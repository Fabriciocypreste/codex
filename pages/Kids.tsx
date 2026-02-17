
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Media } from '../types';
import { Play, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import MediaRow from '../components/MediaRow';
import { playSelectSound } from '../utils/soundEffects';
import { getAllMovies, getAllSeries } from '../services/supabaseService';
import { getLogo, getMediaDetailsByID } from '../services/tmdb';

interface KidsProps {
  movies: Media[];
  series?: Media[];
  onSelectMedia: (media: Media) => void;
  onPlayMedia?: (media: Media) => void;
}

// ─── Floating decorative elements ────────────────────────────────
const FloatingElement: React.FC<{ emoji: string; style: React.CSSProperties; delay: number }> = ({ emoji, style, delay }) => (
  <motion.div
    className="absolute text-2xl md:text-3xl pointer-events-none select-none z-0"
    style={style}
    animate={{
      y: [0, -15, 0, 12, 0],
      rotate: [0, 10, -8, 5, 0],
      scale: [1, 1.1, 0.95, 1.05, 1],
    }}
    transition={{ duration: 6 + delay, repeat: Infinity, ease: 'easeInOut', delay }}
  >
    {emoji}
  </motion.div>
);

const floatingItems = [
  { emoji: '⭐', style: { top: '5%', left: '3%' }, delay: 0 },
  { emoji: '🫧', style: { top: '12%', right: '8%' }, delay: 1.5 },
  { emoji: '⭐', style: { top: '25%', right: '3%' }, delay: 0.8 },
  { emoji: '🫧', style: { top: '40%', left: '5%' }, delay: 2.2 },
  { emoji: '⭐', style: { top: '55%', right: '6%' }, delay: 1.2 },
  { emoji: '🫧', style: { top: '65%', left: '8%' }, delay: 3.0 },
  { emoji: '⭐', style: { top: '78%', right: '4%' }, delay: 0.5 },
  { emoji: '🫧', style: { top: '85%', left: '2%' }, delay: 2.0 },
  { emoji: '✨', style: { top: '15%', left: '45%' }, delay: 1.0 },
  { emoji: '✨', style: { top: '70%', right: '15%' }, delay: 2.5 },
];

// ─── Main Kids Page ──────────────────────────────────────────────
const Kids: React.FC<KidsProps> = ({ movies, series = [], onSelectMedia, onPlayMedia }) => {
  const [heroIndex, setHeroIndex] = useState(0);

  // Combinar filmes e séries
  const [localMovies, setLocalMovies] = useState<Media[] | null>(null);
  const [localSeries, setLocalSeries] = useState<Media[] | null>(null);

  useEffect(() => {
    if ((movies?.length || 0) === 0 && localMovies === null) {
      (async () => {
        try {
          const db = await getAllMovies();
          setLocalMovies(db.map(m => ({ ...m, type: 'movie' } as Media)));
        } catch (e) {
          console.error('Kids fallback getAllMovies failed', e);
          setLocalMovies([]);
        }
      })();
    }
    if ((series?.length || 0) === 0 && localSeries === null) {
      (async () => {
        try {
          const db = await getAllSeries();
          setLocalSeries(db.map(s => ({ ...s, type: 'series' } as Media)));
        } catch (e) {
          console.error('Kids fallback getAllSeries failed', e);
          setLocalSeries([]);
        }
      })();
    }
  }, [movies, series, localMovies, localSeries]);

  const allContent = useMemo(() => [...(movies && movies.length > 0 ? movies : (localMovies || [])), ...(series && series.length > 0 ? series : (localSeries || []))], [movies, series, localMovies, localSeries]);

  // Filtrar conteúdo kids-friendly (animação, família, comédia, aventura, fantasia, infantil)
  const kidsGenres = useMemo(() => ['Animação', 'Animation', 'Família', 'Family', 'Comédia', 'Comedy', 'Kids', 'Aventura', 'Adventure', 'Fantasia', 'Fantasy', 'Infantil'], []);
  
  const kidsContent = useMemo(() => {
    const filtered = allContent.filter(m => {
      if (!m.genre || !Array.isArray(m.genre)) return false;
      return m.genre.some(g => kidsGenres.some(kg => g.toLowerCase().includes(kg.toLowerCase())));
    });
    return filtered.length > 0 ? filtered : allContent.slice(0, 50);
  }, [allContent, kidsGenres]);

  const kidsMovies = useMemo(() => kidsContent.filter(m => m.type === 'movie'), [kidsContent]);
  const kidsSeries = useMemo(() => kidsContent.filter(m => m.type === 'series'), [kidsContent]);
  const animations = useMemo(() => kidsContent.filter(m => m.genre?.some(g => g.toLowerCase().includes('anim'))), [kidsContent]);
  const adventure = useMemo(() => kidsContent.filter(m => m.genre?.some(g => g.toLowerCase().includes('avent') || g.toLowerCase().includes('adventure'))), [kidsContent]);
  const family = useMemo(() => kidsContent.filter(m => m.genre?.some(g => g.toLowerCase().includes('famíl') || g.toLowerCase().includes('family'))), [kidsContent]);

  // Hero items — apenas animações com backdrop (mesmo conteúdo de "Animações Incríveis")
  const heroItems = useMemo(() => {
    const items = animations.filter(m => m.backdrop && m.poster);
    return items.slice(0, 8);
  }, [animations]);

  // ═══ Logo + Trailer do TMDB ═══
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [trailerKey, setTrailerKey] = useState<string | null>(null);
  const [showTrailer, setShowTrailer] = useState(false);
  const logoCache = useRef<Map<string, string | null>>(new Map());
  const trailerCache = useRef<Map<string, string | null>>(new Map());

  const BACKDROP_DURATION = 5000;
  const TRAILER_DURATION = 15000;

  // Fluxo: 5s backdrop → trailer fade-in → 15s → próximo
  useEffect(() => {
    if (heroItems.length === 0) return;
    setShowTrailer(false);

    const trailerTimer = setTimeout(() => setShowTrailer(true), BACKDROP_DURATION);
    const nextTimer = setTimeout(() => {
      if (heroItems.length > 1) {
        setHeroIndex(prev => (prev + 1) % heroItems.length);
      }
    }, BACKDROP_DURATION + TRAILER_DURATION);

    return () => { clearTimeout(trailerTimer); clearTimeout(nextTimer); };
  }, [heroIndex, heroItems.length]);

  // Buscar logo + trailer do TMDB
  useEffect(() => {
    const movie = heroItems[heroIndex];
    if (!movie) { setLogoUrl(null); setTrailerKey(null); return; }

    const cacheKey = `${movie.tmdb_id}_${movie.type}`;

    // Logo
    if (movie.logo_url) { setLogoUrl(movie.logo_url); }
    else if (logoCache.current.has(cacheKey)) { setLogoUrl(logoCache.current.get(cacheKey) || null); }
    else { setLogoUrl(null); }

    // Trailer
    if (movie.trailer_key) { setTrailerKey(movie.trailer_key); }
    else if (trailerCache.current.has(cacheKey)) { setTrailerKey(trailerCache.current.get(cacheKey) || null); }
    else { setTrailerKey(null); }

    const needsLogo = !movie.logo_url && !logoCache.current.has(cacheKey);
    const needsTrailer = !movie.trailer_key && !trailerCache.current.has(cacheKey);

    if ((needsLogo || needsTrailer) && movie.tmdb_id && Number(movie.tmdb_id) > 0) {
      getMediaDetailsByID(Number(movie.tmdb_id), movie.type).then(details => {
        if (!details) return;
        if (needsLogo) { logoCache.current.set(cacheKey, details.logo || null); setLogoUrl(prev => prev || details.logo || null); }
        if (needsTrailer) { trailerCache.current.set(cacheKey, details.trailer || null); setTrailerKey(prev => prev || details.trailer || null); }
      }).catch(() => {
        if (needsLogo) logoCache.current.set(cacheKey, null);
        if (needsTrailer) trailerCache.current.set(cacheKey, null);
      });
    }
  }, [heroIndex, heroItems]);

  const heroMovie = heroItems[heroIndex];
  const heroBackdropUrl = heroMovie?.backdrop || heroMovie?.poster || '';

  // Estrelas do rating
  const heroRating = heroMovie ? (typeof heroMovie.rating === 'number' ? heroMovie.rating : parseFloat(String(heroMovie.rating || '0'))) : 0;
  const heroStars = Array.from({ length: 5 }, (_, i) => i < Math.round((heroRating / 10) * 5));

  const handleSelect = useCallback((m: Media) => onSelectMedia(m), [onSelectMedia]);

  return (
    <div className="relative w-full min-h-screen overflow-hidden">
      {/* ═══ FUNDO: backdrop do banner com 60% blur ═══ */}
      {heroBackdropUrl ? (
        <div className="fixed inset-0 z-0 transition-opacity duration-700">
          <img
            src={heroBackdropUrl}
            alt=""
            className="w-full h-full object-cover"
            style={{
              filter: 'blur(60px) brightness(0.4)',
              transform: 'scale(1.15)',
            }}
          />
          <div className="absolute inset-0 bg-black/50" />
        </div>
      ) : (
        <>
          <div className="fixed inset-0 z-0"
            style={{
              background: 'linear-gradient(135deg, #e879a8 0%, #a78bfa 20%, #7dd3fc 40%, #86efac 60%, #fcd34d 80%, #f9a8d4 100%)',
            }}
          />
          <div className="fixed inset-0 z-0 bg-black/10" />
        </>
      )}

      {/* ═══ ELEMENTOS FLUTUANTES ═══ */}
      {floatingItems.map((item, i) => (
        <FloatingElement key={i} {...item} />
      ))}

      {/* ═══ CONTEÚDO ═══ */}
      <div className="relative z-10 w-full pb-24">

        {/* ─── HERO BANNER KIDS — Glass Card visionOS + Trailer ─── */}
        {heroMovie && (
          <div className="relative w-full h-[85vh] overflow-hidden">
            <AnimatePresence mode="wait">
              <motion.div
                key={`kids-banner-${heroMovie.id}-${heroIndex}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.8 }}
                className="absolute inset-0"
              >
                {/* Backdrop */}
                <div className="absolute inset-0 w-full h-full">
                  <img
                    src={heroMovie.backdrop || heroMovie.poster}
                    alt={heroMovie.title}
                    className="w-full h-full object-cover"
                    loading="eager"
                  />
                </div>

                {/* Trailer YouTube (aparece após 5s) */}
                {showTrailer && trailerKey && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 1.2 }}
                    className="absolute inset-0 z-10 overflow-hidden"
                  >
                    <iframe
                      title={`Trailer ${heroMovie.title}`}
                      className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[177.78vh] h-[56.25vw] min-w-full min-h-full pointer-events-none"
                      src={`https://www.youtube.com/embed/${trailerKey}?autoplay=1&mute=1&controls=0&showinfo=0&rel=0&loop=1&playlist=${trailerKey}&modestbranding=1&iv_load_policy=3&disablekb=1`}
                      frameBorder="0"
                      allow="autoplay; encrypted-media"
                    />
                    <div className="absolute inset-0 bg-black/30" />
                  </motion.div>
                )}

                {/* Gradientes */}
                <div className="absolute inset-0 bg-linear-to-r from-black/80 via-black/40 to-transparent z-20" />
                <div className="absolute inset-0 bg-linear-to-t from-black via-transparent to-transparent z-20" />

                {/* ═══ CARD GLASS VISIONOS ═══ */}
                <motion.div
                  initial={{ y: 40, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
                  className="absolute bottom-[14%] left-8 md:left-12 z-30 w-[380px] max-w-[90vw]"
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
                    {/* Logo ou Título */}
                    <motion.div
                      initial={{ scale: 0.9, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ delay: 0.2, duration: 0.7 }}
                      className="w-full flex justify-center min-h-[60px]"
                    >
                      {logoUrl ? (
                        <img
                          src={logoUrl}
                          alt={heroMovie.title}
                          className="max-h-[80px] max-w-[300px] w-auto object-contain drop-shadow-[0_4px_20px_rgba(0,0,0,0.6)]"
                        />
                      ) : (
                        <h2 className="text-2xl md:text-3xl font-black text-white drop-shadow-2xl leading-tight">
                          {heroMovie.title}
                        </h2>
                      )}
                    </motion.div>

                    {/* Estrelas + Tipo */}
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.35, duration: 0.6 }}
                      className="flex items-center gap-2"
                    >
                      <div className="flex gap-0.5">
                        {heroStars.map((filled, i) => (
                          <span key={i} className={`text-sm ${filled ? 'text-white' : 'text-white/25'}`}>★</span>
                        ))}
                      </div>
                      <span className="text-[11px] font-semibold uppercase tracking-[0.15em] text-white/50">
                        {heroMovie.type === 'series' ? 'Série' : 'Filme'}
                      </span>
                    </motion.div>

                    {/* Descrição */}
                    {heroMovie.description && (
                      <motion.p
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.45, duration: 0.7 }}
                        className="text-white/70 text-[13px] leading-relaxed line-clamp-3 max-w-[320px]"
                      >
                        {heroMovie.description}
                      </motion.p>
                    )}

                    {/* Botões Glass */}
                    <motion.div
                      initial={{ y: 10, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ delay: 0.6, duration: 0.6 }}
                      className="flex items-center gap-3 w-full mt-1"
                      data-nav-row={0}
                    >
                      <button
                        tabIndex={0}
                        data-nav-item
                        data-nav-col={0}
                        className="flex-1 flex items-center justify-center gap-2 px-5 py-2.5 rounded-2xl
                          bg-white/90 text-black font-bold text-sm
                          shadow-[0_4px_16px_rgba(0,0,0,0.25)]
                          hover:bg-white hover:scale-[1.03] active:scale-95
                          transition-all duration-200 outline-none
                          focus-visible:ring-2 focus-visible:ring-white focus-visible:scale-[1.03]"
                        onClick={() => {
                          playSelectSound();
                          onPlayMedia ? onPlayMedia(heroMovie) : onSelectMedia(heroMovie);
                        }}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); playSelectSound(); onPlayMedia ? onPlayMedia(heroMovie) : onSelectMedia(heroMovie); } }}
                      >
                        <Play size={15} fill="black" /> Assistir
                      </button>

                      <button
                        tabIndex={0}
                        data-nav-item
                        data-nav-col={1}
                        className="flex-1 flex items-center justify-center gap-2 px-5 py-2.5 rounded-2xl
                          border border-white/20 text-white font-bold text-sm
                          hover:bg-white/15 hover:scale-[1.03] active:scale-95
                          transition-all duration-200 outline-none
                          focus-visible:ring-2 focus-visible:ring-white focus-visible:scale-[1.03]"
                        style={{
                          background: 'rgba(255,255,255,0.08)',
                          backdropFilter: 'blur(20px)',
                          WebkitBackdropFilter: 'blur(20px)',
                        }}
                        onClick={() => { playSelectSound(); onSelectMedia(heroMovie); }}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); playSelectSound(); onSelectMedia(heroMovie); } }}
                      >
                        <Info size={15} /> Detalhes
                      </button>
                    </motion.div>
                  </div>
                </motion.div>
              </motion.div>
            </AnimatePresence>

            {/* Indicadores com progresso */}
            {heroItems.length > 1 && (
              <div className="absolute bottom-6 right-12 flex gap-2 z-30">
                {heroItems.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => { setShowTrailer(false); setHeroIndex(idx); }}
                    aria-label={`Slide ${idx + 1}`}
                    className={`h-1 rounded-full transition-all duration-500 cursor-pointer ${idx === heroIndex ? 'w-8 bg-white' : 'w-1.5 bg-white/30'}`}
                  >
                    {idx === heroIndex && (
                      <div
                        className="h-full rounded-full bg-[#E50914]"
                        style={{ animation: `banner-progress ${(BACKDROP_DURATION + TRAILER_DURATION) / 1000}s linear forwards` }}
                      />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ─── CONTENT ROWS (mesmo componente MediaRow do site) ─── */}
        <div className="space-y-4">
          {kidsContent.length > 0 && (
            <MediaRow
              title="🌟 Populares no Kids"
              items={kidsContent.slice(0, 20)}
              onSelect={handleSelect}
              onPlay={onPlayMedia}
              rowIndex={1}
            />
          )}

          {animations.length > 0 && (
            <MediaRow
              title="🎨 Animações Incríveis"
              items={animations.slice(0, 20)}
              onSelect={handleSelect}
              onPlay={onPlayMedia}
              rowIndex={2}
            />
          )}

          {adventure.length > 0 && (
            <MediaRow
              title="🗺️ Aventuras Mágicas"
              items={adventure.slice(0, 20)}
              onSelect={handleSelect}
              onPlay={onPlayMedia}
              rowIndex={3}
            />
          )}

          {family.length > 0 && (
            <MediaRow
              title="👨‍👩‍👧‍👦 Para Toda Família"
              items={family.slice(0, 20)}
              onSelect={handleSelect}
              onPlay={onPlayMedia}
              rowIndex={4}
            />
          )}

          {kidsSeries.length > 0 && (
            <MediaRow
              title="📺 Séries para Crianças"
              items={kidsSeries.slice(0, 20)}
              onSelect={handleSelect}
              onPlay={onPlayMedia}
              rowIndex={5}
            />
          )}

          {kidsMovies.length > 0 && (
            <MediaRow
              title="🎬 Filmes Infantis"
              items={kidsMovies.slice(0, 20)}
              onSelect={handleSelect}
              onPlay={onPlayMedia}
              rowIndex={6}
            />
          )}

          {kidsContent.length > 36 && (
            <MediaRow
              title="🌈 Mais para Explorar"
              items={kidsContent.slice(36, 56)}
              onSelect={handleSelect}
              onPlay={onPlayMedia}
              rowIndex={7}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default React.memo(Kids);
