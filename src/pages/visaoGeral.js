// ============================================================
// PÁGINA: VISÃO GERAL EXECUTIVA
// ============================================================

import { renderKPIGrid } from '../components/kpiCard.js';
import { renderDataTable, initTableInteractions } from '../components/dataTable.js';
import { renderFilterBar, initFilterBar, buildSelectOptions } from '../components/filterBar.js';
import { createBarChart, createDoughnutChart, createLineChart, destroyAllCharts } from '../components/chartHelpers.js';
import {
  calcularKPIs, calcularFluxoCaixa, reconciliarDados, getDestaquesExecutivos,
  formatarMoeda, formatarData, formatarPct,
  agruparPorMes, baseFaturamento, baseContasReceber, baseContasPagar,
  getCompetencias, getClientes, getFornecedores, getCategorias,
} from '../data/businessLogic.js';

let currentFilters = {};

function buildPage(filtros = {}) {
  const kpis = calcularKPIs(filtros);
  const destaques = getDestaquesExecutivos();
  const fluxo = calcularFluxoCaixa();

  const kpiCards = [
    { label: 'Total a Faturar', value: kpis.totalFaturamento, color: 'indigo', icon: 'file', sub: `${kpis.qtdOK + kpis.qtdPendente + kpis.qtdDivergente} operações` },
    { label: 'Total a Receber', value: kpis.totalReceber, color: 'emerald', icon: 'down', sub: `${formatarMoeda(kpis.totalRecebido)} recebido` },
    { label: 'Total a Pagar', value: kpis.totalPagar, color: 'red', icon: 'up', sub: `${formatarMoeda(kpis.totalPago)} pago` },
    { label: 'Total Recebido', value: kpis.totalRecebido, color: 'cyan', icon: 'check', sub: formatarPct(kpis.pctRecebido) + ' da carteira' },
    { label: 'Total em Aberto', value: kpis.totalEmAbertoReceber + kpis.totalEmAbertoPagar, color: 'amber', icon: 'clock', sub: 'Receber + Pagar' },
    { label: 'Saldo Projetado', value: kpis.saldoProjetado, color: kpis.saldoProjetado >= 0 ? 'blue' : 'red', icon: 'balance', sub: 'Receber − Pagar' },
  ];

  const tabelaResumo = fluxo.map(f => ({
    periodo: f.label, entradas: f.entradas, saidas: f.saidas, saldo: f.saldoMes, acumulado: f.saldoAcumulado,
  }));

  const tableColumns = [
    { key: 'periodo', label: 'Período' },
    { key: 'entradas', label: 'Entradas', render: r => `<span class="td-value text-emerald">${formatarMoeda(r.entradas)}</span>`, className: 'text-right' },
    { key: 'saidas', label: 'Saídas', render: r => `<span class="td-value text-red">${formatarMoeda(r.saidas)}</span>`, className: 'text-right' },
    { key: 'saldo', label: 'Saldo Mês', render: r => `<span class="td-value ${r.saldo >= 0 ? 'text-emerald' : 'text-red'}">${formatarMoeda(r.saldo)}</span>`, className: 'text-right' },
    { key: 'acumulado', label: 'Acumulado', render: r => `<span class="td-value ${r.acumulado >= 0 ? 'text-blue' : 'text-red'}">${formatarMoeda(r.acumulado)}</span>`, className: 'text-right' },
  ];

  const destaquesHtml = `
    <div class="section-title"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent-amber)" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg> Destaques Executivos</div>
    <div class="highlights-grid">
      ${destaques.maiorClienteFaturar ? `<div class="highlight-card"><div class="highlight-label">Maior Cliente a Faturar</div><div class="highlight-value">${destaques.maiorClienteFaturar.cliente}</div><div class="highlight-sub">${formatarMoeda(destaques.maiorClienteFaturar.total)}</div></div>` : ''}
      ${destaques.maiorDevedor ? `<div class="highlight-card highlight-warning"><div class="highlight-label">Maior Devedor</div><div class="highlight-value">${destaques.maiorDevedor.cliente}</div><div class="highlight-sub">${formatarMoeda(destaques.maiorDevedor.aberto)} em aberto</div></div>` : ''}
      ${destaques.maiorFornecedor ? `<div class="highlight-card"><div class="highlight-label">Maior Fornecedor</div><div class="highlight-value">${destaques.maiorFornecedor.fornecedor}</div><div class="highlight-sub">${formatarMoeda(destaques.maiorFornecedor.total)}</div></div>` : ''}
      <div class="highlight-card highlight-danger"><div class="highlight-label">Total Vencido a Receber</div><div class="highlight-value">${formatarMoeda(destaques.totalVencidoReceber)}</div><div class="highlight-sub">${kpis.qtdVencidosReceber} documentos</div></div>
      <div class="highlight-card highlight-danger"><div class="highlight-label">Total Vencido a Pagar</div><div class="highlight-value">${formatarMoeda(destaques.totalVencidoPagar)}</div><div class="highlight-sub">${kpis.qtdVencidosPagar} documentos</div></div>
    </div>
  `;

  return { kpiCards, tabelaResumo, tableColumns, destaquesHtml };
}

