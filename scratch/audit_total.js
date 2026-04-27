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
  
  console.log('Total records:', allData.length);
  
  const validStatus = ['CONFIRMADA', 'FECHADA'];
  const validData = allData.filter(r => validStatus.includes(String(r.situacao || '').toUpperCase()));
  console.log('Valid Status records:', validData.length);

  const totalA = validData.reduce((s, r) => s + Number(r.total_a_receber_cliente || 0), 0);
  console.log('Total (Total a Receber):', totalA);
  
  const months = validData.reduce((acc, curr) => {
    const mes = curr.dt_emissao ? curr.dt_emissao.slice(0, 7) : 'SEM DATA';
    acc[mes] = (acc[mes] || 0) + Number(curr.total_a_receber_cliente || 0);
    return acc;
  }, {});
  console.log('By Month:', months);
}

check();
