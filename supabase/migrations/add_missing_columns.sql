-- ============================================
-- MIGRATION: Adicionar colunas faltantes
-- Executar no Supabase SQL Editor
-- ============================================

-- 1. Adicionar stream_url na tabela series (CRÍTICO - sem isso, séries não podem ter URL de stream)
ALTER TABLE public.series ADD COLUMN IF NOT EXISTS stream_url TEXT;

-- 2. Adicionar status nas duas tabelas (para controle de publicação via Admin)
ALTER TABLE public.movies ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'published';
ALTER TABLE public.series ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'published';

-- 3. Índices para performance de busca por status
CREATE INDEX IF NOT EXISTS idx_movies_status ON public.movies(status);
CREATE INDEX IF NOT EXISTS idx_series_status ON public.series(status);

-- 4. Índices para busca por stream_url (filtrar conteúdo com stream)
CREATE INDEX IF NOT EXISTS idx_movies_stream_url ON public.movies(stream_url) WHERE stream_url IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_series_stream_url ON public.series(stream_url) WHERE stream_url IS NOT NULL;
