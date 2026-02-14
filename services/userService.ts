import { supabase } from './supabaseService';

// ══════════════════════════════════════════════════
// Cache de autenticação — evita chamar getUser() a cada card
// Com TTL de 5 minutos para evitar cache stale
// ══════════════════════════════════════════════════
let cachedUserId: string | null = null;
let authCheckPromise: Promise<string | null> | null = null;
let cacheTimestamp = 0;
const AUTH_CACHE_TTL = 5 * 60 * 1000; // 5 minutos

async function getAuthUserId(): Promise<string | null> {
  const now = Date.now();
  if (cachedUserId && (now - cacheTimestamp) < AUTH_CACHE_TTL) return cachedUserId;
  if (authCheckPromise) return authCheckPromise;

  authCheckPromise = supabase.auth.getUser()
    .then(({ data }) => {
      cachedUserId = data?.user?.id || null;
      cacheTimestamp = Date.now();
      authCheckPromise = null;
      return cachedUserId;
    })
    .catch(() => {
      authCheckPromise = null;
      cachedUserId = null;
      cacheTimestamp = 0;
      return null;
    });

  return authCheckPromise;
}

// Limpar cache quando auth muda (logout, login, token refresh)
supabase.auth.onAuthStateChange(() => {
  cachedUserId = null;
  authCheckPromise = null;
  cacheTimestamp = 0;
});

// Flag para saber se as tabelas existem (evita spam de erros)
let tablesVerified = false;
let tablesExist = { user_library: false, watch_progress: false };

async function verifyTables(): Promise<void> {
  if (tablesVerified) return;
  tablesVerified = true;

  // Tenta um SELECT mínimo para ver se a tabela existe
  const [libResult, progResult] = await Promise.all([
    supabase.from('user_library').select('id').limit(0),
    supabase.from('watch_progress').select('id').limit(0),
  ]);

  tablesExist.user_library = !libResult.error;
  tablesExist.watch_progress = !progResult.error;

  if (!tablesExist.user_library) {
    console.warn('[userService] Tabela "user_library" não encontrada. Execute a migration: supabase/migrations/user_tables.sql');
  }
  if (!tablesExist.watch_progress) {
    console.warn('[userService] Tabela "watch_progress" não encontrada. Execute a migration: supabase/migrations/user_tables.sql');
  }
}

export const userService = {
  // ══════════════════════════════════════════════════
  // LISTAS (Minha Lista / Ver Depois)
  // ══════════════════════════════════════════════════

  async toggleLibraryItem(
    tmdbId: number | string,
    type: 'movie' | 'tv' | 'series',
    listType: 'watchlist' | 'watch_later'
  ): Promise<'added' | 'removed' | 'auth_required' | 'unavailable'> {
    const userId = await getAuthUserId();
    if (!userId) return 'auth_required';

    await verifyTables();
    if (!tablesExist.user_library) return 'unavailable';

    const mediaType = type === 'series' ? 'tv' : type;

    try {
      const { data: existing } = await supabase
        .from('user_library')
        .select('id')
        .eq('user_id', userId)
        .eq('tmdb_id', String(tmdbId))
        .eq('list_type', listType)
        .maybeSingle();

      if (existing) {
        await supabase.from('user_library').delete().eq('id', existing.id);
        return 'removed';
      } else {
        await supabase.from('user_library').insert({
          user_id: userId,
          tmdb_id: String(tmdbId),
          media_type: mediaType,
          list_type: listType
        });
        return 'added';
      }
    } catch {
      return 'unavailable';
    }
  },

  async checkStatus(tmdbId: number | string): Promise<{
    inWatchlist: boolean;
    inWatchLater: boolean;
  }> {
    const defaults = { inWatchlist: false, inWatchLater: false };

    const userId = await getAuthUserId();
    if (!userId) return defaults;

    await verifyTables();
    if (!tablesExist.user_library) return defaults;

    try {
      const { data, error } = await supabase
        .from('user_library')
        .select('list_type')
        .eq('user_id', userId)
        .eq('tmdb_id', String(tmdbId));

      if (error) return defaults;

      return {
        inWatchlist: data?.some(i => i.list_type === 'watchlist') || false,
        inWatchLater: data?.some(i => i.list_type === 'watch_later') || false
      };
    } catch {
      return defaults;
    }
  },

  async getLibraryItems(listType: 'watchlist' | 'watch_later'): Promise<Array<{
    tmdb_id: string;
    media_type: string;
    created_at: string;
  }>> {
    const userId = await getAuthUserId();
    if (!userId) return [];

    await verifyTables();
    if (!tablesExist.user_library) return [];

    try {
      const { data, error } = await supabase
        .from('user_library')
        .select('tmdb_id, media_type, created_at')
        .eq('user_id', userId)
        .eq('list_type', listType)
        .order('created_at', { ascending: false });

      if (error) return [];
      return data || [];
    } catch {
      return [];
    }
  },

  // ══════════════════════════════════════════════════
  // PROGRESSO (Resume Video)
  // ══════════════════════════════════════════════════

  async saveProgress(
    tmdbId: number | string,
    type: string,
    seconds: number,
    totalDuration?: number,
    season?: number,
    episode?: number
  ): Promise<void> {
    const userId = await getAuthUserId();
    if (!userId) return;

    await verifyTables();
    if (!tablesExist.watch_progress) return;

    try {
      const payload: Record<string, any> = {
        user_id: userId,
        tmdb_id: String(tmdbId),
        media_type: type === 'series' ? 'tv' : type,
        progress_seconds: Math.floor(seconds),
        updated_at: new Date().toISOString()
      };

      if (totalDuration) payload.total_duration = Math.floor(totalDuration);
      if (season !== undefined) payload.season_number = season;
      if (episode !== undefined) payload.episode_number = episode;

      await supabase
        .from('watch_progress')
        .upsert(payload, {
          onConflict: 'user_id, tmdb_id, season_number, episode_number'
        });
    } catch {
      // Silencioso — não spammar console
    }
  },

  async getProgress(
    tmdbId: number | string,
    season?: number,
    episode?: number
  ): Promise<number> {
    const userId = await getAuthUserId();
    if (!userId) return 0;

    await verifyTables();
    if (!tablesExist.watch_progress) return 0;

    try {
      let query = supabase
        .from('watch_progress')
        .select('progress_seconds')
        .eq('user_id', userId)
        .eq('tmdb_id', String(tmdbId));

      if (season !== undefined) query = query.eq('season_number', season);
      if (episode !== undefined) query = query.eq('episode_number', episode);

      const { data, error } = await query.maybeSingle();

      if (error) return 0;
      return data?.progress_seconds || 0;
    } catch {
      return 0;
    }
  },

  async getContinueWatching(): Promise<Array<{
    tmdb_id: string;
    media_type: string;
    progress_seconds: number;
    total_duration: number | null;
    season_number: number | null;
    episode_number: number | null;
    updated_at: string;
  }>> {
    const userId = await getAuthUserId();
    if (!userId) return [];

    await verifyTables();
    if (!tablesExist.watch_progress) return [];

    try {
      const { data, error } = await supabase
        .from('watch_progress')
        .select('tmdb_id, media_type, progress_seconds, total_duration, season_number, episode_number, updated_at')
        .eq('user_id', userId)
        .gt('progress_seconds', 30)
        .order('updated_at', { ascending: false })
        .limit(20);

      if (error) return [];

      return (data || []).filter(item => {
        if (!item.total_duration || item.total_duration === 0) return true;
        return (item.progress_seconds / item.total_duration) < 0.95;
      });
    } catch {
      return [];
    }
  }
};

export default userService;
