import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Media } from '../types';
import { getMediaDetailsByID, getImageUrl } from '../services/tmdb';
import { tmdbSync } from '../services/tmdbSync';
import { userService } from '../services/userService';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Plus, Check, Clock, Info, Volume2, VolumeX } from 'lucide-react';
import { getMediaPoster } from '../utils/mediaUtils';
import { playNavigateSound, playSelectSound, playBackSound } from '../utils/soundEffects';

interface MediaCardProps {
  media: Media;
  onClick: () => void;
  onPlay?: () => void;
  size?: 'sm' | 'md' | 'lg';
  colIndex?: number;
}

/**
 * MediaCard — Netflix/Apple TV Style (TV Box Remote)
 * ════════════════════════════════════════════════════
 * Retraído: Poster vertical
 * Expandido (focus D-Pad ou hover): Backdrop + Logo + 4 botões glass
 * TV Box: Enter entra no modo botões, ← → navega, Enter executa, Back sai
 */
const MediaCard: React.FC<MediaCardProps> = React.memo(({ media, onClick, onPlay, size = 'md', colIndex = 0 }) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [trailerKey, setTrailerKey] = useState<string | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoError, setLogoError] = useState(false);
  const [backdropUrl, setBackdropUrl] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(true);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  // Library states (Supabase)
  const [inWatchlist, setInWatchlist] = useState(false);
  const [inWatchLater, setInWatchLater] = useState(false);
  const [isTogglingList, setIsTogglingList] = useState(false);
  const [isTogglingLater, setIsTogglingLater] = useState(false);
  // TV Box: modo de navegação pelos botões internos
  const [buttonMode, setButtonMode] = useState(false);
  const [activeBtn, setActiveBtn] = useState(0);
  const hoverTimeoutRef = useRef<number | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // Total de botões: Assistir, Lista (+), Depois (relógio), Detalhes (info)
  const TOTAL_BTNS = 4;

  // Reset logoError ao trocar de media
  useEffect(() => {
    setLogoError(false);
  }, [media.id, media.tmdb_id]);

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
    e?.preventDefault?.();
    e?.stopPropagation?.();
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
    e?.preventDefault?.();
    e?.stopPropagation?.();
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

  // Card ativo = hover (mouse) OU focus (D-Pad controle remoto)
  const isActive = isHovered || isFocused;
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
      else setLogoUrl(null);
      setLogoError(false);
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
    setButtonMode(false);
    setActiveBtn(0);
  }, []);

  const handleFocus = useCallback(() => {
    setIsFocused(true);
  }, []);

  const handleBlur = useCallback(() => {
    setIsFocused(false);
    setButtonMode(false);
    setActiveBtn(0);
  }, []);

  // ─── Navegação ─────────────────────────────────────────────────
  const goToWatch = useCallback((e?: React.MouseEvent) => {
    e?.preventDefault?.();
    e?.stopPropagation?.();
    if (onPlay) { onPlay(); return; }
    navigate(`/watch/${media.type === 'series' ? 'tv' : 'movie'}/${media.tmdb_id || media.id}`);
  }, [navigate, media, onPlay]);

  const goToDetails = useCallback((e?: React.MouseEvent) => {
    e?.preventDefault?.();
    e?.stopPropagation?.();
    onClick();
  }, [onClick]);

  // Executar ação do botão ativo (ordem: Assistir, Lista, Depois, Detalhes)
  const executeButton = useCallback((idx: number) => {
    playSelectSound();
    switch (idx) {
      case 0: goToWatch(); break;       // Assistir
      case 1: handleToggleWatchlist(); break; // Lista (+)
      case 2: handleToggleWatchLater(); break; // Depois (relógio)
      case 3: goToDetails(); break;     // Detalhes (info)
    }
  }, [goToWatch, goToDetails, handleToggleWatchlist, handleToggleWatchLater]);

  // ─── Controle Remoto D-Pad ─────────────────────────────────────
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (buttonMode) {
      // Modo botões: ← → navega entre botões, Enter executa, Back sai
      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          e.stopPropagation();
          playNavigateSound();
          setActiveBtn(prev => Math.max(0, prev - 1));
          break;
        case 'ArrowRight':
          e.preventDefault();
          e.stopPropagation();
          playNavigateSound();
          setActiveBtn(prev => Math.min(TOTAL_BTNS - 1, prev + 1));
          break;
        case 'ArrowUp':
        case 'ArrowDown':
          // Sai do modo botões — NÃO previne propagação para que o spatial nav mova o foco
          setButtonMode(false);
          setActiveBtn(0);
          // Não chama e.preventDefault/stopPropagation — spatial nav cuida da navegação
          return;
        case 'Enter':
          e.preventDefault();
          e.stopPropagation();
          executeButton(activeBtn);
          break;
        case 'Escape':
        case 'Backspace':
          e.preventDefault();
          e.stopPropagation();
          playBackSound();
          setButtonMode(false);
          setActiveBtn(0);
          break;
      }
    } else {
      // Modo normal: Enter entra no modo botões (card já está expandido via focus)
      if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        playSelectSound();
        setButtonMode(true);
        setActiveBtn(0);
      }
    }
  }, [buttonMode, activeBtn, executeButton]);

  // Interceptar ArrowLeft/Right em fase de captura quando em buttonMode — evita spatial nav pular para próximo card
  useEffect(() => {
    if (!buttonMode) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        const target = e.target as HTMLElement;
        if (cardRef.current?.contains(target)) {
          e.preventDefault();
          e.stopPropagation();
          playNavigateSound();
          if (e.key === 'ArrowLeft') {
            setActiveBtn(prev => Math.max(0, prev - 1));
          } else {
            setActiveBtn(prev => Math.min(TOTAL_BTNS - 1, prev + 1));
          }
        }
      }
    };
    window.addEventListener('keydown', handler, { capture: true });
    return () => window.removeEventListener('keydown', handler, { capture: true });
  }, [buttonMode]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    };
  }, []);

  return (
    <div
      ref={cardRef}
      className={`relative flex-shrink-0 outline-none rounded-2xl ${isActive ? 'z-50' : ''}`}
      data-nav-media-card
      style={{
        width: isActive ? `${expandedWidth}px` : `${cardWidth}px`,
        height: `${cardHeight}px`,
        transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
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

        {/* Focus ring (TV) — linha fina seguindo a curva do poster */}
        {isFocused && !buttonMode && (
          <div className="absolute inset-0 rounded-2xl ring-1 ring-inset ring-white/70 pointer-events-none z-30" />
        )}

        {/* ═══ EXPANDIDO (Focus/Hover) — Estilo Cinematic ═══ */}
        <AnimatePresence>
          {isActive && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 flex flex-col justify-end rounded-2xl"
            >
              {/* ── FUNDO: Backdrop cinematic ── */}
              <div className="absolute inset-0 w-full h-full bg-black overflow-hidden">
                <img
                  src={backdropUrl || media.backdrop || poster}
                  alt={media.title}
                  className="absolute inset-0 w-full h-full object-cover object-top opacity-70"
                />
                {/* Gradiente cinematic — escurece base e laterais */}
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent z-10" />
                <div className="absolute inset-0 bg-gradient-to-r from-black/60 to-transparent z-10" />

                {/* Botão Mute (mouse only) */}
                {trailerKey && (
                  <button
                    onClick={(e) => { e.stopPropagation(); setIsMuted(!isMuted); }}
                    className="absolute top-2 right-2 z-30 p-1.5 bg-black/50 border border-white/20 rounded-full text-white hover:bg-white/20 transition-colors"
                    tabIndex={-1}
                  >
                    {isMuted ? <VolumeX size={12} /> : <Volume2 size={12} />}
                  </button>
                )}
              </div>

              {/* ── CONTEÚDO SOBREPOSTO ── */}
              <div className="relative z-30 p-3 pb-2.5 flex flex-col justify-end gap-2">
                {/* Logo do filme/série via API TMDB (VITE_TMDB_READ_TOKEN no .env) — fallback para título */}
                <div className="flex items-end mb-0.5">
                  {logoUrl && !logoError ? (
                    <img
                      src={logoUrl}
                      alt={media.title}
                      className="max-h-[32px] max-w-[55%] object-contain drop-shadow-[0_2px_10px_rgba(0,0,0,0.9)]"
                      onError={() => setLogoError(true)}
                    />
                  ) : (
                    <h3 className="text-[13px] font-black uppercase tracking-tight text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.95)] line-clamp-1 leading-tight">
                      {media.title}
                    </h3>
                  )}
                </div>

                {/* Botões — estilo referência: Assistir branco, demais circulares escuros */}
                <div className="flex items-center gap-2">
                  {/* Assistir — botão principal branco */}
                  <button
                    type="button"
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); goToWatch(e); }}
                    tabIndex={-1}
                    className={`py-1.5 px-3 rounded-xl font-bold text-[10px] flex items-center gap-1.5 transition-all
                      ${buttonMode && activeBtn === 0 ? 'scale-110 ring-2 ring-white' : ''}`}
                    style={{
                      backgroundColor: 'rgba(255,255,255,0.95)',
                      color: '#000',
                    }}
                  >
                    <Play size={11} fill="black" /> Assistir
                  </button>

                  {/* + (Minha Lista) — circular escuro */}
                  <button
                    type="button"
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleToggleWatchlist(e); }}
                    tabIndex={-1}
                    className={`w-8 h-8 flex items-center justify-center rounded-full text-white border border-white/20 transition-all
                      ${buttonMode && activeBtn === 1 ? 'scale-110 ring-2 ring-white' : ''}
                      ${inWatchlist ? 'bg-green-600/80' : 'bg-black/70'}`}
                    title={inWatchlist ? 'Remover da Lista' : 'Minha Lista'}
                  >
                    {inWatchlist ? <Check size={12} strokeWidth={2.5} /> : <Plus size={12} strokeWidth={2.5} />}
                  </button>

                  {/* Relógio (Assistir Depois) — circular escuro */}
                  <button
                    type="button"
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleToggleWatchLater(e); }}
                    tabIndex={-1}
                    className={`w-8 h-8 flex items-center justify-center rounded-full text-white border border-white/20 transition-all
                      ${buttonMode && activeBtn === 2 ? 'scale-110 ring-2 ring-white' : ''}
                      ${inWatchLater ? 'bg-blue-600/80' : 'bg-black/70'}`}
                    title={inWatchLater ? 'Remover' : 'Ver Depois'}
                  >
                    <Clock size={12} strokeWidth={2.5} />
                  </button>

                  {/* Info (Detalhes) — circular escuro */}
                  <button
                    type="button"
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); goToDetails(); }}
                    tabIndex={-1}
                    className={`w-8 h-8 flex items-center justify-center rounded-full text-white border border-white/20 bg-black/70 transition-all
                      ${buttonMode && activeBtn === 3 ? 'scale-110 ring-2 ring-white' : ''}`}
                    title="Detalhes"
                  >
                    <Info size={12} strokeWidth={2.5} />
                  </button>
                </div>

                {/* Dica de navegação (TV Box) — aparece no modo botões */}
                {buttonMode && (
                  <div className="text-center mt-0.5">
                    <span className="text-[7px] text-white/30 font-bold uppercase tracking-[0.2em]">
                      ← → navegar · OK selecionar · VOLTAR sair
                    </span>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
});

MediaCard.displayName = 'MediaCard';
export default MediaCard;
