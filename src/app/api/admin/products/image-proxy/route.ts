import { NextResponse } from 'next/server'
import { authenticateApiRequest } from '@/lib/auth/serverAuth'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  try {
    const { auth, errorResponse } = await authenticateApiRequest({
      requiredRoles: ['superadmin', 'owner', 'admin', 'almacen', 'vendedor', 'cajero', 'cashier'],
    })
    if (errorResponse || !auth) {
      return errorResponse!
    }

    const { searchParams } = new URL(req.url)
    const imageUrl = searchParams.get('url')

    if (!imageUrl || (!imageUrl.startsWith('http://') && !imageUrl.startsWith('https://'))) {
      return NextResponse.json({ error: 'URL de imagen inválida.' }, { status: 400 })
    }

    const response = await fetch(imageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; InnoviseImageEditor/1.0)',
        Accept: 'image/*,*/*;q=0.8',
      },
    })

    if (!response.ok) {
      return NextResponse.json(
        { error: `No se pudo descargar la imagen remota (${response.status}).` },
        { status: 400 }
      )
    }

    const contentType = response.headers.get('content-type') || 'image/jpeg'
    const arrayBuffer = await response.arrayBuffer()
    const base64 = Buffer.from(arrayBuffer).toString('base64')
    const dataUrl = `data:${contentType};base64,${base64}`

    return NextResponse.json({ success: true, dataUrl })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error al procesar imagen remota.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
