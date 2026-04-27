// ============================================================
// PÁGINA: A FATURAR (Pipeline + Conciliação)
// Paginação controlada: filtros → dados filtrados → slice por página
// ============================================================

import { renderKPIGrid } from '../components/kpiCard.js';
import { renderFilterBar, initFilterBar, buildSelectOptions } from '../components/filterBar.js';
import { createDoughnutChart, createBarChart, createLineChart, createHorizontalBarChart, destroyAllCharts } from '../components/chartHelpers.js';
import {
  reconciliarDados, calcularKPIs, formatarMoeda, formatarData, formatarPct,
  agruparPor, agruparPorMes, baseFaturamento, getTopClientesFaturar,
  getCompetencias, getClientes, getCategorias, totalRegistrosBrutos,
} from '../data/businessLogic.js';

// ---------- ESTADO DA PÁGINA ----------
let currentFilters = {};
let currentPage = 1;
let currentSearch = '';
let currentSortKey = '';
let currentSortAsc = true;
const PAGE_SIZE = 15;

// Armazena os dados completos filtrados (sem paginação)
let allFilteredData = [];
let allFilteredColumns = [];

// ---------- HELPERS ----------

const badgeConciliacao = (s) => `<span class="badge ${s === 'OK' ? 'badge-ok' : s === 'Pendente' ? 'badge-pendente' : 'badge-divergente'}">${s}</span>`;
const badgeFat = (s) => `<span class="badge ${s === 'FECHADA' || s === 'Fechada' ? 'badge-fechada' : 'badge-confirmada'}">${s}</span>`;

function getColumns() {
  return [
    { key: 'reserva', label: 'Reserva' },
    { key: 'cliente', label: 'Cliente' },
    { key: 'categoria', label: 'Categoria' },
    { key: 'valor_total', label: 'Valor', render: r => `<span class="td-value">${formatarMoeda(r.valor_total)}</span>`, className: 'text-right' },
    { key: 'data_emissao', label: 'Emissão', render: r => formatarData(r.data_emissao) },
    { key: 'competencia', label: 'Competência' },
    { key: 'status_faturamento', label: 'Faturamento', render: r => badgeFat(r.status_faturamento) },
    { key: 'status_conciliacao', label: 'Conciliação', render: r => badgeConciliacao(r.status_conciliacao) },
    { key: 'documento', label: 'Documento', render: r => r.documento || '<span class="text-muted">—</span>' },
  ];
}

// ---------- PAGINAÇÃO CONTROLADA ----------

function applySearch(data, query) {
  if (!query) return data;
  const q = query.toLowerCase();
  return data.filter(row => {
    return (row.reserva || '').toLowerCase().includes(q)
      || (row.cliente || '').toLowerCase().includes(q)
      || (row.categoria || '').toLowerCase().includes(q)
      || (row.documento || '').toLowerCase().includes(q)
      || (row.status_faturamento || '').toLowerCase().includes(q)
      || (row.status_conciliacao || '').toLowerCase().includes(q);
  });
}

function applySort() {
  if (!currentSortKey) return;
  allFilteredData.sort((a, b) => {
    let aVal = a[currentSortKey];
    let bVal = b[currentSortKey];
    
    if (aVal === null || aVal === undefined) aVal = '';
    if (bVal === null || bVal === undefined) bVal = '';

    const aNum = Number(aVal);
    const bNum = Number(bVal);
    
    if (!isNaN(aNum) && !isNaN(bNum) && aVal !== '' && bVal !== '') {
      return currentSortAsc ? aNum - bNum : bNum - aNum;
    }

    aVal = String(aVal);
    bVal = String(bVal);
    return currentSortAsc ? aVal.localeCompare(bVal, 'pt-BR') : bVal.localeCompare(aVal, 'pt-BR');
  });
}

