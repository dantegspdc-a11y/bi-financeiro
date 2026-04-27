// Audit script: investigate date parsing and monthly totals discrepancy
// Excel says April = R$ 1,963,526.63 (1318 records), March = R$ 103,790.30
// BI says April = R$ 1,881,704.07 (1248 records), March = R$ 185,612.86 (115 records)
// Difference is ~R$ 81,822 — records being assigned to wrong month

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
  console.log(`Total registros: ${raw.length}\n`);

  // 1. Check dt_emissao format - show first 10 samples
  console.log('='.repeat(70));
  console.log('1️⃣  FORMATO DE dt_emissao (primeiros 20 registros)');
  console.log('='.repeat(70));
  raw.slice(0, 20).forEach((r, i) => {
    console.log(`   [${i}] reserva=${r.reserva} | dt_emissao="${r.dt_emissao}" | type=${typeof r.dt_emissao} | length=${String(r.dt_emissao || '').length}`);
  });

  // 2. Check for different date formats
  console.log('\n' + '='.repeat(70));
  console.log('2️⃣  ANÁLISE DE FORMATOS DE DATA');
  console.log('='.repeat(70));
  const formatGroups = {};
  raw.forEach(r => {
    const dt = String(r.dt_emissao || '');
    let format = 'VAZIO';
    if (dt.match(/^\d{4}-\d{2}-\d{2}$/)) format = 'YYYY-MM-DD';
    else if (dt.match(/^\d{4}-\d{2}-\d{2}T/)) format = 'YYYY-MM-DDT... (timestamp)';
    else if (dt.match(/^\d{2}\/\d{2}\/\d{4}$/)) format = 'DD/MM/YYYY';
    else if (dt.length > 0) format = `OUTRO: "${dt.slice(0, 30)}"`;
    formatGroups[format] = (formatGroups[format] || 0) + 1;
  });
  Object.entries(formatGroups).forEach(([fmt, count]) => {
    console.log(`   ${fmt}: ${count} registros`);
  });

  // 3. Compare month assignment: slice(0,7) vs Date parsing
  console.log('\n' + '='.repeat(70));
  console.log('3️⃣  COMPARAÇÃO: slice(0,7) vs new Date().getMonth()');
  console.log('='.repeat(70));
  
  let disagreements = 0;
  const disagreementExamples = [];
  
  raw.forEach(r => {
    const dt = String(r.dt_emissao || '');
    if (!dt) return;
    
    const sliceMonth = dt.slice(0, 7); // e.g., "2026-04"
    
    // Parse the date the same way businessLogic does
    const parsed = new Date(dt + (dt.includes('T') ? '' : 'T00:00:00'));
    const parsedMonth = `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}`;
    
    if (sliceMonth !== parsedMonth) {
      disagreements++;
      if (disagreementExamples.length < 10) {
        disagreementExamples.push({
          reserva: r.reserva,
          dt_emissao: dt,
          slice_month: sliceMonth,
          parsed_month: parsedMonth,
          total_a_receber: parseMoeda(r.total_a_receber_cliente)
        });
      }
    }
  });
  
  console.log(`   Datas concordam: ${raw.length - disagreements}`);
  console.log(`   Datas DIVERGEM: ${disagreements}`);
  if (disagreementExamples.length > 0) {
    console.log('\n   Exemplos de divergência:');
    console.table(disagreementExamples);
  }

  // 4. Monthly totals using BOTH methods
  console.log('\n' + '='.repeat(70));
  console.log('4️⃣  SOMA MENSAL — MÉTODO slice vs MÉTODO Date.parse');
  console.log('='.repeat(70));
  
  const bySlice = {};
  const byParsed = {};
  
  // Also do Excel-style: just by month number (abril = any year)
  const byMonthOnly = {};
  
  raw.forEach(r => {
    const val = parseMoeda(r.total_a_receber_cliente);
    const dt = String(r.dt_emissao || '');
    
    // Method 1: slice
    const sm = dt ? dt.slice(0, 7) : 'SEM-DATA';
    if (!bySlice[sm]) bySlice[sm] = { total: 0, count: 0 };
    bySlice[sm].total += val;
    bySlice[sm].count += 1;
    
    // Method 2: Date parse
    if (dt) {
      const parsed = new Date(dt + (dt.includes('T') ? '' : 'T00:00:00'));
      const pm = `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}`;
      if (!byParsed[pm]) byParsed[pm] = { total: 0, count: 0 };
      byParsed[pm].total += val;
      byParsed[pm].count += 1;
      
      // By month only (like Excel filter)
      const monthNum = parsed.getMonth() + 1;
      const monthNames = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
      const mn = monthNames[monthNum - 1];
      if (!byMonthOnly[mn]) byMonthOnly[mn] = { total: 0, count: 0 };
      byMonthOnly[mn].total += val;
      byMonthOnly[mn].count += 1;
    }
  });
  
  console.log('\n   MÉTODO SLICE (usado no businessLogic.js para "competencia"):');
  Object.keys(bySlice).sort().forEach(m => {
    const marker = m.includes('03') || m.includes('04') ? ' <<<' : '';
    console.log(`   ${m}: ${fmt(bySlice[m].total)} (${bySlice[m].count} reg)${marker}`);
  });
  
  console.log('\n   MÉTODO DATE.PARSE (usado no agruparPorMes/getMesAno):');
  Object.keys(byParsed).sort().forEach(m => {
    const marker = m.includes('03') || m.includes('04') ? ' <<<' : '';
    console.log(`   ${m}: ${fmt(byParsed[m].total)} (${byParsed[m].count} reg)${marker}`);
  });
  
  console.log('\n   POR MÊS (como filtro Excel - todos os anos):');
  ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'].forEach(m => {
    if (byMonthOnly[m]) {
      const marker = m === 'mar' || m === 'abr' ? ' <<<' : '';
      console.log(`   ${m}: ${fmt(byMonthOnly[m].total)} (${byMonthOnly[m].count} reg)${marker}`);
    }
  });

  // 5. Deep dive into March/April boundary
  console.log('\n' + '='.repeat(70));
  console.log('5️⃣  REGISTROS NA FRONTEIRA MARÇO/ABRIL');
  console.log('='.repeat(70));
  
  const borderRecords = raw.filter(r => {
    const dt = String(r.dt_emissao || '');
    return dt.startsWith('2026-03') || dt.startsWith('2026-04') || 
           dt.startsWith('03/') || dt.startsWith('04/');
  });
  
  // Show last days of March and first days of April
  const lateMarco = raw.filter(r => {
    const dt = String(r.dt_emissao || '');
    return dt >= '2026-03-25' && dt <= '2026-03-31';
  });
  const earlyAbril = raw.filter(r => {
    const dt = String(r.dt_emissao || '');
    return dt >= '2026-04-01' && dt <= '2026-04-05';
  });
  
  console.log(`\n   Últimos dias de Março (25-31):  ${lateMarco.length} registros, ${fmt(lateMarco.reduce((s,r) => s + parseMoeda(r.total_a_receber_cliente), 0))}`);
  console.log(`   Primeiros dias de Abril (01-05): ${earlyAbril.length} registros, ${fmt(earlyAbril.reduce((s,r) => s + parseMoeda(r.total_a_receber_cliente), 0))}`);

  // 6. Check if Excel filter might include ALL "abril" months (not just 2026)
  console.log('\n' + '='.repeat(70));
  console.log('6️⃣  REGISTROS DE ABRIL (QUALQUER ANO) — como Excel filtra');
  console.log('='.repeat(70));
  
  const abrilTodosAnos = raw.filter(r => {
    const dt = String(r.dt_emissao || '');
    if (dt.length >= 7) {
      const month = dt.slice(5, 7);
      return month === '04';
    }
    return false;
  });
  
  const somaAbrilTodos = abrilTodosAnos.reduce((s, r) => s + parseMoeda(r.total_a_receber_cliente), 0);
  console.log(`   Abril (todos os anos): ${abrilTodosAnos.length} registros, ${fmt(somaAbrilTodos)}`);
  console.log(`   Excel espera: 1318 registros, R$ 1.963.526,63`);
  console.log(`   Diferença: ${abrilTodosAnos.length - 1318} registros, ${fmt(somaAbrilTodos - 1963526.63)}`);
  
  // Group by year
  const abrilPorAno = {};
  abrilTodosAnos.forEach(r => {
    const ano = String(r.dt_emissao || '').slice(0, 4);
    if (!abrilPorAno[ano]) abrilPorAno[ano] = { total: 0, count: 0 };
    abrilPorAno[ano].total += parseMoeda(r.total_a_receber_cliente);
    abrilPorAno[ano].count += 1;
  });
  Object.keys(abrilPorAno).sort().forEach(ano => {
    console.log(`     ${ano}: ${abrilPorAno[ano].count} reg, ${fmt(abrilPorAno[ano].total)}`);
  });

  // 7. Check records without dates or with unusual dates
  console.log('\n' + '='.repeat(70));
  console.log('7️⃣  REGISTROS SEM DATA OU COM DATA INVÁLIDA');
  console.log('='.repeat(70));
  
  const semData = raw.filter(r => !r.dt_emissao);
  const dataInvalida = raw.filter(r => {
    const dt = String(r.dt_emissao || '');
    return dt && !dt.match(/^\d{4}-\d{2}-\d{2}/);
  });
  
  console.log(`   Sem dt_emissao: ${semData.length} registros`);
  if (semData.length > 0) {
    const somaSemData = semData.reduce((s, r) => s + parseMoeda(r.total_a_receber_cliente), 0);
    console.log(`   Soma dos sem data: ${fmt(somaSemData)}`);
    console.log('   Primeiros 5:');
    semData.slice(0, 5).forEach(r => {
      console.log(`     reserva=${r.reserva} total_a_receber=${parseMoeda(r.total_a_receber_cliente)} situacao=${r.situacao}`);
    });
  }
  console.log(`   Data em formato inesperado: ${dataInvalida.length} registros`);
  if (dataInvalida.length > 0) {
    dataInvalida.slice(0, 5).forEach(r => {
      console.log(`     reserva=${r.reserva} dt_emissao="${r.dt_emissao}"`);
    });
  }

  // 8. Final summary
  console.log('\n' + '='.repeat(70));
  console.log('📋 RESUMO DA INVESTIGAÇÃO');
  console.log('='.repeat(70));
  console.log(`\n   Excel Abril:  1318 reg, R$ 1.963.526,63`);
  console.log(`   BI Abril:     ${bySlice['2026-04']?.count || '?'} reg, ${fmt(bySlice['2026-04']?.total || 0)} (slice)`);
  console.log(`   BI Abril:     ${byParsed['2026-04']?.count || '?'} reg, ${fmt(byParsed['2026-04']?.total || 0)} (parsed)`);
  console.log(`   Abril todos:  ${abrilTodosAnos.length} reg, ${fmt(somaAbrilTodos)}`);
  console.log(`\n   Excel Março:  R$ 103.790,30`);
  console.log(`   BI Março:     ${bySlice['2026-03']?.count || '?'} reg, ${fmt(bySlice['2026-03']?.total || 0)} (slice)`);
  console.log(`   BI Março:     ${byParsed['2026-03']?.count || '?'} reg, ${fmt(byParsed['2026-03']?.total || 0)} (parsed)`);
  
  console.log('\n✅ Auditoria completa.');
}

main().catch(console.error);
