-- =============================================
-- MIGRATION: Criar tabelas user_library e watch_progress
-- Execute no Supabase SQL Editor (Dashboard > SQL)
-- =============================================

-- ═══════════════════════════════════════════════
-- TABELA: user_library (Watchlist + Assistir Depois)
-- ═══════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.user_library (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    tmdb_id TEXT NOT NULL,
    media_type TEXT NOT NULL CHECK (media_type IN ('movie', 'tv')),
    list_type TEXT NOT NULL CHECK (list_type IN ('watchlist', 'watch_later')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, tmdb_id, list_type)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_user_library_user_id ON public.user_library(user_id);
CREATE INDEX IF NOT EXISTS idx_user_library_tmdb_id ON public.user_library(tmdb_id);
CREATE INDEX IF NOT EXISTS idx_user_library_list_type ON public.user_library(user_id, list_type);

-- RLS
ALTER TABLE public.user_library ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários podem ver sua própria library"
    ON public.user_library FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem inserir na própria library"
    ON public.user_library FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuários podem deletar da própria library"
    ON public.user_library FOR DELETE
    USING (auth.uid() = user_id);

-- ═══════════════════════════════════════════════
-- TABELA: watch_progress (Progresso de vídeo)
-- ═══════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.watch_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    tmdb_id TEXT NOT NULL,
    media_type TEXT NOT NULL CHECK (media_type IN ('movie', 'tv')),
    progress_seconds INTEGER DEFAULT 0,
    total_duration INTEGER,
    season_number INTEGER DEFAULT 0,
    episode_number INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, tmdb_id, season_number, episode_number)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_watch_progress_user_id ON public.watch_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_watch_progress_tmdb_id ON public.watch_progress(tmdb_id);
CREATE INDEX IF NOT EXISTS idx_watch_progress_updated ON public.watch_progress(user_id, updated_at DESC);

-- RLS
ALTER TABLE public.watch_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários podem ver seu próprio progresso"
    ON public.watch_progress FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem salvar seu próprio progresso"
    ON public.watch_progress FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuários podem atualizar seu próprio progresso"
    ON public.watch_progress FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem deletar seu próprio progresso"
    ON public.watch_progress FOR DELETE
    USING (auth.uid() = user_id);
