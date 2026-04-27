// ============================================================
// REGRAS DE NEGÓCIO — BI FINANCEIRO EXECUTIVO
// Centraliza toda lógica de conciliação, KPIs e cálculos
// ============================================================

import { supabase } from '../lib/supabase.js';

async function fetchAll(tableName) {
  // Pegar a quantidade total de registros primeiro
  const { count, error: countErr } = await supabase
    .from(tableName)
    .select('*', { count: 'exact', head: true });

  if (countErr) return { data: [], error: countErr };
  if (!count) return { data: [], error: null };

  const step = 1000;
  let allData = [];
  const CONCURRENT_BATCHES = 10; // Disparar 10 requisições simultâneas (10k registros por batch)

  // Iterar e criar promessas APENAS para o batch atual (impede que o Supabase/navegador travem por excesso de requisições)
  for (let batchStart = 0; batchStart < count; batchStart += step * CONCURRENT_BATCHES) {
    const batchPromises = [];
    
    for (let i = 0; i < CONCURRENT_BATCHES; i++) {
      const from = batchStart + (i * step);
      if (from >= count) break;
      
      batchPromises.push(
        supabase
          .from(tableName)
          .select('*')
          .range(from, from + step - 1)
      );
    }
    
    const results = await Promise.all(batchPromises);
    for (const res of results) {
      if (res.error) return { data: allData, error: res.error };
      if (res.data) {
        // Usar push(...data) é muito mais rápido e usa menos memória
        allData.push(...res.data);
      }
    }
  }

  return { data: allData, error: null };
}

// Variáveis de estado para os dados
export let baseFaturamento = [];
export let baseContasReceber = [];
export let baseContasPagar = [];
export let totalRegistrosBrutos = 0;

// Normalization function
export function parseMoeda(valor) {
  if (valor === null || valor === undefined) return 0;
  if (typeof valor === 'number') return valor;
  // Se for string, remove símbolos e trata vírgula decimal
  const clean = String(valor)
    .replace('R$', '')
    .replace(/\s/g, '')
    .replace(/\./g, '') // Remove pontos de milhar
    .replace(',', '.'); // Troca vírgula decimal por ponto
  const num = parseFloat(clean);
  return isNaN(num) ? 0 : num;
}

function normalizeFaturamento(d) {
  const vTotal = parseMoeda(d.total_a_receber_cliente);
  return {
    ...d,
    reserva: String(d.reserva || ''),
    cliente: d.cliente || 'Desconhecido',
    data_emissao: d.dt_emissao,
    valor_total: vTotal,
    centro_custo: d.c_custo || 'Outros',
    emissor: d.emissor,
    status_faturamento: String(d.situacao || '').toUpperCase(),
    categoria: d.c_custo || 'Outros', 
    competencia: d.dt_emissao ? d.dt_emissao.slice(0, 7) : '2026-04'
  };
}

function normalizeReceber(d) {
  const vRec = parseMoeda(d.vendas_total_receber_cliente);
  const vPago = parseMoeda(d.valor_pago);
  // Flag: título foi baixado/recebido se possui dt_recebimento
  const foiRecebido = !!d.dt_recebimento;
  return {
    ...d,
    reserva: String(d.vendas_reserva || ''),
    cliente: d.cliente || 'Desconhecido',
    data_emissao: d.vendas_dt_emissao,
    data_vencimento: d.dt_vencimento,
    valor_receber: vRec,
    valor_pago: vPago,
    _valor_pago_original: vPago, // preservar original para a lógica de enriquecimento
    _foi_recebido: foiRecebido,
    aberto: vRec - vPago,
    documento: d.documento,
    categoria: d.vendas_produto || 'Diversos',
    competencia: d.dt_vencimento ? d.dt_vencimento.slice(0, 7) : '2026-04'
  };
}

function normalizePagar(d) {
  const vPag = parseMoeda(d.valor_parcela);
  const vPago = parseMoeda(d.valor_pago);
  return {
    ...d,
    data_emissao: d.dt_emissao,
    data_vencimento: d.dt_vencimento,
    valor_pagar: vPag,
    valor_pago: vPago,
    aberto: vPag - vPago,
    competencia: d.dt_vencimento ? d.dt_vencimento.slice(0, 7) : '2026-04'
  };
}

