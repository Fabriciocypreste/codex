import { Media, SeriesDetail, CastMember, CrewMember, Episode, SimilarSeries, Video, WatchProvider, PersonDetail } from '../types';

const API_KEY = import.meta.env.VITE_TMDB_API_KEY;
const READ_TOKEN = import.meta.env.VITE_TMDB_READ_TOKEN;
const BASE_URL = 'https://api.themoviedb.org/3';
const IMAGE_BASE_URL = 'https://image.tmdb.org/t/p';
const IMAGE_BASE = 'https://image.tmdb.org/t/p/original';

const fetchOptions = {
  method: 'GET',
  headers: {
    accept: 'application/json',
    Authorization: `Bearer ${READ_TOKEN}`
  }
};

const handleResponse = async (response: Response, errorMessage: string) => {
  if (!response.ok) throw new Error(`${errorMessage} (${response.status})`);
  return response.json();
};

export const getImageUrl = (path: string | null, size: 'original' | 'w500' | 'w200' | 'w1280' | 'w780' | 'h632' = 'original') => {
  if (!path) return 'https://images.unsplash.com/photo-1626814026160-2237a95fc5a0?q=80&w=500&auto=format&fit=crop';
  return `${IMAGE_BASE_URL}/${size}${path}`;
};

export const fetchMovies = async (type: 'popular' | 'top_rated' = 'popular'): Promise<Media[]> => {
  const res = await fetch(`${BASE_URL}/movie/${type}?language=pt-BR`, fetchOptions);
  const data = await res.json();
  return Promise.all(data.results.map((item: any) => transformTMDBItem(item, 'movie')));
};

export const fetchSeries = async (type: 'popular' | 'top_rated' = 'popular'): Promise<Media[]> => {
  const res = await fetch(`${BASE_URL}/tv/${type}?language=pt-BR`, fetchOptions);
  const data = await res.json();
  return Promise.all(data.results.map((item: any) => transformTMDBItem(item, 'series')));
};

export const getTrailer = async (id: number, type: 'movie' | 'series'): Promise<string | undefined> => {
  const res = await fetch(`${BASE_URL}/${type === 'movie' ? 'movie' : 'tv'}/${id}/videos?language=pt-BR`, fetchOptions);
  const data = await res.json();
  const trailer = data.results?.find((v: any) => v.type === 'Trailer' && v.site === 'YouTube');
  return trailer?.key;
};

export const getMediaDetailsByID = async (id: number, type: 'movie' | 'series') => {
  try {
    const res = await fetch(`${BASE_URL}/${type === 'movie' ? 'movie' : 'tv'}/${id}?append_to_response=videos,images&include_image_language=pt,en,null&language=pt-BR`, fetchOptions);
    const data = await res.json();

    const trailer = data.videos?.results?.find((v: any) => v.type === 'Trailer' && v.site === 'YouTube' && (v.iso_639_1 === 'pt' || v.name.toLowerCase().includes('dublado'))) ||
      data.videos?.results?.find((v: any) => v.type === 'Trailer' && v.site === 'YouTube');

    const logo = data.images?.logos?.find((l: any) => l.iso_639_1 === 'pt') ||
      data.images?.logos?.find((l: any) => l.iso_639_1 === 'en') ||
      data.images?.logos?.[0];

    return {
      backdrop: data.backdrop_path ? `${IMAGE_BASE}${data.backdrop_path}` : undefined,
      poster: data.poster_path ? `${IMAGE_BASE_URL}/w500${data.poster_path}` : undefined,
      logo: logo ? `${IMAGE_BASE}${logo.file_path}` : undefined,
      trailer: trailer?.key,
      description: data.overview,
      year: new Date(data.release_date || data.first_air_date).getFullYear(),
      rating: data.vote_average?.toFixed(1)
    };
  } catch (error) {
    console.error('Error fetching details:', error);
    return null;
  }
};

