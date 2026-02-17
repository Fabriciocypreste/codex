import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const sb = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

const { data: movies } = await sb.from('movies').select('id, title, poster, backdrop, logo_url').limit(1000);
const { data: series } = await sb.from('series').select('id, title, poster, backdrop, logo_url').limit(1000);

const mP = movies.filter(m => m.poster?.includes('tmdb.org')).length;
const mB = movies.filter(m => m.backdrop?.includes('tmdb.org')).length;
const mL = movies.filter(m => m.logo_url?.includes('tmdb.org')).length;
const sP = series.filter(s => s.poster?.includes('tmdb.org')).length;
const sB = series.filter(s => s.backdrop?.includes('tmdb.org')).length;
const sL = series.filter(s => s.logo_url?.includes('tmdb.org')).length;

console.log(`\n=== VALIDAÇÃO DE IMAGENS ===`);
console.log(`FILMES (${movies.length}):`);
console.log(`  Poster:   ${mP}/${movies.length}`);
console.log(`  Backdrop: ${mB}/${movies.length}`);
console.log(`  Logo:     ${mL}/${movies.length}`);
console.log(`SÉRIES (${series.length}):`);
console.log(`  Poster:   ${sP}/${series.length}`);
console.log(`  Backdrop: ${sB}/${series.length}`);
console.log(`  Logo:     ${sL}/${series.length}`);

console.log(`\n--- Amostra Filmes ---`);
movies.slice(0, 3).forEach(m => {
  console.log(`${m.title}: poster=${!!m.poster} backdrop=${!!m.backdrop} logo=${!!m.logo_url}`);
});
console.log(`\n--- Amostra Séries ---`);
series.slice(0, 3).forEach(s => {
  console.log(`${s.title}: poster=${!!s.poster} backdrop=${!!s.backdrop} logo=${!!s.logo_url}`);
});
