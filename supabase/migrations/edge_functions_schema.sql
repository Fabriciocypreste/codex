
-- Tabela de Cache do TMDB (evita chamadas excessivas)
CREATE TABLE IF NOT EXISTS public.content_tmdb_cache (
    tmdb_id INTEGER NOT NULL,
    media_type TEXT NOT NULL, -- 'movie' or 'tv'
    data JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (tmdb_id, media_type)
);

-- Tabela de Arquivos de Conteúdo (para gerar URLs seguras)
CREATE TABLE IF NOT EXISTS public.content_files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content_id UUID, -- Link para movies.id ou series.id (opcional, pode ser loose coupling)
    tmdb_id INTEGER,
    media_type TEXT,
    file_path TEXT NOT NULL, -- Caminho no Storage (ex: 'movies/inception.mp4')
    bucket_id TEXT NOT NULL DEFAULT 'videos',
    quality TEXT DEFAULT '1080p',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_content_tmdb_cache_updated ON public.content_tmdb_cache(updated_at);
CREATE INDEX IF NOT EXISTS idx_content_files_tmdb ON public.content_files(tmdb_id, media_type);

-- Full Text Search para Catálogo (Movies)
ALTER TABLE public.movies ADD COLUMN IF NOT EXISTS search_vector tsvector;
CREATE INDEX IF NOT EXISTS idx_movies_search ON public.movies USING GIN(search_vector);

CREATE OR REPLACE FUNCTION movies_search_trigger() RETURNS trigger AS $$
BEGIN
  new.search_vector :=
    setweight(to_tsvector('portuguese', coalesce(new.title, '')), 'A') ||
    setweight(to_tsvector('portuguese', coalesce(new.description, '')), 'B');
  return new;
END
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tsvectorupdate_movies ON public.movies;
CREATE TRIGGER tsvectorupdate_movies BEFORE INSERT OR UPDATE
    ON public.movies FOR EACH ROW EXECUTE PROCEDURE movies_search_trigger();

-- Full Text Search para Catálogo (Series)
ALTER TABLE public.series ADD COLUMN IF NOT EXISTS search_vector tsvector;
CREATE INDEX IF NOT EXISTS idx_series_search ON public.series USING GIN(search_vector);

CREATE OR REPLACE FUNCTION series_search_trigger() RETURNS trigger AS $$
BEGIN
  new.search_vector :=
    setweight(to_tsvector('portuguese', coalesce(new.title, '')), 'A') ||
    setweight(to_tsvector('portuguese', coalesce(new.description, '')), 'B');
  return new;
END
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tsvectorupdate_series ON public.series;
CREATE TRIGGER tsvectorupdate_series BEFORE INSERT OR UPDATE
    ON public.series FOR EACH ROW EXECUTE PROCEDURE series_search_trigger();

-- Função RPC para paginação eficiente
CREATE OR REPLACE FUNCTION public.rpc_get_catalog(
  p_type TEXT,
  p_page INTEGER,
  p_limit INTEGER,
  p_search TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_offset INTEGER;
  v_result JSONB;
  v_total INTEGER;
BEGIN
  v_offset := (p_page - 1) * p_limit;

  IF p_type = 'movie' THEN
    SELECT count(*) INTO v_total FROM public.movies 
    WHERE (p_search IS NULL OR search_vector @@ plainto_tsquery('portuguese', p_search));

    SELECT jsonb_build_object(
      'data', jsonb_agg(t),
      'total', v_total,
      'page', p_page,
      'limit', p_limit
    ) INTO v_result
    FROM (
      SELECT * FROM public.movies
      WHERE (p_search IS NULL OR search_vector @@ plainto_tsquery('portuguese', p_search))
      ORDER BY created_at DESC
      LIMIT p_limit OFFSET v_offset
    ) t;

  ELSIF p_type = 'series' THEN
    SELECT count(*) INTO v_total FROM public.series
    WHERE (p_search IS NULL OR search_vector @@ plainto_tsquery('portuguese', p_search));

    SELECT jsonb_build_object(
      'data', jsonb_agg(t),
      'total', v_total,
      'page', p_page,
      'limit', p_limit
    ) INTO v_result
    FROM (
      SELECT * FROM public.series
      WHERE (p_search IS NULL OR search_vector @@ plainto_tsquery('portuguese', p_search))
      ORDER BY created_at DESC
      LIMIT p_limit OFFSET v_offset
    ) t;
  
  ELSE
    RAISE EXCEPTION 'Invalid type';
  END IF;

  RETURN v_result;
END;
$$;

-- Proteger RPC
REVOKE EXECUTE ON FUNCTION public.rpc_get_catalog(TEXT, INTEGER, INTEGER, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_get_catalog(TEXT, INTEGER, INTEGER, TEXT) TO service_role;
