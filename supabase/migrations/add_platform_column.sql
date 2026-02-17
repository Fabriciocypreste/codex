-- ============================================
-- MIGRATION: Adicionar coluna platform
-- Executar no Supabase SQL Editor
-- ============================================

-- Adicionar coluna platform nas tabelas movies e series
ALTER TABLE public.movies ADD COLUMN IF NOT EXISTS platform TEXT;
ALTER TABLE public.series ADD COLUMN IF NOT EXISTS platform TEXT;

-- Adicionar coluna trailer_url (usada no admin para URL de trailer customizada)
ALTER TABLE public.movies ADD COLUMN IF NOT EXISTS trailer_url TEXT;
ALTER TABLE public.series ADD COLUMN IF NOT EXISTS trailer_url TEXT;

-- Adicionar coluna use_trailer (flag para usar trailer customizado)
ALTER TABLE public.movies ADD COLUMN IF NOT EXISTS use_trailer BOOLEAN DEFAULT false;
ALTER TABLE public.series ADD COLUMN IF NOT EXISTS use_trailer BOOLEAN DEFAULT false;

-- Índice para filtrar por plataforma
CREATE INDEX IF NOT EXISTS idx_movies_platform ON public.movies(platform) WHERE platform IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_series_platform ON public.series(platform) WHERE platform IS NOT NULL;