function getPageData() {
  // 1. Aplicar busca textual sobre os dados já filtrados pelo filtro de negócio
  const searchFiltered = applySearch(allFilteredData, currentSearch);
  const totalRecords = searchFiltered.length;
  const totalPages = Math.max(1, Math.ceil(totalRecords / PAGE_SIZE));

  // Garantir que a página atual é válida
  if (currentPage > totalPages) currentPage = totalPages;
  if (currentPage < 1) currentPage = 1;

  // 2. Fatiar (slice) para a página atual
  const start = (currentPage - 1) * PAGE_SIZE;
  const end = start + PAGE_SIZE;
  const pageRows = searchFiltered.slice(start, end);

  return { pageRows, totalRecords, totalPages, currentPage };
}

function renderTableHTML(columns, pageRows, totalRecords, totalPages, currentPage) {
  const thHtml = columns.map((col, i) => {
    const isSorted = currentSortKey === col.key;
    const sortAttr = isSorted ? (currentSortAsc ? 'asc' : 'desc') : '';
    const sortedClass = isSorted ? 'sorted' : '';
    return `<th data-col="${i}" data-sort-key="${col.key}" data-sort="${sortAttr}" class="sortable ${sortedClass}">${col.label} <span class="sort-icon">↕</span></th>`;
  }).join('');

  const trHtml = pageRows.map(row => {
    const cells = columns.map(col => {
      const val = col.render ? col.render(row) : (row[col.key] ?? '—');
      const cls = col.className || '';
      return `<td class="${cls}">${val}</td>`;
    }).join('');
    return `<tr>${cells}</tr>`;
  }).join('');

  const prevDisabled = currentPage <= 1 ? 'disabled' : '';
  const nextDisabled = currentPage >= totalPages ? 'disabled' : '';

  return `
    <div class="table-card" id="table-faturar">
      <div class="table-header">
        <div class="table-header-left">
          <span class="table-header-title">Pipeline de Faturamento — Conciliação</span>
          <span class="table-count" id="af-table-count">${totalRecords} registros</span>
        </div>
        <div class="table-header-actions">
          <input type="text" class="table-search" id="af-table-search" placeholder="Buscar..." value="${currentSearch}" />
        </div>
      </div>
      <div class="table-wrapper">
        <table class="data-table">
          <thead><tr>${thHtml}</tr></thead>
          <tbody>${trHtml}</tbody>
        </table>
      </div>
      <div class="table-pagination">
        <button class="btn btn-outline btn-sm" id="af-page-prev" ${prevDisabled}>← Anterior</button>
        <span class="pagination-info" id="af-page-info">Página ${currentPage} de ${totalPages}</span>
        <button class="btn btn-outline btn-sm" id="af-page-next" ${nextDisabled}>Próxima →</button>
      </div>
    </div>
  `;
}

// Atualiza APENAS a tabela (sem reconstruir KPIs ou charts)
function refreshTable() {
  const columns = getColumns();
  const { pageRows, totalRecords, totalPages } = getPageData();

  const tableContainer = document.getElementById('af-table-container');
  if (!tableContainer) return;

  tableContainer.innerHTML = renderTableHTML(columns, pageRows, totalRecords, totalPages, currentPage);
  bindTableEvents();
}

function bindTableEvents() {
  // Busca textual
  const searchInput = document.getElementById('af-table-search');
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      currentSearch = searchInput.value.trim();
      currentPage = 1; // Reset para página 1 ao buscar
      refreshTable();
      // Manter o foco no input de busca
      const newInput = document.getElementById('af-table-search');
      if (newInput) {
        newInput.focus();
        newInput.setSelectionRange(newInput.value.length, newInput.value.length);
      }
    });
  }

  // Botões de paginação
  const prevBtn = document.getElementById('af-page-prev');
  const nextBtn = document.getElementById('af-page-next');
  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      if (currentPage > 1) { currentPage--; refreshTable(); }
    });
  }
  if (nextBtn) {
    const { totalPages } = getPageData();
    nextBtn.addEventListener('click', () => {
      if (currentPage < totalPages) { currentPage++; refreshTable(); }
    });
  }

  // Ordenação nas colunas
  const ths = document.querySelectorAll('#table-faturar th.sortable');
  ths.forEach(th => {
    th.addEventListener('click', () => {
      const key = th.dataset.sortKey;
      if (currentSortKey === key) {
        currentSortAsc = !currentSortAsc;
      } else {
        currentSortKey = key;
        currentSortAsc = true;
      }
      
      applySort();
      currentPage = 1;
      refreshTable();
    });
  });
}

