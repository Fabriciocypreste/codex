import { Media } from '../types';
import { deduplicateMedia, sanitizeTMDBItem } from '../utils/mediaUtils';

const READ_TOKEN = import.meta.env.VITE_TMDB_READ_TOKEN;
const BASE_URL = 'https://api.themoviedb.org/3';
const IMAGE_BASE = 'https://image.tmdb.org/t/p';

const fetchOptions = {
  method: 'GET',
  headers: {
    accept: 'application/json',
    Authorization: `Bearer ${READ_TOKEN}`
  }
};

/**
 * Limpa nomes de gêneros removendo emojis e símbolos decorativos
 */
export function cleanGenreName(genre: string): string {
  return genre
    .replace(/[♦️⭐✔️☠⚔🎬🔥✨💎🎄🎅]/gu, '')
    .replace(/\|/g, '·')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Busca poster/backdrop do TMDB por tmdb_id
 */
async function fetchTMDBById(tmdbId: number, type: 'movie' | 'series'): Promise<{
  poster?: string;
  backdrop?: string;
  overview?: string;
} | null> {
  try {
    const endpoint = type === 'movie' ? 'movie' : 'tv';
    const res = await fetch(`${BASE_URL}/${endpoint}/${tmdbId}?language=pt-BR`, fetchOptions);
    if (!res.ok) {
      if (res.status === 404) return null; // TMDB ID inválido
      return null;
    }
    const data = await res.json();
    const sanitized = sanitizeTMDBItem(data, type);
    if (!sanitized) return null;
    return {
      poster: sanitized.poster_path ? `${IMAGE_BASE}/w500${sanitized.poster_path}` : undefined,
      backdrop: sanitized.backdrop_path ? `${IMAGE_BASE}/original${sanitized.backdrop_path}` : undefined,
      overview: sanitized.overview,
    };
  } catch {
    return null;
  }
}

/**
 * Busca poster/backdrop do TMDB por título
 */
async function searchTMDBByTitle(title: string, type: 'movie' | 'series'): Promise<{
  poster?: string;
  backdrop?: string;
  tmdb_id?: number;
  overview?: string;
} | null> {
  try {
    const endpoint = type === 'movie' ? 'movie' : 'tv';
    const res = await fetch(
      `${BASE_URL}/search/${endpoint}?query=${encodeURIComponent(title)}&language=pt-BR&page=1`,
      fetchOptions
    );
    if (!res.ok) return null;
    const data = await res.json();
    const first = data.results?.[0];
    if (!first) return null;
    const sanitized = sanitizeTMDBItem(first, type);
    if (!sanitized) return null;
    return {
      poster: sanitized.poster_path ? `${IMAGE_BASE}/w500${sanitized.poster_path}` : undefined,
      backdrop: sanitized.backdrop_path ? `${IMAGE_BASE}/original${sanitized.backdrop_path}` : undefined,
      tmdb_id: sanitized.id,
      overview: sanitized.overview,
    };
  } catch {
    return null;
  }
}

/**
 * Enriquecer lista de Media do DB com imagens TMDB oficiais.
 * Processa em lotes de 8 para evitar rate-limit.
 */
export async function enrichWithTMDB(items: Media[]): Promise<Media[]> {
  const enriched: Media[] = [];
  const batchSize = 8;

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const results = await Promise.allSettled(
      batch.map(async (item) => {
        // Se já tem poster TMDB (URL http com tmdb.org), mantém
        if (item.poster && item.poster.includes('tmdb.org')) {
          return item;
        }

        let tmdbData: any = null;

        if (item.tmdb_id && item.tmdb_id > 0) {
          tmdbData = await fetchTMDBById(item.tmdb_id, item.type);
        } else {
          tmdbData = await searchTMDBByTitle(item.title, item.type);
        }

        if (tmdbData) {
          return {
            ...item,
            poster: tmdbData.poster || item.poster,
            backdrop: tmdbData.backdrop || item.backdrop,
            tmdb_id: tmdbData.tmdb_id || item.tmdb_id,
            description: item.description || tmdbData.overview || '',
          };
        }
        return item;
      })
    );

    results.forEach(r => {
      if (r.status === 'fulfilled') enriched.push(r.value);
    });
  }

  return enriched;
}

/**
 * Organizar conteúdo do DB por gênero (limpa nomes de emojis).
 */
