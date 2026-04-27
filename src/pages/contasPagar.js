// ============================================================
// PÁGINA: CONTAS A PAGAR
// ============================================================

import { renderKPIGrid } from '../components/kpiCard.js';
import { renderDataTable, initTableInteractions } from '../components/dataTable.js';
import { renderFilterBar, initFilterBar, buildSelectOptions } from '../components/filterBar.js';
import { createBarChart, createDoughnutChart, createLineChart, createHorizontalBarChart, destroyAllCharts } from '../components/chartHelpers.js';
import {
  getContasPagarComStatus, filtrarContasPagar, formatarMoeda, formatarData, formatarPct,
  agruparPor, agruparPorMes, baseContasPagar, getTopFornecedores, calcularAgingPagar,
  getAgingMedio, getPrazoMedio,
  getCompetencias, getFornecedores, getCategoriasPagar,
} from '../data/businessLogic.js';

let currentFilters = {};

function buildContent(filtros = {}) {
  const contas = filtros && Object.keys(filtros).length > 0 ? filtrarContasPagar(filtros) : getContasPagarComStatus();
  const total = contas.reduce((s, c) => s + c.valor_pagar, 0);
  const totalPago = contas.reduce((s, c) => s + (c.valor_pago || 0), 0);
  const totalAberto = total - totalPago;
  const vencidos = contas.filter(c => c.status === 'Vencido');
  const totalVencido = vencidos.reduce((s, c) => s + c.aberto, 0);
  const pctPago = total > 0 ? (totalPago / total) * 100 : 0;
  const agingMedio = getAgingMedio(baseContasPagar, 'data_vencimento', 'valor_pagar', 'valor_pago');
  const prazoMedio = getPrazoMedio(contas, 'data_vencimento');

  const kpiCards = [
    { label: 'Total a Pagar', value: total, color: 'red', icon: 'money', sub: `${contas.length} documentos` },
    { label: 'Total Pago', value: totalPago, color: 'emerald', icon: 'check', sub: formatarPct(pctPago) },
    { label: 'Total em Aberto', value: totalAberto, color: 'amber', icon: 'clock', sub: `${contas.filter(c => c.aberto > 0).length} títulos` },
    { label: 'Total Vencido', value: totalVencido, color: 'red', icon: 'alert', sub: `${vencidos.length} documentos` },
    { label: '% Pago', value: formatarPct(pctPago), color: 'cyan', icon: 'percent', isCurrency: false, sub: 'do total' },
    { label: 'Aging Médio', value: `${agingMedio} dias`, color: 'amber', icon: 'calendar', isCurrency: false, sub: 'vencidos em aberto' },
    { label: 'Prazo Médio', value: `${prazoMedio} dias`, color: 'blue', icon: 'calendar', isCurrency: false, sub: 'até vencimento' },
  ];

  const badgeStatus = (s) => `<span class="badge ${s === 'Vencido' ? 'badge-vencido' : s === 'Pago' ? 'badge-ok' : 'badge-avencer'}">${s}</span>`;

  const columns = [
    { key: 'beneficiario', label: 'Fornecedor' },
    { key: 'documento', label: 'Documento' },
    { key: 'categoria', label: 'Categoria' },
    { key: 'data_vencimento', label: 'Vencimento', render: r => formatarData(r.data_vencimento) },
    { key: 'valor_pagar', label: 'Valor', render: r => `<span class="td-value">${formatarMoeda(r.valor_pagar)}</span>`, className: 'text-right' },
    { key: 'valor_pago', label: 'Pago', render: r => `<span class="td-value text-emerald">${formatarMoeda(r.valor_pago || 0)}</span>`, className: 'text-right' },
    { key: 'status', label: 'Status', render: r => badgeStatus(r.status) },
    { key: 'competencia', label: 'Competência' },
  ];

  return { kpiCards, contas, columns };
}

