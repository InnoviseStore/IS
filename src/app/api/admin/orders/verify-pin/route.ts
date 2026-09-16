import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { authenticateApiRequest } from '@/lib/auth/serverAuth'

function getAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { tenant_id, pin } = body

    if (!tenant_id || !pin) {
      return NextResponse.json(
        { error: 'El ID de la tienda y la clave son obligatorios.' },
        { status: 400 }
      )
    }

    // 1. Validar autenticación
    const { auth, errorResponse } = await authenticateApiRequest({
      requiredRoles: ['superadmin', 'owner', 'admin', 'cashier', 'cajero'],
      targetTenantId: tenant_id,
    })
    if (errorResponse || !auth) {
      return errorResponse!
    }

    const supabase = getAdminClient()
    const { data: tenant, error } = await supabase
      .from('tenants')
      .select('settings')
      .eq('id', tenant_id)
      .single()

    if (error || !tenant) {
      return NextResponse.json({ error: 'Tienda no encontrada.' }, { status: 404 })
    }

    const settings = (tenant.settings || {}) as Record<string, any>
    const configuredPin = settings.admin_security_pin || '1234'

    const isValid = String(pin).trim() === String(configuredPin).trim()

    if (!isValid) {
      return NextResponse.json(
        { valid: false, error: 'Clave de Administrador incorrecta.' },
        { status: 401 }
      )
    }

    return NextResponse.json({ valid: true, message: 'Clave autorizada con éxito.' })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error al verificar clave.'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
