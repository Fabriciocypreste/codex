import { supabase } from './supabaseService';

/**
 * StreamService v2 — Blindado contra Erro 406 e Duplicatas
 * ═══════════════════════════════════════════════════════════
 * Estratégia: tmdb_id (Number → String fallback) → título exato → parcial → tabela alternativa
 * Cache em memória para evitar queries repetidas.
 */

const streamCache = new Map<string, string | null>();

function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Escapar caracteres especiais do PostgREST/ilike (%, _, :)
function escapeIlike(title: string): string {
  return title.replace(/%/g, '\\%').replace(/_/g, '\\_');
}

/**
 * Busca URL do Filme/Série (Blindado contra duplicatas e erros 406)
 */
export async function getStreamUrl(
  title: string,
  type: 'movie' | 'series' = 'movie',
  tmdbId?: number
): Promise<string | null> {
  const cacheKey = normalizeTitle(title);
  if (streamCache.has(cacheKey)) return streamCache.get(cacheKey) || null;

  const table = type === 'movie' ? 'movies' : 'series';

  try {
    // 1. Tentar por tmdb_id numérico (mais preciso)
    if (tmdbId && Number(tmdbId) > 0) {
      const { data, error } = await supabase
        .from(table)
        .select('stream_url')
        .eq('tmdb_id', Number(tmdbId))
        .not('stream_url', 'is', null)
        .order('created_at', { ascending: false })
        .range(0, 0);

      if (error) console.error('[StreamService] Erro query tmdb_id:', error);

      if (data && data.length > 0 && data[0].stream_url) {
        streamCache.set(cacheKey, data[0].stream_url);
        return data[0].stream_url;
      }

      // 1b. Fallback: tmdb_id como String
      const { data: dataStr, error: errStr } = await supabase
        .from(table)
        .select('stream_url')
        .eq('tmdb_id', String(tmdbId))
        .not('stream_url', 'is', null)
        .range(0, 0);

      if (errStr) console.error('[StreamService] Erro query tmdb_id str:', errStr);

      if (dataStr && dataStr.length > 0 && dataStr[0].stream_url) {
        streamCache.set(cacheKey, dataStr[0].stream_url);
        return dataStr[0].stream_url;
      }
    }

    // 2. Tentar por título exato (case-insensitive)
    const safeTitle = escapeIlike(title);
    const { data: exactMatch, error: errExact } = await supabase
      .from(table)
      .select('stream_url, title')
      .ilike('title', safeTitle)
      .not('stream_url', 'is', null)
      .order('created_at', { ascending: false })
      .range(0, 0);

    if (errExact) console.error('[StreamService] Erro query title exact:', errExact);

    if (exactMatch && exactMatch.length > 0 && exactMatch[0].stream_url) {
      streamCache.set(cacheKey, exactMatch[0].stream_url);
      return exactMatch[0].stream_url;
    }

    // 3. Busca parcial
    const { data: partialMatches, error: errPartial } = await supabase
      .from(table)
      .select('stream_url, title')
      .ilike('title', `%${safeTitle}%`)
      .not('stream_url', 'is', null)
      .order('created_at', { ascending: false })
      .range(0, 4);

    if (errPartial) console.error('[StreamService] Erro query partial:', errPartial);

    // 3b. Tabela alternativa
    if (!partialMatches || partialMatches.length === 0) {
      const altTable = table === 'movies' ? 'series' : 'movies';
      const { data: altMatch, error: errAlt } = await supabase
        .from(altTable)
        .select('stream_url, title')
        .ilike('title', `%${safeTitle}%`)
        .not('stream_url', 'is', null)
        .order('created_at', { ascending: false })
        .range(0, 0);

      if (errAlt) console.error('[StreamService] Erro query alt table:', errAlt);

      if (altMatch && altMatch.length > 0 && altMatch[0].stream_url) {
        streamCache.set(cacheKey, altMatch[0].stream_url);
        return altMatch[0].stream_url;
      }
    }

    if (partialMatches && partialMatches.length > 0) {
      // Usar melhor match
      const normalizedSearch = normalizeTitle(title);
      // Sort in memory to avoid reduce on empty array issue (though length > 0 checks that)
      const sorted = partialMatches.sort((a, b) => {
        const diffA = Math.abs(normalizeTitle(a.title).length - normalizedSearch.length);
        const diffB = Math.abs(normalizeTitle(b.title).length - normalizedSearch.length);
        return diffA - diffB;
      });

      const best = sorted[0];
      if (best && best.stream_url) {
        streamCache.set(cacheKey, best.stream_url);
        return best.stream_url;
      }
    }

    // Se chegou aqui, não achou nada
    console.warn(`[StreamService] Nada encontrado para: "${title}" (ID: ${tmdbId})`);
    streamCache.set(cacheKey, null);
    return null;
  } catch (err) {
    console.error(`[StreamService] EXCEPTION ao buscar stream_url para "${title}":`, err);
    return null;
  }
}

