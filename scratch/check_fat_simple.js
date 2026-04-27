const supabaseUrl = 'https://npwurtggsykqlupeeffj.supabase.co';
const supabaseKey = 'sb_publishable_d6Ojqr_l2p5m9AiasEg1qQ_FjYwFAmC';

async function check() {
  const response = await fetch(`${supabaseUrl}/rest/v1/faturamento?select=situacao`, {
    headers: {
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`
    }
  });
  const data = await response.json();
  console.log('Total rows:', data.length);
  const stats = data.reduce((acc, curr) => {
    acc[curr.situacao] = (acc[curr.situacao] || 0) + 1;
    return acc;
  }, {});
  console.log('Statuses:', stats);

  const resSamples = await fetch(`${supabaseUrl}/rest/v1/faturamento?select=*&limit=5`, {
    headers: {
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`
    }
  });
  const samples = await resSamples.json();
  console.log('Samples:', JSON.stringify(samples, null, 2));
}

check();
