-- ============================================================
-- Migration 28: Page Views Analytics
-- Tabla de visitas para analíticas de alcance por tienda
-- ============================================================

-- Tabla principal de eventos de visita
CREATE TABLE IF NOT EXISTS public.page_views (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  tenant_slug   TEXT        NOT NULL,
  session_id    TEXT        NOT NULL,
  path          TEXT        NOT NULL DEFAULT '/',
  user_agent    TEXT,
  visited_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices para consultas rápidas de analíticas
CREATE INDEX IF NOT EXISTS idx_page_views_tenant_id      ON public.page_views (tenant_id);
CREATE INDEX IF NOT EXISTS idx_page_views_tenant_slug    ON public.page_views (tenant_slug);
CREATE INDEX IF NOT EXISTS idx_page_views_visited_at     ON public.page_views (visited_at DESC);
CREATE INDEX IF NOT EXISTS idx_page_views_session        ON public.page_views (session_id, tenant_id, visited_at DESC);

-- Habilitar RLS
ALTER TABLE public.page_views ENABLE ROW LEVEL SECURITY;

-- Solo superadmin puede leer (a través del service role en la API)
-- La inserción se hace siempre con service role key (bypassa RLS)
CREATE POLICY "superadmin_read_page_views"
  ON public.page_views
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role = 'superadmin'
    )
  );

-- Comentarios descriptivos
COMMENT ON TABLE public.page_views IS 'Eventos de visita al catálogo público por tenant. Deduplicados por session_id (1 evento por sesión cada 4h).';
COMMENT ON COLUMN public.page_views.session_id IS 'ID de sesión generado en el navegador del visitante (sessionStorage). No identifica al usuario.';
COMMENT ON COLUMN public.page_views.path IS 'Ruta visitada dentro del catálogo, e.g. /innovise o /innovise/p/producto-x';
