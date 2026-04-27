const supabaseUrl = 'https://npwurtggsykqlupeeffj.supabase.co';
const supabaseKey = 'sb_publishable_d6Ojqr_l2p5m9AiasEg1qQ_FjYwFAmC';

async function check() {
  const response = await fetch(`${supabaseUrl}/rest/v1/faturamento?dt_emissao=gte.2026-04-01&dt_emissao=lte.2026-04-30`, {
    headers: {
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`
    }
  });
  const data = await response.json();
  console.log('April rows:', data.length);
  
  const totalA = data.reduce((s, r) => s + Number(r.total_a_receber_cliente || 0), 0);
  const totalB = data.reduce((s, r) => s + Number(r.total_cliente || 0), 0);
  const totalBoth = data.reduce((s, r) => s + Number(r.total_a_receber_cliente ?? r.total_cliente ?? 0), 0);
  
  console.log('Total A (Total a Receber):', totalA);
  console.log('Total B (Total Cliente):', totalB);
  console.log('Total Combined (??):', totalBoth);
  
  const statuses = data.reduce((acc, curr) => {
    acc[curr.situacao] = (acc[curr.situacao] || 0) + Number(curr.total_a_receber_cliente ?? curr.total_cliente ?? 0);
    return acc;
  }, {});
  console.log('Sum by Status:', statuses);
}

check();
