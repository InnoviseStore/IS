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
  const { data: tenants } = await supabase.from('tenants').select('id, name, slug, settings');
  console.log('Tenants:', tenants?.map(t => ({ id: t.id, name: t.name, slug: t.slug, checkout_mode: t.settings?.checkout_mode, customer_checkout_mode: t.settings?.customer_checkout_mode })));

  const innovise = tenants?.find(t => t.slug === 'innovise');
  console.log('innovise customer_auth_mode en BD:', innovise?.settings?.customer_auth_mode);
  console.log('innovise checkout_mode en BD:', innovise?.settings?.checkout_mode);

  const { data: products } = await supabase
    .from('products')
    .select('id, name, sku, image_url, images, is_active')
    .eq('tenant_id', innovise.id)
    .order('name');

  console.log(`Total productos para ${innovise.name}:`, products?.length);
  products?.forEach(p => {
    console.log(`- [${p.is_active ? 'ACTIVO' : 'INACTIVO'}] ${p.name} | image_url: ${p.image_url}`);
  });
}

run();