export function organizeByGenre(items: Media[]): Map<string, Media[]> {
  const genreMap = new Map<string, Media[]>();

  items.forEach(item => {
    if (Array.isArray(item.genre)) {
      item.genre.forEach(g => {
        const clean = cleanGenreName(g);
        if (!clean || clean.length < 2) return;
        if (!genreMap.has(clean)) genreMap.set(clean, []);
        genreMap.get(clean)!.push(item);
      });
    }
  });

  // Filtrar gêneros com poucos itens e ordenar por quantidade
  return new Map(
    Array.from(genreMap.entries())
      .filter(([_, items]) => items.length >= 2)
      .sort((a, b) => b[1].length - a[1].length)
  );
}

/**
 * Busca trending do TMDB para banners hero
 */
export async function fetchTrendingForBanner(): Promise<Media[]> {
  try {
    const res = await fetch(`${BASE_URL}/trending/all/week?language=pt-BR`, fetchOptions);
    if (!res.ok) return [];
    const data = await res.json();

    return data.results.slice(0, 15).map((item: any) => {
      const sanitized = sanitizeTMDBItem(item, item.media_type === 'movie' ? 'movie' : 'series');
      if (!sanitized) return null;
      return {
        id: `tmdb-${sanitized.media_type}-${sanitized.id}`,
        tmdb_id: sanitized.id,
        title: sanitized.title || sanitized.name,
        type: sanitized.media_type === 'movie' ? 'movie' : 'series',
        description: sanitized.overview,
        rating: sanitized.vote_average?.toFixed(1) || 'N/A',
        year: new Date(sanitized.release_date || sanitized.first_air_date || '').getFullYear() || 2025,
        genre: (sanitized.genre_ids || []).map((id: number) => getGenreName(id)),
        backdrop: sanitized.backdrop_path ? `${IMAGE_BASE}/original${sanitized.backdrop_path}` : '',
        poster: sanitized.poster_path ? `${IMAGE_BASE}/w500${sanitized.poster_path}` : '',
        stars: [],
      };
    }).filter((i: Media | null) => i && i.backdrop && i.poster) as Media[];
  } catch (err) {
    console.warn('Erro ao buscar trending TMDB:', err);
    return [];
  }
}

/**
 * Catálogo Principal:
 * - Usa conteúdo REAL do banco de dados (filmes e séries do Supabase)
 * - Enriquece com imagens oficiais do TMDB
 * - Busca trending para banners
 * - Organiza por gênero, PRIORIZANDO conteúdo local com stream_url
 */
export async function fetchTMDBCatalog(dbMovies: Media[], dbSeries: Media[]): Promise<{
  trendingMovies: Media[];
  trendingSeries: Media[];
  enrichedMovies: Media[];
  enrichedSeries: Media[];
  moviesByGenre: Map<string, Media[]>;
  seriesByGenre: Map<string, Media[]>;
}> {
  // Separar conteúdo local COM stream_url (prioridade alta) 
  const moviesWithStream = dbMovies.filter(m => m.stream_url && m.stream_url.length > 0);
  const seriesWithStream = dbSeries.filter(s => s.stream_url && s.stream_url.length > 0);
  
  // Conteúdo sem stream (para enriquecer depois)
  const moviesWithoutStream = dbMovies.filter(m => !m.stream_url || m.stream_url.length === 0);
  const seriesWithoutStream = dbSeries.filter(s => !s.stream_url || s.stream_url.length === 0);

  // Enriquecer conteúdo sem stream (primeiros 100 cada)
  const toEnrichMovies = moviesWithoutStream.slice(0, 100);
  const toEnrichSeries = seriesWithoutStream.slice(0, 100);

  const [trending, enrichedMoviesEnriched, enrichedSeriesEnriched] = await Promise.all([
    fetchTrendingForBanner(),
    enrichWithTMDB(toEnrichMovies),
    enrichWithTMDB(toEnrichSeries),
  ]);

  // Cruzar trending com DB para herdar stream_url
  const allDbItems = [...dbMovies, ...dbSeries];
  const dbTitleMap = new Map<string, Media>();
  allDbItems.forEach(item => {
    if (item.stream_url) {
      dbTitleMap.set(item.title.toLowerCase().trim(), item);
    }
  });

  const trendingWithUrls = trending.map(t => {
    const dbMatch = dbTitleMap.get(t.title.toLowerCase().trim());
    if (dbMatch?.stream_url) {
      return { ...t, stream_url: dbMatch.stream_url };
    }
    return t;
  });

  const trendingMovies = deduplicateMedia(trendingWithUrls.filter(t => t.type === 'movie' && t.stream_url));
  const trendingSeries = deduplicateMedia(trendingWithUrls.filter(t => t.type === 'series' && t.stream_url));

  // PRIORIDADE: Conteúdo local com stream_url PRIMEIRO, depois enriquecido
  const allMoviesForGenre = deduplicateMedia([...moviesWithStream, ...enrichedMoviesEnriched, ...moviesWithoutStream]);
  const allSeriesForGenre = deduplicateMedia([...seriesWithStream, ...enrichedSeriesEnriched, ...seriesWithoutStream]);

  const moviesByGenre = organizeByGenre(allMoviesForGenre);
  const seriesByGenre = organizeByGenre(allSeriesForGenre);

  return {
    trendingMovies,
    trendingSeries,
    enrichedMovies: allMoviesForGenre,
    enrichedSeries: allSeriesForGenre,
    moviesByGenre,
    seriesByGenre
  };
}