export function render() {
  const filters = [
    { type: 'select', id: 'f-cp-comp', key: 'competencia', label: 'Competência', options: buildSelectOptions(getCompetencias()) },
    { type: 'select', id: 'f-cp-forn', key: 'fornecedor', label: 'Fornecedor', options: buildSelectOptions(getFornecedores()) },
    { type: 'select', id: 'f-cp-cat', key: 'categoria', label: 'Categoria', options: buildSelectOptions(getCategoriasPagar()) },
    { type: 'select', id: 'f-cp-st', key: 'status', label: 'Status', options: [{ value: 'Vencido', label: 'Vencido' }, { value: 'A vencer', label: 'A vencer' }, { value: 'Pago', label: 'Pago' }] },
  ];

  const { kpiCards, contas, columns } = buildContent();

  return `
    <div class="page-enter">
      ${renderFilterBar({ id: 'filter-cp', filters })}
      <div id="cp-content">
        ${renderKPIGrid(kpiCards)}
        <div class="charts-grid mb-6">
          <div class="chart-card"><div class="chart-card-title"><span class="dot emerald"></span>Pago × Em Aberto</div><div class="chart-container"><canvas id="chart-cp-pago-ab"></canvas></div></div>
          <div class="chart-card"><div class="chart-card-title"><span class="dot amber"></span>Top 10 Maiores Fornecedores</div><div class="chart-container"><canvas id="chart-cp-top"></canvas></div></div>
          <div class="chart-card"><div class="chart-card-title"><span class="dot blue"></span>Por Categoria</div><div class="chart-container"><canvas id="chart-cp-categoria"></canvas></div></div>
          <div class="chart-card"><div class="chart-card-title"><span class="dot red"></span>Aging</div><div class="chart-container"><canvas id="chart-cp-aging"></canvas></div></div>
        </div>
        <div class="section-title">Detalhamento Completo</div>
        ${renderDataTable({ id: 'table-pagar', title: 'Contas a Pagar — Detalhado', columns, rows: contas })}
      </div>
    </div>
  `;
}

export function init() {
  destroyAllCharts();
  const contas = getContasPagarComStatus();
  const totalPago = contas.reduce((s, c) => s + (c.valor_pago || 0), 0);
  const totalAberto = contas.reduce((s, c) => s + c.aberto, 0);

  createDoughnutChart('chart-cp-pago-ab', {
    labels: ['Pago', 'Em Aberto'],
    data: [totalPago, totalAberto],
    colors: ['#10b981', '#f59e0b'],
  });

  // Top 10 Fornecedores (Horizontal Bar Chart)
  const topFornecedores = getTopFornecedores(10);
  createHorizontalBarChart('chart-cp-top', {
    labels: topFornecedores.map(f => f.fornecedor),
    datasets: [{
      label: 'Valor a Pagar',
      data: topFornecedores.map(f => f.total),
      backgroundColor: topFornecedores.map((_, i) => i < 3 ? '#f59e0b' : '#334155'), // Amber for top 3
      borderRadius: 4
    }]
  });

  const porCat = agruparPor(baseContasPagar, 'categoria');
  const catLabels = Object.keys(porCat).sort((a, b) => porCat[b].total - porCat[a].total);
  createDoughnutChart('chart-cp-categoria', {
    labels: catLabels,
    data: catLabels.map(l => porCat[l].total),
  });

  const aging = calcularAgingPagar();
  createBarChart('chart-cp-aging', {
    labels: Object.keys(aging),
    datasets: [{ label: 'Valor', data: Object.values(aging), color: '#ef4444' }],
  });

  initTableInteractions('table-pagar');
  initFilterBar('filter-cp', (filtros) => {
    currentFilters = filtros;
    const content = document.getElementById('cp-content');
    if (content) {
      const { kpiCards } = buildContent(filtros);
      const kpiEl = content.querySelector('.kpi-grid');
      if (kpiEl) kpiEl.outerHTML = renderKPIGrid(kpiCards);
    }
  });
}
