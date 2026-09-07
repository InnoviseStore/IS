import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: Request) {
  try {
    const { name, slug, phone_whatsapp, adminEmail, adminPassword, plan } = await req.json()

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

    // 2. Insert new tenant
    const { data: newTenant, error: tenantErr } = await supabase
      .from('tenants')
      .insert({
        name: name.trim(),
        slug: cleanSlug,
        phone_whatsapp: phone_whatsapp ? phone_whatsapp.replace(/[^0-9]/g, '') : null,
        currency_rate_bcv: 91.50,
        is_active: true,
        plan: plan || 'pro',
        settings: {
          currency_display: 'USD',
          show_ves_price: true,
          description: `Catálogo oficial de ${name.trim()}`,
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

    return NextResponse.json({
      success: true,
      tenant: newTenant,
      user: { id: authUser.user.id, email: authUser.user.email },
    })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
