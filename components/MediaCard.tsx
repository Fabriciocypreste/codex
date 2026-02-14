import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Media } from '../types';
import { getMediaDetailsByID, getImageUrl } from '../services/tmdb';
import { tmdbSync } from '../services/tmdbSync';
import { userService } from '../services/userService';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Plus, Check, Clock, Info, Volume2, VolumeX } from 'lucide-react';
import { getMediaPoster } from '../utils/mediaUtils';
import ActionModal from './ActionModal';

interface MediaCardProps {
  media: Media;
  onClick: () => void;
  onPlay?: () => void;
  size?: 'sm' | 'md' | 'lg';
  colIndex?: number;
}

/**
 * MediaCard — Netflix/Apple TV Style
 * ════════════════════════════════════
 * Retraído: Poster vertical
 * Expandido (hover/focus): Backdrop + Trailer + Logo + 4 botões [▶ Assistir] [+] [🕐] [i]
 * TV Box: Enter abre ActionModal, D-Pad navega
 */
const MediaCard: React.FC<MediaCardProps> = React.memo(({ media, onClick, onPlay, size = 'md', colIndex = 0 }) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [trailerKey, setTrailerKey] = useState<string | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [backdropUrl, setBackdropUrl] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(true);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  // Library states (Supabase)
  const [inWatchlist, setInWatchlist] = useState(false);
  const [inWatchLater, setInWatchLater] = useState(false);
  const [isTogglingList, setIsTogglingList] = useState(false);
  const [isTogglingLater, setIsTogglingLater] = useState(false);
  const hoverTimeoutRef = useRef<number | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // Check library status on mount
  useEffect(() => {
    const tmdbId = media.tmdb_id || media.id;
    if (tmdbId) {
      userService.checkStatus(tmdbId).then(status => {
        setInWatchlist(status.inWatchlist);
        setInWatchLater(status.inWatchLater);
      }).catch(() => {});
    }
  }, [media.tmdb_id, media.id]);

  // Toggle Watchlist
  const handleToggleWatchlist = useCallback(async (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (isTogglingList) return;
    const tmdbId = media.tmdb_id || media.id;
    if (!tmdbId) return;
    setIsTogglingList(true);
    setInWatchlist(prev => !prev); // optimistic
    try {
      const result = await userService.toggleLibraryItem(tmdbId, media.type === 'series' ? 'tv' : 'movie', 'watchlist');
      if (result === 'auth_required') setInWatchlist(prev => !prev);
    } catch { setInWatchlist(prev => !prev); }
    finally { setIsTogglingList(false); }
  }, [media, isTogglingList]);

  // Toggle Watch Later
  const handleToggleWatchLater = useCallback(async (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (isTogglingLater) return;
    const tmdbId = media.tmdb_id || media.id;
    if (!tmdbId) return;
    setIsTogglingLater(true);
    setInWatchLater(prev => !prev); // optimistic
    try {
      const result = await userService.toggleLibraryItem(tmdbId, media.type === 'series' ? 'tv' : 'movie', 'watch_later');
      if (result === 'auth_required') setInWatchLater(prev => !prev);
    } catch { setInWatchLater(prev => !prev); }
    finally { setIsTogglingLater(false); }
  }, [media, isTogglingLater]);

  // Expand on hover (mouse), not on D-Pad focus
  const isActive = isHovered;
  const poster = getMediaPoster(media);

  // Card sizing — Slim padrão
  const cardWidth = 160;
  const cardHeight = 240;
  const expandedWidth = Math.round(cardHeight * 16 / 9);

  // ─── Preload: Trailer + Logo + Backdrop ───────────────────────
  const preloadContent = useCallback(async () => {
    if (hasLoaded) return;
    try {
      let tmdbId = media.tmdb_id && media.tmdb_id > 0 ? media.tmdb_id : null;

      // Se não tem tmdb_id, buscar pelo título no TMDB
      if (!tmdbId && media.title) {
        const searchType = media.type === 'series' ? 'tv' : 'movie';
        const searchRes = await fetch(
          `https://api.themoviedb.org/3/search/${searchType}?query=${encodeURIComponent(media.title)}&language=pt-BR`,
          { headers: { Authorization: `Bearer ${import.meta.env.VITE_TMDB_READ_TOKEN}` } }
        );
        const searchData = await searchRes.json();
        if (searchData.results && searchData.results.length > 0) {
          tmdbId = searchData.results[0].id;
        }
      }

      if (!tmdbId) { setHasLoaded(true); return; }

      // Auto-Cura: se o ID falhar, tmdbSync corrige no banco automaticamente
      const details = await tmdbSync.getOrFixDetails(
        { ...media, tmdb_id: tmdbId },
        media.type === 'series' ? 'tv' : 'movie'
      ) || await getMediaDetailsByID(tmdbId, media.type);
      setHasLoaded(true);
      if (!details) return;

      if (details.trailer) setTrailerKey(details.trailer);
      if (details.logo) setLogoUrl(details.logo);
      if (details.backdrop) setBackdropUrl(details.backdrop);
    } catch {
      setHasLoaded(true);
    }
  }, [media.tmdb_id, media.type, media.title, hasLoaded]);

  const handleMouseEnter = useCallback(() => {
    hoverTimeoutRef.current = window.setTimeout(() => {
      setIsHovered(true);
      preloadContent();
    }, 400);
  }, [preloadContent]);

  const handleMouseLeave = useCallback(() => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    setIsHovered(false);
  }, []);

  const handleFocus = useCallback(() => setIsFocused(true), []);
  const handleBlur = useCallback(() => setIsFocused(false), []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      setShowModal(true);
    }
  }, []);

  const handleModalClose = useCallback(() => {
    setShowModal(false);
    setTimeout(() => cardRef.current?.focus(), 50);
  }, []);

  // ─── Navegação ─────────────────────────────────────────────────
  const goToWatch = useCallback((e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (onPlay) { onPlay(); return; }
    navigate(`/watch/${media.type === 'series' ? 'tv' : 'movie'}/${media.tmdb_id || media.id}`);
  }, [navigate, media, onPlay]);

  const goToDetails = useCallback((e?: React.MouseEvent) => {
    e?.stopPropagation();
    onClick();
  }, [onClick]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    };
  }, []);

  return (
    <>
      <div
        ref={cardRef}
        className={`relative flex-shrink-0 outline-none ${isFocused ? 'z-50' : ''}`}
        style={{
          width: isActive ? `${expandedWidth}px` : `${cardWidth}px`,
          height: `${cardHeight}px`,
          transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
          transform: isFocused && !isActive ? 'scale(1.08)' : 'scale(1)',
          transformOrigin: 'top left',
        }}
        tabIndex={0}
        data-nav-item
        data-nav-col={colIndex}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
      >
        <motion.div
          layout
          className={`absolute top-0 left-0 h-full bg-[#0a0a0a] rounded-2xl overflow-hidden cursor-pointer
            ${isActive
                ? 'shadow-[0_12px_40px_rgba(0,0,0,0.9),0_4px_12px_rgba(0,0,0,0.5)] z-50'
                : isFocused
                  ? 'shadow-[0_8px_32px_rgba(255,255,255,0.15),0_2px_8px_rgba(255,255,255,0.08)] z-50'
                  : 'shadow-[0_4px_20px_rgba(0,0,0,0.4),0_1px_4px_rgba(0,0,0,0.2)]'
            }
            transition-all duration-300 ease-out`}
          style={{ width: isActive ? expandedWidth : cardWidth, height: cardHeight }}
          onClick={onClick}
        >
          {/* ═══ POSTER visionOS (Estado Retraído) ═══ */}
          <div className={`absolute inset-0 transition-opacity duration-300 ${isActive ? 'opacity-0' : 'opacity-100'}`}>
            {/* Glass frame container */}
            <div className="absolute inset-0 rounded-2xl overflow-hidden">
              <img
                src={poster}
                alt={media.title}
                className="w-full h-full object-cover"
                loading="lazy"
                onLoad={() => setImageLoaded(true)}
              />
              {!imageLoaded && <div className="absolute inset-0 bg-white/5 animate-pulse" />}
              {/* Gradiente sutil na base */}
              <div className="absolute inset-x-0 bottom-0 h-2/5 bg-linear-to-t from-black/80 via-black/30 to-transparent" />
            </div>
            {/* visionOS glass border — moldura 3D premium */}
            <div className="absolute inset-0 rounded-2xl ring-1 ring-inset ring-white/[0.12] pointer-events-none" />
            <div className="absolute inset-0 rounded-2xl border border-white/[0.06] pointer-events-none shadow-[0_8px_32px_rgba(0,0,0,0.5),0_2px_8px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.08)]" />
          </div>

          {/* Focus ring (TV) */}
          {isFocused && !isActive && (
            <div className="absolute inset-0 rounded-2xl border-2 border-white/50 pointer-events-none z-30 shadow-[0_0_20px_rgba(255,255,255,0.15)]" />
          )}

          {/* ═══ EXPANDIDO (Hover) ═══ */}
          <AnimatePresence>
            {isActive && (
              <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="absolute inset-0 flex flex-col justify-end rounded-2xl"
              >
                {/* ── FUNDO: Trailer / Backdrop (100%) ── */}
                <div className="absolute inset-0 w-full h-full bg-[#121212]/95 overflow-hidden">
                  {/* Imagem de fundo sempre presente */}
                  <img
                    src={backdropUrl || media.backdrop || poster}
                    alt={media.title}
                    className="absolute inset-0 w-full h-full object-cover opacity-80"
                  />

                  {/* Trailer desativado — somente sob ação do usuário */}

                  {/* Gradiente inferior para legibilidade */}
                  <div className="absolute inset-0 bg-linear-to-t from-black/90 via-black/40 to-transparent z-20" />

                  {/* Botão Mute */}
                  {trailerKey && (
                    <button
                      onClick={(e) => { e.stopPropagation(); setIsMuted(!isMuted); }}
                      className="absolute top-2 right-2 z-30 p-1.5 bg-black/50 border border-white/20 rounded-full text-white hover:bg-white/20 transition-colors"
                    >
                      {isMuted ? <VolumeX size={12} /> : <Volume2 size={12} />}
                    </button>
                  )}
                </div>

                {/* ── CONTEÚDO SOBREPOSTO ao vídeo ── */}
                <div className="relative z-30 p-3 flex flex-col justify-end gap-2">
                  <div className="flex items-center gap-2.5 mt-1">
                    {/* Assistir */}
                    <button
                      onClick={goToWatch}
                      className="flex-1 py-2 px-3 rounded-2xl font-bold flex items-center justify-center gap-2 text-[12px]
                        bg-white/95 text-black
                        shadow-[0_2px_8px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.8)]
                        hover:bg-white hover:shadow-[0_4px_16px_rgba(255,255,255,0.25),inset_0_1px_0_rgba(255,255,255,1)]
                        hover:scale-105
                        active:scale-95 active:shadow-[0_1px_4px_rgba(0,0,0,0.2)]
                        transition-all duration-200 ease-out"
                    >
                      <Play size={13} fill="black" /> Assistir
                    </button>

                    {/* Minha Lista (toggle) */}
                    <button
                      onClick={handleToggleWatchlist}
                      className={`w-9 h-9 rounded-full flex items-center justify-center
                        bg-[#121212]/95 border
                        shadow-[0_2px_8px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.1)]
                        hover:scale-110 active:scale-90
                        transition-all duration-200 ease-out
                        ${inWatchlist
                          ? 'bg-green-500/30 border-green-400/50 text-green-400 hover:bg-green-500/40'
                          : 'bg-white/10 border-white/20 text-white/90 hover:bg-white/25 hover:border-white/40'
                        }`}
                      title={inWatchlist ? 'Remover da Lista' : 'Minha Lista'}
                    >
                      {inWatchlist ? <Check size={15} strokeWidth={2.5} /> : <Plus size={15} strokeWidth={2.5} />}
                    </button>

                    {/* Ver Depois (toggle) */}
                    <button
                      onClick={handleToggleWatchLater}
                      className={`w-9 h-9 rounded-full flex items-center justify-center
                        bg-[#121212]/95 border
                        shadow-[0_2px_8px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.1)]
                        hover:scale-110 active:scale-90
                        transition-all duration-200 ease-out
                        ${inWatchLater
                          ? 'bg-blue-500/30 border-blue-400/50 text-blue-400 hover:bg-blue-500/40'
                          : 'bg-white/10 border-white/20 text-white/90 hover:bg-white/25 hover:border-white/40'
                        }`}
                      title={inWatchLater ? 'Remover' : 'Ver Depois'}
                    >
                      <Clock size={14} strokeWidth={2.5} />
                    </button>

                    {/* Detalhes */}
                    <button
                      onClick={goToDetails}
                      className="w-9 h-9 rounded-full flex items-center justify-center
                        bg-[#121212]/95 border border-white/20
                        shadow-[0_2px_8px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.1)]
                        hover:bg-white/25 hover:border-white/40 hover:shadow-[0_4px_12px_rgba(255,255,255,0.1),inset_0_1px_0_rgba(255,255,255,0.2)]
                        hover:scale-110
                        active:scale-90 active:bg-white/30
                        text-white/90 hover:text-white
                        transition-all duration-200 ease-out"
                      title="Detalhes"
                    >
                      <Info size={15} strokeWidth={2.5} />
                    </button>
                  </div>
                  <div className="flex items-end justify-start">
                    {logoUrl ? (
                      <img
                        src={logoUrl}
                        alt={media.title}
                        className="max-h-6 max-w-[40%] object-contain drop-shadow-lg"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                    ) : (
                      <span className="text-[10px] text-white/80 font-bold uppercase tracking-wide line-clamp-1 drop-shadow-md">
                        {media.title}
                      </span>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>

      {/* TV Action Modal (Enter no Controle) */}
      <ActionModal
        media={media}
        isOpen={showModal}
        onClose={handleModalClose}
        onSelect={onClick}
        onPlay={onPlay}
      />
    </>
  );
});

MediaCard.displayName = 'MediaCard';
export default MediaCard;
