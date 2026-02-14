/**
 * tmdbSync.ts — Auto-Cura de IDs TMDB errados
 * ═══════════════════════════════════════════════════════════
 * Se um tmdb_id retorna 404/erro, busca pelo nome no TMDB,
 * corrige o ID no Supabase e retorna os dados corretos.
 * ═══════════════════════════════════════════════════════════
 */

import { supabase } from './supabaseService';
import { fetchDetails, tmdb, getMediaDetailsByID } from './tmdb';
import { Media } from '../types';

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
 * Busca detalhes no TMDB com Auto-Cura.
 * Se o tmdb_id falhar, busca pelo título, corrige no banco e retorna.
 */
async function getOrFixDetails(localItem: any, type: 'movie' | 'tv'): Promise<any | null> {
  if (!localItem) return null;
  const tmdbId = localItem.tmdb_id || localItem.id;

  // 1. Tenta busca normal pelo ID
  if (tmdbId && Number(tmdbId) > 0) {
    try {
      const details = await fetchDetails(Number(tmdbId), type);
      if (details && !details.status_code) {
        return details;
      }
    } catch (e) {
      console.warn(`[Auto-Heal] ID ${tmdbId} falhou para "${localItem.title}".`);
    }
  }

  // 2. Auto-Cura: busca por nome no TMDB
  const searchName = localItem.title || localItem.name;
  if (!searchName) return null;

  console.log(`[Auto-Heal] Corrigindo: "${searchName}" (ID antigo: ${tmdbId})`);
  try {
    const endpoint = type === 'movie' ? 'movie' : 'tv';
    const res = await fetch(
      `${BASE_URL}/search/${endpoint}?query=${encodeURIComponent(searchName)}&language=pt-BR&page=1`,
      fetchOptions
    );
    if (!res.ok) return null;
    const data = await res.json();

    const correct = data.results?.[0];
    if (!correct) {
      console.warn(`[Auto-Heal] Nenhum resultado TMDB para "${searchName}"`);
      return null;
    }

    // 3. Corrige o ID no Supabase para não precisar buscar de novo
    const table = type === 'movie' ? 'movies' : 'series';
    const updatePayload: any = { tmdb_id: correct.id };
    if (correct.poster_path) updatePayload.poster = `${IMAGE_BASE}/w500${correct.poster_path}`;
    if (correct.backdrop_path) updatePayload.backdrop = `${IMAGE_BASE}/original${correct.backdrop_path}`;
    if (correct.overview) updatePayload.description = correct.overview;

    const { error: updateError } = await supabase
      .from(table)
      .update(updatePayload)
      .eq('id', localItem.id);

    if (updateError) {
      console.warn(`[Auto-Heal] Erro ao atualizar DB:`, updateError);
    } else {
      console.log(`[Auto-Heal] ✅ Corrigido "${searchName}": ${tmdbId} → ${correct.id}`);
    }

    // 4. Retorna os detalhes com o ID correto
    return await fetchDetails(correct.id, type);
  } catch (err) {
    console.error(`[Auto-Heal] Falha total para "${searchName}":`, err);
    return null;
  }
}

/**
 * Versão enriquecida do getMediaDetailsByID com auto-cura
 */
async function getDetailsWithHeal(media: Media): Promise<any | null> {
  const type = media.type === 'series' ? 'tv' : 'movie';
  return getOrFixDetails(media, type);
}

// ─── Export ──────────────────────────────────────────────────
export const tmdbSync = {
  getOrFixDetails,
  getDetailsWithHeal,
};

export { getOrFixDetails, getDetailsWithHeal };
export default tmdbSync;
