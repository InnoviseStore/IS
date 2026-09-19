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

async function checkAll() {
  const { data: tenants } = await supabase.from('tenants').select('id, slug');
  const innovise = tenants?.find(t => t.slug === 'innovise');

  const { data: products } = await supabase
    .from('products')
    .select('id, name, sku, image_url, images')
    .eq('tenant_id', innovise.id)
    .order('name');

  console.log(`Verificando ${products.length} productos...\n`);

  for (const p of products) {
    if (!p.image_url) {
      console.log(`[SIN URL] ${p.name}`);
      continue;
    }
    if (p.image_url.startsWith('data:')) {
      console.log(`[DATA URI BASE64 - ${Math.round(p.image_url.length / 1024)} KB] ${p.name}`);
      continue;
    }
    try {
      const res = await fetch(p.image_url, { method: 'HEAD' });
      if (res.status >= 200 && res.status < 300) {
        console.log(`[OK ${res.status}] ${p.name}`);
      } else {
        console.log(`[ERROR ${res.status}] ${p.name} -> ${p.image_url.slice(0, 70)}...`);
      }
    } catch (e) {
      console.log(`[FETCH FAILED: ${e.message}] ${p.name} -> ${p.image_url.slice(0, 70)}...`);
    }
  }
}

checkAll();
