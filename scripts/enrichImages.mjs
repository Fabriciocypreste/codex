/**
 * enrichImages.mjs
 * Enriquece todos os filmes e séries no Supabase com imagens oficiais do TMDB:
 *   - poster (vertical, w500)
 *   - backdrop (horizontal, original)
 *   - logo_url (logo do título, se disponível)
 *
 * Uso: node scripts/enrichImages.mjs
 */

import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY;
const TMDB_TOKEN  = process.env.VITE_TMDB_READ_TOKEN;

if (!SUPABASE_URL || !SUPABASE_KEY || !TMDB_TOKEN) {
  console.error('❌ Variáveis de ambiente ausentes. Verifique .env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const TMDB_BASE = 'https://api.themoviedb.org/3';
const IMG = 'https://image.tmdb.org/t/p';
const fetchOpts = { headers: { accept: 'application/json', Authorization: `Bearer ${TMDB_TOKEN}` } };

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function tmdbFetch(path, retries = 3) {
  try {
    const res = await fetch(`${TMDB_BASE}${path}`, fetchOpts);
    if (!res.ok) {
      if (res.status === 429 && retries > 0) {
        console.warn('    ⏳ Rate limit TMDB, aguardando 3s...');
        await sleep(3000);
        return tmdbFetch(path, retries - 1);
      }
      return null;
    }
    return res.json();
  } catch (err) {
    if (retries > 0) {
      console.warn(`    ⚠️ Erro de rede, retentando... (${retries} restantes)`);
      await sleep(2000);
      return tmdbFetch(path, retries - 1);
    }
    console.error(`    ❌ Falha na requisição: ${err.message}`);
    return null;
  }
}

/**
 * Busca imagens detalhadas de um filme/série no TMDB
 */
async function getImages(tmdbId, type) {
  const endpoint = type === 'movie' ? 'movie' : 'tv';

  // Buscar dados + imagens em uma única chamada
  const data = await tmdbFetch(
    `/${endpoint}/${tmdbId}?append_to_response=images&include_image_language=pt,en,null&language=pt-BR`
  );
  if (!data) return null;

  // Poster: prioridade pt-BR > en > qualquer
  const poster = data.poster_path
    ? `${IMG}/w500${data.poster_path}`
    : null;

  // Backdrop: prioridade imagem mais larga
  const backdrop = data.backdrop_path
    ? `${IMG}/original${data.backdrop_path}`
    : null;

  // Logo: prioridade pt > en > qualquer
  const logos = data.images?.logos || [];
  const logoPt = logos.find(l => l.iso_639_1 === 'pt');
  const logoEn = logos.find(l => l.iso_639_1 === 'en');
  const logoAny = logos[0];
  const bestLogo = logoPt || logoEn || logoAny;
  const logo_url = bestLogo?.file_path
    ? `${IMG}/w500${bestLogo.file_path}`
    : null;

  // Descrição em PT-BR
  const description = data.overview || null;

  // Trailer key
  const videos = data.videos?.results || [];
  const trailer = videos.find(v => v.type === 'Trailer' && v.site === 'YouTube');
  const trailer_key = trailer?.key || null;

  // Stars (cast)
  const stars = (data.credits?.cast || []).slice(0, 5).map(c => c.name);

  // Duration (filmes)
  const duration = data.runtime ? `${data.runtime} min` : null;

  // Seasons (séries)
  const seasons = data.number_of_seasons || null;

  return {
    poster,
    backdrop,
    logo_url,
    description,
    trailer_key,
    stars: stars.length > 0 ? stars : null,
    duration,
    seasons,
    rating: data.vote_average ? String(data.vote_average.toFixed(1)) : null
  };
}

/**
 * Atualiza lote de registros no Supabase
 */
async function updateRecord(table, id, updates) {
  // Remover campos nulos para não sobrescrever dados existentes com null
  const cleanUpdates = {};
  for (const [key, value] of Object.entries(updates)) {
    if (value !== null && value !== undefined) {
      cleanUpdates[key] = value;
    }
  }

  if (Object.keys(cleanUpdates).length === 0) return false;

  const { error } = await supabase.from(table).update(cleanUpdates).eq('id', id);
  if (error) {
    console.error(`    ❌ Update ${table} ${id}: ${error.message}`);
    return false;
  }
  return true;
}

/* ══════════════════════════════════════════════
   MAIN
   ══════════════════════════════════════════════ */
async function main() {
  console.log('🖼️  REDX Image Enrichment — Posters, Backdrops & Logos');
  console.log('═'.repeat(60));

  // Buscar todos os filmes e séries do Supabase
  const { data: allMovies, error: mErr } = await supabase.from('movies').select('id, tmdb_id, title, poster, backdrop, logo_url').order('created_at', { ascending: false });
  const { data: allSeries, error: sErr } = await supabase.from('series').select('id, tmdb_id, title, poster, backdrop, logo_url').order('created_at', { ascending: false });

  if (mErr || sErr) {
    console.error('❌ Erro ao buscar dados:', mErr?.message, sErr?.message);
    process.exit(1);
  }

  console.log(`\n📦 Encontrados: ${allMovies.length} filmes, ${allSeries.length} séries\n`);

  /* ── FILMES ── */
  console.log('📽️  FILMES — Atualizando imagens...');
  let updatedMovies = 0;
  let skippedMovies = 0;

  for (let i = 0; i < allMovies.length; i++) {
    const movie = allMovies[i];

    if (!movie.tmdb_id) {
      skippedMovies++;
      continue;
    }

    // Verificar se já tem todas as imagens
    const hasPoster = movie.poster && movie.poster.includes('tmdb.org');
    const hasBackdrop = movie.backdrop && movie.backdrop.includes('tmdb.org');
    const hasLogo = movie.logo_url && movie.logo_url.includes('tmdb.org');

    // Se já tem poster + backdrop, só busca se faltar logo
    if (hasPoster && hasBackdrop && hasLogo) {
      skippedMovies++;
      continue;
    }

    const images = await getImages(movie.tmdb_id, 'movie');
    await sleep(200); // Rate-limit

    if (!images) {
      skippedMovies++;
      continue;
    }

    const updates = {};
    if (!hasPoster && images.poster) updates.poster = images.poster;
    if (!hasBackdrop && images.backdrop) updates.backdrop = images.backdrop;
    if (!hasLogo && images.logo_url) updates.logo_url = images.logo_url;
    if (images.description) updates.description = images.description;
    if (images.rating) updates.rating = images.rating;
    if (images.duration) updates.duration = images.duration;
    if (images.stars) updates.stars = images.stars;
    if (images.trailer_key) updates.trailer_key = images.trailer_key;

    const ok = await updateRecord('movies', movie.id, updates);
    if (ok) updatedMovies++;

    if ((i + 1) % 50 === 0) {
      console.log(`  ... ${i + 1}/${allMovies.length} processados (${updatedMovies} atualizados)`);
    }
  }
  console.log(`  ✅ Filmes: ${updatedMovies} atualizados, ${skippedMovies} já completos\n`);

  /* ── SÉRIES ── */
  console.log('📺  SÉRIES — Atualizando imagens...');
  let updatedSeries = 0;
  let skippedSeries = 0;

  for (let i = 0; i < allSeries.length; i++) {
    const serie = allSeries[i];

    if (!serie.tmdb_id) {
      skippedSeries++;
      continue;
    }

    const hasPoster = serie.poster && serie.poster.includes('tmdb.org');
    const hasBackdrop = serie.backdrop && serie.backdrop.includes('tmdb.org');
    const hasLogo = serie.logo_url && serie.logo_url.includes('tmdb.org');

    if (hasPoster && hasBackdrop && hasLogo) {
      skippedSeries++;
      continue;
    }

    const images = await getImages(serie.tmdb_id, 'series');
    await sleep(200);

    if (!images) {
      skippedSeries++;
      continue;
    }

    const updates = {};
    if (!hasPoster && images.poster) updates.poster = images.poster;
    if (!hasBackdrop && images.backdrop) updates.backdrop = images.backdrop;
    if (!hasLogo && images.logo_url) updates.logo_url = images.logo_url;
    if (images.description) updates.description = images.description;
    if (images.rating) updates.rating = images.rating;
    if (images.seasons) updates.seasons = images.seasons;
    if (images.stars) updates.stars = images.stars;
    if (images.trailer_key) updates.trailer_key = images.trailer_key;

    const ok = await updateRecord('series', serie.id, updates);
    if (ok) updatedSeries++;

    if ((i + 1) % 50 === 0) {
      console.log(`  ... ${i + 1}/${allSeries.length} processados (${updatedSeries} atualizados)`);
    }
  }
  console.log(`  ✅ Séries: ${updatedSeries} atualizadas, ${skippedSeries} já completas\n`);

  /* ── Resumo ── */
  console.log('═'.repeat(60));
  console.log(`🏁 CONCLUÍDO:`);
  console.log(`   📽️  ${updatedMovies}/${allMovies.length} filmes enriquecidos`);
  console.log(`   📺  ${updatedSeries}/${allSeries.length} séries enriquecidas`);
  console.log(`   🖼️  Imagens: poster (w500), backdrop (original), logo (w500)`);
  console.log('═'.repeat(60));
}

main().catch(err => {
  console.error('💥 Erro fatal:', err);
  process.exit(1);
});
