import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Media } from '../types';
import { getCatalogWithFilters } from '../services/supabaseService';
import { getCatalogSettings } from '../services/catalogService';
import { sanitizeMediaList } from '../utils/mediaUtils';
import { fetchTMDBCatalog } from '../services/tmdbCatalog';

interface CatalogState {
  movies: Media[];
  series: Media[];
  trendingMovies: Media[];
  trendingSeries: Media[];
  moviesByGenre: Map<string, Media[]>;
  seriesByGenre: Map<string, Media[]>;
  loading: boolean;
  reload: () => void;
}

const CatalogContext = createContext<CatalogState>({
  movies: [], series: [], trendingMovies: [], trendingSeries: [],
  moviesByGenre: new Map(), seriesByGenre: new Map(),
  loading: true, reload: () => { },
});

export const useCatalog = () => useContext(CatalogContext);

const CACHE_KEY = 'redx-catalog-cache';
const CACHE_TTL = 30 * 60 * 1000;

const removeDuplicates = (mediaList: Media[]) => {
  const seen = new Set();
  return mediaList.filter(m => {
    if (!m.tmdb_id) return true;
    if (seen.has(m.tmdb_id)) return false;
    seen.add(m.tmdb_id);
    return true;
  });
};

const organizeByGenre = (items: Media[]): Map<string, Media[]> => {
  const map = new Map<string, Media[]>();
  items.forEach(item => {
    if (Array.isArray(item.genre)) {
      item.genre.forEach(g => {
        const clean = g.trim();
        if (!clean || clean.length < 2) return;
        if (!map.has(clean)) map.set(clean, []);
        map.get(clean)!.push(item);
      });
    }
  });
  return new Map(
    Array.from(map.entries())
      .filter(([_, items]) => items.length >= 2)
      .sort((a, b) => b[1].length - a[1].length)
  );
};

const sortByRating = (a: Media, b: Media) => {
  const ra = parseFloat(String(a.rating || '0'));
  const rb = parseFloat(String(b.rating || '0'));
  return rb - ra;
};