// ---------- CHARTS ----------

function renderCharts() {
  destroyAllCharts();
  const conciliados = allFilteredData;
  const kpis = calcularKPIs(currentFilters);

  const fatMensal = agruparPorMes(conciliados, 'data_emissao', 'valor_total');
  createLineChart('chart-af-evolucao', {
    labels: fatMensal.map(m => m.label),
    datasets: [{ label: 'A Faturar', data: fatMensal.map(m => m.valor), color: '#6366f1' }],
  });

  createDoughnutChart('chart-af-fat-pend', {
    labels: ['Faturado', 'Pendente', 'Divergente'],
    data: [kpis.faturadoPeriodo, kpis.pendenteFaturamento, kpis.totalFaturamento - kpis.faturadoPeriodo - kpis.pendenteFaturamento],
    colors: ['#10b981', '#f59e0b', '#ef4444'],
  });

  const porCat = agruparPor(conciliados, 'categoria');
  const catLabels = Object.keys(porCat).sort((a, b) => porCat[b].total - porCat[a].total).slice(0, 5);
  createBarChart('chart-af-categoria', {
    labels: catLabels,
    datasets: [{ label: 'Valor por Categoria', data: catLabels.map(l => porCat[l].total), color: '#3b82f6' }],
  });

  const topClientes = getTopClientesFaturar(10, currentFilters);
  createHorizontalBarChart('chart-af-top', {
    labels: topClientes.map(c => c.cliente),
    datasets: [{
      label: 'Valor a Faturar',
      data: topClientes.map(c => c.total),
      backgroundColor: topClientes.map((_, i) => i < 3 ? '#6366f1' : '#334155'),
      borderRadius: 4
    }]
  });
}

// ---------- RENDERIZAÇÃO COMPLETA ----------

function rebuildContent(filtros = {}) {
  // 1. Filtrar dados e manter ordenação
  allFilteredData = reconciliarDados(filtros);
  applySort();
  const kpis = calcularKPIs(filtros);

  const kpiCards = [
    { label: 'Total Geral', value: kpis.totalFaturamento, color: 'indigo', icon: 'file', sub: `${allFilteredData.length} operações` },
    { label: 'Faturado (Fechada)', value: kpis.faturadoPeriodo, color: 'emerald', icon: 'check', sub: `${kpis.qtdFaturado} fechadas` },
    { label: 'A Faturar (Confirmada)', value: kpis.pendenteFaturamento, color: 'amber', icon: 'clock', sub: `${kpis.qtdPendente} confirmadas` },
    { label: 'Taxa de Conversão', value: formatarPct(kpis.taxaConversao), color: 'blue', icon: 'percent', isCurrency: false, sub: 'Fechada / Total' },
    { label: 'Ticket Médio', value: kpis.ticketMedio, color: 'cyan', icon: 'target', sub: 'Valor médio por reserva' },
    { label: 'Qtd. Reservas', value: totalRegistrosBrutos, color: 'indigo', icon: 'users', isCurrency: false, sub: `${kpis.qtdDivergente} divergentes` },
  ];

  // 2. Paginação: dados filtrados → slice da página atual
  const columns = getColumns();
  const { pageRows, totalRecords, totalPages } = getPageData();

  const content = document.getElementById('af-content');
  if (!content) return;

  content.innerHTML = `
    ${renderKPIGrid(kpiCards)}
    <div class="charts-grid mb-6">
      <div class="chart-card"><div class="chart-card-title"><span class="dot indigo"></span>Evolução Mensal do Faturamento</div><div class="chart-container"><canvas id="chart-af-evolucao"></canvas></div></div>
      <div class="chart-card"><div class="chart-card-title"><span class="dot emerald"></span>Faturado × Pendente</div><div class="chart-container"><canvas id="chart-af-fat-pend"></canvas></div></div>
      <div class="chart-card"><div class="chart-card-title"><span class="dot amber"></span>Análise por Categoria</div><div class="chart-container"><canvas id="chart-af-categoria"></canvas></div></div>
      <div class="chart-card"><div class="chart-card-title"><span class="dot blue"></span>Top 10 Clientes a Faturar</div><div class="chart-container"><canvas id="chart-af-top"></canvas></div></div>
    </div>
    <div class="section-title">Detalhamento Completo</div>
    <div id="af-table-container">
      ${renderTableHTML(columns, pageRows, totalRecords, totalPages, currentPage)}
    </div>
  `;

  // 3. Bindings
  renderCharts();
  bindTableEvents();
}

