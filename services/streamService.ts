import { supabase } from './supabaseService';

/**
 * StreamService v3 — Sequência de Episódios + WebP Priority + Heartbeat Resiliente
 * ═══════════════════════════════════════════════════════════════════════════════════
 * Estratégia: tmdb_id (Number → String fallback) → título exato → parcial → tabela alternativa
 * Cache em memória para evitar queries repetidas.
 * 
 * v3:
 * - getNextEpisode(): busca próximo episódio com título, stream_url e progresso salvo
 * - resolveImageUrl(): prioriza WebP do Storage sobre TMDB
 * - resilientSaveProgress(): heartbeat 30s com retry e localStorage fallback
 */

// ═══════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════
export interface NextEpisodeResult {
  title: string;
  season: number;
  episode: number;
  stream_url: string;
  savedProgress: number; // segundos já assistidos (0 se novo)
}

// ═══════════════════════════════════════════════════════
// CACHES — LRU com limite de 200 entradas (evita vazamento de memória)
// ═══════════════════════════════════════════════════════
const MAX_CACHE_SIZE = 200;

function lruSet<K, V>(map: Map<K, V>, key: K, value: V): void {
  if (map.size >= MAX_CACHE_SIZE && !map.has(key)) {
    const firstKey = map.keys().next().value;
    if (firstKey !== undefined) map.delete(firstKey);
  }
  map.set(key, value);
}

function lruGet<K, V>(map: Map<K, V>, key: K): V | undefined {
  const value = map.get(key);
  if (value !== undefined) {
    map.delete(key);
    map.set(key, value);
  }
  return value;
}

const streamCache = new Map<string, string | null>();
const nextEpisodeCache = new Map<string, NextEpisodeResult | null>();
const imageUrlCache = new Map<string, string>();

// Chave do localStorage para heartbeat resiliente
const PROGRESS_LS_KEY = 'redx_progress_backup';

function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Escapar caracteres especiais do PostgREST/ilike (%, _, \)
// Também sanitiza caracteres que podem causar erro 400 no PostgREST
function escapeIlike(title: string): string {
  if (!title || !title.trim()) return '';
  return title
    .replace(/\\/g, '\\\\')
    .replace(/%/g, '\\%')
    .replace(/_/g, '\\_')
    .trim();
}

// Validar se o título é seguro para query (evitar 400)
function isSafeForQuery(title: string): boolean {
  return !!title && title.trim().length >= 2;
}

/**
 * Busca URL do Filme/Série (Blindado contra duplicatas e erros 406)
 */
export async function getStreamUrl(
  title: string,
  type: 'movie' | 'series' = 'movie',
  tmdbId?: number
): Promise<string | null> {
  const cacheKey = `${type}_${tmdbId || ''}_${normalizeTitle(title)}`;
  const cached = lruGet(streamCache, cacheKey);
  if (cached !== undefined) return cached;

  const table = type === 'movie' ? 'movies' : 'series';

  try {
    // Se não tem título NEM tmdb_id, retorna null (evita match aleatório)
    if (!title.trim() && (!tmdbId || Number(tmdbId) <= 0)) {
      return null;
    }
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
        lruSet(streamCache, cacheKey, data[0].stream_url);
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
        lruSet(streamCache, cacheKey, dataStr[0].stream_url);
        return dataStr[0].stream_url;
      }
    }

    // 2. Tentar por título exato (case-insensitive) - só se tem título
    if (!title.trim()) {
      console.warn(`[StreamService] Sem título e tmdb_id ${tmdbId} não encontrado`);
      lruSet(streamCache, cacheKey, null);
      return null;
    }
    const safeTitle = escapeIlike(title);
    if (!isSafeForQuery(safeTitle)) {
      console.warn(`[StreamService] Título inválido para query: "${title}"`);
      lruSet(streamCache, cacheKey, null);
      return null;
    }
    const { data: exactMatch, error: errExact } = await supabase
      .from(table)
      .select('stream_url, title')
      .ilike('title', safeTitle)
      .not('stream_url', 'is', null)
      .order('created_at', { ascending: false })
      .range(0, 0);

    if (errExact) console.error('[StreamService] Erro query title exact:', errExact);

    if (exactMatch && exactMatch.length > 0 && exactMatch[0].stream_url) {
      lruSet(streamCache, cacheKey, exactMatch[0].stream_url);
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
        lruSet(streamCache, cacheKey, altMatch[0].stream_url);
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
        lruSet(streamCache, cacheKey, best.stream_url);
        return best.stream_url;
      }
    }

    // Se chegou aqui, não achou nada
    console.warn(`[StreamService] Nada encontrado para: "${title}" (ID: ${tmdbId})`);
    lruSet(streamCache, cacheKey, null);
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
  const cached = lruGet(streamCache, cacheKey);
  if (cached !== undefined) return cached;

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
        lruSet(streamCache, cacheKey, data[0].stream_url);
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
      lruSet(streamCache, cacheKey, null);
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
      lruSet(streamCache, cacheKey, null);
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
    lruSet(streamCache, cacheKey, url);
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
  nextEpisodeCache.clear();
  imageUrlCache.clear();
}

