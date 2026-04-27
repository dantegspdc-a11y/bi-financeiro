// ============================================================
// PÁGINA: CONTAS A RECEBER
// ============================================================

import { renderKPIGrid } from '../components/kpiCard.js';
import { renderDataTable, initTableInteractions } from '../components/dataTable.js';
import { renderFilterBar, initFilterBar, buildSelectOptions } from '../components/filterBar.js';
import { createBarChart, createDoughnutChart, createLineChart, createHorizontalBarChart, destroyAllCharts } from '../components/chartHelpers.js';
import {
  getContasReceberComStatus, filtrarContasReceber, formatarMoeda, formatarData, formatarPct,
  agruparPor, agruparPorMes, baseContasReceber, baseFaturamento, getTopDevedores, calcularAgingReceber,
  getAgingMedio, getPrazoMedio,
  getCompetencias, getClientes, getCategorias, fatMap,
} from '../data/businessLogic.js';

let currentFilters = {};

function getEnrichedContas(filtros = {}) {
  const rawContas = filtros && Object.keys(filtros).length > 0 ? filtrarContasReceber(filtros) : getContasReceberComStatus();
  
  const faturamentoMap = fatMap;

  return rawContas.map(c => {
    const reservaKey = String(c.reserva);
    const venda = faturamentoMap.get(reservaKey);

    if (venda) {
      return {
        ...c,
        cliente: venda.cliente,
        categoria: venda.centro_custo || venda.categoria || c.categoria,
        emissor: venda.emissor,
        valor_venda: venda.valor_total
      };
    } else {
      return {
        ...c,
        cliente: '<span class="text-muted">Reserva não localizada</span>',
      };
    }
  });
}

function buildContent(filtros = {}) {
  const contas = getEnrichedContas(filtros);
  const total = contas.reduce((s, c) => s + c.valor_receber, 0);
  const totalRecebido = contas.reduce((s, c) => s + (c.valor_pago || 0), 0);
  const totalAberto = total - totalRecebido;
  const vencidos = contas.filter(c => c.status === 'Vencido');
  const totalVencido = vencidos.reduce((s, c) => s + c.aberto, 0);
  const pctRecebido = total > 0 ? (totalRecebido / total) * 100 : 0;
  const agingMedio = getAgingMedio(contas, 'data_vencimento', 'valor_receber', 'valor_pago');
  const prazoMedio = getPrazoMedio(contas, 'data_vencimento');

  const kpiCards = [
    { label: 'Total Carteira', value: total, color: 'indigo', icon: 'money', sub: `${contas.length} documentos` },
    { label: 'Total Recebido', value: totalRecebido, color: 'emerald', icon: 'check', sub: formatarPct(pctRecebido) },
    { label: 'Total em Aberto', value: totalAberto, color: 'amber', icon: 'clock', sub: `${contas.filter(c => c.aberto > 0).length} títulos` },
    { label: 'Total Vencido', value: totalVencido, color: 'red', icon: 'alert', sub: `${vencidos.length} documentos` },
    { label: '% Recebido', value: formatarPct(pctRecebido), color: 'cyan', icon: 'percent', isCurrency: false, sub: 'da carteira total' },
    { label: 'Aging Médio', value: `${agingMedio} dias`, color: 'amber', icon: 'calendar', isCurrency: false, sub: 'vencidos em aberto' },
    { label: 'Prazo Médio', value: `${prazoMedio} dias`, color: 'blue', icon: 'calendar', isCurrency: false, sub: 'até vencimento' },
  ];

  const badgeStatus = (s) => `<span class="badge ${s === 'Vencido' ? 'badge-vencido' : s === 'Recebido' ? 'badge-ok' : 'badge-avencer'}">${s}</span>`;

  const columns = [
    { key: 'cliente', label: 'Cliente' },
    { key: 'reserva', label: 'Reserva' },
    { key: 'documento', label: 'Documento' },
    { key: 'categoria', label: 'Categoria' },
    { key: 'data_vencimento', label: 'Vencimento', render: r => formatarData(r.data_vencimento) },
    { key: 'valor_receber', label: 'Valor', render: r => `<span class="td-value">${formatarMoeda(r.valor_receber)}</span>`, className: 'text-right' },
    { key: 'valor_pago', label: 'Pago', render: r => `<span class="td-value text-emerald">${formatarMoeda(r.valor_pago || 0)}</span>`, className: 'text-right' },
    { key: 'status', label: 'Status', render: r => badgeStatus(r.status) },
    { key: 'competencia', label: 'Competência' },
  ];

  return { kpiCards, contas, columns };
}

