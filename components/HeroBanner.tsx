import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Media } from '../types';
import { Play, Info, Plus, Clock } from 'lucide-react';
import { playSelectSound } from '../utils/soundEffects';
import { getLogo, getMediaDetailsByID } from '../services/tmdb';

interface HeroBannerProps {
  mediaType?: 'movie' | 'tv' | 'all';
  onPlayMedia?: (media: Media) => void;
  onSelectMedia?: (media: Media) => void;
  dbMedia?: Media[];
  onBackdropChange?: (url: string) => void;
}

// Trailers customizados (YouTube video ID)
const TRAILER_OVERRIDES: Record<number, string> = {
  37680: 'k13aNEQKawA', // Suits (Homens de Terno)
};

// TMDB IDs das séries curadas para o banner principal
const BANNER_TMDB_IDS = [
  1396,   // Breaking Bad
  119051, // Wandinha
  37680,  // Suits (Homens de Terno)
  44217,  // Vikings
  2691,   // Dois Homens e Meio
  21510,  // Crimes do Colarinho Branco
  46952,  // A Lista Negra
  1405,   // Dexter
  4604,   // Smallville
];

/**
 * HeroBanner — Versão 100% Supabase
 * Exibe séries curadas no banner principal com backdrop + info do conteúdo real.
 */
// Tempo em ms
const BACKDROP_DURATION = 5000;  // 5s mostrando só a imagem
const TRAILER_DURATION = 15000;  // 15s de trailer antes de trocar

