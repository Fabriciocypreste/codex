import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';
const sb = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
const TMDB = 'https://api.themoviedb.org/3';
const IMG = 'https://image.tmdb.org/t/p';
const opts = { headers: { accept: 'application/json', Authorization: `Bearer ${process.env.VITE_TMDB_READ_TOKEN}` } };

// Deletar o registro errado (Eden, tmdb_id 21030)
await sb.from('series').delete().eq('tmdb_id', 21030);
console.log('Removido registro errado (Eden)');

// Buscar dados corretos de White Collar (21510)
const res = await fetch(`${TMDB}/tv/21510?append_to_response=images,credits&include_image_language=pt,en,null&language=pt-BR`, opts);
const data = await res.json();

const logos = data.images?.logos || [];
const bestLogo = logos.find(l => l.iso_639_1 === 'pt') || logos.find(l => l.iso_639_1 === 'en') || logos[0];

const record = {
  tmdb_id: 21510,
  title: data.name,
  description: data.overview,
  poster: data.poster_path ? `${IMG}/w500${data.poster_path}` : null,
  backdrop: data.backdrop_path ? `${IMG}/original${data.backdrop_path}` : null,
  logo_url: bestLogo?.file_path ? `${IMG}/w500${bestLogo.file_path}` : null,
  genre: (data.genres || []).map(g => g.name),
  stars: (data.credits?.cast || []).slice(0, 5).map(c => c.name),
  rating: data.vote_average ? String(data.vote_average.toFixed(1)) : null,
  year: data.first_air_date ? parseInt(data.first_air_date.substring(0, 4)) : null,
  seasons: data.number_of_seasons || null,
  status: 'published',
};

const { error } = await sb.from('series').insert(record);
if (error) console.log('Error:', error.message);
else console.log('OK:', record.title, `(${record.year})`, 'poster:', !!record.poster, 'backdrop:', !!record.backdrop, 'logo:', !!record.logo_url);
console.log('Stars:', record.stars.join(', '));
