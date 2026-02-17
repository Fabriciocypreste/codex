/**
 * insertBannerSeries.mjs
 * Insere/atualiza no Supabase as séries selecionadas para os banners.
 * Busca dados completos + imagens (poster, backdrop, logo) do TMDB.
 *
 * Uso: node scripts/insertBannerSeries.mjs
 */
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY;
const TMDB_TOKEN  = process.env.VITE_TMDB_READ_TOKEN;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const TMDB = 'https://api.themoviedb.org/3';
const IMG  = 'https://image.tmdb.org/t/p';
const opts = { headers: { accept: 'application/json', Authorization: `Bearer ${TMDB_TOKEN}` } };
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function tmdbGet(path) {
  const res = await fetch(`${TMDB}${path}`, opts);
  if (res.status === 429) { await sleep(3000); return tmdbGet(path); }
  if (!res.ok) return null;
  return res.json();
}

// Séries desejadas pelo usuário com seus TMDB IDs
const BANNER_SERIES = [
  { tmdb_id: 1396,   name: 'Breaking Bad' },
  { tmdb_id: 119051, name: 'Wandinha (Wednesday)' },
  { tmdb_id: 37680,  name: 'Suits' },
  { tmdb_id: 44217,  name: 'Vikings' },
  { tmdb_id: 2691,   name: 'Dois Homens e Meio (Two and a Half Men)' },
  { tmdb_id: 21510,  name: 'Crimes do Colarinho Branco (White Collar)' },
  { tmdb_id: 46952,  name: 'A Lista Negra (The Blacklist)' },
  { tmdb_id: 1405,   name: 'Dexter' },
  { tmdb_id: 4604,   name: 'Smallville' },
];

async function processSeries(tmdb_id, label) {
  console.log(`\n🔍 ${label} (TMDB: ${tmdb_id})`);

  // Buscar detalhes completos + imagens + créditos
  const data = await tmdbGet(`/tv/${tmdb_id}?append_to_response=images,credits&include_image_language=pt,en,null&language=pt-BR`);
  if (!data) { console.log('   ❌ Não encontrado no TMDB'); return null; }

  // Poster
  const poster = data.poster_path ? `${IMG}/w500${data.poster_path}` : null;

  // Backdrop
  const backdrop = data.backdrop_path ? `${IMG}/original${data.backdrop_path}` : null;

  // Logo (prioridade: pt > en > qualquer)
  const logos = data.images?.logos || [];
  const bestLogo = logos.find(l => l.iso_639_1 === 'pt') || logos.find(l => l.iso_639_1 === 'en') || logos[0];
  const logo_url = bestLogo?.file_path ? `${IMG}/w500${bestLogo.file_path}` : null;

  // Gêneros
  const genre = (data.genres || []).map(g => g.name);

  // Cast
  const stars = (data.credits?.cast || []).slice(0, 5).map(c => c.name);

  // Descrição
  const description = data.overview || '';

  const record = {
    tmdb_id,
    title: data.name,
    description,
    poster,
    backdrop,
    logo_url,
    genre,
    stars,
    rating: data.vote_average ? String(data.vote_average.toFixed(1)) : null,
    year: data.first_air_date ? parseInt(data.first_air_date.substring(0, 4)) : null,
    seasons: data.number_of_seasons || null,
    status: 'published',
    is_banner: true,  // Flag para identificar conteúdo de banner
  };

  console.log(`   📺 ${record.title} (${record.year})`);
  console.log(`   🖼️  poster: ${poster ? '✅' : '❌'} | backdrop: ${backdrop ? '✅' : '❌'} | logo: ${logo_url ? '✅' : '❌'}`);
  console.log(`   ⭐ Rating: ${record.rating} | Seasons: ${record.seasons}`);
  console.log(`   🎭 ${genre.join(', ')}`);
  console.log(`   🌟 ${stars.join(', ')}`);

  return record;
}

async function main() {
  console.log('🎬 REDX Banner Series — Inserção de séries para banners');
  console.log('═'.repeat(60));

  const records = [];

  for (const s of BANNER_SERIES) {
    const record = await processSeries(s.tmdb_id, s.name);
    if (record) records.push(record);
    await sleep(300);
  }

  if (records.length === 0) {
    console.log('\n❌ Nenhuma série processada');
    return;
  }

  // Upsert no Supabase (por tmdb_id)
  console.log(`\n📤 Inserindo/atualizando ${records.length} séries no Supabase...`);

  for (const rec of records) {
    // Verificar se já existe
    const { data: existing } = await supabase.from('series').select('id').eq('tmdb_id', rec.tmdb_id).limit(1);

    if (existing && existing.length > 0) {
      // Update
      const { error } = await supabase.from('series').update(rec).eq('tmdb_id', rec.tmdb_id);
      if (error) {
        console.log(`   ❌ Update ${rec.title}: ${error.message}`);
        // Tentar sem is_banner caso a coluna não exista
        delete rec.is_banner;
        const { error: e2 } = await supabase.from('series').update(rec).eq('tmdb_id', rec.tmdb_id);
        if (e2) console.log(`   ❌ Retry ${rec.title}: ${e2.message}`);
        else console.log(`   ✅ ${rec.title} — atualizada (sem is_banner)`);
      } else {
        console.log(`   ✅ ${rec.title} — atualizada`);
      }
    } else {
      // Insert
      const { error } = await supabase.from('series').insert(rec);
      if (error) {
        // Tentar sem is_banner
        delete rec.is_banner;
        const { error: e2 } = await supabase.from('series').insert(rec);
        if (e2) console.log(`   ❌ Insert ${rec.title}: ${e2.message}`);
        else console.log(`   ✅ ${rec.title} — inserida (sem is_banner)`);
      } else {
        console.log(`   ✅ ${rec.title} — inserida`);
      }
    }
  }

  // Listar os tmdb_ids para uso no HeroBanner
  console.log('\n═'.repeat(60));
  console.log('📋 TMDB IDs para configurar no HeroBanner:');
  console.log(JSON.stringify(records.map(r => r.tmdb_id)));
  console.log('\n🏁 Concluído!');
}

main().catch(err => { console.error('💥', err); process.exit(1); });

