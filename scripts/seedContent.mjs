/**
 * seedContent.mjs
 * Script de seed que busca filmes e séries reais do TMDB (2022-2026)
 * e insere no Supabase via upsert (onConflict: tmdb_id).
 *
 * Uso: node scripts/seedContent.mjs
 */

import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

/* ── Config ── */
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY;
const TMDB_TOKEN  = process.env.VITE_TMDB_READ_TOKEN;

if (!SUPABASE_URL || !SUPABASE_KEY || !TMDB_TOKEN) {
  console.error('❌ Variáveis de ambiente ausentes. Verifique .env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const TMDB_BASE = 'https://api.themoviedb.org/3';
const IMG_BASE  = 'https://image.tmdb.org/t/p';
const fetchOpts = { headers: { accept: 'application/json', Authorization: `Bearer ${TMDB_TOKEN}` } };

/* ── Mapa de gêneros TMDB ── */
const MOVIE_GENRES = {
  28:'Ação',12:'Aventura',16:'Animação',35:'Comédia',80:'Crime',99:'Documentário',
  18:'Drama',10751:'Família',14:'Fantasia',36:'História',27:'Terror',10402:'Música',
  9648:'Mistério',10749:'Romance',878:'Ficção Científica',10770:'Filme de TV',
  53:'Thriller',10752:'Guerra',37:'Faroeste'
};
const TV_GENRES = {
  10759:'Ação & Aventura',16:'Animação',35:'Comédia',80:'Crime',99:'Documentário',
  18:'Drama',10751:'Família',10762:'Kids',9648:'Mistério',10763:'Notícias',
  10764:'Reality',878:'Ficção Científica & Fantasia',10766:'Novela',10767:'Talk Show',
  10768:'Guerra & Política',37:'Faroeste'
};

/* ── Helpers ── */
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function tmdbFetch(path) {
  const res = await fetch(`${TMDB_BASE}${path}`, fetchOpts);
  if (!res.ok) throw new Error(`TMDB ${res.status}: ${path}`);
  return res.json();
}

function mapGenres(ids, map) {
  return (ids || []).map(id => map[id]).filter(Boolean);
}

/* ── Buscar filmes por ano (várias páginas) ── */
async function discoverMoviesByYear(year, maxPages = 5) {
  const all = [];
  for (let page = 1; page <= maxPages; page++) {
    try {
      const data = await tmdbFetch(
        `/discover/movie?language=pt-BR&sort_by=popularity.desc&primary_release_year=${year}&vote_count.gte=100&page=${page}`
      );
      all.push(...(data.results || []));
      if (page >= data.total_pages) break;
      await sleep(250);
    } catch (e) {
      console.warn(`  ⚠ Filmes ${year} p${page}: ${e.message}`);
      break;
    }
  }
  return all;
}

/* ── Buscar séries por ano (várias páginas) ── */
async function discoverSeriesByYear(year, maxPages = 5) {
  const all = [];
  for (let page = 1; page <= maxPages; page++) {
    try {
      const data = await tmdbFetch(
        `/discover/tv?language=pt-BR&sort_by=popularity.desc&first_air_date_year=${year}&vote_count.gte=50&page=${page}`
      );
      all.push(...(data.results || []));
      if (page >= data.total_pages) break;
      await sleep(250);
    } catch (e) {
      console.warn(`  ⚠ Séries ${year} p${page}: ${e.message}`);
      break;
    }
  }
  return all;
}

/* ── Buscar detalhes + elenco de um filme ── */
async function getMovieDetails(id) {
  try {
    const data = await tmdbFetch(`/movie/${id}?append_to_response=credits,videos&language=pt-BR`);
    const cast = (data.credits?.cast || []).slice(0, 5).map(c => c.name);
    const trailer = (data.videos?.results || []).find(v => v.type === 'Trailer' && v.site === 'YouTube');
    const duration = data.runtime ? `${data.runtime} min` : null;
    return { cast, trailer_key: trailer?.key || null, duration, overview: data.overview || null };
  } catch {
    return { cast: [], trailer_key: null, duration: null, overview: null };
  }
}

/* ── Buscar detalhes + elenco de uma série ── */
async function getSeriesDetails(id) {
  try {
    const data = await tmdbFetch(`/tv/${id}?append_to_response=credits,videos&language=pt-BR`);
    const cast = (data.credits?.cast || []).slice(0, 5).map(c => c.name);
    const trailer = (data.videos?.results || []).find(v => v.type === 'Trailer' && v.site === 'YouTube');
    return {
      cast,
      trailer_key: trailer?.key || null,
      seasons: data.number_of_seasons || 1,
      overview: data.overview || null
    };
  } catch {
    return { cast: [], trailer_key: null, seasons: 1, overview: null };
  }
}

/* ── Upsert em lotes ── */
async function upsertBatch(table, rows) {
  if (rows.length === 0) return 0;
  const batchSize = 50;
  let inserted = 0;
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const { error } = await supabase
      .from(table)
      .upsert(batch, { onConflict: 'tmdb_id', ignoreDuplicates: false });
    if (error) {
      console.error(`  ❌ Upsert ${table} batch ${i}: ${error.message}`);
    } else {
      inserted += batch.length;
    }
  }
  return inserted;
}

/* ══════════════════════════════════════════════
   MAIN
   ══════════════════════════════════════════════ */
async function main() {
  console.log('🎬 REDX Content Seeder — Filmes & Séries 2022-2026');
  console.log('═'.repeat(55));

  const years = [2022, 2023, 2024, 2025, 2026];
  let totalMovies = 0;
  let totalSeries = 0;

  /* ── FILMES ── */
  console.log('\n📽️  FILMES');
  for (const year of years) {
    process.stdout.write(`  ${year}: buscando...`);
    const raw = await discoverMoviesByYear(year, 5);
    process.stdout.write(` ${raw.length} encontrados. Enriquecendo`);

    const movieRows = [];
    for (let i = 0; i < raw.length; i++) {
      const m = raw[i];
      const details = await getMovieDetails(m.id);
      await sleep(120); // rate-limit

      movieRows.push({
        tmdb_id: m.id,
        title: m.title,
        description: details.overview || m.overview || '',
        rating: String(m.vote_average?.toFixed(1) || '0'),
        year,
        duration: details.duration,
        genre: mapGenres(m.genre_ids, MOVIE_GENRES),
        backdrop: m.backdrop_path ? `${IMG_BASE}/original${m.backdrop_path}` : null,
        poster: m.poster_path ? `${IMG_BASE}/w500${m.poster_path}` : null,
        stars: details.cast,
        trailer_key: details.trailer_key,
        status: 'published'
      });

      if ((i + 1) % 20 === 0) process.stdout.write('.');
    }

    const count = await upsertBatch('movies', movieRows);
    console.log(` ✅ ${count} inseridos/atualizados`);
    totalMovies += count;
  }

  /* ── SÉRIES ── */
  console.log('\n📺  SÉRIES');
  for (const year of years) {
    process.stdout.write(`  ${year}: buscando...`);
    const raw = await discoverSeriesByYear(year, 5);
    process.stdout.write(` ${raw.length} encontrados. Enriquecendo`);

    const seriesRows = [];
    for (let i = 0; i < raw.length; i++) {
      const s = raw[i];
      const details = await getSeriesDetails(s.id);
      await sleep(120);

      seriesRows.push({
        tmdb_id: s.id,
        title: s.name,
        description: details.overview || s.overview || '',
        rating: String(s.vote_average?.toFixed(1) || '0'),
        year,
        seasons: details.seasons,
        genre: mapGenres(s.genre_ids, TV_GENRES),
        backdrop: s.backdrop_path ? `${IMG_BASE}/original${s.backdrop_path}` : null,
        poster: s.poster_path ? `${IMG_BASE}/w500${s.poster_path}` : null,
        stars: details.cast,
        trailer_key: details.trailer_key,
        status: 'published'
      });

      if ((i + 1) % 20 === 0) process.stdout.write('.');
    }

    const count = await upsertBatch('series', seriesRows);
    console.log(` ✅ ${count} inseridos/atualizados`);
    totalSeries += count;
  }

  /* ── Resumo ── */
  console.log('\n' + '═'.repeat(55));
  console.log(`🏁 CONCLUÍDO: ${totalMovies} filmes + ${totalSeries} séries inseridos no Supabase`);
  console.log('═'.repeat(55));
}

main().catch(err => {
  console.error('💥 Erro fatal:', err);
  process.exit(1);
});