// ---------- EXPORTS ----------

export function render() {
  const filters = [
    { type: 'select', id: 'f-af-comp', key: 'competencia', label: 'Competência', options: buildSelectOptions(getCompetencias()) },
    { type: 'select', id: 'f-af-cli', key: 'cliente', label: 'Cliente', options: buildSelectOptions(getClientes()) },
    { type: 'select', id: 'f-af-cat', key: 'categoria', label: 'Categoria', options: buildSelectOptions(getCategorias()) },
    { type: 'select', id: 'f-af-st', key: 'status', label: 'Status', options: [{ value: 'FECHADA', label: 'Fechada' }, { value: 'CONFIRMADA', label: 'Confirmada' }] },
  ];

  // Carregar dados iniciais e aplicar ordenação inicial (se houver)
  allFilteredData = reconciliarDados({});
  applySort();
  const kpis = calcularKPIs({});
  const columns = getColumns();
  const { pageRows, totalRecords, totalPages } = getPageData();

  const kpiCards = [
    { label: 'Total Geral', value: kpis.totalFaturamento, color: 'indigo', icon: 'file', sub: `${allFilteredData.length} operações` },
    { label: 'Faturado (Fechada)', value: kpis.faturadoPeriodo, color: 'emerald', icon: 'check', sub: `${kpis.qtdFaturado} fechadas` },
    { label: 'A Faturar (Confirmada)', value: kpis.pendenteFaturamento, color: 'amber', icon: 'clock', sub: `${kpis.qtdPendente} confirmadas` },
    { label: 'Taxa de Conversão', value: formatarPct(kpis.taxaConversao), color: 'blue', icon: 'percent', isCurrency: false, sub: 'Fechada / Total' },
    { label: 'Ticket Médio', value: kpis.ticketMedio, color: 'cyan', icon: 'target', sub: 'Valor médio por reserva' },
    { label: 'Qtd. Reservas', value: totalRegistrosBrutos, color: 'indigo', icon: 'users', isCurrency: false, sub: `${kpis.qtdDivergente} divergentes` },
  ];

  return `
    <div class="page-enter">
      ${renderFilterBar({ id: 'filter-af', filters })}
      <div id="af-content">
        ${renderKPIGrid(kpiCards)}
        <div class="charts-grid mb-6">
          <div class="chart-card"><div class="chart-card-title"><span class="dot indigo"></span>Evolução Mensal do Faturamento</div><div class="chart-container"><canvas id="chart-af-evolucao"></canvas></div></div>
          <div class="chart-card"><div class="chart-card-title"><span class="dot emerald"></span>Faturado × Pendente</div><div class="chart-container"><canvas id="chart-af-fat-pend"></canvas></div></div>
          <div class="chart-card"><div class="chart-card-title"><span class="dot amber"></span>Análise por Categoria</div><div class="chart-container"><canvas id="chart-af-categoria"></canvas></div></div>
          <div class="chart-card"><div class="chart-card-title"><span class="dot blue"></span>Top 10 Clientes a Faturar</div><div class="chart-container"><canvas id="chart-af-top"></canvas></div></div>
        </div>
        <div class="section-title">Detalhamento Completo</div>
        <div id="af-table-container">
          ${renderTableHTML(columns, pageRows, totalRecords, totalPages, currentPage)}
        </div>
      </div>
    </div>
  `;
}

export function init() {
  // Renderizar charts
  renderCharts();
  bindTableEvents();

  // Registrar filtros UMA ÚNICA VEZ
  initFilterBar('filter-af', (filtros) => {
    currentFilters = filtros;
    currentPage = 1;      // Reset para página 1 ao filtrar
    currentSearch = '';    // Limpar busca textual ao filtrar
    rebuildContent(filtros);
  });
}
