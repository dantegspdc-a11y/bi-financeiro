// ============================================================
// PÁGINA: RELATÓRIO EXECUTIVO
// ============================================================

import { createBarChart, createLineChart, destroyAllCharts } from '../components/chartHelpers.js';
import {
  calcularKPIs, calcularFluxoCaixa, reconciliarDados, calcularComparativo,
  formatarMoeda, formatarPct, getContasReceberComStatus, getContasPagarComStatus,
  agruparPorMes, baseFaturamento, getTopClientesFaturar, getTopDevedores, getTopFornecedores,
  getDestaquesExecutivos, getCompetenciaAtual, getCompetenciaAnterior,
} from '../data/businessLogic.js';

export function render() {
  const kpis = calcularKPIs();
  const fluxo = calcularFluxoCaixa();
  const conciliados = reconciliarDados();
  const saldoFinal = fluxo.length ? fluxo[fluxo.length - 1].saldoAcumulado : 0;
  const comp = calcularComparativo(getCompetenciaAtual(), getCompetenciaAnterior());
  const destaques = getDestaquesExecutivos();
  const topClientes = getTopClientesFaturar(5);
  const topDevedores = getTopDevedores(5);
  const topFornecedores = getTopFornecedores(5);

  const contasReceberVencidas = getContasReceberComStatus().filter(c => c.status === 'Vencido');
  const contasPagarVencidas = getContasPagarComStatus().filter(c => c.status === 'Vencido');

  const today = new Date();
  const dateStr = today.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });

  const deltaArrow = (v) => v >= 0
    ? `<span class="delta-up">▲ ${Math.abs(v).toFixed(1)}%</span>`
    : `<span class="delta-down">▼ ${Math.abs(v).toFixed(1)}%</span>`;

  function renderTopList(items, nameField, valueField) {
    return items.map((item, i) => `
      <div class="report-list-item">
        <span class="report-list-rank">${i + 1}</span>
        <span class="report-list-name">${item[nameField]}</span>
        <span class="report-list-value">${formatarMoeda(item[valueField])}</span>
      </div>
    `).join('');
  }

  return `
    <div class="page-enter report-page" id="report-page">
      <div class="report-header">
        <div class="report-logo-area" id="report-logo-area"></div>
        <div class="report-company-name" style="font-weight: 600; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 8px;">EMPRESA S/A</div>
        <h1>Relatório Executivo Financeiro</h1>
        <p>Gerado em ${dateStr} — Dados Consolidados</p>
        <div class="report-actions mt-4">
          <button class="btn btn-primary" id="btn-report-mode">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="6" y="3" width="12" height="18" rx="1"/><line x1="9" y1="7" x2="15" y2="7"/><line x1="9" y1="11" x2="15" y2="11"/><line x1="9" y1="15" x2="12" y2="15"/></svg>
            Gerar Relatório Executivo
          </button>
          <button class="btn btn-outline" id="btn-print" onclick="window.print()">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
            Imprimir / PDF
          </button>
        </div>
      </div>

      <!-- 1. RESUMO FINANCEIRO -->
      <div class="report-section">
        <h2>1. Resumo Financeiro</h2>
        <div class="report-kpi-row">
          <div class="report-kpi"><div class="label">Total a Receber</div><div class="value positive">${formatarMoeda(kpis.totalReceber)}</div><div class="report-kpi-delta">${deltaArrow(comp.deltaReceber)} vs anterior</div></div>
          <div class="report-kpi"><div class="label">Total a Pagar</div><div class="value negative">${formatarMoeda(kpis.totalPagar)}</div><div class="report-kpi-delta">${deltaArrow(comp.deltaPagar)} vs anterior</div></div>
          <div class="report-kpi"><div class="label">Saldo Projetado</div><div class="value ${kpis.saldoProjetado >= 0 ? 'positive' : 'negative'}">${formatarMoeda(kpis.saldoProjetado)}</div></div>
        </div>
        <div class="report-kpi-row">
          <div class="report-kpi"><div class="label">Total Recebido</div><div class="value positive">${formatarMoeda(kpis.totalRecebido)}</div><div class="report-kpi-sub">${formatarPct(kpis.pctRecebido)} da carteira</div></div>
          <div class="report-kpi"><div class="label">Total Pago</div><div class="value">${formatarMoeda(kpis.totalPago)}</div><div class="report-kpi-sub">${formatarPct(kpis.pctPago)} do total</div></div>
          <div class="report-kpi"><div class="label">Total Faturamento</div><div class="value">${formatarMoeda(kpis.totalFaturamento)}</div><div class="report-kpi-delta">${deltaArrow(comp.deltaFaturamento)} vs anterior</div></div>
        </div>
      </div>

      <!-- 2. FATURAMENTO -->
      <div class="report-section">
        <h2>2. Faturamento</h2>
        <div class="chart-card mt-4"><div class="chart-card-title"><span class="dot indigo"></span>Evolução do Faturamento</div><div class="chart-container-sm"><canvas id="report-chart-fat"></canvas></div></div>
      </div>

      <!-- 3. FLUXO DE CAIXA -->
      <div class="report-section">
        <h2>3. Fluxo de Caixa</h2>
        <div class="report-kpi-row">
          <div class="report-kpi"><div class="label">Total Entradas</div><div class="value positive">${formatarMoeda(fluxo.reduce((s, f) => s + f.entradas, 0))}</div></div>
          <div class="report-kpi"><div class="label">Total Saídas</div><div class="value negative">${formatarMoeda(fluxo.reduce((s, f) => s + f.saidas, 0))}</div></div>
          <div class="report-kpi"><div class="label">Saldo Acumulado</div><div class="value ${saldoFinal >= 0 ? 'positive' : 'negative'}">${formatarMoeda(saldoFinal)}</div></div>
        </div>
        <div class="chart-card mt-4"><div class="chart-card-title"><span class="dot blue"></span>Projeção de Caixa</div><div class="chart-container-sm"><canvas id="report-chart-caixa"></canvas></div></div>
      </div>

      <!-- 4. TOP 5 -->
      <div class="report-section">
        <h2>4. Rankings</h2>
        <div class="report-columns">
          <div class="report-col">
            <h3 class="report-col-title">Top 5 Clientes</h3>
            ${renderTopList(topClientes, 'cliente', 'total')}
          </div>
          <div class="report-col">
            <h3 class="report-col-title">Top 5 Devedores</h3>
            ${renderTopList(topDevedores, 'cliente', 'aberto')}
          </div>
          <div class="report-col">
            <h3 class="report-col-title">Top 5 Fornecedores</h3>
            ${renderTopList(topFornecedores, 'fornecedor', 'total')}
          </div>
        </div>
      </div>

      <!-- 5. DESTAQUES DA GESTÃO -->
      <div class="report-section">
        <h2>5. Destaques da Gestão</h2>
        <div class="highlights-grid report-highlights">
          ${destaques.maiorClienteFaturar ? `<div class="highlight-card"><div class="highlight-label">Maior Cliente a Faturar</div><div class="highlight-value">${destaques.maiorClienteFaturar.cliente}</div><div class="highlight-sub">${formatarMoeda(destaques.maiorClienteFaturar.total)}</div></div>` : ''}
          ${destaques.maiorDevedor ? `<div class="highlight-card highlight-warning"><div class="highlight-label">Maior Devedor</div><div class="highlight-value">${destaques.maiorDevedor.cliente}</div><div class="highlight-sub">${formatarMoeda(destaques.maiorDevedor.aberto)}</div></div>` : ''}
          ${destaques.maiorFornecedor ? `<div class="highlight-card"><div class="highlight-label">Maior Fornecedor</div><div class="highlight-value">${destaques.maiorFornecedor.fornecedor}</div><div class="highlight-sub">${formatarMoeda(destaques.maiorFornecedor.total)}</div></div>` : ''}
          <div class="highlight-card highlight-danger"><div class="highlight-label">Vencido a Receber</div><div class="highlight-value">${formatarMoeda(destaques.totalVencidoReceber)}</div></div>
          <div class="highlight-card highlight-danger"><div class="highlight-label">Vencido a Pagar</div><div class="highlight-value">${formatarMoeda(destaques.totalVencidoPagar)}</div></div>
        </div>
      </div>

      <!-- 6. RISCOS -->
      <div class="report-section">
        <h2>6. Análise de Riscos</h2>
        ${kpis.vencidosReceber > 0 ? `<div class="risk-item"><div class="risk-icon high"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg></div><div class="risk-content"><div class="risk-title">Recebíveis vencidos: ${formatarMoeda(kpis.vencidosReceber)}</div><div class="risk-desc">${contasReceberVencidas.length} documentos. Impacto direto no fluxo de caixa.</div></div></div>` : ''}
        ${kpis.vencidosPagar > 0 ? `<div class="risk-item"><div class="risk-icon high"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg></div><div class="risk-content"><div class="risk-title">Pagamentos vencidos: ${formatarMoeda(kpis.vencidosPagar)}</div><div class="risk-desc">${contasPagarVencidas.length} documentos. Risco de multas.</div></div></div>` : ''}
        <div class="risk-item"><div class="risk-icon ${saldoFinal >= 0 ? 'low' : 'high'}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg></div><div class="risk-content"><div class="risk-title">Projeção de caixa: ${saldoFinal >= 0 ? 'Positiva' : 'Negativa'}</div><div class="risk-desc">Saldo projetado ${formatarMoeda(saldoFinal)}. ${saldoFinal >= 0 ? 'Situação confortável.' : 'Atenção: necessidade de capital.'}</div></div></div>
      </div>

      <!-- 7. OPORTUNIDADES -->
      <div class="report-section">
        <h2>7. Oportunidades</h2>
        <div class="risk-item"><div class="risk-icon low"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg></div><div class="risk-content"><div class="risk-title">Pipeline pendente: ${formatarMoeda(kpis.pendenteFaturamento)}</div><div class="risk-desc">${kpis.qtdPendente} operações confirmadas aguardando faturamento.</div></div></div>
        <div class="risk-item"><div class="risk-icon low"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg></div><div class="risk-content"><div class="risk-title">Taxa de conversão: ${formatarPct(kpis.taxaConversao)}</div><div class="risk-desc">Potencial de aumento com aceleração do faturamento.</div></div></div>
      </div>
    </div>
  `;
}