export function render() {
  const filters = [
    { type: 'select', id: 'f-cr-comp', key: 'competencia', label: 'Competência', options: buildSelectOptions(getCompetencias()) },
    { type: 'select', id: 'f-cr-cli', key: 'cliente', label: 'Cliente', options: buildSelectOptions(getClientes()) },
    { type: 'select', id: 'f-cr-cat', key: 'categoria', label: 'Categoria', options: buildSelectOptions(getCategorias()) },
    { type: 'select', id: 'f-cr-st', key: 'status', label: 'Status', options: [{ value: 'Vencido', label: 'Vencido' }, { value: 'A vencer', label: 'A vencer' }, { value: 'Recebido', label: 'Recebido' }] },
  ];

  const { kpiCards, contas, columns } = buildContent();

  return `
    <div class="page-enter">
      ${renderFilterBar({ id: 'filter-cr', filters })}
      <div id="cr-content">
        ${renderKPIGrid(kpiCards)}
        <div class="charts-grid mb-6">
          <div class="chart-card"><div class="chart-card-title"><span class="dot emerald"></span>Recebido × Em Aberto</div><div class="chart-container"><canvas id="chart-cr-rec-ab"></canvas></div></div>
          <div class="chart-card"><div class="chart-card-title"><span class="dot red"></span>Top 10 Maiores Devedores</div><div class="chart-container"><canvas id="chart-cr-top"></canvas></div></div>
          <div class="chart-card"><div class="chart-card-title"><span class="dot amber"></span>Carteira por Categoria</div><div class="chart-container"><canvas id="chart-cr-categoria"></canvas></div></div>
          <div class="chart-card"><div class="chart-card-title"><span class="dot red"></span>Aging por Faixa</div><div class="chart-container"><canvas id="chart-cr-aging"></canvas></div></div>
        </div>
        <div class="section-title">Detalhamento Completo</div>
        ${renderDataTable({ id: 'table-receber', title: 'Contas a Receber — Detalhado', columns, rows: contas })}
      </div>
    </div>
  `;
}

export function init() {
  destroyAllCharts();
  const contas = getEnrichedContas(currentFilters);
  const totalRecebido = contas.reduce((s, c) => s + (c.valor_pago || 0), 0);
  const totalAberto = contas.reduce((s, c) => s + c.aberto, 0);

  createDoughnutChart('chart-cr-rec-ab', {
    labels: ['Recebido', 'Em Aberto'],
    data: [totalRecebido, totalAberto],
    colors: ['#10b981', '#f59e0b'],
  });

  // Top 10 Devedores usando o cliente enriquecido
  const gruposDevedores = {};
  contas.forEach(c => {
    if (c.aberto > 0) {
      const clienteNome = c.cliente.includes('Reserva não localizada') ? 'Reserva não localizada' : c.cliente;
      if (!gruposDevedores[clienteNome]) gruposDevedores[clienteNome] = 0;
      gruposDevedores[clienteNome] += c.aberto;
    }
  });
  const topDevedores = Object.entries(gruposDevedores)
    .map(([cliente, aberto]) => ({ cliente, aberto }))
    .sort((a, b) => b.aberto - a.aberto)
    .slice(0, 10);

  createHorizontalBarChart('chart-cr-top', {
    labels: topDevedores.map(d => d.cliente),
    datasets: [{
      label: 'Valor em Aberto',
      data: topDevedores.map(d => d.aberto),
      backgroundColor: topDevedores.map((_, i) => i < 3 ? '#ef4444' : '#334155'),
      borderRadius: 4
    }]
  });

  const porCat = agruparPor(contas, 'categoria');
  const catLabels = Object.keys(porCat).sort((a, b) => porCat[b].total - porCat[a].total);
  createDoughnutChart('chart-cr-categoria', {
    labels: catLabels,
    data: catLabels.map(l => porCat[l].total),
    colors: ['#6366f1', '#8b5cf6', '#3b82f6', '#06b6d4', '#10b981'],
  });

  const aging = calcularAgingReceber(); // Este ainda usa baseContasReceber interno, mas os outros já estão ok
  createBarChart('chart-cr-aging', {
    labels: Object.keys(aging),
    datasets: [{ label: 'Valor', data: Object.values(aging), color: '#ef4444' }],
  });

  const { columns, contas: finalRows } = buildContent(currentFilters);
  initTableInteractions('table-receber', columns, finalRows);
  initFilterBar('filter-cr', (filtros) => {
    currentFilters = filtros;
    const content = document.getElementById('cr-content');
    if (content) {
      const { kpiCards, contas, columns } = buildContent(filtros);
      content.innerHTML = `
        ${renderKPIGrid(kpiCards)}
        <div class="charts-grid mb-6">
          <div class="chart-card"><div class="chart-card-title"><span class="dot emerald"></span>Recebido × Em Aberto</div><div class="chart-container"><canvas id="chart-cr-rec-ab"></canvas></div></div>
          <div class="chart-card"><div class="chart-card-title"><span class="dot red"></span>Top 10 Maiores Devedores</div><div class="chart-container"><canvas id="chart-cr-top"></canvas></div></div>
          <div class="chart-card"><div class="chart-card-title"><span class="dot amber"></span>Carteira por Categoria</div><div class="chart-container"><canvas id="chart-cr-categoria"></canvas></div></div>
          <div class="chart-card"><div class="chart-card-title"><span class="dot red"></span>Aging por Faixa</div><div class="chart-container"><canvas id="chart-cr-aging"></canvas></div></div>
        </div>
        <div class="section-title">Detalhamento Completo</div>
        ${renderDataTable({ id: 'table-receber', title: 'Contas a Receber — Detalhado', columns, rows: contas })}
      `;
      initTableInteractions('table-receber', columns, contas);
      init(); // Reinicializa os gráficos
    }
  });
}
