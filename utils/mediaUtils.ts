import { Media } from '../types';

/* ============================================================
   MEDIA UTILS – Dedup, Validation, Poster Fallback, Season Filter
   ============================================================ */

/** SVG placeholder for items without poster */
export const PLACEHOLDER_POSTER = 'data:image/svg+xml;base64,' + btoa(
  '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="450" viewBox="0 0 300 450">' +
  '<rect fill="#1a1a2e" width="300" height="450"/>' +
  '<rect fill="#252540" x="100" y="170" width="100" height="110" rx="8"/>' +
  '<circle fill="#3a3a5c" cx="150" cy="200" r="20"/>' +
  '<polygon fill="#3a3a5c" points="120,260 150,230 180,260" />' +
  '<text fill="#555" font-family="Arial" font-size="12" text-anchor="middle" x="150" y="310">Sem Imagem</text>' +
  '</svg>'
);

/**
 * Get the best available image for a media item.
 * Fallback chain: poster → backdrop → placeholder
 */
export function getMediaPoster(media: Media): string {
  if (media.poster && media.poster.length > 5 && !media.poster.includes('undefined') && !media.poster.includes('null')) {
    return media.poster;
  }
  if (media.backdrop && media.backdrop.length > 5 && !media.backdrop.includes('undefined') && !media.backdrop.includes('null')) {
    return media.backdrop;
  }
  return PLACEHOLDER_POSTER;
}

/**
 * Check if a media item has a valid poster image URL
 */
export function hasValidPoster(media: Media): boolean {
  const poster = getMediaPoster(media);
  return poster !== PLACEHOLDER_POSTER;
}

/**
 * Filter out season-like entries that shouldn't appear as standalone content.
 * Seasons belong inside their parent series' details page.
 */
export function filterOutSeasons(items: Media[]): Media[] {
  const seasonPatterns = [
    /^temporada\s*\d+/i,
    /^season\s*\d+/i,
    /^s\d{1,2}$/i,
    /^t\d{1,2}\s*$/i,
    /^(\d+)[ªa]\s*temporada/i,
    /\btemporada\s*\d+$/i,
    /\bseason\s*\d+$/i,
    /^temp\s*\d+/i,
    /^s\d{1,2}\s*e\d+$/i,
    /^s\d{1,2}\s*·\s*e\d+/i,
  ];

  return items.filter(item => {
    const title = (item.title || '').trim();
    if (!title) return false;

    // Pure season/episode reference (very short titles matching patterns)
    for (const pattern of seasonPatterns) {
      if (pattern.test(title)) return false;
    }

    // Check group_title for season indicators
    if (item.group_title) {
      const gt = item.group_title.trim();
      for (const pattern of seasonPatterns) {
        if (pattern.test(gt)) return false;
      }
    }

    return true;
  });
}

/**
 * Deduplicate media items by tmdb_id (preferred) or title.
 * Keeps the first occurrence (highest quality data).
 */
export function deduplicateMedia(items: Media[]): Media[] {
  const seen = new Map<string, boolean>();
  const result: Media[] = [];

  for (const item of items) {
    let key: string;
    if (item.tmdb_id && item.tmdb_id > 0) {
      key = `tmdb-${item.type}-${item.tmdb_id}`;
    } else {
      key = `title-${item.type}-${(item.title || '').toLowerCase().trim()}`;
    }

    if (key && !seen.has(key)) {
      seen.set(key, true);
      result.push(item);
    }
  }

  return result;
}

/**
 * Validate that a media item has minimum required fields.
 */
export function isValidMedia(media: Media): boolean {
  if (!media) return false;
  if (!media.id) return false;
  if (!media.title || media.title.trim().length === 0) return false;
  if (!media.type || (media.type !== 'movie' && media.type !== 'series')) return false;
  return true;
}

/**
 * Full sanitization pipeline: validate → remove seasons → deduplicate → fix posters
 */
export function sanitizeMediaList(items: Media[]): Media[] {
  return deduplicateMedia(
    filterOutSeasons(
      items.filter(isValidMedia)
    )
  ).map(item => ({
    ...item,
    poster: getMediaPoster(item),
    description: item.description || '',
    rating: item.rating || 'N/A',
    year: item.year || new Date().getFullYear(),
    genre: Array.isArray(item.genre) ? item.genre : [],
    stars: Array.isArray(item.stars) ? item.stars : [],
  }));
}

/**
 * Sanitize a raw TMDB API response item.
 * Returns null if invalid.
 */
export function sanitizeTMDBItem(item: any, type: 'movie' | 'series'): any | null {
  if (!item) return null;
  if (!item.id) return null;
  if (type === 'movie' && !item.title) return null;
  if (type === 'series' && !item.name && !item.title) return null;

  return {
    ...item,
    poster_path: item.poster_path || null,
    backdrop_path: item.backdrop_path || null,
    overview: item.overview || '',
    vote_average: typeof item.vote_average === 'number' ? item.vote_average : 0,
  };
}

/**
 * Get display text for media duration/seasons
 */
export function getMediaDuration(media: Media): string {
  if (media.duration) return media.duration;
  if (media.type === 'series' && media.seasons && media.seasons > 0) {
    return `${media.seasons} Temp.`;
  }
  return media.type === 'movie' ? 'Filme' : 'Série';
}

/**
 * Detectar plataforma/fonte a partir da URL de stream.
 * Retorna nome legível ou null se não identificável.
 */
export function detectPlatformFromUrl(url?: string | null): string | null {
  if (!url) return null;
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    // CDN / IPTV providers
    if (hostname.includes('cdnapp') || hostname.includes('cdn.app')) return 'CDN App';
    if (hostname.includes('xtream') || hostname.includes('xstream')) return 'Xtream';
    if (hostname.includes('iptv')) return 'IPTV';
    if (hostname.includes('m3u')) return 'IPTV';
    // Cloud storage
    if (hostname.includes('supabase')) return 'Supabase';
    if (hostname.includes('cloudflare') || hostname.includes('r2.dev')) return 'Cloudflare';
    if (hostname.includes('amazonaws') || hostname.includes('s3.')) return 'AWS S3';
    if (hostname.includes('storage.googleapis')) return 'GCS';
    if (hostname.includes('blob.core.windows')) return 'Azure';
    // Streaming
    if (hostname.includes('youtube') || hostname.includes('youtu.be')) return 'YouTube';
    if (hostname.includes('vimeo')) return 'Vimeo';
    if (hostname.includes('dailymotion')) return 'Dailymotion';
    // Generic patterns
    if (hostname.includes('stream') || hostname.includes('vod')) return 'VOD';
    if (hostname.includes('api.')) return 'API Stream';
    // Fallback: pegar domínio base (2 últimas partes)
    const parts = hostname.split('.');
    if (parts.length >= 2) {
      const domain = parts.slice(-2).join('.');
      return domain;
    }
    return 'Desconhecido';
  } catch {
    // URL inválida
    if (url.startsWith('/') || url.startsWith('./')) return 'Local';
    return null;
  }
}
