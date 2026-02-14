
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Media } from '../types';
import { Play, ChevronLeft, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { fetchDetails } from '../services/tmdb';
import MediaRow from '../components/MediaRow';
import { playSelectSound } from '../utils/soundEffects';

interface KidsProps {
  movies: Media[];
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
const Kids: React.FC<KidsProps> = ({ movies, onSelectMedia, onPlayMedia }) => {
  const [heroIndex, setHeroIndex] = useState(0);
  const [heroLogo, setHeroLogo] = useState<string | null>(null);
  const [showTrailer, setShowTrailer] = useState(false);
  const [trailerKey, setTrailerKey] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(true);
  const timeoutRef = useRef<number | null>(null);

  // Filtrar conteúdo kids-friendly (animação, família, comédia, aventura, fantasia)
  const kidsGenres = useMemo(() => ['Animação', 'Animation', 'Família', 'Family', 'Comédia', 'Comedy', 'Kids', 'Aventura', 'Adventure', 'Fantasia', 'Fantasy'], []);
  
  const kidsContent = useMemo(() => {
    const filtered = movies.filter(m => {
      if (!m.genre || !Array.isArray(m.genre)) return false;
      return m.genre.some(g => kidsGenres.some(kg => g.toLowerCase().includes(kg.toLowerCase())));
    });
    return filtered.length > 0 ? filtered : movies.slice(0, 50);
  }, [movies, kidsGenres]);

  const kidsMovies = useMemo(() => kidsContent.filter(m => m.type === 'movie'), [kidsContent]);
  const kidsSeries = useMemo(() => kidsContent.filter(m => m.type === 'series'), [kidsContent]);
  const animations = useMemo(() => kidsContent.filter(m => m.genre?.some(g => g.toLowerCase().includes('anim'))), [kidsContent]);
  const adventure = useMemo(() => kidsContent.filter(m => m.genre?.some(g => g.toLowerCase().includes('avent') || g.toLowerCase().includes('adventure'))), [kidsContent]);
  const family = useMemo(() => kidsContent.filter(m => m.genre?.some(g => g.toLowerCase().includes('famíl') || g.toLowerCase().includes('family'))), [kidsContent]);

  // Hero items — kids content with backdrop
  const heroItems = useMemo(() => {
    const items = kidsContent.filter(m => m.backdrop && m.poster);
    return items.slice(0, 8);
  }, [kidsContent]);

  // Banner cycle: image 5s → trailer 25s → next (same as HeroBanner)
  useEffect(() => {
    if (heroItems.length === 0) return;
    const current = heroItems[heroIndex];

    setShowTrailer(false);
    setTrailerKey(null);
    setHeroLogo(null);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    const runCycle = async () => {
      try {
        if (current.tmdb_id && current.tmdb_id > 0) {
          const details = await fetchDetails(current.tmdb_id, current.type === 'series' ? 'tv' : 'movie');
          setHeroLogo(details?.logo || null);
          const trailer = details?.videos?.results?.find((v: any) => v.type === 'Trailer');

          if (trailer) {
            setTrailerKey(trailer.key);
            timeoutRef.current = window.setTimeout(() => {
              setShowTrailer(true);
              timeoutRef.current = window.setTimeout(() => {
                setHeroIndex(prev => (prev + 1) % heroItems.length);
              }, 25000);
            }, 5000);
          } else {
            timeoutRef.current = window.setTimeout(() => {
              setHeroIndex(prev => (prev + 1) % heroItems.length);
            }, 8000);
          }
        } else {
          timeoutRef.current = window.setTimeout(() => {
            setHeroIndex(prev => (prev + 1) % heroItems.length);
          }, 8000);
        }
      } catch {
        setHeroIndex(prev => (prev + 1) % heroItems.length);
      }
    };

    runCycle();
    return () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); };
  }, [heroIndex, heroItems]);

  const heroMovie = heroItems[heroIndex];

  const handleSelect = useCallback((m: Media) => onSelectMedia(m), [onSelectMedia]);

  return (
    <div className="relative w-full min-h-screen overflow-hidden">
      {/* ═══ FUNDO GRADIENTE COLORIDO ═══ */}
      <div className="fixed inset-0 z-0"
        style={{
          background: 'linear-gradient(135deg, #e879a8 0%, #a78bfa 20%, #7dd3fc 40%, #86efac 60%, #fcd34d 80%, #f9a8d4 100%)',
        }}
      />
      <div className="fixed inset-0 z-0 bg-black/10" />

      {/* ═══ ELEMENTOS FLUTUANTES ═══ */}
      {floatingItems.map((item, i) => (
        <FloatingElement key={i} {...item} />
      ))}

      {/* ═══ CONTEÚDO ═══ */}
      <div className="relative z-10 w-full pb-24">

        {/* ─── HERO BANNER (mesmo padrão do site) ─── */}
        {heroMovie && (
          <div className="px-4 md:px-8 pt-20 mb-6">
            <div className="relative w-full h-[75vh] md:h-[80vh] rounded-[2.5rem] overflow-hidden border border-white/15 shadow-[0_8px_60px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.08)] group">
              <AnimatePresence mode="wait">
                <motion.div
                  key={heroMovie.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.8 }}
                  className="absolute inset-0"
                >
                  {/* Background: trailer or image */}
                  <div className="absolute inset-0 w-full h-full">
                    {showTrailer && trailerKey ? (
                      <div className="w-full h-full relative">
                        <iframe
                          className="absolute inset-0 w-full h-full scale-[1.35] pointer-events-none"
                          src={`https://www.youtube.com/embed/${trailerKey}?autoplay=1&mute=${isMuted ? 1 : 0}&controls=0&loop=0&modestbranding=1&rel=0&showinfo=0&start=5`}
                          title="Trailer"
                          frameBorder="0"
                          allow="autoplay; encrypted-media"
                        />
                        <div className="absolute inset-0 bg-black/10" />
                      </div>
                    ) : (
                      <img
                        src={heroMovie.backdrop || heroMovie.poster}
                        alt={heroMovie.title}
                        className="w-full h-full object-cover"
                      />
                    )}

                    {/* Gradients */}
                    <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/35 to-transparent" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                    {/* visionOS inner ring */}
                    <div className="absolute inset-0 rounded-[2.5rem] ring-1 ring-inset ring-white/[0.08] pointer-events-none" />
                  </div>

                  {/* Hero content */}
                  <div className="absolute bottom-[12%] left-8 md:left-14 max-w-xl space-y-3 z-10">
                    {heroLogo ? (
                      <motion.img
                        initial={{ y: 14, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        src={heroLogo}
                        alt={heroMovie.title}
                        className="max-w-[130px] md:max-w-[182px] max-h-[46px] md:max-h-[65px] object-contain drop-shadow-[0_4px_16px_rgba(0,0,0,0.7)]"
                      />
                    ) : (
                      <motion.h2
                        initial={{ y: 14, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        className="text-2xl md:text-4xl font-black tracking-tighter drop-shadow-2xl"
                      >
                        {heroMovie.title}
                      </motion.h2>
                    )}

                    {/* Release info */}
                    <motion.div
                      initial={{ y: 10, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ delay: 0.12 }}
                      className="flex items-center gap-3"
                    >
                      {heroMovie.year ? (
                        <span className="text-[11px] font-bold text-white/60 tracking-widest uppercase bg-white/5 px-2.5 py-1 rounded-lg border border-white/10">
                          {heroMovie.year}
                        </span>
                      ) : null}
                      {heroMovie.rating ? (
                        <span className="text-[11px] font-bold text-yellow-400/80 tracking-wider">★ {heroMovie.rating}</span>
                      ) : null}
                    </motion.div>

                    <motion.p
                      initial={{ y: 10, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ delay: 0.2 }}
                      className="text-xs md:text-sm text-gray-300 line-clamp-2 font-medium drop-shadow-md leading-relaxed"
                    >
                      {heroMovie.description}
                    </motion.p>

                    <motion.div
                      initial={{ y: 10, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ delay: 0.25 }}
                      className="flex items-center gap-3 pt-1"
                      data-nav-row={0}
                    >
                      <button
                        data-nav-item
                        data-nav-col={0}
                        tabIndex={0}
                        onClick={() => onPlayMedia ? onPlayMedia(heroMovie) : onSelectMedia(heroMovie)}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); playSelectSound(); onPlayMedia ? onPlayMedia(heroMovie) : onSelectMedia(heroMovie); } }}
                        className="px-6 py-3 bg-white/10 backdrop-blur-2xl text-white rounded-2xl font-bold flex items-center gap-2.5 hover:bg-white/20 hover:scale-105 active:scale-95 transition-all text-sm border border-white/20 shadow-[inset_0_1px_0_rgba(255,255,255,0.15),inset_0_-1px_0_rgba(0,0,0,0.1),0_4px_24px_rgba(0,0,0,0.4)] outline-none focus:ring-2 focus:ring-[#E50914] focus:scale-105"
                      >
                        <Play size={16} fill="white" /> Assistir
                      </button>
                    </motion.div>
                  </div>
                </motion.div>
              </AnimatePresence>

              {/* Indicator dots */}
              {heroItems.length > 1 && (
                <div className="absolute bottom-5 right-5 flex gap-2 z-20">
                  {heroItems.map((_, idx) => (
                    <button
                      key={idx}
                      onClick={() => setHeroIndex(idx)}
                      className={`h-1.5 rounded-full transition-all duration-500 ${
                        idx === heroIndex ? 'w-8 bg-white' : 'w-2 bg-white/35 hover:bg-white/70'
                      }`}
                    />
                  ))}
                </div>
              )}
            </div>
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