// ═══════════════════════════════════════════════════════
// NEXT EPISODE — Busca próximo episódio com stream_url + progresso
// ═══════════════════════════════════════════════════════

/**
 * Busca o próximo episódio de uma série dado season/episode atuais.
 * Retorna título, stream_url e progresso salvo para transição sem loading.
 * Estratégia: próximo episode_number na mesma season → primeiro episode da próxima season.
 */
export async function getNextEpisode(
  seriesTmdbId: number | string,
  currentSeason: number,
  currentEpisode: number,
  userId?: string
): Promise<NextEpisodeResult | null> {
  const cacheKey = `next_${seriesTmdbId}_s${currentSeason}e${currentEpisode}`;
  const cached = lruGet(nextEpisodeCache, cacheKey);
  if (cached !== undefined) return cached;

  try {
    // 1. Buscar a série pelo tmdb_id
    const { data: seriesData } = await supabase
      .from('series')
      .select('id')
      .eq('tmdb_id', Number(seriesTmdbId) || String(seriesTmdbId))
      .limit(1);

    if (!seriesData?.length) {
      lruSet(nextEpisodeCache, cacheKey, null);
      return null;
    }
    const seriesId = seriesData[0].id;

    // 2. Buscar todas as seasons desta série
    const { data: seasons } = await supabase
      .from('seasons')
      .select('id, season_number')
      .eq('series_id', seriesId)
      .order('season_number', { ascending: true });

    if (!seasons?.length) {
      lruSet(nextEpisodeCache, cacheKey, null);
      return null;
    }

    // 3. Buscar season atual
    const currentSeasonRow = seasons.find(s => s.season_number === currentSeason);
    if (!currentSeasonRow) {
      lruSet(nextEpisodeCache, cacheKey, null);
      return null;
    }

    // 4. Tentar próximo episódio na mesma season
    const { data: nextEpInSeason } = await supabase
      .from('episodes')
      .select('id, title, episode_number, stream_url')
      .eq('season_id', currentSeasonRow.id)
      .eq('episode_number', currentEpisode + 1)
      .not('stream_url', 'is', null)
      .limit(1);

    let nextEp = nextEpInSeason?.[0] || null;
    let nextSeason = currentSeason;
    let nextEpNum = currentEpisode + 1;

    // 5. Se não achou, tentar primeiro episódio da próxima season
    if (!nextEp) {
      const nextSeasonRow = seasons.find(s => s.season_number > currentSeason);
      if (nextSeasonRow) {
        const { data: firstEpNextSeason } = await supabase
          .from('episodes')
          .select('id, title, episode_number, stream_url')
          .eq('season_id', nextSeasonRow.id)
          .order('episode_number', { ascending: true })
          .not('stream_url', 'is', null)
          .limit(1);

        if (firstEpNextSeason?.length) {
          nextEp = firstEpNextSeason[0];
          nextSeason = nextSeasonRow.season_number;
          nextEpNum = nextEp.episode_number;
        }
      }
    }

    if (!nextEp || !nextEp.stream_url) {
      lruSet(nextEpisodeCache, cacheKey, null);
      return null;
    }

    // 6. Buscar progresso salvo para esse episódio (transição sem tela de loading)
    let savedProgress = 0;
    if (userId) {
      const { data: progressData } = await supabase
        .from('watch_progress')
        .select('progress_seconds')
        .eq('user_id', userId)
        .eq('tmdb_id', String(seriesTmdbId))
        .eq('season_number', nextSeason)
        .eq('episode_number', nextEpNum)
        .maybeSingle();

      savedProgress = progressData?.progress_seconds || 0;
    }

    const result: NextEpisodeResult = {
      title: nextEp.title || `Episódio ${nextEpNum}`,
      season: nextSeason,
      episode: nextEpNum,
      stream_url: nextEp.stream_url,
      savedProgress,
    };

    lruSet(nextEpisodeCache, cacheKey, result);
    return result;
  } catch (err) {
    console.error(`[StreamService] Erro getNextEpisode S${currentSeason}E${currentEpisode}:`, err);
    return null;
  }
}