export const getLogo = async (id: number, type: 'movie' | 'series'): Promise<string | undefined> => {
  try {
    const res = await fetch(`${BASE_URL}/${type === 'movie' ? 'movie' : 'tv'}/${id}/images`, fetchOptions);
    const data = await res.json();
    const logo = data.logos?.find((l: any) => l.iso_639_1 === 'pt') ||
      data.logos?.find((l: any) => l.iso_639_1 === 'en') ||
      data.logos?.[0];
    return logo ? `${IMAGE_BASE}${logo.file_path}` : undefined;
  } catch (error) {
    console.error('Error fetching logo:', error);
    return undefined;
  }
};

const transformTMDBItem = async (item: any, type: 'movie' | 'series'): Promise<Media> => {
  return {
    id: `${type}-${item.id}`,
    tmdb_id: item.id,
    title: item.title || item.name,
    type,
    description: item.overview,
    rating: item.adult ? '18+' : '14+',
    year: new Date(item.release_date || item.first_air_date).getFullYear(),
    genre: [], // Simplified for this demo
    backdrop: `${IMAGE_BASE}${item.backdrop_path}`,
    poster: `${IMAGE_BASE_URL}/w500${item.poster_path}`,
    stars: [],
    duration: type === 'movie' ? '2h 15m' : undefined,
    seasons: type === 'series' ? 1 : undefined
  };
};

// --- FUNÇÕES VISION STREAM ---

export const fetchSeriesDetail = async (id: number): Promise<SeriesDetail> => {
  const response = await fetch(`${BASE_URL}/tv/${id}?language=pt-BR`, fetchOptions);
  return handleResponse(response, 'Falha ao carregar detalhes');
};

export const fetchMovieDetail = async (id: number): Promise<SeriesDetail> => {
    // Adaptado para retornar SeriesDetail mesmo sendo filme, para compatibilidade com a UI
    const response = await fetch(`${BASE_URL}/movie/${id}?language=pt-BR`, fetchOptions);
    const data = await handleResponse(response, 'Falha ao carregar detalhes');
    // Adiciona campos faltantes para fingir que é SeriesDetail
    return {
        ...data,
        name: data.title,
        original_name: data.original_title,
        first_air_date: data.release_date,
        number_of_seasons: 0,
        number_of_episodes: 0,
        seasons: [],
        episode_run_time: [data.runtime],
        type: 'movie'
    };
};

export const fetchSeriesCredits = async (id: number, type: 'movie' | 'series' = 'series'): Promise<{ cast: CastMember[], crew: CrewMember[] }> => {
  const endpoint = type === 'movie' ? 'movie' : 'tv';
  const response = await fetch(`${BASE_URL}/${endpoint}/${id}/credits?language=pt-BR`, fetchOptions);
  return handleResponse(response, 'Falha ao carregar créditos');
};

export const fetchPersonDetail = async (id: number): Promise<PersonDetail> => {
  const response = await fetch(`${BASE_URL}/person/${id}?language=pt-BR`, fetchOptions);
  return handleResponse(response, 'Falha ao carregar detalhes do ator');
};

export const fetchSeriesVideos = async (id: number, type: 'movie' | 'series' = 'series'): Promise<Video[]> => {
  const endpoint = type === 'movie' ? 'movie' : 'tv';
  const response = await fetch(`${BASE_URL}/${endpoint}/${id}/videos?language=pt-BR`, fetchOptions);
  const data = await handleResponse(response, 'Falha ao carregar vídeos');
  return data.results || [];
};

export const fetchSeasonEpisodes = async (seriesId: number, seasonNumber: number): Promise<Episode[]> => {
  const response = await fetch(`${BASE_URL}/tv/${seriesId}/season/${seasonNumber}?language=pt-BR`, fetchOptions);
  const data = await handleResponse(response, 'Falha ao carregar episódios');
  return data.episodes || [];
};

