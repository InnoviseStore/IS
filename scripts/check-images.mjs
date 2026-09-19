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
  const innovise = tenants?.find(t => t.slug === 'innovise');

  const { data: products } = await supabase
    .from('products')
    .select('id, name, sku, image_url, images, is_active')
    .eq('tenant_id', innovise.id)
    .order('name');

  const withImage = products?.filter(p => p.image_url) || [];
  const withoutImage = products?.filter(p => !p.image_url) || [];

  console.log(`Total productos: ${products?.length}`);
  console.log(`Con imagen: ${withImage.length}`);
  console.log(`Sin imagen: ${withoutImage.length}`);

  console.log('\n--- PRODUCTOS SIN IMAGEN ---');
  withoutImage.forEach(p => console.log(`- ${p.name} (SKU: ${p.sku})`));

  console.log('\n--- PRODUCTOS CON IMAGEN (Dominios de las imágenes) ---');
  withImage.forEach(p => {
    try {
      const u = new URL(p.image_url);
      console.log(`- ${p.name}: [${u.hostname}] ${p.image_url.slice(0, 80)}...`);
    } catch (e) {
      console.log(`- ${p.name}: [INVALID URL] ${p.image_url}`);
    }
  });
}

run();