export async function carregarDados() {
  console.time('⏱️ carregarDados total');
  console.log('🔄 Carregando dados do Supabase...');
  
  console.time('⏱️ fetch');
  const [resFat, resRec, resPag] = await Promise.all([
    fetchAll('faturamento'),
    fetchAll('contas_receber'),
    fetchAll('contas_pagar')
  ]);
  console.timeEnd('⏱️ fetch');

  if (resFat.error) console.error('Erro faturamento:', resFat.error);
  if (resRec.error) console.error('Erro receber:', resRec.error);
  if (resPag.error) console.error('Erro pagar:', resPag.error);

  const rawFaturamento = resFat.data || [];
  const rawReceber = resRec.data || [];
  const rawPagar = resPag.data || [];

  console.log(`📦 Bruto: Fat=${rawFaturamento.length} | Rec=${rawReceber.length} | Pag=${rawPagar.length}`);

  console.time('⏱️ processamento');

  // REGRAS FINANCEIRAS DE STATUS
  const statusValidos = ['CONFIRMADA', 'FECHADA'];

  // ---- PASSO 1: Criar mapa BRUTO de faturamento por reserva (O(n)) ----
  // Isso substitui o .find() que era O(n) por lookup, tornando o enriquecimento de Contas Receber O(1) por item
  const fatBrutoMap = new Map();
  for (let i = 0; i < rawFaturamento.length; i++) {
    const f = rawFaturamento[i];
    fatBrutoMap.set(String(f.reserva), f);
  }

  // ---- PASSO 2: Normalizar e filtrar faturamento (passo único) ----
  const faturamentoNormalized = [];
  const faturamentoValidoMap = new Map();

  for (let i = 0; i < rawFaturamento.length; i++) {
    const norm = normalizeFaturamento(rawFaturamento[i]);
    if (statusValidos.includes(String(norm.status_faturamento || '').toUpperCase())) {
      faturamentoNormalized.push(norm);
      faturamentoValidoMap.set(String(norm.reserva), norm);
    }
  }

  // ---- PASSO 3: Normalizar contas a pagar ----
  const pagarNormalized = new Array(rawPagar.length);
  for (let i = 0; i < rawPagar.length; i++) {
    pagarNormalized[i] = normalizePagar(rawPagar[i]);
  }

  // ---- PASSO 4: Normalizar contas receber e filtrar por status válido ----
  const receberNormalizados = [];
  for (let i = 0; i < rawReceber.length; i++) {
    const norm = normalizeReceber(rawReceber[i]);
    const reservaStr = String(norm.reserva);
    const fatBruto = fatBrutoMap.get(reservaStr);

    // Regra 4: Se vinculado a status inválido, descartar
    if (fatBruto && !statusValidos.includes(String(fatBruto.situacao || '').toUpperCase())) {
      continue;
    }

    receberNormalizados.push({
      ...norm,
      cliente: fatBruto ? fatBruto.cliente : norm.cliente,
      categoria: fatBruto ? (fatBruto.produto || fatBruto.c_custo || norm.categoria) : norm.categoria,
      status_faturamento: fatBruto ? String(fatBruto.situacao || '').toUpperCase() : 'DESCONHECIDO'
    });
  }

  // ---- PASSO 5: Finalizar base de Contas a Receber ----
  const receberFinal = receberNormalizados.map(rec => {
    // Se o título foi recebido mas o valor_pago está zerado, assumir que o valor pago foi o total a receber
    if (rec._foi_recebido && rec.valor_pago <= 0 && rec.valor_receber > 0) {
      return {
        ...rec,
        valor_pago: rec.valor_receber,
        aberto: 0
      };
    }
    return rec;
  });

  console.timeEnd('⏱️ processamento');

  baseFaturamento = faturamentoNormalized;
  baseContasReceber = receberFinal;
  baseContasPagar = pagarNormalized;
  totalRegistrosBrutos = rawFaturamento.length;
  
  console.log(`✅ BI Atualizado: ${baseFaturamento.length} faturamentos | ${baseContasReceber.length} receber | ${baseContasPagar.length} pagar`);
  console.timeEnd('⏱️ carregarDados total');
  return { baseFaturamento, baseContasReceber, baseContasPagar };
}

// A carga inicial agora é disparada ativamente pelo main.js após renderizar o layout base
// para que o usuário não veja uma tela em branco durante o download.
// ---------- FORMATAÇÃO ----------