export const fetchSimilarSeries = async (id: number, type: 'movie' | 'series' = 'series'): Promise<SimilarSeries[]> => {
  const endpoint = type === 'movie' ? 'movie' : 'tv';
  const response = await fetch(`${BASE_URL}/${endpoint}/${id}/similar?language=pt-BR`, fetchOptions);
  const data = await handleResponse(response, 'Falha ao carregar similares');
  return data.results || [];
};

export const fetchSeriesProviders = async (id: number, type: 'movie' | 'series' = 'series'): Promise<WatchProvider[]> => {
  const endpoint = type === 'movie' ? 'movie' : 'tv';
  const response = await fetch(`${BASE_URL}/${endpoint}/${id}/watch/providers`, fetchOptions);
  const data = await handleResponse(response, 'Falha ao carregar provedores');
  return data.results?.BR?.flatrate || [];
};

/**
 * Retorna o nome da plataforma de streaming principal para o Brasil (BR).
 * Consulta flatrate (assinatura) > ads > buy, retorna a primeira encontrada.
 * Retorna null se não houver informação.
 */
export const getWatchProviderName = async (tmdbId: number, type: 'movie' | 'series'): Promise<string | null> => {
  try {
    const endpoint = type === 'movie' ? 'movie' : 'tv';
    const response = await fetch(`${BASE_URL}/${endpoint}/${tmdbId}/watch/providers`, fetchOptions);
    if (!response.ok) return null;
    const data = await response.json();
    const br = data.results?.BR;
    if (!br) return null;
    // Preferência: assinatura > ads > compra/aluguel
    const provider = br.flatrate?.[0] || br.ads?.[0] || br.rent?.[0] || br.buy?.[0];
    return provider?.provider_name || null;
  } catch {
    return null;
  }
};

export const fetchSeriesImages = async (id: number, type: 'movie' | 'series' = 'series'): Promise<any> => {
  const endpoint = type === 'movie' ? 'movie' : 'tv';
  const response = await fetch(`${BASE_URL}/${endpoint}/${id}/images`, fetchOptions);
  return handleResponse(response, 'Falha ao carregar imagens');
};

export const searchMulti = async (query: string): Promise<any[]> => {
  if (!query) return [];
  const response = await fetch(`${BASE_URL}/search/multi?query=${encodeURIComponent(query)}&language=pt-BR&include_adult=false`, fetchOptions);
  const data = await handleResponse(response, 'Erro na busca');
  return data.results || [];
};

export const searchAnyLang = async (query: string): Promise<any[]> => {
  if (!query) return [];
  const [ptRes, enRes] = await Promise.all([
    fetch(`${BASE_URL}/search/multi?query=${encodeURIComponent(query)}&language=pt-BR&include_adult=false`, fetchOptions),
    fetch(`${BASE_URL}/search/multi?query=${encodeURIComponent(query)}&language=en-US&include_adult=false`, fetchOptions)
  ]);
  const ptData = await handleResponse(ptRes, 'Erro na busca (pt-BR)');
  const enData = await handleResponse(enRes, 'Erro na busca (en-US)');
  const combined = [...(ptData.results || []), ...(enData.results || [])];
  const seen = new Set<string>();
  return combined.filter((r: any) => {
    const key = `${r.media_type}-${r.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

// --- TMDB Namespace para HeroBanner ---
export const tmdb = {
  getTrending: async () => {
    const res = await fetch(`${BASE_URL}/trending/all/week?language=pt-BR`, fetchOptions);
    return handleResponse(res, 'Erro ao buscar trending');
  },
};

export const fetchDetails = async (id: number, mediaType: string) => {
  const endpoint = mediaType === 'tv' ? 'tv' : 'movie';
  const res = await fetch(`${BASE_URL}/${endpoint}/${id}?append_to_response=videos,images&include_image_language=pt,en,null&language=pt-BR`, fetchOptions);
  return handleResponse(res, 'Erro ao buscar detalhes');
};
