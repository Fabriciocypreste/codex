import React, { useEffect, useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { tmdb, getImageUrl, fetchDetails } from '../services/tmdb';
import { Media } from '../types';
import { Play, Info, Volume2, VolumeX } from 'lucide-react';
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
  const [bannerItems, setBannerItems] = useState<any[]>([]);
  const [streamUrlMap, setStreamUrlMap] = useState<Map<string, string>>(new Map());
  const [tmdbUrlMap, setTmdbUrlMap] = useState<Map<number, string>>(new Map());
  const [currentIndex, setCurrentIndex] = useState(0);
  const [trailerKey, setTrailerKey] = useState<string | null>(null);
  const [showTrailer, setShowTrailer] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [trailerReady, setTrailerReady] = useState(false);

  const timeoutRef = useRef<number | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  // 1. CARREGAR TRENDING DO TMDB + CONTEÚDO REAL DO SUPABASE
  useEffect(() => {
    const loadData = async () => {
      try {
        // Buscar trending do TMDB
        const data = await tmdb.getTrending();
        if (!data?.results?.length) return;

        let filtered = data.results;

        if (mediaType === 'movie') {
          filtered = filtered.filter((m: any) => m.media_type === 'movie');
        } else if (mediaType === 'tv') {
          filtered = filtered.filter((m: any) => m.media_type === 'tv');
        }

        // Filtrar só conteúdo de 2018+ com poster
        const since2018 = filtered.filter((m: any) => {
          const year = new Date(m.release_date || m.first_air_date || '').getFullYear();
          return year >= 2018 && m.poster_path && m.backdrop_path;
        });

        setBannerItems(since2018.slice(0, 12));
      } catch (e) {
        console.error("Erro ao carregar banner:", e);
      }
    };
    loadData();
  }, [mediaType]);

  // Construir mapas de stream_url do Supabase (TMDB ID e Título)
  useEffect(() => {
    if (!dbMedia || dbMedia.length === 0) return;

    const titleMap = new Map<string, string>();
    const idMap = new Map<number, string>();

    dbMedia.forEach(item => {
      if (!item.stream_url) return;
      if (item.tmdb_id) idMap.set(item.tmdb_id, item.stream_url);
      if (item.title) titleMap.set(normalizeTitle(item.title), item.stream_url);
    });

    setStreamUrlMap(titleMap);
    setTmdbUrlMap(idMap);
  }, [dbMedia]);

  // 2. ORQUESTRAÇÃO: POSTER 5s → TRAILER 15s → PRÓXIMO
  useEffect(() => {
    if (bannerItems.length === 0) return;

    const currentMovie = bannerItems[currentIndex];

    // Reset estado
    setShowTrailer(false);
    setTrailerKey(null);
    setTrailerReady(false);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    const runCycle = async () => {
      try {
        const details = await fetchDetails(currentMovie.id, currentMovie.media_type || 'movie');

        // Buscar trailer (prioridade: dublado PT → qualquer trailer)
        const trailerPT = details?.videos?.results?.find(
          (v: any) => v.type === 'Trailer' && v.site === 'YouTube' && (v.iso_639_1 === 'pt' || v.name?.toLowerCase().includes('dublado'))
        );
        const trailerAny = details?.videos?.results?.find(
          (v: any) => v.type === 'Trailer' && v.site === 'YouTube'
        );
        const trailer = trailerPT || trailerAny;

        // Logo (pt > en > qualquer)
        const logoData = details?.images?.logos?.find((l: any) => l.iso_639_1 === 'pt')
          || details?.images?.logos?.find((l: any) => l.iso_639_1 === 'en')
          || details?.images?.logos?.[0];
        setLogoUrl(logoData ? `${IMAGE_BASE}${logoData.file_path}` : null);

        if (trailer) {
          setTrailerKey(trailer.key);

          // ETAPA A: Mostra poster por 5 segundos
          timeoutRef.current = window.setTimeout(() => {
            setShowTrailer(true);

            // ETAPA B: Trailer roda por 15 segundos, depois troca
            timeoutRef.current = window.setTimeout(() => {
              nextMovie();
            }, 15000);

          }, 5000);
        } else {
          // Sem trailer — mostra poster por 8s e avança
          timeoutRef.current = window.setTimeout(() => {
            nextMovie();
          }, 8000);
        }
      } catch (e) {
        // Erro — avança após 5s
        timeoutRef.current = window.setTimeout(() => nextMovie(), 5000);
      }
    };

    runCycle();

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [currentIndex, bannerItems]);

  const nextMovie = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % bannerItems.length);
  }, [bannerItems.length]);

  const buildMediaItem = useCallback((movie: any): Media => {
    const streamUrl = tmdbUrlMap.get(movie.id) || streamUrlMap.get(normalizeTitle(movie.title || movie.name));
    return {
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
  }, [tmdbUrlMap, streamUrlMap]);

  if (bannerItems.length === 0) {
    return (
      <div className="h-[85vh] bg-black animate-pulse flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-[#E50914] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const movie = bannerItems[currentIndex];

  return (
    <div className="absolute top-0 left-0 w-screen h-[85vh] overflow-hidden z-0">
      <div className="relative h-full w-full overflow-hidden bg-black group">
        <AnimatePresence mode='wait'>
          <motion.div
            key={`banner-${movie.id}-${currentIndex}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8 }}
            className="absolute inset-0"
          >
            {/* === FUNDO: POSTER/BACKDROP (sempre visível como base) === */}
            <div className="absolute inset-0 w-full h-full">
              <img
                src={getImageUrl(movie.backdrop_path, 'original')}
                alt={movie.title || movie.name}
                className={`w-full h-full object-cover transition-opacity duration-1000 ${showTrailer && trailerKey ? 'opacity-0' : 'opacity-100'}`}
              />
            </div>

            {/* === TRAILER YOUTUBE (sobrepõe a imagem após 5s) === */}
            {showTrailer && trailerKey && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 1.2 }}
                className="absolute inset-0 w-full h-full z-10"
              >
                <iframe
                  ref={iframeRef}
                  src={`https://www.youtube.com/embed/${trailerKey}?autoplay=1&mute=${isMuted ? 1 : 0}&controls=0&showinfo=0&rel=0&modestbranding=1&iv_load_policy=3&loop=0&start=0&enablejsapi=1&origin=${window.location.origin}`}
                  title="Trailer"
                  className="w-full h-full object-cover pointer-events-none"
                  style={{ 
                    border: 'none',
                    /* Scale up para esconder bordas pretas do YouTube */
                    transform: 'scale(1.25)',
                    transformOrigin: 'center center',
                  }}
                  allow="autoplay; encrypted-media"
                  allowFullScreen
                />
              </motion.div>
            )}

            {/* Gradientes para leitura do texto */}
            <div className="absolute inset-0 bg-linear-to-r from-black/90 via-black/50 to-transparent z-20"></div>
            <div className="absolute inset-0 bg-linear-to-t from-black via-transparent to-transparent z-20"></div>

            {/* === CONTEÚDO TEXTUAL === */}
            <div className="absolute bottom-[18%] left-12 max-w-xl space-y-3 z-30">
              {/* Logo do título */}
              {logoUrl ? (
                <motion.img
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ duration: 0.8 }}
                  src={logoUrl}
                  alt={movie.title || movie.name}
                  className="max-w-[150px] md:max-w-[210px] h-auto object-contain drop-shadow-2xl"
                />
              ) : (
                <motion.h1
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ duration: 0.8 }}
                  className="text-3xl md:text-5xl font-black text-white drop-shadow-2xl"
                >
                  {movie.title || movie.name}
                </motion.h1>
              )}

              {/* Ano e Rating */}
              <motion.div
                initial={{ y: 10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.2, duration: 0.6 }}
                className="flex items-center gap-3 text-sm text-white/60"
              >
                {movie.release_date || movie.first_air_date ? (
                  <span className="bg-white/10 px-2 py-0.5 rounded text-white/80 font-medium">
                    {new Date(movie.release_date || movie.first_air_date).getFullYear()}
                  </span>
                ) : null}
                {movie.vote_average ? (
                  <span className="flex items-center gap-1">
                    <span className="text-yellow-400">★</span> {movie.vote_average.toFixed(1)}
                  </span>
                ) : null}
                <span className="uppercase text-xs tracking-wider text-white/40">
                  {movie.media_type === 'tv' ? 'Série' : 'Filme'}
                </span>
              </motion.div>

              {/* Sinopse */}
              <motion.p
                initial={{ y: 10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.3, duration: 0.8 }}
                className="text-white/80 text-sm md:text-base font-medium max-w-[320px] drop-shadow-md line-clamp-2 leading-relaxed"
              >
                {movie.overview}
              </motion.p>

              {/* Botões D-Pad */}
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
                    const mediaItem = buildMediaItem(movie);
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
                    const mediaItem = buildMediaItem(movie);
                    if (onSelectMedia) onSelectMedia(mediaItem);
                  }}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); (e.target as HTMLElement).click(); } }}
                >
                  <Info size={16} /> Detalhes
                </button>

                {/* Botão Mute/Unmute (só aparece durante trailer) */}
                {showTrailer && trailerKey && (
                  <button
                    tabIndex={0}
                    data-nav-item
                    data-nav-col={2}
                    className="flex items-center justify-center w-10 h-10 rounded-full bg-white/10 border border-white/20 text-white
                      hover:bg-white/25 hover:scale-105 active:scale-95
                      transition-all duration-200 outline-none focus:ring-2 focus:ring-white focus:scale-105"
                    onClick={() => setIsMuted(!isMuted)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); setIsMuted(!isMuted); } }}
                  >
                    {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
                  </button>
                )}
              </motion.div>
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Indicadores visuais (barrinhas) */}
        <div className="absolute bottom-6 right-12 flex gap-2 z-30">
          {bannerItems.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentIndex(idx)}
              aria-label={`Slide ${idx + 1}`}
              className={`h-1 rounded-full transition-all duration-500 cursor-pointer ${idx === currentIndex ? 'w-6 bg-white' : 'w-1.5 bg-white/30'}`}
            />
          ))}
        </div>

        {/* Indicador de estado (Poster / Trailer) */}
        {showTrailer && trailerKey && (
          <div className="absolute top-6 right-12 z-30">
            <span className="bg-red-600/80 text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider animate-pulse">
              ▶ Trailer
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default HeroBanner;
