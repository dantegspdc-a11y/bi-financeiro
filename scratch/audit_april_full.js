const supabaseUrl = 'https://npwurtggsykqlupeeffj.supabase.co';
const supabaseKey = 'sb_publishable_d6Ojqr_l2p5m9AiasEg1qQ_FjYwFAmC';

async function check() {
  let allData = [];
  let from = 0;
  let step = 1000;
  
  while (true) {
    const response = await fetch(`${supabaseUrl}/rest/v1/faturamento?dt_emissao=gte.2026-04-01&dt_emissao=lte.2026-04-30&select=*`, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Range': `${from}-${from + step - 1}`
      }
    });
    const data = await response.json();
    if (!data || data.length === 0) break;
    allData = allData.concat(data);
    if (data.length < step) break;
    from += step;
  }
  
  console.log('Total April rows:', allData.length);
  
  const totalA = allData.reduce((s, r) => s + Number(r.total_a_receber_cliente || 0), 0);
  const totalB = allData.reduce((s, r) => s + Number(r.total_cliente || 0), 0);
  
  console.log('Total A (Total a Receber):', totalA);
  console.log('Total B (Total Cliente):', totalB);
  
  const statuses = allData.reduce((acc, curr) => {
    const val = Number(curr.total_a_receber_cliente || 0);
    acc[curr.situacao] = (acc[curr.situacao] || 0) + val;
    return acc;
  }, {});
  console.log('Sum (Total A) by Status:', statuses);
}

check();