/**
 * Busca URL do Episódio — via join series → seasons → episodes
 * Tenta tmdb_id numérico e string como fallback.
 */
export async function getEpisodeStreamUrl(
  seriesTitle: string,
  seasonNumber: number,
  episodeNumber: number,
  tmdbId?: number | string
): Promise<string | null> {
  const cacheKey = `${normalizeTitle(seriesTitle)}_s${seasonNumber}e${episodeNumber}`;
  if (streamCache.has(cacheKey)) return streamCache.get(cacheKey) || null;

  try {
    // Tentar via tmdb_id (join direto se possível)
    if (tmdbId) {
      const { data, error } = await supabase
        .from('episodes')
        .select('stream_url, seasons!inner(season_number, series!inner(tmdb_id))')
        .eq('seasons.series.tmdb_id', String(tmdbId))
        .eq('seasons.season_number', Number(seasonNumber))
        .eq('episode_number', Number(episodeNumber))
        .not('stream_url', 'is', null)
        .range(0, 0);

      if (error) console.error(`[StreamService] Erro episodio ID ${tmdbId}:`, error);

      if (data && data.length > 0 && data[0].stream_url) {
        streamCache.set(cacheKey, data[0].stream_url);
        return data[0].stream_url;
      }
    }

    // Fallback: buscar serie por título → season → episode
    const { data: seriesData, error: errSeries } = await supabase
      .from('series')
      .select('id')
      .ilike('title', seriesTitle)
      .range(0, 0);

    if (errSeries) console.error(`[StreamService] Erro busca serie titulo "${seriesTitle}":`, errSeries);

    if (!seriesData || seriesData.length === 0) {
      streamCache.set(cacheKey, null);
      return null;
    }
    const seriesId = seriesData[0].id;

    const { data: seasonData, error: errSeason } = await supabase
      .from('seasons')
      .select('id')
      .eq('series_id', seriesId)
      .eq('season_number', seasonNumber)
      .range(0, 0);

    if (errSeason) console.error(`[StreamService] Erro busca season ${seasonNumber}:`, errSeason);

    if (!seasonData || seasonData.length === 0) {
      streamCache.set(cacheKey, null);
      return null;
    }
    const seasonId = seasonData[0].id;

    const { data: episodeData, error: errEp } = await supabase
      .from('episodes')
      .select('stream_url')
      .eq('season_id', seasonId)
      .eq('episode_number', episodeNumber)
      .not('stream_url', 'is', null)
      .range(0, 0);

    if (errEp) console.error(`[StreamService] Erro busca episodio ${episodeNumber}:`, errEp);

    const url = (episodeData && episodeData.length > 0) ? episodeData[0].stream_url : null;
    streamCache.set(cacheKey, url);
    return url;
  } catch (err) {
    console.error(`[StreamService] Erro episódio ${seriesTitle} S${seasonNumber}E${episodeNumber}:`, err);
    return null;
  }
}

/**
 * Limpa o cache (útil para forçar refresh)
 */
export function clearStreamCache(): void {
  streamCache.clear();
}

// Export como objeto para uso tmdbSync-style
export const streamService = {
  getMovieUrl: (tmdbId: number | string) => getStreamUrl('', 'movie', Number(tmdbId)),
  getEpisodeUrl: getEpisodeStreamUrl,
  getStreamUrl,
  clearCache: clearStreamCache,
};
