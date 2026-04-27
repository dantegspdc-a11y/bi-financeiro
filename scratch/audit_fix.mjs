// Audit script to verify the calculation fix against Supabase
// Tests the exact same logic used in businessLogic.js

const SUPABASE_URL = 'https://npwurtggsykqlupeeffj.supabase.co';
const SUPABASE_KEY = 'sb_publishable_d6Ojqr_l2p5m9AiasEg1qQ_FjYwFAmC';

const fmt = v => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

function parseMoeda(valor) {
  if (valor === null || valor === undefined) return 0;
  if (typeof valor === 'number') return valor;
  const clean = String(valor).replace('R$', '').replace(/\s/g, '').replace(/\./g, '').replace(',', '.');
  const num = parseFloat(clean);
  return isNaN(num) ? 0 : num;
}

async function fetchAll(tableName) {
  let allData = [];
  let from = 0;
  const step = 1000;
  while (true) {
    const url = `${SUPABASE_URL}/rest/v1/${tableName}?select=*&offset=${from}&limit=${step}`;
    const res = await fetch(url, {
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
    });
    const data = await res.json();
    if (!data || data.length === 0) break;
    allData = allData.concat(data);
    if (data.length < step) break;
    from += step;
  }
  return allData;
}

async function main() {
  console.log('🔄 Buscando dados do Supabase...\n');
  const raw = await fetchAll('faturamento');
  
  console.log('='.repeat(70));
  console.log('📦 TOTAL REGISTROS BRUTOS:', raw.length);
  console.log('='.repeat(70));

  // Status distribution
  const statusCount = {};
  raw.forEach(f => {
    const st = String(f.situacao || 'VAZIO').toUpperCase();
    statusCount[st] = (statusCount[st] || 0) + 1;
  });
  console.log('\n📊 Distribuição por status:');
  Object.entries(statusCount).sort((a,b) => b[1]-a[1]).forEach(([st, count]) => {
    console.log(`   ${st}: ${count}`);
  });

  // Filter valid
  const statusValidos = ['CONFIRMADA', 'FECHADA'];
  const validos = raw.filter(f => statusValidos.includes(String(f.situacao || '').toUpperCase()));
  console.log(`\n✅ Registros válidos (CONFIRMADA + FECHADA): ${validos.length}`);
  const qtdConf = validos.filter(f => String(f.situacao).toUpperCase() === 'CONFIRMADA').length;
  const qtdFech = validos.filter(f => String(f.situacao).toUpperCase() === 'FECHADA').length;
  console.log(`   ↳ CONFIRMADA: ${qtdConf} | FECHADA: ${qtdFech}`);

  // Compare fields: total_cliente vs total_a_receber_cliente
  console.log('\n' + '='.repeat(70));
  console.log('🔬 COMPARAÇÃO: total_cliente vs total_a_receber_cliente');
  console.log('='.repeat(70));
  let iguais = 0, diferentes = 0;
  const exemplos = [];
  raw.forEach(f => {
    const vCliente = parseMoeda(f.total_cliente);
    const vReceber = parseMoeda(f.total_a_receber_cliente);
    if (Math.abs(vCliente - vReceber) < 0.01) {
      iguais++;
    } else {
      diferentes++;
      if (exemplos.length < 5) {
        exemplos.push({ reserva: f.reserva, total_cliente: vCliente, total_a_receber_cliente: vReceber, diff: vReceber - vCliente });
      }
    }
  });
  console.log(`Iguais: ${iguais} | Diferentes: ${diferentes}`);
  if (exemplos.length > 0) {
    console.log('Exemplos de divergência:');
    console.table(exemplos);
  }

  // Totals using total_a_receber_cliente (correct field)
  console.log('\n' + '='.repeat(70));
  console.log('💰 SOMAS USANDO total_a_receber_cliente (campo correto)');
  console.log('='.repeat(70));

  const somaGeralReceber = validos.reduce((s, f) => s + parseMoeda(f.total_a_receber_cliente), 0);
  const somaSoConfirmada = validos.filter(f => String(f.situacao).toUpperCase() === 'CONFIRMADA').reduce((s, f) => s + parseMoeda(f.total_a_receber_cliente), 0);
  const somaSoFechada = validos.filter(f => String(f.situacao).toUpperCase() === 'FECHADA').reduce((s, f) => s + parseMoeda(f.total_a_receber_cliente), 0);
  
  console.log(`Total Geral (CONFIRMADA + FECHADA): ${fmt(somaGeralReceber)}`);
  console.log(`   ↳ Só CONFIRMADA: ${fmt(somaSoConfirmada)}`);
  console.log(`   ↳ Só FECHADA:    ${fmt(somaSoFechada)}`);
  console.log(`   ↳ DIFERENÇA (o que o BI antigo ignorava): ${fmt(somaSoFechada)}`);

  // Totals using total_cliente (old/wrong field)
  const somaGeralCliente = validos.reduce((s, f) => s + parseMoeda(f.total_cliente), 0);
  console.log(`\n   [Comparação] Usando total_cliente: ${fmt(somaGeralCliente)}`);
  console.log(`   [Comparação] Diferença entre campos: ${fmt(somaGeralReceber - somaGeralCliente)}`);

  // Monthly breakdown
  console.log('\n' + '='.repeat(70));
  console.log('📅 SOMA POR MÊS (usando total_a_receber_cliente)');
  console.log('='.repeat(70));
  
  const porMes = {};
  validos.forEach(f => {
    const mes = f.dt_emissao ? f.dt_emissao.slice(0, 7) : '2026-04';
    const val = parseMoeda(f.total_a_receber_cliente);
    if (!porMes[mes]) porMes[mes] = { total: 0, confirmada: 0, fechada: 0, count: 0 };
    porMes[mes].total += val;
    porMes[mes].count += 1;
    if (String(f.situacao).toUpperCase() === 'CONFIRMADA') porMes[mes].confirmada += val;
    if (String(f.situacao).toUpperCase() === 'FECHADA') porMes[mes].fechada += val;
  });

  Object.keys(porMes).sort().forEach(mes => {
    const m = porMes[mes];
    const marker = mes === '2026-04' ? ' <<<< 🎯' : '';
    console.log(`   ${mes}: ${fmt(m.total)} (${m.count} reg | CONFIRMADA: ${fmt(m.confirmada)} | FECHADA: ${fmt(m.fechada)})${marker}`);
  });

  // OLD vs NEW comparison for April/2026
  if (porMes['2026-04']) {
    const abril = porMes['2026-04'];
    console.log('\n' + '='.repeat(70));
    console.log('🎯 ABRIL/2026 — ANTES vs DEPOIS DA CORREÇÃO');
    console.log('='.repeat(70));
    console.log(`   ANTES (só CONFIRMADA):          ${fmt(abril.confirmada)}`);
    console.log(`   DEPOIS (CONFIRMADA + FECHADA):   ${fmt(abril.total)}`);
    console.log(`   DIFERENÇA CORRIGIDA:             ${fmt(abril.fechada)}`);
    console.log(`   Registros em Abril/2026:         ${abril.count}`);
    console.log(`\n   Esperado (Excel): ~R$ 1.900.000`);
    console.log(`   BI corrigido:     ${fmt(abril.total)}`);
  }

  // Check for records without date
  const semData = validos.filter(f => !f.dt_emissao);
  if (semData.length > 0) {
    console.log(`\n⚠️ ${semData.length} registros sem dt_emissao (atribuídos a 2026-04)`);
  }

  // Check for zero/negative values
  const zeros = validos.filter(f => parseMoeda(f.total_a_receber_cliente) === 0);
  const negativos = validos.filter(f => parseMoeda(f.total_a_receber_cliente) < 0);
  if (zeros.length > 0) console.log(`⚠️ ${zeros.length} registros com total_a_receber_cliente = 0`);
  if (negativos.length > 0) console.log(`⚠️ ${negativos.length} registros com total_a_receber_cliente < 0`);

  console.log('\n✅ Auditoria concluída.');
}

main().catch(console.error);
