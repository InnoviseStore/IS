import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: Request) {
  try {
    const {
      name,
      slug,
      phone_whatsapp,
      adminEmail,
      adminPassword,
      plan,
      rubro,
      logo_url,
      isotype_url,
      imagotype_url,
      slogan,
      instagram_handle,
      theme,
      suggested_categories,
      createSampleProducts,
      sampleProducts,
    } = await req.json()

    if (!name || !slug || !adminEmail || !adminPassword) {
      return NextResponse.json(
        { error: 'Nombre, slug, email y contraseña son obligatorios.' },
        { status: 400 }
      )
    }

    const cleanSlug = slug.toLowerCase().trim().replace(/[^a-z0-9-]/g, '')

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
    const supabase = createClient(supabaseUrl, serviceRoleKey)

    // 1. Check if slug already exists
    const { data: existingTenant } = await supabase
      .from('tenants')
      .select('id')
      .eq('slug', cleanSlug)
      .maybeSingle()

    if (existingTenant) {
      return NextResponse.json(
        { error: `El slug "${cleanSlug}" ya está en uso por otra tienda.` },
        { status: 409 }
      )
    }

    const cleanPhone = phone_whatsapp ? phone_whatsapp.replace(/[^0-9]/g, '') : null
    const cleanInstagram = instagram_handle ? instagram_handle.replace(/^@/, '').trim() : null
    const finalLogoUrl = imagotype_url || logo_url || isotype_url || '/logo.png'

    // 2. Insert new tenant with complete branding and settings
    const { data: newTenant, error: tenantErr } = await supabase
      .from('tenants')
      .insert({
        name: name.trim(),
        slug: cleanSlug,
        phone_whatsapp: cleanPhone,
        currency_rate_bcv: 91.50,
        settings: {
          is_active: true,
          plan: plan || 'pro',
          currency_display: 'USD',
          show_ves_price: true,
          description: slogan || `Catálogo oficial de ${name.trim()}`,
          slogan: slogan || `Catálogo oficial de ${name.trim()}`,
          rubro: rubro || 'general',
          logo_url: finalLogoUrl,
          isotype_url: isotype_url || null,
          imagotype_url: imagotype_url || null,
          instagram_handle: cleanInstagram,
          theme: theme || { primaryColor: '#2563eb', accentColor: '#4f46e5' },
          suggested_categories: Array.isArray(suggested_categories) ? suggested_categories : [],
        },
      })
      .select()
      .single()

    if (tenantErr || !newTenant) {
      throw new Error(tenantErr?.message || 'Error al registrar el comercio en la base de datos.')
    }

    // 3. Create owner user in Supabase Auth
    const { data: authUser, error: authErr } = await supabase.auth.admin.createUser({
      email: adminEmail.trim(),
      password: adminPassword,
      email_confirm: true,
      user_metadata: {
        full_name: `Dueño ${name.trim()}`,
        tenant_id: newTenant.id,
      },
    })

    if (authErr || !authUser.user) {
      // Rollback tenant creation
      await supabase.from('tenants').delete().eq('id', newTenant.id)
      throw new Error(authErr?.message || 'Error al crear la cuenta de acceso del usuario.')
    }

    // 4. Create profile with 'owner' role for this tenant
    const { error: profileErr } = await supabase.from('profiles').insert({
      id: authUser.user.id,
      tenant_id: newTenant.id,
      full_name: `Dueño ${name.trim()}`,
      email: adminEmail.trim(),
      role: 'owner',
    })

    if (profileErr) {
      throw new Error(profileErr.message)
    }

    // 5. Optional starter products for immediate catalog readiness
    if (createSampleProducts && Array.isArray(sampleProducts) && sampleProducts.length > 0) {
      try {
        const starterRows = sampleProducts.map((sp: { name: string; sku: string; description: string; base_price_usd: number; cost_usd: number; stock?: number }) => ({
          tenant_id: newTenant.id,
          name: sp.name,
          sku: sp.sku,
          description: sp.description,
          base_price_usd: sp.base_price_usd,
          cost_usd: sp.cost_usd,
          stock: sp.stock || 10,
          is_active: true,
        }))
        await supabase.from('products').insert(starterRows)
      } catch (prodErr) {
        console.warn('Could not insert sample products:', prodErr)
      }
    }

    return NextResponse.json({
      success: true,
      tenant: newTenant,
      user: { id: authUser.user.id, email: authUser.user.email },
    })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