// ═══════════════════════════════════════════════════════
// IMAGE URL — Prioriza WebP do Storage sobre TMDB
// ═══════════════════════════════════════════════════════

/**
 * Resolve URL de imagem priorizando WebP local do Supabase Storage.
 * Se a imagem já foi convertida e salva no storage, retorna ela.
 * Caso contrário, retorna a URL TMDB original.
 */
export function resolveImageUrl(
  originalUrl: string | undefined,
  tmdbId?: number | string,
  imageType: 'poster' | 'backdrop' = 'poster'
): string {
  if (!originalUrl) return '';

  // Se já é URL do Supabase Storage (WebP otimizado), usar direto
  if (originalUrl.includes('supabase.co/storage')) {
    return originalUrl;
  }

  // Check cache
  const cacheKey = `img_${tmdbId || ''}_${imageType}`;
  const cached = lruGet(imageUrlCache, cacheKey);
  if (cached !== undefined) return cached;

  // Se é URL TMDB, verificar se existe versão WebP local (via pattern de naming)
  if (originalUrl.includes('image.tmdb.org') && tmdbId) {
    // A convenção de upload é: bucket/tmdb-{id}-{type}.webp
    const bucket = imageType === 'poster' ? 'posters' : 'backdrops';
    const possibleWebpName = `tmdb-${tmdbId}-${bucket}.webp`;

    // Construir URL pública do storage (sync, sem fetch)
    const { data } = supabase.storage.from(bucket).getPublicUrl(possibleWebpName);
    if (data?.publicUrl) {
      // Guardar no cache — a verificação real de existência será lazy
      // (se a imagem não existir, o browser faz fallback natural para a src TMDB via onerror)
      lruSet(imageUrlCache, cacheKey, data.publicUrl);
      return data.publicUrl;
    }
  }

  // Fallback: URL original
  lruSet(imageUrlCache, cacheKey, originalUrl);
  return originalUrl;
}

// ═══════════════════════════════════════════════════════
// HEARTBEAT RESILIENTE — Salva progresso com retry + localStorage
// ═══════════════════════════════════════════════════════

interface ProgressBackup {
  tmdb_id: string;
  media_type: string;
  seconds: number;
  total_duration?: number;
  season?: number;
  episode?: number;
  timestamp: number;
}

/**
 * Salva progresso de forma resiliente:
 * 1. Tenta salvar no Supabase via watch_progress
 * 2. Em caso de falha (rede, queda), salva no localStorage
 * 3. Na próxima execução, tenta sincronizar o backup local
 */
