
-- Adicionar coluna original_title na tabela movies
ALTER TABLE public.movies ADD COLUMN IF NOT EXISTS original_title TEXT;

-- Adicionar coluna original_title na tabela series (para garantir)
ALTER TABLE public.series ADD COLUMN IF NOT EXISTS original_title TEXT;

-- Garantir que outras colunas que possam faltar existam
ALTER TABLE public.movies ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.series ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
