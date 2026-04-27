// ============================================================
// PÁGINA: FLUXO DE CAIXA
// ============================================================

import { renderKPIGrid } from '../components/kpiCard.js';
import { renderDataTable, renderRankingTable, initTableInteractions } from '../components/dataTable.js';
import { createBarChart, createLineChart, createDoughnutChart, destroyAllCharts } from '../components/chartHelpers.js';
import {
  calcularFluxoCaixa, formatarMoeda, agruparPor,
  baseContasReceber, baseContasPagar,
} from '../data/businessLogic.js';

export function render() {
  const fluxo = calcularFluxoCaixa();
  const totalEntradas = fluxo.reduce((s, f) => s + f.entradas, 0);
  const totalSaidas = fluxo.reduce((s, f) => s + f.saidas, 0);
  const saldoFinal = fluxo.length ? fluxo[fluxo.length - 1].saldoAcumulado : 0;
  const mesAtual = fluxo.find(f => f.mes === '2026-04');
  const saldoMesAtual = mesAtual ? mesAtual.saldoMes : 0;
  const entradasPrevistas = totalEntradas - fluxo.reduce((s, f) => s + f.entradasPagas, 0);
  const saidasPrevistas = totalSaidas - fluxo.reduce((s, f) => s + f.saidasPagas, 0);

  // Top entradas/saídas por categoria
  const entPorCat = agruparPor(baseContasReceber, 'categoria');
  const saiPorCat = agruparPor(baseContasPagar, 'categoria');
  const topEntradas = Object.entries(entPorCat).sort((a, b) => b[1].total - a[1].total).slice(0, 5);
  const topSaidas = Object.entries(saiPorCat).sort((a, b) => b[1].total - a[1].total).slice(0, 5);

  const kpiCards = [
    { label: 'Total Entradas', value: totalEntradas, color: 'emerald', icon: 'down', sub: 'Contas a receber' },
    { label: 'Total Saídas', value: totalSaidas, color: 'red', icon: 'up', sub: 'Contas a pagar' },
    { label: 'Entradas Previstas', value: entradasPrevistas, color: 'cyan', icon: 'clock', sub: 'Ainda não recebido' },
    { label: 'Saídas Previstas', value: saidasPrevistas, color: 'amber', icon: 'clock', sub: 'Ainda não pago' },
    { label: 'Saldo Mês Atual', value: saldoMesAtual, color: saldoMesAtual >= 0 ? 'blue' : 'red', icon: 'balance', sub: 'Abril/2026' },
    { label: 'Saldo Projetado Final', value: saldoFinal, color: saldoFinal >= 0 ? 'indigo' : 'red', icon: 'balance', sub: 'Acumulado' },
  ];

  const tableColumns = [
    { key: 'label', label: 'Período' },
    { key: 'entradas', label: 'Entradas', render: r => `<span class="td-value text-emerald">${formatarMoeda(r.entradas)}</span>`, className: 'text-right' },
    { key: 'saidas', label: 'Saídas', render: r => `<span class="td-value text-red">${formatarMoeda(r.saidas)}</span>`, className: 'text-right' },
    { key: 'saldoMes', label: 'Saldo Mês', render: r => `<span class="td-value ${r.saldoMes >= 0 ? 'text-emerald' : 'text-red'}">${formatarMoeda(r.saldoMes)}</span>`, className: 'text-right' },
    { key: 'saldoAcumulado', label: 'Acumulado', render: r => `<span class="td-value ${r.saldoAcumulado >= 0 ? 'text-blue' : 'text-red'}">${formatarMoeda(r.saldoAcumulado)}</span>`, className: 'text-right' },
  ];

  const topEntColumns = [
    { key: 'cat', label: 'Categoria' },
    { key: 'total', label: 'Valor', render: r => `<span class="td-value text-emerald">${formatarMoeda(r.total)}</span>`, className: 'text-right' },
    { key: 'count', label: 'Qtd', className: 'text-right' },
  ];

  const topSaiColumns = [
    { key: 'cat', label: 'Categoria' },
    { key: 'total', label: 'Valor', render: r => `<span class="td-value text-red">${formatarMoeda(r.total)}</span>`, className: 'text-right' },
    { key: 'count', label: 'Qtd', className: 'text-right' },
  ];

  return `
    <div class="page-enter">
      ${renderKPIGrid(kpiCards)}

      <div class="charts-grid mb-6">
        <div class="chart-card"><div class="chart-card-title"><span class="dot blue"></span>Curva de Saldo Acumulado</div><div class="chart-container"><canvas id="chart-saldo-curva"></canvas></div></div>
        <div class="chart-card"><div class="chart-card-title"><span class="dot emerald"></span>Entradas vs Saídas por Mês</div><div class="chart-container"><canvas id="chart-fluxo-barras"></canvas></div></div>
      </div>

      <div class="charts-grid mb-6">
        <div class="chart-card"><div class="chart-card-title"><span class="dot indigo"></span>Saldo Mensal — Projeção</div><div class="chart-container"><canvas id="chart-saldo-mensal"></canvas></div></div>
        <div class="chart-card"><div class="chart-card-title"><span class="dot amber"></span>Impacto por Categoria (Entradas)</div><div class="chart-container"><canvas id="chart-impacto-cat"></canvas></div></div>
      </div>

      <div class="charts-grid mb-6">
        <div class="chart-card"><div class="chart-card-title"><span class="dot emerald"></span>Top Entradas por Categoria</div><div class="chart-container"><canvas id="chart-top-entradas"></canvas></div></div>
        <div class="chart-card"><div class="chart-card-title"><span class="dot red"></span>Top Saídas por Categoria</div><div class="chart-container"><canvas id="chart-top-saidas"></canvas></div></div>
      </div>

      ${renderDataTable({ id: 'table-fluxo', title: 'Fluxo de Caixa — Detalhado por Período', columns: tableColumns, rows: fluxo, searchable: false, paginated: false })}
    </div>
  `;
}

