import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function check() {
  const { data, error } = await supabase.from('faturamento').select('situacao', { count: 'exact' });
  if (error) {
    console.error(error);
    return;
  }
  console.log('Total rows:', data.length);
  const stats = data.reduce((acc, curr) => {
    acc[curr.situacao] = (acc[curr.situacao] || 0) + 1;
    return acc;
  }, {});
  console.log('Statuses:', stats);
  
  const { data: samples } = await supabase.from('faturamento').select('*').limit(5);
  console.log('Samples:', JSON.stringify(samples, null, 2));
}

check();
