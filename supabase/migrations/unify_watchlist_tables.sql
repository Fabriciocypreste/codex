-- ============================================================
-- MIGRAÇÃO: Unificação de tabelas legadas
-- watchlist → user_library | watch_history → watch_progress
-- ============================================================
-- Data: 2026-02-14
-- Descrição: Elimina fragmentação de dados migrando registros
--            das tabelas legadas para as tabelas unificadas.
-- ============================================================

BEGIN;

-- ============================================================
-- 1. Migrar watchlist → user_library
-- ============================================================
-- A tabela legada usa content_id (UUID) enquanto a unificada usa tmdb_id (TEXT).
-- Fazemos JOIN com movies/series para obter o tmdb_id correspondente.

-- 1a. Migrar favoritos de filmes
INSERT INTO public.user_library (user_id, tmdb_id, media_type, list_type, created_at)
SELECT
    w.user_id,
    m.tmdb_id::TEXT,
    'movie',
    'watchlist',
    w.created_at
FROM public.watchlist w
JOIN public.movies m ON m.id = w.content_id
WHERE w.content_type = 'movie'
  AND m.tmdb_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- 1b. Migrar favoritos de séries
INSERT INTO public.user_library (user_id, tmdb_id, media_type, list_type, created_at)
SELECT
    w.user_id,
    s.tmdb_id::TEXT,
    'series',
    'watchlist',
    w.created_at
FROM public.watchlist w
JOIN public.series s ON s.id = w.content_id
WHERE w.content_type = 'series'
  AND s.tmdb_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- ============================================================
-- 2. Migrar watch_history → watch_progress
-- ============================================================
-- A tabela legada tem progress/total_duration, a unificada tem
-- progress_seconds/total_duration. Fazemos JOIN para obter tmdb_id.

-- 2a. Migrar histórico de filmes
INSERT INTO public.watch_progress (user_id, tmdb_id, media_type, progress_seconds, total_duration, updated_at)
SELECT
    wh.user_id,
    m.tmdb_id::TEXT,
    'movie',
    COALESCE(wh.progress, 0),
    COALESCE(wh.total_duration, 0),
    COALESCE(wh.updated_at, wh.last_watched, NOW())
FROM public.watch_history wh
JOIN public.movies m ON m.id = wh.content_id
WHERE wh.content_type = 'movie'
  AND m.tmdb_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- 2b. Migrar histórico de séries
INSERT INTO public.watch_progress (user_id, tmdb_id, media_type, progress_seconds, total_duration, updated_at)
SELECT
    wh.user_id,
    s.tmdb_id::TEXT,
    'series',
    COALESCE(wh.progress, 0),
    COALESCE(wh.total_duration, 0),
    COALESCE(wh.updated_at, wh.last_watched, NOW())
FROM public.watch_history wh
JOIN public.series s ON s.id = wh.content_id
WHERE wh.content_type = 'series'
  AND s.tmdb_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- ============================================================
-- 3. Remover políticas RLS das tabelas legadas
-- ============================================================
DROP POLICY IF EXISTS "Usuários podem ver sua própria watchlist" ON public.watchlist;
DROP POLICY IF EXISTS "Usuários podem gerenciar sua própria watchlist" ON public.watchlist;
DROP POLICY IF EXISTS "Usuários podem ver seu próprio histórico" ON public.watch_history;
DROP POLICY IF EXISTS "Usuários podem gerenciar seu próprio histórico" ON public.watch_history;

-- ============================================================
-- 4. Remover índices das tabelas legadas
-- ============================================================
DROP INDEX IF EXISTS idx_watchlist_user_id;
DROP INDEX IF EXISTS idx_watch_history_user_id;
DROP INDEX IF EXISTS idx_watch_history_content;

-- ============================================================
-- 5. Remover triggers das tabelas legadas
-- ============================================================
DROP TRIGGER IF EXISTS update_watch_history_updated_at ON public.watch_history;

-- ============================================================
-- 6. Dropar tabelas legadas
-- ============================================================
DROP TABLE IF EXISTS public.watchlist CASCADE;
DROP TABLE IF EXISTS public.watch_history CASCADE;

-- ============================================================
-- 7. Garantir índices compostos nas tabelas unificadas
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_user_library_user_tmdb
    ON public.user_library(user_id, tmdb_id);
CREATE INDEX IF NOT EXISTS idx_user_library_list_type
    ON public.user_library(list_type);
CREATE INDEX IF NOT EXISTS idx_watch_progress_user_tmdb
    ON public.watch_progress(user_id, tmdb_id);
CREATE INDEX IF NOT EXISTS idx_watch_progress_updated
    ON public.watch_progress(updated_at DESC);

-- ============================================================
-- 8. Garantir trigger de updated_at em watch_progress
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_watch_progress_updated_at ON public.watch_progress;
CREATE TRIGGER update_watch_progress_updated_at
    BEFORE UPDATE ON public.watch_progress
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMIT;

-- ============================================================
-- RESULTADO ESPERADO:
-- ✅ Dados de watchlist migrados para user_library
-- ✅ Dados de watch_history migrados para watch_progress
-- ✅ Tabelas legadas removidas (watchlist, watch_history)
-- ✅ Índices otimizados nas tabelas unificadas
-- ✅ Trigger de updated_at ativo em watch_progress
-- ============================================================