export function init() {
  destroyAllCharts();
  const fluxo = calcularFluxoCaixa();

  createLineChart('chart-saldo-curva', {
    labels: fluxo.map(f => f.label),
    datasets: [{ label: 'Saldo Acumulado', data: fluxo.map(f => f.saldoAcumulado), color: '#3b82f6', fill: true }],
  });

  createBarChart('chart-fluxo-barras', {
    labels: fluxo.map(f => f.label),
    datasets: [
      { label: 'Entradas', data: fluxo.map(f => f.entradas), color: '#10b981' },
      { label: 'Saídas', data: fluxo.map(f => f.saidas), color: '#ef4444' },
    ],
  });

  createBarChart('chart-saldo-mensal', {
    labels: fluxo.map(f => f.label),
    datasets: [{
      label: 'Saldo do Mês', data: fluxo.map(f => f.saldoMes),
      backgroundColor: fluxo.map(f => f.saldoMes >= 0 ? '#10b981' : '#ef4444'),
    }],
  });

  const entPorCat = agruparPor(baseContasReceber, 'categoria');
  const catLabels = Object.keys(entPorCat).sort((a, b) => entPorCat[b].total - entPorCat[a].total);
  createDoughnutChart('chart-impacto-cat', {
    labels: catLabels,
    data: catLabels.map(l => entPorCat[l].total),
  });

  // Top Entradas (Horizontal Bar Chart)
  const topEntradas = Object.entries(entPorCat).sort((a, b) => b[1].total - a[1].total).slice(0, 5);
  createHorizontalBarChart('chart-top-entradas', {
    labels: topEntradas.map(([cat]) => cat),
    datasets: [{
      label: 'Valor',
      data: topEntradas.map(([, g]) => g.total),
      backgroundColor: topEntradas.map((_, i) => i < 3 ? '#10b981' : '#334155'), // Emerald for top 3
      borderRadius: 4
    }]
  });

  // Top Saídas (Horizontal Bar Chart)
  const saiPorCat = agruparPor(baseContasPagar, 'categoria');
  const topSaidas = Object.entries(saiPorCat).sort((a, b) => b[1].total - a[1].total).slice(0, 5);
  createHorizontalBarChart('chart-top-saidas', {
    labels: topSaidas.map(([cat]) => cat),
    datasets: [{
      label: 'Valor',
      data: topSaidas.map(([, g]) => g.total),
      backgroundColor: topSaidas.map((_, i) => i < 3 ? '#ef4444' : '#334155'), // Red for top 3
      borderRadius: 4
    }]
  });

  initTableInteractions('table-fluxo');
}
