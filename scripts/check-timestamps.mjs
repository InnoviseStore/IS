import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envFile = fs.readFileSync('.env.local', 'utf8');
let url = '';
let key = '';

envFile.split('\n').forEach(line => {
  const [k, ...v] = line.split('=');
  if (k && v.length) {
    const val = v.join('=').trim().replace(/^['"]|['"]$/g, '');
    if (k.trim() === 'NEXT_PUBLIC_SUPABASE_URL') url = val;
    if (k.trim() === 'SUPABASE_SERVICE_ROLE_KEY') key = val;
  }
});

const supabase = createClient(url, key);

async function run() {
  const { data: tenant } = await supabase
    .from('tenants')
    .select('id, name, slug, settings')
    .eq('slug', 'innovise')
    .single();

  console.log('--- ESTADO REAL EN BD SUPABASE ---');
  console.log('tenant:', tenant.name);
  console.log('checkout_mode:', tenant.settings?.checkout_mode);
  console.log('customer_auth_mode:', tenant.settings?.customer_auth_mode);
}

run();