const HeroBanner: React.FC<HeroBannerProps> = ({ mediaType = 'all', onPlayMedia, onSelectMedia, dbMedia, onBackdropChange }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [trailerKey, setTrailerKey] = useState<string | null>(null);
  const [showTrailer, setShowTrailer] = useState(false);
  // Cache TMDB persistente em localStorage (sobrevive entre sessões)
  const logoCache = useRef<Map<string, string | null>>(() => {
    try {
      const saved = localStorage.getItem('redx-logo-cache');
      if (!saved) return new Map();
      const arr = JSON.parse(saved) as [string, string | null][];
      return Array.isArray(arr) ? new Map(arr) : new Map();
    } catch { return new Map(); }
  });
  const trailerCache = useRef<Map<string, string | null>>(() => {
    try {
      const saved = localStorage.getItem('redx-trailer-cache');
      if (!saved) return new Map();
      const arr = JSON.parse(saved) as [string, string | null][];
      return Array.isArray(arr) ? new Map(arr) : new Map();
    } catch { return new Map(); }
  });

  // Inicializar os refs (lazy init)
  if (typeof logoCache.current === 'function') logoCache.current = (logoCache.current as any)();
  if (typeof trailerCache.current === 'function') trailerCache.current = (trailerCache.current as any)();

  // Filtrar conteúdo — prioriza séries curadas do banner
  const bannerItems = useMemo(() => {
    if (!dbMedia || dbMedia.length === 0) return [];

    let filtered = dbMedia;

    // Filtrar por tipo se necessário
    if (mediaType === 'movie') {
      filtered = filtered.filter(m => m.type === 'movie');
    } else if (mediaType === 'tv') {
      filtered = filtered.filter(m => m.type === 'series');
    }

    // Apenas conteúdo com backdrop ou poster
    const withImages = filtered.filter(m => m.backdrop || m.poster);

    // Separar séries curadas (pela lista de TMDB IDs)
    const curated: Media[] = [];
    const rest: Media[] = [];

    for (const item of withImages) {
      if (item.tmdb_id && BANNER_TMDB_IDS.includes(Number(item.tmdb_id))) {
        curated.push(item);
      } else {
        rest.push(item);
      }
    }

    // Ordenar curadas na ordem definida na lista
    curated.sort((a, b) => {
      const ia = BANNER_TMDB_IDS.indexOf(Number(a.tmdb_id));
      const ib = BANNER_TMDB_IDS.indexOf(Number(b.tmdb_id));
      return ia - ib;
    });

    // Completar com outros (por rating) caso tenha menos de 9 curadas
    const sortByRating = (a: Media, b: Media) => {
      const ra = parseFloat(String(a.rating || '0'));
      const rb = parseFloat(String(b.rating || '0'));
      return rb - ra;
    };
    rest.sort(sortByRating);

    return [...curated, ...rest].slice(0, 12);
  }, [dbMedia, mediaType]);

  // ═══ FLUXO: 5s backdrop → trailer entra → 15s de trailer → próximo ═══
  useEffect(() => {
    if (bannerItems.length <= 1 && !bannerItems[0]?.trailer_key && !trailerKey) return;

    // Reset trailer ao trocar de item
    setShowTrailer(false);

    // Fase 1: Após 5s, mostrar trailer
    const trailerTimer = setTimeout(() => {
      setShowTrailer(true);
    }, BACKDROP_DURATION);

    // Fase 2: Após 5s + 15s = 20s total, avançar para próximo
    const nextTimer = setTimeout(() => {
      if (bannerItems.length > 1) {
        setCurrentIndex(prev => (prev + 1) % bannerItems.length);
      }
    }, BACKDROP_DURATION + TRAILER_DURATION);

    return () => {
      clearTimeout(trailerTimer);
      clearTimeout(nextTimer);
    };
  }, [currentIndex, bannerItems.length]);

  // Buscar logo + trailer do TMDB para o item atual
  useEffect(() => {
    const movie = bannerItems[currentIndex];
    if (!movie) { setLogoUrl(null); setTrailerKey(null); return; }

    const cacheKey = `${movie.tmdb_id}_${movie.type}`;

    // Logo — cache hit ou media.logo_url
    if (movie.logo_url) {
      setLogoUrl(movie.logo_url);
    } else if (logoCache.current.has(cacheKey)) {
      setLogoUrl(logoCache.current.get(cacheKey) || null);
    } else {
      setLogoUrl(null);
    }

    // Trailer — override > media.trailer_key > cache > TMDB
    const overrideKey = movie.tmdb_id ? TRAILER_OVERRIDES[Number(movie.tmdb_id)] : undefined;
    if (overrideKey) {
      setTrailerKey(overrideKey);
    } else if (movie.trailer_key) {
      setTrailerKey(movie.trailer_key);
    } else if (trailerCache.current.has(cacheKey)) {
      setTrailerKey(trailerCache.current.get(cacheKey) || null);
    } else {
      setTrailerKey(null);
    }

    const needsLogo = !movie.logo_url && !logoCache.current.has(cacheKey);
    const needsTrailer = !overrideKey && !movie.trailer_key && !trailerCache.current.has(cacheKey);

    if ((needsLogo || needsTrailer) && movie.tmdb_id && Number(movie.tmdb_id) > 0) {
      getMediaDetailsByID(Number(movie.tmdb_id), movie.type).then(details => {
        if (!details) return;
        if (needsLogo) {
          logoCache.current.set(cacheKey, details.logo || null);
          setLogoUrl(prev => prev || details.logo || null);
          try { localStorage.setItem('redx-logo-cache', JSON.stringify(Array.from(logoCache.current.entries()))); } catch {}
        }
        if (needsTrailer) {
          const key = overrideKey || details.trailer || null;
          trailerCache.current.set(cacheKey, key);
          setTrailerKey(prev => prev || key);
          try { localStorage.setItem('redx-trailer-cache', JSON.stringify(Array.from(trailerCache.current.entries()))); } catch {}
        }
      }).catch(() => {
        if (needsLogo) logoCache.current.set(cacheKey, null);
        if (needsTrailer) trailerCache.current.set(cacheKey, null);
      });
    }
  }, [currentIndex, bannerItems]);

  if (bannerItems.length === 0) {
    return (
      <div className="h-[85vh] bg-black animate-pulse flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-[#E50914] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const movie = bannerItems[currentIndex];
  const backdropUrl = movie.backdrop || movie.poster || '';

  // Notificar o parent sobre o backdrop atual para uso como fundo da página
  useEffect(() => {
    if (backdropUrl && onBackdropChange) onBackdropChange(backdropUrl);
  }, [backdropUrl, onBackdropChange]);

  const year = movie.year || (movie.release_date ? new Date(movie.release_date).getFullYear() : null) || (movie.first_air_date ? new Date(movie.first_air_date).getFullYear() : null);
  const rating = typeof movie.rating === 'number' ? movie.rating : parseFloat(String(movie.rating || '0'));

  // Release curto — máx 3 linhas
  const releaseLines: string[] = [];
  const dateStr = movie.release_date || movie.first_air_date;
  if (dateStr) {
    try {
      const d = new Date(dateStr);
      const y = d.getFullYear();
      const m = d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
      const day = d.getDate();
      if (day > 0 && m) releaseLines.push(`${day} ${m}`, String(y));
      else if (m) releaseLines.push(`${m} ${y}`);
      else releaseLines.push(String(y));
    } catch { if (year) releaseLines.push(String(year)); }
  } else if (year) releaseLines.push(String(year));
  const genres = (movie.genre || []).slice(0, 2).join(' · ');
  if (genres && releaseLines.length < 3) releaseLines.push(genres);

  // Converter rating TMDB (0-10) em estrelas (0-5)
  const starCount = Math.round((rating / 10) * 5);
  const stars = Array.from({ length: 5 }, (_, i) => i < starCount);

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
            {/* === FUNDO: BACKDROP (sempre visível como base) === */}
            <div className="absolute inset-0 w-full h-full">
              <img
                src={backdropUrl}
                alt={movie.title}
                className="w-full h-full object-cover"
                loading="eager"
              />
            </div>

            {/* === TRAILER YOUTUBE (aparece após 5s com fade) === */}
            {showTrailer && trailerKey && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 1.2 }}
                className="absolute inset-0 z-10 overflow-hidden"
              >
                <iframe
                  title={`Trailer ${movie.title}`}
                  className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[177.78vh] h-[56.25vw] min-w-full min-h-full pointer-events-none"
                  src={`https://www.youtube.com/embed/${trailerKey}?autoplay=1&mute=1&controls=0&showinfo=0&rel=0&loop=1&playlist=${trailerKey}&modestbranding=1&iv_load_policy=3&disablekb=1`}
                  frameBorder="0"
                  allow="autoplay; encrypted-media"
                />
                {/* Overlay escuro sobre trailer para manter legibilidade */}
                <div className="absolute inset-0 bg-black/30" />
              </motion.div>
            )}

            {/* Gradientes para leitura (acima de tudo) */}
            <div className="absolute inset-0 bg-linear-to-r from-black/80 via-black/40 to-transparent z-20" />
            <div className="absolute inset-0 bg-linear-to-t from-black via-transparent to-transparent z-20" />

            {/* ═══ CARD GLASS VISIONOS ═══ */}
            <motion.div
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
              className="absolute bottom-[14%] left-12 z-30 w-[380px] max-w-[90vw]"
            >
              <div
                className="rounded-3xl border border-white/[0.12] p-7 flex flex-col items-center text-center gap-4"
                style={{
                  background: 'linear-gradient(135deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.03) 100%)',
                  backdropFilter: 'blur(40px) saturate(1.6)',
                  WebkitBackdropFilter: 'blur(40px) saturate(1.6)',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.1)',
                }}
              >
                {/* Logo + Release curto (máx 3 linhas) */}
                <motion.div
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.2, duration: 0.7 }}
                  className="w-full flex flex-col items-center gap-1"
                >
                  {logoUrl ? (
                    <img
                      src={logoUrl}
                      alt={movie.title}
                      className="max-h-[44px] max-w-[200px] w-auto object-contain drop-shadow-[0_2px_12px_rgba(0,0,0,0.7)]"
                    />
                  ) : (
                    <h2 className="text-lg font-black text-white drop-shadow-2xl leading-tight tracking-wide uppercase">
                      {movie.title}
                    </h2>
                  )}
                  {releaseLines.length > 0 && (
                    <div className="flex flex-col items-center gap-0.5 text-center w-full" style={{ maxHeight: '3.6em' }}>
                      {releaseLines.slice(0, 3).map((line, i) => (
                        <span key={i} className="text-[11px] font-bold text-white/70 uppercase tracking-[0.2em] leading-tight truncate max-w-full">
                          {line}
                        </span>
                      ))}
                    </div>
                  )}
                </motion.div>

                {/* Botão Assistir + Ícones circulares (estilo referência) */}
                <motion.div
                  initial={{ y: 10, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.5, duration: 0.6 }}
                  className="flex items-center gap-3 w-full mt-1"
                  data-nav-row={1}
                >
                  {/* Assistir — botão principal branco com ícone preto */}
                  <button
                    tabIndex={0}
                    data-nav-item
                    data-nav-col={0}
                    className="flex-1 flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl
                      bg-white text-black font-bold text-sm
                      hover:bg-white/95 hover:scale-[1.02] active:scale-95
                      transition-all duration-200 outline-none
                      focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
                    onClick={() => {
                      playSelectSound();
                      if (onPlayMedia) onPlayMedia(movie);
                      else if (onSelectMedia) onSelectMedia(movie);
                    }}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); (e.target as HTMLElement).click(); } }}
                  >
                    <Play size={16} fill="black" /> Assistir
                  </button>

                  {/* + (Minha Lista) — circular escuro */}
                  <button
                    tabIndex={0}
                    data-nav-item
                    data-nav-col={1}
                    className="w-11 h-11 flex items-center justify-center rounded-full
                      bg-black/70 text-white border border-white/20
                      hover:bg-black/90 hover:scale-110 active:scale-95
                      transition-all duration-200 outline-none
                      focus-visible:ring-2 focus-visible:ring-white focus-visible:scale-110"
                    title="Minha Lista"
                    onClick={() => { playSelectSound(); }}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); (e.target as HTMLElement).click(); } }}
                  >
                    <Plus size={18} strokeWidth={2.5} />
                  </button>

                  {/* Relógio (Assistir Depois) — circular escuro */}
                  <button
                    tabIndex={0}
                    data-nav-item
                    data-nav-col={2}
                    className="w-11 h-11 flex items-center justify-center rounded-full
                      bg-black/70 text-white border border-white/20
                      hover:bg-black/90 hover:scale-110 active:scale-95
                      transition-all duration-200 outline-none
                      focus-visible:ring-2 focus-visible:ring-white focus-visible:scale-110"
                    title="Assistir Depois"
                    onClick={() => { playSelectSound(); }}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); (e.target as HTMLElement).click(); } }}
                  >
                    <Clock size={18} strokeWidth={2} />
                  </button>

                  {/* Info (Detalhes) — circular escuro */}
                  <button
                    tabIndex={0}
                    data-nav-item
                    data-nav-col={3}
                    className="w-11 h-11 flex items-center justify-center rounded-full
                      bg-black/70 text-white border border-white/20
                      hover:bg-black/90 hover:scale-110 active:scale-95
                      transition-all duration-200 outline-none
                      focus-visible:ring-2 focus-visible:ring-white focus-visible:scale-110"
                    title="Detalhes"
                    onClick={() => {
                      playSelectSound();
                      if (onSelectMedia) onSelectMedia(movie);
                    }}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); (e.target as HTMLElement).click(); } }}
                  >
                    <Info size={18} strokeWidth={2} />
                  </button>
                </motion.div>
              </div>
            </motion.div>
          </motion.div>
        </AnimatePresence>

        {/* Indicadores visuais (barrinhas com progresso) */}
        <div className="absolute bottom-6 right-12 flex gap-2 z-30">
          {bannerItems.map((_, idx) => (
            <button
              key={idx}
              onClick={() => {
                setShowTrailer(false);
                setCurrentIndex(idx);
              }}
              aria-label={`Slide ${idx + 1}`}
              className={`h-1 rounded-full transition-all duration-500 cursor-pointer ${idx === currentIndex ? 'w-8 bg-white' : 'w-1.5 bg-white/30'}`}
            >
              {/* Barra de progresso animada no item ativo */}
              {idx === currentIndex && (
                <div
                  className="h-full rounded-full bg-[#E50914]"
                  style={{
                    animation: `banner-progress ${(BACKDROP_DURATION + TRAILER_DURATION) / 1000}s linear forwards`,
                  }}
                />
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default HeroBanner;