export function render() {
  const filters = [
    { type: 'select', id: 'f-vg-comp', key: 'competencia', label: 'Competência', options: buildSelectOptions(getCompetencias()) },
    { type: 'select', id: 'f-vg-cat', key: 'categoria', label: 'Categoria', options: buildSelectOptions(getCategorias()) },
    { type: 'select', id: 'f-vg-cli', key: 'cliente', label: 'Cliente', options: buildSelectOptions(getClientes()) },
    { type: 'select', id: 'f-vg-forn', key: 'fornecedor', label: 'Fornecedor', options: buildSelectOptions(getFornecedores()) },
  ];

  const { kpiCards, tabelaResumo, tableColumns, destaquesHtml } = buildPage();

  return `
    <div class="page-enter">
      ${renderFilterBar({ id: 'filter-vg', filters })}
      <div id="vg-content">
        ${renderKPIGrid(kpiCards)}
        ${destaquesHtml}
        <div class="charts-grid">
          <div class="chart-card"><div class="chart-card-title"><span class="dot emerald"></span>Faturado × Recebido × Pago</div><div class="chart-container"><canvas id="chart-fat-rec-pago"></canvas></div></div>
          <div class="chart-card"><div class="chart-card-title"><span class="dot indigo"></span>Evolução por Competência</div><div class="chart-container"><canvas id="chart-evolucao-comp"></canvas></div></div>
          <div class="chart-card"><div class="chart-card-title"><span class="dot amber"></span>Conciliação — Status</div><div class="chart-container"><canvas id="chart-conciliacao"></canvas></div></div>
          <div class="chart-card"><div class="chart-card-title"><span class="dot blue"></span>Entradas vs Saídas</div><div class="chart-container"><canvas id="chart-entradas-saidas"></canvas></div></div>
        </div>
        <div class="section-title">Resumo Consolidado por Período</div>
        ${renderDataTable({ id: 'table-resumo', title: 'Fluxo Mensal', columns: tableColumns, rows: tabelaResumo, searchable: false, paginated: false })}
      </div>
    </div>
  `;
}

function initCharts() {
  destroyAllCharts();
  const fluxo = calcularFluxoCaixa();
  const kpis = calcularKPIs(currentFilters);

  createBarChart('chart-entradas-saidas', {
    labels: fluxo.map(f => f.label),
    datasets: [
      { label: 'Entradas', data: fluxo.map(f => f.entradas), color: '#10b981' },
      { label: 'Saídas', data: fluxo.map(f => f.saidas), color: '#ef4444' },
    ],
  });

  const fatMensal = agruparPorMes(baseFaturamento, 'data_emissao', 'valor_total');
  const recMensal = agruparPorMes(baseContasReceber, 'data_vencimento', 'valor_receber');
  const allLabels = [...new Set([...fatMensal.map(m => m.label), ...recMensal.map(m => m.label)])].sort();

  createBarChart('chart-fat-rec-pago', {
    labels: allLabels,
    datasets: [
      { label: 'Faturado', data: allLabels.map(l => { const m = fatMensal.find(x => x.label === l); return m ? m.valor : 0; }), color: '#6366f1' },
      { label: 'A Receber', data: allLabels.map(l => { const m = recMensal.find(x => x.label === l); return m ? m.valor : 0; }), color: '#10b981' },
    ],
  });

  createLineChart('chart-evolucao-comp', {
    labels: fatMensal.map(m => m.label),
    datasets: [{ label: 'Faturamento', data: fatMensal.map(m => m.valor), color: '#6366f1' }],
  });

  createDoughnutChart('chart-conciliacao', {
    labels: ['OK', 'Pendente', 'Divergente'],
    data: [kpis.qtdOK, kpis.qtdPendente, kpis.qtdDivergente],
    colors: ['#10b981', '#f59e0b', '#ef4444'],
  });
}

export function init() {
  initCharts();
  initTableInteractions('table-resumo');
  initFilterBar('filter-vg', (filtros) => {
    currentFilters = filtros;
    const content = document.getElementById('vg-content');
    if (content) {
      const { kpiCards, tabelaResumo, tableColumns, destaquesHtml } = buildPage(filtros);
      // Re-render KPIs and highlights
      const kpiEl = content.querySelector('.kpi-grid');
      if (kpiEl) kpiEl.outerHTML = renderKPIGrid(kpiCards);
      initCharts();
    }
  });
}
