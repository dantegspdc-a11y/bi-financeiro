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
  
  let count0 = 0;
  let recovered = 0;
  data.forEach(r => {
    const valA = Number(r.total_a_receber_cliente || 0);
    const valB = Number(r.total_cliente || 0);
    if (valA === 0 && valB > 0) {
      count0++;
      recovered += valB;
    }
  });
  console.log('April rows with 0 in A but >0 in B:', count0);
  console.log('Potential recovery:', recovered);
}

check();