export function init() {
  destroyAllCharts();
  const fluxo = calcularFluxoCaixa();
  const fatMensal = agruparPorMes(baseFaturamento, 'data_emissao', 'valor_total');

  createBarChart('report-chart-fat', {
    labels: fatMensal.map(m => m.label),
    datasets: [{ label: 'Faturamento', data: fatMensal.map(m => m.valor), color: '#6366f1' }],
  });

  createLineChart('report-chart-caixa', {
    labels: fluxo.map(f => f.label),
    datasets: [
      { label: 'Entradas', data: fluxo.map(f => f.entradas), color: '#10b981', fill: false },
      { label: 'Saídas', data: fluxo.map(f => f.saidas), color: '#ef4444', fill: false },
      { label: 'Saldo', data: fluxo.map(f => f.saldoAcumulado), color: '#3b82f6', fill: true },
    ],
  });

  // Report mode button
  const reportBtn = document.getElementById('btn-report-mode');
  if (reportBtn) {
    reportBtn.addEventListener('click', () => {
      document.body.classList.toggle('report-mode');
      const sidebar = document.getElementById('sidebar');
      const header = document.getElementById('header');
      if (document.body.classList.contains('report-mode')) {
        if (sidebar) sidebar.style.display = 'none';
        if (header) header.style.display = 'none';
        reportBtn.textContent = '✕ Sair do Modo Relatório';
      } else {
        if (sidebar) sidebar.style.display = '';
        if (header) header.style.display = '';
        reportBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="6" y="3" width="12" height="18" rx="1"/><line x1="9" y1="7" x2="15" y2="7"/><line x1="9" y1="11" x2="15" y2="11"/><line x1="9" y1="15" x2="12" y2="15"/></svg> Gerar Relatório Executivo';
      }
    });
  }

  // Insert logo into report
  const logoArea = document.getElementById('report-logo-area');
  const storedLogo = localStorage.getItem('bi_empresa_logo');
  if (logoArea && storedLogo) {
    logoArea.innerHTML = `<img src="${storedLogo}" alt="Logo" class="report-logo" />`;
  }
}
