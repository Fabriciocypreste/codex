import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { tmdb, getImageUrl, fetchDetails } from '../services/tmdb';
import { Media } from '../types';
import { Play, Info } from 'lucide-react';
import { playSelectSound } from '../utils/soundEffects';

const IMAGE_BASE = 'https://image.tmdb.org/t/p/original';

interface HeroBannerProps {
  mediaType?: 'movie' | 'tv' | 'all';
  onPlayMedia?: (media: Media) => void;
  onSelectMedia?: (media: Media) => void;
  dbMedia?: Media[];
}

/** Normaliza título para comparação */
function normalizeTitle(t: string): string {
  return t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
}

const HeroBanner: React.FC<HeroBannerProps> = ({ mediaType = 'all', onPlayMedia, onSelectMedia, dbMedia }) => {
  const [movies, setMovies] = useState<any[]>([]);
  const [streamUrlMap, setStreamUrlMap] = useState<Map<string, string>>(new Map());
  const [tmdbUrlMap, setTmdbUrlMap] = useState<Map<number, string>>(new Map());
  const [currentIndex, setCurrentIndex] = useState(0);
  const [trailerKey, setTrailerKey] = useState<string | null>(null);
  const [showTrailer, setShowTrailer] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  const timeoutRef = useRef<number | null>(null);

  // 1. CARREGAR LISTA DE FILMES
  useEffect(() => {
    const loadData = async () => {
      try {
        const data = await tmdb.getTrending();
        if (data && data.results && data.results.length > 0) {
          let filtered = data.results;

          if (mediaType === 'movie') {
            filtered = filtered.filter((m: any) => m.media_type === 'movie');
          } else if (mediaType === 'tv') {
            filtered = filtered.filter((m: any) => m.media_type === 'tv');
          }

          setMovies(filtered.slice(0, 8));
        }
      } catch (e) {
        console.error("Erro banner:", e);
      }
    };
    loadData();
  }, [mediaType]);

  // Construir mapa de stream_url a partir do catálogo do Supabase
  // PRIORIDADE: TMDB ID > Título Exato
  useEffect(() => {
    if (!dbMedia || dbMedia.length === 0) return;

    const titleMap = new Map<string, string>();
    const idMap = new Map<number, string>();

    dbMedia.forEach(item => {
      if (!item.stream_url) return;

      // Mapear por TMDB ID (Mais preciso)
      if (item.tmdb_id) {
        idMap.set(item.tmdb_id, item.stream_url);
      }

      // Mapear por Título (Fallback)
      if (item.title) {
        titleMap.set(normalizeTitle(item.title), item.stream_url);
      }
    });

    setStreamUrlMap(titleMap);
    setTmdbUrlMap(idMap);
  }, [dbMedia]);

  // 2. ORQUESTRAÇÃO DO TEMPO (IMAGEM -> VÍDEO -> PRÓXIMO)
  useEffect(() => {
    if (movies.length === 0) return;

    const currentMovie = movies[currentIndex];

    setShowTrailer(false);
    setTrailerKey(null);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    const runCycle = async () => {
      try {
        const details = await fetchDetails(currentMovie.id, currentMovie.media_type || 'movie');
        const trailer = details?.videos?.results?.find((v: any) => v.type === 'Trailer');

        // Extrair logo das imagens (pt > en > qualquer)
        const logoData = details?.images?.logos?.find((l: any) => l.iso_639_1 === 'pt')
          || details?.images?.logos?.find((l: any) => l.iso_639_1 === 'en')
          || details?.images?.logos?.[0];
        setLogoUrl(logoData ? `${IMAGE_BASE}${logoData.file_path}` : null);

        if (trailer) {
          setTrailerKey(trailer.key);

          // ETAPA A: Espera 5 segundos vendo a imagem estática
          timeoutRef.current = window.setTimeout(() => {
            setShowTrailer(true);

            // ETAPA B: Deixa o vídeo rodar por 25 segundos, depois troca
            timeoutRef.current = window.setTimeout(() => {
              nextMovie();
            }, 25000);

          }, 5000);
        } else {
          timeoutRef.current = window.setTimeout(() => {
            nextMovie();
          }, 8000);
        }
      } catch (e) {
        nextMovie();
      }
    };

    runCycle();

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [currentIndex, movies]);

  const nextMovie = () => {
    setCurrentIndex((prev) => (prev + 1) % movies.length);
  };

  if (movies.length === 0) return <div className="h-[80vh] bg-black animate-pulse" />;

  const movie = movies[currentIndex];

  return (
    <div className="absolute top-0 left-0 w-screen h-screen overflow-hidden z-0">
      <div className="relative h-full w-full overflow-hidden bg-black group">
        <AnimatePresence mode='wait'>
          <motion.div
            key={movie.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8 }}
            className="absolute inset-0"
          >
            {/* === FUNDO (VÍDEO OU IMAGEM) === */}
            <div className="absolute inset-0 w-full h-full">
              <img
                src={getImageUrl(movie.backdrop_path, 'original')}
                alt={movie.title}
                className="w-full h-full object-cover"
              />

              {/* Gradientes para leitura do texto (Estilo Prime Video: Vignette forte na esquerda) */}
              <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/50 to-transparent"></div>
              <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent"></div>
            </div>

            {/* === CONTEÚDO === */}
            <div className="absolute top-1/2 left-12 -translate-y-1/3 max-w-xl space-y-4 z-20">
              {/* Logo */}
              <motion.img
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.8 }}
                src={logoUrl}
                alt={movie.title || movie.name}
                className="max-w-[150px] md:max-w-[210px] h-auto object-contain drop-shadow-2xl mt-32"
              />

              {/* Sinopse Curta */}
              <motion.p
                initial={{ y: 10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.3, duration: 0.8 }}
                className="text-white/80 text-sm md:text-base font-medium max-w-[260px] drop-shadow-md line-clamp-2 leading-relaxed"
              >
                {movie.overview}
              </motion.p>

              {/* TV Action Buttons — D-Pad focusable */}
              <motion.div
                initial={{ y: 10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.5, duration: 0.6 }}
                className="flex items-center gap-3"
                data-nav-row={1}
              >
                <button
                  tabIndex={0}
                  data-nav-item
                  data-nav-col={0}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-white/95 text-black font-bold text-sm
                    shadow-[0_2px_8px_rgba(0,0,0,0.3)] hover:bg-white hover:scale-105 active:scale-95
                    transition-all duration-200 outline-none focus:ring-2 focus:ring-white focus:scale-105"
                  onClick={() => {
                    playSelectSound();
                    const streamUrl = tmdbUrlMap.get(movie.id) || streamUrlMap.get(normalizeTitle(movie.title || movie.name));
                    const mediaItem: Media = {
                      id: String(movie.id),
                      tmdb_id: movie.id,
                      title: movie.title || movie.name,
                      type: movie.media_type === 'tv' ? 'series' : 'movie',
                      description: movie.overview,
                      poster: getImageUrl(movie.poster_path, 'w500'),
                      backdrop: getImageUrl(movie.backdrop_path, 'original'),
                      year: new Date(movie.release_date || movie.first_air_date || '').getFullYear() || undefined,
                      rating: movie.vote_average?.toFixed(1),
                      genre: [],
                      stars: [],
                      stream_url: streamUrl,
                    };
                    if (onPlayMedia) onPlayMedia(mediaItem);
                    else if (onSelectMedia) onSelectMedia(mediaItem);
                  }}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); (e.target as HTMLElement).click(); } }}
                >
                  <Play size={16} fill="black" /> Assistir
                </button>

                <button
                  tabIndex={0}
                  data-nav-item
                  data-nav-col={1}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/10 border border-white/20 text-white font-bold text-sm
                    hover:bg-white/25 hover:scale-105 active:scale-95
                    transition-all duration-200 outline-none focus:ring-2 focus:ring-white focus:scale-105"
                  onClick={() => {
                    playSelectSound();
                    const streamUrl = tmdbUrlMap.get(movie.id) || streamUrlMap.get(normalizeTitle(movie.title || movie.name));
                    const mediaItem: Media = {
                      id: String(movie.id),
                      tmdb_id: movie.id,
                      title: movie.title || movie.name,
                      type: movie.media_type === 'tv' ? 'series' : 'movie',
                      description: movie.overview,
                      poster: getImageUrl(movie.poster_path, 'w500'),
                      backdrop: getImageUrl(movie.backdrop_path, 'original'),
                      year: new Date(movie.release_date || movie.first_air_date || '').getFullYear() || undefined,
                      rating: movie.vote_average?.toFixed(1),
                      genre: [],
                      stars: [],
                      stream_url: streamUrl,
                    };
                    if (onSelectMedia) onSelectMedia(mediaItem);
                  }}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); (e.target as HTMLElement).click(); } }}
                >
                  <Info size={16} /> Detalhes
                </button>
              </motion.div>
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Indicadores Visuais (Barrinhas) */}
        <div className="absolute bottom-6 right-12 flex gap-2 z-30">
          {movies.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentIndex(idx)}
              aria-label={`Slide ${idx + 1}`}
              className={`h-1 rounded-full transition-all duration-500 cursor-pointer ${idx === currentIndex ? 'w-6 bg-white' : 'w-1.5 bg-white/30'}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default HeroBanner;