export async function resilientSaveProgress(
  userId: string,
  tmdbId: number | string,
  mediaType: string,
  seconds: number,
  totalDuration?: number,
  season?: number,
  episode?: number
): Promise<boolean> {
  const payload: Record<string, any> = {
    user_id: userId,
    tmdb_id: String(tmdbId),
    media_type: mediaType === 'series' ? 'tv' : mediaType,
    progress_seconds: Math.floor(seconds),
    updated_at: new Date().toISOString(),
  };
  if (totalDuration) payload.total_duration = Math.floor(totalDuration);
  if (season !== undefined) payload.season_number = season;
  if (episode !== undefined) payload.episode_number = episode;

  try {
    const { error } = await supabase
      .from('watch_progress')
      .upsert(payload, { onConflict: 'user_id, tmdb_id, season_number, episode_number' });

    if (error) throw error;

    // Sucesso: tentar sincronizar backups antigos do localStorage
    flushLocalProgressBackup(userId);
    return true;
  } catch {
    // Falha de rede/Supabase: salvar no localStorage como backup
    saveProgressToLocalStorage({
      tmdb_id: String(tmdbId),
      media_type: mediaType,
      seconds: Math.floor(seconds),
      total_duration: totalDuration ? Math.floor(totalDuration) : undefined,
      season,
      episode,
      timestamp: Date.now(),
    });
    return false;
  }
}

/** Salva backup de progresso no localStorage (TV Box resilience) */
function saveProgressToLocalStorage(entry: ProgressBackup): void {
  try {
    const raw = localStorage.getItem(PROGRESS_LS_KEY);
    const backups: ProgressBackup[] = raw ? JSON.parse(raw) : [];
    // Substituir entrada existente para o mesmo conteúdo
    const key = `${entry.tmdb_id}_s${entry.season || 0}e${entry.episode || 0}`;
    const idx = backups.findIndex(b =>
      `${b.tmdb_id}_s${b.season || 0}e${b.episode || 0}` === key
    );
    if (idx >= 0) {
      backups[idx] = entry;
    } else {
      backups.push(entry);
    }
    // Limitar a 50 entradas
    const trimmed = backups.slice(-50);
    localStorage.setItem(PROGRESS_LS_KEY, JSON.stringify(trimmed));
  } catch {
    // localStorage indisponível — silencioso
  }
}

/** Tenta sincronizar backups do localStorage com o Supabase */
async function flushLocalProgressBackup(userId: string): Promise<void> {
  try {
    const raw = localStorage.getItem(PROGRESS_LS_KEY);
    if (!raw) return;
    const backups: ProgressBackup[] = JSON.parse(raw);
    if (backups.length === 0) return;

    // Filtrar entradas com menos de 24h
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    const recent = backups.filter(b => b.timestamp > cutoff);

    const payloads = recent.map(b => ({
      user_id: userId,
      tmdb_id: b.tmdb_id,
      media_type: b.media_type === 'series' ? 'tv' : b.media_type,
      progress_seconds: b.seconds,
      total_duration: b.total_duration || null,
      season_number: b.season ?? null,
      episode_number: b.episode ?? null,
      updated_at: new Date(b.timestamp).toISOString(),
    }));

    if (payloads.length > 0) {
      await supabase
        .from('watch_progress')
        .upsert(payloads, { onConflict: 'user_id, tmdb_id, season_number, episode_number' });
    }

    // Limpar backups sincronizados
    localStorage.removeItem(PROGRESS_LS_KEY);
  } catch {
    // Falha silenciosa
  }
}

// Export como objeto para uso tmdbSync-style
export const streamService = {
  getMovieUrl: (tmdbId: number | string) => getStreamUrl('', 'movie', Number(tmdbId) || undefined),
  getEpisodeUrl: getEpisodeStreamUrl,
  getStreamUrl,
  getNextEpisode,
  resolveImageUrl,
  resilientSaveProgress,
  clearCache: clearStreamCache,
};