// Mapa de gêneros TMDB (id -> nome em PT)
const GENRE_MAP: Record<number, string> = {
  28: 'Ação', 12: 'Aventura', 16: 'Animação', 35: 'Comédia', 80: 'Crime',
  99: 'Documentário', 18: 'Drama', 10751: 'Família', 14: 'Fantasia',
  36: 'História', 27: 'Terror', 10402: 'Música', 9648: 'Mistério',
  10749: 'Romance', 878: 'Ficção Científica', 10770: 'Cinema TV',
  53: 'Suspense', 10752: 'Guerra', 37: 'Faroeste',
  10759: 'Ação & Aventura', 10762: 'Kids', 10763: 'Notícias',
  10764: 'Reality', 10765: 'Ficção Científica & Fantasia', 10766: 'Novela',
  10767: 'Talk Show', 10768: 'Guerra & Política',
};

function getGenreName(id: number): string {
  return GENRE_MAP[id] || 'Outros';
}

/**
 * Busca conteúdo em massa no TMDB (Discover API)
 */
export async function discoverContent(
  type: 'movie' | 'series',
  params: { year?: number; genreId?: string; page?: number }
): Promise<Media[]> {
  try {
    const endpoint = type === 'movie' ? 'discover/movie' : 'discover/tv';
    const queryParams = new URLSearchParams({
      language: 'pt-BR',
      sort_by: 'popularity.desc',
      page: (params.page || 1).toString(),
      'vote_count.gte': '50', // Filtrar coisas muito desconhecidas
    });

    if (params.year) {
      if (type === 'movie') {
        queryParams.append('primary_release_year', params.year.toString());
      } else {
        queryParams.append('first_air_date_year', params.year.toString());
      }
    }

    if (params.genreId && params.genreId !== 'Todos') {
      queryParams.append('with_genres', params.genreId);
    }

    const res = await fetch(`${BASE_URL}/${endpoint}?${queryParams.toString()}`, fetchOptions);
    if (!res.ok) return [];

    const data = await res.json();

    return data.results.map((item: any) => {
      const sanitized = sanitizeTMDBItem(item, type);
      if (!sanitized) return null;
      return {
        id: `tmdb-${type}-${sanitized.id}`, // ID temporário, será substituído no insert
        tmdb_id: sanitized.id,
        title: sanitized.title || sanitized.name,
        type: type,
        description: sanitized.overview,
        rating: sanitized.vote_average?.toFixed(1) || 'N/A',
        year: new Date(sanitized.release_date || sanitized.first_air_date || '').getFullYear() || params.year || 2025,
        genre: (sanitized.genre_ids || []).map((id: number) => getGenreName(id)),
        backdrop: sanitized.backdrop_path ? `${IMAGE_BASE}/original${sanitized.backdrop_path}` : '',
        poster: sanitized.poster_path ? `${IMAGE_BASE}/w500${sanitized.poster_path}` : '',
        status: 'published', // Conteúdo importado já vem publicado
        stars: [],
      };
    }).filter((i: Media | null) => i && i.poster) as Media[];
  } catch (err) {
    console.warn('Erro no discoverContent:', err);
    return [];
  }
}
