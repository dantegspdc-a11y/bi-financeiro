const supabaseUrl = 'https://npwurtggsykqlupeeffj.supabase.co';
const supabaseKey = 'sb_publishable_d6Ojqr_l2p5m9AiasEg1qQ_FjYwFAmC';

async function check() {
  let allData = [];
  let from = 0;
  let step = 1000;
  
  while (true) {
    const response = await fetch(`${supabaseUrl}/rest/v1/faturamento?select=*`, {
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
  
  console.log('Total records in Supabase:', allData.length);
  
  const april = allData.filter(r => r.dt_emissao && r.dt_emissao.startsWith('2026-04'));
  console.log('April records:', april.length);
  
  const totalApril = april.reduce((s, r) => s + Number(r.total_a_receber_cliente || 0), 0);
  console.log('April Total (Total a Receber):', totalApril);
}

check();