export function formatarMoeda(valor) {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function formatarData(dataStr) {
  if (!dataStr) return '—';
  const [y, m, d] = dataStr.split('-');
  return `${d}/${m}/${y}`;
}

export function parsarData(dataStr) {
  return new Date(dataStr + 'T00:00:00');
}

export function getMesAno(dataStr) {
  const d = parsarData(dataStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function getMesAnoLabel(mesAno) {
  const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  const [y, m] = mesAno.split('-');
  return `${meses[parseInt(m) - 1]}/${y}`;
}

export function formatarPct(valor) {
  return `${valor.toFixed(1)}%`;
}

// ---------- COMPETÊNCIAS ----------

export function getCompetencias() {
  const set = new Set();
  baseFaturamento.forEach(f => set.add(f.competencia));
  baseContasReceber.forEach(r => set.add(r.competencia));
  baseContasPagar.forEach(p => set.add(p.competencia));
  return [...set].sort();
}

export function getCompetenciaAtual() { return '2026-04'; }
export function getCompetenciaAnterior() { return '2026-03'; }

export function getClientes() {
  const set = new Set();
  baseFaturamento.forEach(f => set.add(f.cliente));
  baseContasReceber.forEach(r => set.add(r.cliente));
  return [...set].sort();
}

export function getFornecedores() {
  const set = new Set();
  baseContasPagar.forEach(p => set.add(p.beneficiario));
  return [...set].sort();
}

export function getCategorias() {
  const set = new Set();
  baseFaturamento.forEach(f => set.add(f.categoria));
  baseContasReceber.forEach(r => set.add(r.categoria));
  return [...set].sort();
}

export function getCategoriasPagar() {
  const set = new Set();
  baseContasPagar.forEach(p => set.add(p.categoria));
  return [...set].sort();
}

// ---------- FILTROS ----------

export function filtrarFaturamento(filtros = {}) {
  let dados = [...baseFaturamento];
  if (filtros.competencia) dados = dados.filter(d => d.competencia === filtros.competencia);
  if (filtros.cliente) dados = dados.filter(d => d.cliente === filtros.cliente);
  if (filtros.categoria) dados = dados.filter(d => d.categoria === filtros.categoria);
  if (filtros.status) dados = dados.filter(d => d.status_faturamento === String(filtros.status).toUpperCase());
  if (filtros.reserva) dados = dados.filter(d => d.reserva.toLowerCase().includes(filtros.reserva.toLowerCase()));
  return dados;
}

export function filtrarContasReceber(filtros = {}) {
  let dados = getContasReceberComStatus();
  if (filtros.competencia) dados = dados.filter(d => d.competencia === filtros.competencia);
  if (filtros.cliente) dados = dados.filter(d => d.cliente === filtros.cliente);
  if (filtros.categoria) dados = dados.filter(d => d.categoria === filtros.categoria);
  if (filtros.status) dados = dados.filter(d => d.status === filtros.status);
  if (filtros.reserva) dados = dados.filter(d => d.reserva.toLowerCase().includes(filtros.reserva.toLowerCase()));
  if (filtros.documento) dados = dados.filter(d => d.documento.toLowerCase().includes(filtros.documento.toLowerCase()));
  return dados;
}

export function filtrarContasPagar(filtros = {}) {
  let dados = getContasPagarComStatus();
  if (filtros.competencia) dados = dados.filter(d => d.competencia === filtros.competencia);
  if (filtros.fornecedor) dados = dados.filter(d => d.beneficiario === filtros.fornecedor);
  if (filtros.categoria) dados = dados.filter(d => d.categoria === filtros.categoria);
  if (filtros.status) dados = dados.filter(d => d.status === filtros.status);
  if (filtros.documento) dados = dados.filter(d => d.documento.toLowerCase().includes(filtros.documento.toLowerCase()));
  return dados;
}

// ---------- CONCILIAÇÃO ----------

export function reconciliarDados(filtros = {}) {
  let dados = baseFaturamento;

  if (filtros.competencia) dados = dados.filter(d => d.competencia === filtros.competencia);
  if (filtros.cliente) dados = dados.filter(d => d.cliente === filtros.cliente);
  if (filtros.categoria) dados = dados.filter(d => d.categoria === filtros.categoria);
  if (filtros.status) dados = dados.filter(d => d.status_faturamento === String(filtros.status).toUpperCase());
  if (filtros.reserva) dados = dados.filter(d => d.reserva.toLowerCase().includes(filtros.reserva.toLowerCase()));

  // Criar mapa de contas a receber por reserva (O(1) lookup ao invés de O(n) .find())
  const receberMap = new Map();
  for (let i = 0; i < baseContasReceber.length; i++) {
    const r = baseContasReceber[i];
    receberMap.set(String(r.reserva), r);
  }

  return dados.map(fat => {
    const receber = receberMap.get(String(fat.reserva));
    if (!receber) {
      return { ...fat, status_conciliacao: 'Pendente', status_final: 'Aguardando faturamento', documento: null, valor_receber: null, data_vencimento: null, divergencia: 0 };
    }
    const diferenca = Math.abs(receber.valor_receber - fat.valor_total);
    if (diferenca < 0.01) {
      return { ...fat, status_conciliacao: 'OK', status_final: 'Faturado', documento: receber.documento, valor_receber: receber.valor_receber, data_vencimento: receber.data_vencimento, divergencia: 0 };
    }
    return { ...fat, status_conciliacao: 'Divergente', status_final: 'Revisar', documento: receber.documento, valor_receber: receber.valor_receber, data_vencimento: receber.data_vencimento, divergencia: receber.valor_receber - fat.valor_total };
  });
}

// ---------- KPIs ----------

export function calcularKPIs(filtros = {}) {
  const hoje = new Date().toISOString().slice(0, 10);
  const conciliados = reconciliarDados(filtros);

  let contasRec = [...baseContasReceber];
  let contasPag = [...baseContasPagar];
  if (filtros.competencia) {
    contasRec = contasRec.filter(r => r.competencia === filtros.competencia);
    contasPag = contasPag.filter(p => p.competencia === filtros.competencia);
  }
  if (filtros.cliente) contasRec = contasRec.filter(r => r.cliente === filtros.cliente);
  if (filtros.fornecedor) contasPag = contasPag.filter(p => p.beneficiario === filtros.fornecedor);
  if (filtros.categoria) {
    contasRec = contasRec.filter(r => r.categoria === filtros.categoria);
    contasPag = contasPag.filter(p => p.categoria === filtros.categoria);
  }

  const totalReceber = contasRec.reduce((s, r) => s + r.valor_receber, 0);
  const totalRecebido = contasRec.reduce((s, r) => s + (r.valor_pago || 0), 0);
  const totalEmAbertoReceber = totalReceber - totalRecebido;
  const totalPagar = contasPag.reduce((s, r) => s + r.valor_pagar, 0);
  const totalPago = contasPag.reduce((s, r) => s + (r.valor_pago || 0), 0);
  const totalEmAbertoPagar = totalPagar - totalPago;

  const vencidosReceber = contasRec.filter(r => r.data_vencimento < hoje && (r.valor_receber - (r.valor_pago || 0)) > 0).reduce((s, r) => s + r.valor_receber - (r.valor_pago || 0), 0);
  const vencidosPagar = contasPag.filter(r => r.data_vencimento < hoje && (r.valor_pagar - (r.valor_pago || 0)) > 0).reduce((s, r) => s + r.valor_pagar - (r.valor_pago || 0), 0);

  // REGRA DE NEGÓCIO:
  // FECHADA = já foi faturado (Faturado)
  // CONFIRMADA = pendente de faturamento (A Faturar)
  const faturadoPeriodo = conciliados
    .filter(c => c.status_faturamento === 'FECHADA')
    .reduce((s, c) => s + c.valor_total, 0);
  const pendenteFaturamento = conciliados
    .filter(c => c.status_faturamento === 'CONFIRMADA')
    .reduce((s, c) => s + c.valor_total, 0);
  
  // Total geral: FECHADA + CONFIRMADA
  const totalFaturamento = conciliados
    .reduce((s, f) => s + f.valor_total, 0);
    
  const saldoProjetado = totalReceber - totalPagar;

  const qtdFaturado = conciliados.filter(c => c.status_faturamento === 'FECHADA').length;
  const qtdPendente = conciliados.filter(c => c.status_faturamento === 'CONFIRMADA').length;
  // Manter compatibilidade com OK/Pendente/Divergente para conciliação
  const qtdOK = conciliados.filter(c => c.status_conciliacao === 'OK').length;
  const qtdDivergente = conciliados.filter(c => c.status_conciliacao === 'Divergente').length;
  const qtdVencidosReceber = contasRec.filter(r => r.data_vencimento < hoje && (r.valor_receber - (r.valor_pago || 0)) > 0).length;
  const qtdVencidosPagar = contasPag.filter(r => r.data_vencimento < hoje && (r.valor_pagar - (r.valor_pago || 0)) > 0).length;

  const ticketMedio = conciliados.length > 0 ? totalFaturamento / conciliados.length : 0;

  const taxaConversao = conciliados.length > 0 ? (qtdFaturado / conciliados.length) * 100 : 0;
  const pctRecebido = totalReceber > 0 ? (totalRecebido / totalReceber) * 100 : 0;
  const pctPago = totalPagar > 0 ? (totalPago / totalPagar) * 100 : 0;

  return {
    totalReceber, totalRecebido, totalEmAbertoReceber,
    totalPagar, totalPago, totalEmAbertoPagar,
    vencidosReceber, vencidosPagar,
    faturadoPeriodo, pendenteFaturamento, totalFaturamento, saldoProjetado,
    qtdOK, qtdPendente, qtdDivergente, qtdFaturado, qtdVencidosReceber, qtdVencidosPagar,
    ticketMedio, taxaConversao, pctRecebido, pctPago,
  };
}

// ---------- COMPARATIVO ----------

export function calcularComparativo(compAtual, compAnterior) {
  const kpiAtual = calcularKPIs({ competencia: compAtual });
  const kpiAnterior = calcularKPIs({ competencia: compAnterior });
  function delta(atual, anterior) {
    if (anterior === 0) return atual > 0 ? 100 : 0;
    return ((atual - anterior) / Math.abs(anterior)) * 100;
  }
  return {
    atual: kpiAtual, anterior: kpiAnterior,
    deltaReceber: delta(kpiAtual.totalReceber, kpiAnterior.totalReceber),
    deltaPagar: delta(kpiAtual.totalPagar, kpiAnterior.totalPagar),
    deltaFaturamento: delta(kpiAtual.totalFaturamento, kpiAnterior.totalFaturamento),
    deltaSaldo: delta(kpiAtual.saldoProjetado, kpiAnterior.saldoProjetado),
  };
}

// ---------- RANKINGS ----------

export function getTopClientesFaturar(n = 10, filtros = {}) {
  const conciliados = reconciliarDados(filtros);
  // Top Clientes = apenas CONFIRMADA (a faturar)
  const aFaturar = conciliados.filter(f => f.status_faturamento === 'CONFIRMADA');
  
  const grupos = {};
  aFaturar.forEach(f => {
    if (!grupos[f.cliente]) grupos[f.cliente] = { total: 0, count: 0 };
    grupos[f.cliente].total += f.valor_total;
    grupos[f.cliente].count += 1;
  });
  const totalGeral = Object.values(grupos).reduce((s, g) => s + g.total, 0);
  return Object.entries(grupos)
    .map(([cliente, g]) => ({ cliente, total: g.total, count: g.count, pct: totalGeral > 0 ? (g.total / totalGeral) * 100 : 0 }))
    .sort((a, b) => b.total - a.total).slice(0, n);
}

export function getTopDevedores(n = 10) {
  const grupos = {};
  baseContasReceber.forEach(r => {
    const aberto = r.valor_receber - (r.valor_pago || 0);
    if (!grupos[r.cliente]) grupos[r.cliente] = { carteira: 0, recebido: 0, aberto: 0, count: 0, diasTotal: 0 };
    grupos[r.cliente].carteira += r.valor_receber;
    grupos[r.cliente].recebido += (r.valor_pago || 0);
    grupos[r.cliente].aberto += aberto;
    grupos[r.cliente].count += 1;
    const hoje = new Date();
    const venc = parsarData(r.data_vencimento);
    const aging = Math.max(0, Math.ceil((hoje - venc) / (1000 * 60 * 60 * 24)));
    if (aberto > 0) grupos[r.cliente].diasTotal += aging;
  });
  return Object.entries(grupos)
    .filter(([, g]) => g.aberto > 0)
    .map(([cliente, g]) => ({ cliente, carteira: g.carteira, recebido: g.recebido, aberto: g.aberto, agingMedio: g.count > 0 ? Math.round(g.diasTotal / g.count) : 0, pctRecebido: g.carteira > 0 ? (g.recebido / g.carteira) * 100 : 0 }))
    .sort((a, b) => b.aberto - a.aberto).slice(0, n);
}

export function getTopFornecedores(n = 10) {
  const grupos = {};
  baseContasPagar.forEach(p => {
    const aberto = p.valor_pagar - (p.valor_pago || 0);
    if (!grupos[p.beneficiario]) grupos[p.beneficiario] = { total: 0, pago: 0, aberto: 0, count: 0, diasTotal: 0 };
    grupos[p.beneficiario].total += p.valor_pagar;
    grupos[p.beneficiario].pago += (p.valor_pago || 0);
    grupos[p.beneficiario].aberto += aberto;
    grupos[p.beneficiario].count += 1;
    const hoje = new Date();
    const venc = parsarData(p.data_vencimento);
    const aging = Math.max(0, Math.ceil((hoje - venc) / (1000 * 60 * 60 * 24)));
    if (aberto > 0) grupos[p.beneficiario].diasTotal += aging;
  });
  return Object.entries(grupos)
    .map(([fornecedor, g]) => ({ fornecedor, total: g.total, pago: g.pago, aberto: g.aberto, agingMedio: g.count > 0 ? Math.round(g.diasTotal / g.count) : 0, pctPago: g.total > 0 ? (g.pago / g.total) * 100 : 0 }))
    .sort((a, b) => b.total - a.total).slice(0, n);
}

// ---------- AGING ----------

export function calcularAgingReceber() {
  const hoje = new Date();
  const faixas = { 'Em dia': 0, '1-30 dias': 0, '31-60 dias': 0, '61-90 dias': 0, '90+ dias': 0 };
  baseContasReceber.forEach(r => {
    const aberto = r.valor_receber - (r.valor_pago || 0);
    if (aberto <= 0) return;
    const venc = parsarData(r.data_vencimento);
    const dias = Math.ceil((hoje - venc) / (1000 * 60 * 60 * 24));
    if (dias <= 0) faixas['Em dia'] += aberto;
    else if (dias <= 30) faixas['1-30 dias'] += aberto;
    else if (dias <= 60) faixas['31-60 dias'] += aberto;
    else if (dias <= 90) faixas['61-90 dias'] += aberto;
    else faixas['90+ dias'] += aberto;
  });
  return faixas;
}

export function calcularAgingPagar() {
  const hoje = new Date();
  const faixas = { 'Em dia': 0, '1-30 dias': 0, '31-60 dias': 0, '61-90 dias': 0, '90+ dias': 0 };
  baseContasPagar.forEach(p => {
    const aberto = p.valor_pagar - (p.valor_pago || 0);
    if (aberto <= 0) return;
    const venc = parsarData(p.data_vencimento);
    const dias = Math.ceil((hoje - venc) / (1000 * 60 * 60 * 24));
    if (dias <= 0) faixas['Em dia'] += aberto;
    else if (dias <= 30) faixas['1-30 dias'] += aberto;
    else if (dias <= 60) faixas['31-60 dias'] += aberto;
    else if (dias <= 90) faixas['61-90 dias'] += aberto;
    else faixas['90+ dias'] += aberto;
  });
  return faixas;
}

export function getAgingMedio(contas, campoVencimento, campoValor, campoPago) {
  const hoje = new Date();
  let totalDias = 0, count = 0;
  contas.forEach(c => {
    const aberto = c[campoValor] - (c[campoPago] || 0);
    if (aberto <= 0) return;
    const venc = parsarData(c[campoVencimento]);
    const dias = Math.max(0, Math.ceil((hoje - venc) / (1000 * 60 * 60 * 24)));
    totalDias += dias;
    count += 1;
  });
  return count > 0 ? Math.round(totalDias / count) : 0;
}

export function getPrazoMedio(contas, campoVencimento, campoEmissao) {
  if (contas.length === 0) return 0;
  let totalDias = 0;
  const hoje = new Date();
  contas.forEach(c => {
    const venc = parsarData(c[campoVencimento]);
    totalDias += Math.ceil((venc - hoje) / (1000 * 60 * 60 * 24));
  });
  return Math.round(totalDias / contas.length);
}

// ---------- DESTAQUES EXECUTIVOS ----------

export function getDestaquesExecutivos() {
  const topClientes = getTopClientesFaturar(1);
  const topDevedores = getTopDevedores(1);
  const topFornecedores = getTopFornecedores(1);
  const hoje = new Date().toISOString().slice(0, 10);

  const vencidosRec = baseContasReceber.filter(r => r.data_vencimento < hoje && (r.valor_receber - (r.valor_pago || 0)) > 0);
  const totalVencidoRec = vencidosRec.reduce((s, r) => s + r.valor_receber - (r.valor_pago || 0), 0);
  const vencidosPag = baseContasPagar.filter(p => p.data_vencimento < hoje && (p.valor_pagar - (p.valor_pago || 0)) > 0);
  const totalVencidoPag = vencidosPag.reduce((s, p) => s + p.valor_pagar - (p.valor_pago || 0), 0);

  return {
    maiorClienteFaturar: topClientes[0] || null,
    maiorDevedor: topDevedores[0] || null,
    maiorFornecedor: topFornecedores[0] || null,
    totalVencidoReceber: totalVencidoRec,
    totalVencidoPagar: totalVencidoPag,
  };
}

// ---------- FLUXO DE CAIXA ----------

export function calcularFluxoCaixa() {
  const meses = {};
  baseContasReceber.forEach(r => {
    const mes = getMesAno(r.data_vencimento);
    if (!meses[mes]) meses[mes] = { entradas: 0, saidas: 0, entradasPagas: 0, saidasPagas: 0 };
    meses[mes].entradas += r.valor_receber;
    meses[mes].entradasPagas += (r.valor_pago || 0);
  });
  baseContasPagar.forEach(p => {
    const mes = getMesAno(p.data_vencimento);
    if (!meses[mes]) meses[mes] = { entradas: 0, saidas: 0, entradasPagas: 0, saidasPagas: 0 };
    meses[mes].saidas += p.valor_pagar;
    meses[mes].saidasPagas += (p.valor_pago || 0);
  });
  const sortedKeys = Object.keys(meses).sort();
  let saldoAcumulado = 0;
  return sortedKeys.map(mes => {
    const { entradas, saidas, entradasPagas, saidasPagas } = meses[mes];
    const saldoMes = entradas - saidas;
    saldoAcumulado += saldoMes;
    return { mes, label: getMesAnoLabel(mes), entradas, saidas, entradasPagas, saidasPagas, saldoMes, saldoAcumulado };
  });
}

// ---------- AGRUPAMENTOS ----------

export function agruparPor(array, campo) {
  const grupos = {};
  array.forEach(item => {
    const chave = item[campo] || 'Outros';
    if (!grupos[chave]) grupos[chave] = { total: 0, count: 0, items: [] };
    const valor = item.valor_total || item.valor_receber || item.valor_pagar || 0;
    grupos[chave].total += valor;
    grupos[chave].count += 1;
    grupos[chave].items.push(item);
  });
  return grupos;
}

export function agruparPorMes(array, campoData, campoValor) {
  const meses = {};
  array.forEach(item => {
    const mes = getMesAno(item[campoData]);
    if (!meses[mes]) meses[mes] = 0;
    meses[mes] += item[campoValor];
  });
  const sortedKeys = Object.keys(meses).sort();
  return sortedKeys.map(m => ({ mes: m, label: getMesAnoLabel(m), valor: meses[m] }));
}

// ---------- CONTAS COM STATUS ----------

export function getContasReceberComStatus() {
  const hoje = new Date().toISOString().slice(0, 10);
  return baseContasReceber.map(r => {
    const aberto = r.valor_receber - (r.valor_pago || 0);
    let status;
    if (aberto <= 0) status = 'Recebido';
    else if (r.data_vencimento < hoje) status = 'Vencido';
    else status = 'A vencer';
    return { ...r, status, aberto, dias: Math.ceil((parsarData(r.data_vencimento) - parsarData(hoje)) / (1000 * 60 * 60 * 24)) };
  });
}

export function getContasPagarComStatus() {
  const hoje = new Date().toISOString().slice(0, 10);
  return baseContasPagar.map(p => {
    const aberto = p.valor_pagar - (p.valor_pago || 0);
    let status;
    if (aberto <= 0) status = 'Pago';
    else if (p.data_vencimento < hoje) status = 'Vencido';
    else status = 'A vencer';
    return { ...p, status, aberto, dias: Math.ceil((parsarData(p.data_vencimento) - parsarData(hoje)) / (1000 * 60 * 60 * 24)) };
  });
}

// ---------- EXPORTAÇÃO ----------

// baseFaturamento, baseContasReceber, baseContasPagar are already exported above
