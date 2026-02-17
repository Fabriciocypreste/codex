-- RLS hardening for tables flagged in audit:
-- seasons, episodes, catalog_settings, user_devices

-- Enable RLS where tables exist
ALTER TABLE IF EXISTS public.seasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.episodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.catalog_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.user_devices ENABLE ROW LEVEL SECURITY;

-- Optional defense-in-depth
ALTER TABLE IF EXISTS public.seasons FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.episodes FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.catalog_settings FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.user_devices FORCE ROW LEVEL SECURITY;

-- seasons
DROP POLICY IF EXISTS "Seasons visiveis para autenticados" ON public.seasons;
DROP POLICY IF EXISTS "Admins gerenciam seasons" ON public.seasons;

CREATE POLICY "Seasons visiveis para autenticados"
  ON public.seasons
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins gerenciam seasons"
  ON public.seasons
  FOR ALL
  TO authenticated
  USING (auth.jwt() ->> 'role' = 'admin')
  WITH CHECK (auth.jwt() ->> 'role' = 'admin');

-- episodes
DROP POLICY IF EXISTS "Episodes visiveis para autenticados" ON public.episodes;
DROP POLICY IF EXISTS "Admins gerenciam episodes" ON public.episodes;

CREATE POLICY "Episodes visiveis para autenticados"
  ON public.episodes
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins gerenciam episodes"
  ON public.episodes
  FOR ALL
  TO authenticated
  USING (auth.jwt() ->> 'role' = 'admin')
  WITH CHECK (auth.jwt() ->> 'role' = 'admin');

-- catalog_settings
DROP POLICY IF EXISTS "Catalog settings visivel para autenticados" ON public.catalog_settings;
DROP POLICY IF EXISTS "Admins gerenciam catalog settings" ON public.catalog_settings;

CREATE POLICY "Catalog settings visivel para autenticados"
  ON public.catalog_settings
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins gerenciam catalog settings"
  ON public.catalog_settings
  FOR ALL
  TO authenticated
  USING (auth.jwt() ->> 'role' = 'admin')
  WITH CHECK (auth.jwt() ->> 'role' = 'admin');

-- user_devices
DROP POLICY IF EXISTS "Usuarios veem seus user_devices" ON public.user_devices;
DROP POLICY IF EXISTS "Usuarios gerenciam seus user_devices" ON public.user_devices;

CREATE POLICY "Usuarios veem seus user_devices"
  ON public.user_devices
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Usuarios gerenciam seus user_devices"
  ON public.user_devices
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