export const CatalogProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [movies, setMovies] = useState<Media[]>([]);
  const [series, setSeries] = useState<Media[]>([]);
  const [trendingMovies, setTrendingMovies] = useState<Media[]>([]);
  const [trendingSeries, setTrendingSeries] = useState<Media[]>([]);
  const [moviesByGenre, setMoviesByGenre] = useState<Map<string, Media[]>>(new Map());
  const [seriesByGenre, setSeriesByGenre] = useState<Map<string, Media[]>>(new Map());
  const [loading, setLoading] = useState(true);

  const loadingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLoadingRef = useRef(false);

  const applyCatalog = useCallback((cleanMovies: Media[], cleanSeries: Media[], tMovies?: Media[], tSeries?: Media[]) => {
    setMovies(cleanMovies);
    setSeries(cleanSeries);

    // Se vierem as tendências reais do TMDB via API, usamos elas. 
    // Caso contrário, fallback para o que tem no banco de dados.
    const finalTrendingMovies = (tMovies && tMovies.length > 0) ? tMovies : [...cleanMovies].sort(sortByRating).slice(0, 20);
    const finalTrendingSeries = (tSeries && tSeries.length > 0) ? tSeries : [...cleanSeries].sort(sortByRating).slice(0, 20);

    console.log(`📊 [CatalogContext] Trending: ${finalTrendingMovies.length} filmes, ${finalTrendingSeries.length} séries (TMDB: ${tMovies?.length || 0}, Fallback DB: ${finalTrendingMovies.length > 0 && (!tMovies || tMovies.length === 0) ? 'SIM' : 'NÃO'})`);

    setTrendingMovies(finalTrendingMovies);
    setTrendingSeries(finalTrendingSeries);

    setMoviesByGenre(organizeByGenre(cleanMovies));
    setSeriesByGenre(organizeByGenre(cleanSeries));
  }, []);

  const loadData = useCallback(async () => {
    const isMounted = { current: true };

    // Timeout de segurança: 15 segundos para carregar tudo
    isLoadingRef.current = true;
    const timeoutId = setTimeout(() => {
      if (isLoadingRef.current && isMounted.current) {
        console.error('❌ [CatalogContext] Timeout de carga atingido (15s). Forçando interrupção.');
        setLoading(false);
        isLoadingRef.current = false;
      }
    }, 15000);
    loadingTimeoutRef.current = timeoutId;

    try {
      let usedCache = false;
      try {
        const cached = localStorage.getItem(CACHE_KEY);
        if (cached) {
          const { movies: cm, series: cs, timestamp } = JSON.parse(cached);
          if (cm?.length > 0 && Date.now() - timestamp < CACHE_TTL) {
            const cachedMovies = cm.map((m: any) => ({ ...m, type: 'movie' as const })) as Media[];
            const cachedSeries = cs.map((s: any) => ({ ...s, type: 'series' as const })) as Media[];
            applyCatalog(cachedMovies, cachedSeries);
            setLoading(false);
            usedCache = true;
          }
        }
      } catch (cacheErr) {
        console.warn('⚠️ [CatalogContext] Erro ao ler cache:', cacheErr);
      }

      const settings = await getCatalogSettings();
      console.log('🔍 [CatalogContext] Configurações do catálogo:', settings);

      const filters: any = settings ? {
        minYear: settings.min_year || 2018,
        maxYear: settings.max_year,
        genres: settings.selected_genres,
        contentType: settings.content_type
      } : { minYear: 2018 };

      console.log('🔍 [CatalogContext] Aplicando filtros:', filters);
      const { movies: dbMovies, series: dbSeries } = await getCatalogWithFilters(filters);

      console.log(`📦 [CatalogContext] DB Original: ${dbMovies?.length || 0} filmes, ${dbSeries?.length || 0} séries`);

      let dbMoviesTyped = (dbMovies || []).map(m => ({ ...m, type: 'movie' as const })) as Media[];
      let dbSeriesTyped = (dbSeries || []).map(s => ({ ...s, type: 'series' as const })) as Media[];

      // FALLBACK 1: Se o filtro for muito restritivo, tentar 2015
      if ((dbMoviesTyped.length < 5 && dbSeriesTyped.length < 5) && filters.minYear > 2015) {
        console.warn('⚠️ [CatalogContext] Filtro muito restritivo. Tentando carregar desde 2015...');
        const fallback = await getCatalogWithFilters({ minYear: 2015 });
        dbMoviesTyped = (fallback.movies || []).map(m => ({ ...m, type: 'movie' as const })) as Media[];
        dbSeriesTyped = (fallback.series || []).map(s => ({ ...s, type: 'series' as const })) as Media[];
        console.log(`📦 [CatalogContext] Fallback 2015: ${dbMoviesTyped.length} filmes, ${dbSeriesTyped.length} séries`);
      }

      // FALLBACK 2: Se ainda assim estiver vazio, carregar TUDO (Emergency)
      if (dbMoviesTyped.length === 0 && dbSeriesTyped.length === 0) {
        console.warn('🚨 [CatalogContext] Catálogo vazio! Carregando tudo sem filtros.');
        const emergency = await getCatalogWithFilters({});
        dbMoviesTyped = (emergency.movies || []).map(m => ({ ...m, type: 'movie' as const })) as Media[];
        dbSeriesTyped = (emergency.series || []).map(s => ({ ...s, type: 'series' as const })) as Media[];
      }

      dbMoviesTyped = removeDuplicates(dbMoviesTyped);
      dbSeriesTyped = removeDuplicates(dbSeriesTyped);

      const cleanMovies = sanitizeMediaList(dbMoviesTyped);
      const cleanSeries = sanitizeMediaList(dbSeriesTyped);

      console.log(`✨ [CatalogContext] Catálogo Sanitizado: ${cleanMovies.length} filmes, ${cleanSeries.length} séries`);

      // --- ENRIQUECIMENTO COM TMDB API ---
      try {
        const { trendingMovies: tMovies, trendingSeries: tSeries, enrichedMovies, enrichedSeries } = await fetchTMDBCatalog(cleanMovies, cleanSeries);

        console.log(`🚀 [CatalogContext] Final: ${enrichedMovies.length} filmes, ${enrichedSeries.length} séries, ${tMovies.length} trending`);
        applyCatalog(enrichedMovies, enrichedSeries, tMovies, tSeries);

        try {
          const cacheData = {
            movies: enrichedMovies.slice(0, 500),
            series: enrichedSeries.slice(0, 500),
            timestamp: Date.now(),
          };
          localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));
        } catch (cacheWriteErr) {
          console.warn('⚠️ [CatalogContext] Erro ao escrever cache:', cacheWriteErr);
        }

      } catch (tmdbErr) {
        console.error('❌ [CatalogContext] Erro ao enriquecer com TMDB. Usando dados puros do DB.', tmdbErr);
        // Fallback: usar dados sem enriquecimento
        applyCatalog(cleanMovies, cleanSeries, [], []);
      }

    } catch (error) {
      console.error('❌ [CatalogContext] Erro crítico ao carregar catálogo:', error);
    } finally {
      setLoading(false);
      isLoadingRef.current = false;
      if (timeoutId) clearTimeout(timeoutId);
    }

    return () => { isMounted.current = false; };
  }, [applyCatalog]);

  useEffect(() => { loadData(); }, [loadData]);

  const value = useMemo(() => ({
    movies, series, trendingMovies, trendingSeries,
    moviesByGenre, seriesByGenre, loading, reload: loadData,
  }), [movies, series, trendingMovies, trendingSeries, moviesByGenre, seriesByGenre, loading, loadData]);

  return <CatalogContext.Provider value={value}>{children}</CatalogContext.Provider>;
};
