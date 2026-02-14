
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Media } from '../types';
import { VideoOff, X, Rewind, Pause, Play, FastForward, Volume2, VolumeX, Maximize, SkipForward, Wifi, WifiOff } from 'lucide-react';
import { getTrailer } from '../services/tmdb';
import { userService } from '../services/userService';
import { getStreamUrl } from '../services/streamService';
import { useSpatialNav } from '../hooks/useSpatialNavigation';
import Hls from 'hls.js';
import { HlsStreamingManager, QualityLevel, StreamStats } from '../services/hlsStreamingService';
import QualitySelector from '../components/VideoPlayer/QualitySelector';
import SubtitleManager, { SubtitleOverlay, useSubtitles } from '../components/VideoPlayer/SubtitleManager';
import { getBufferPreloadManager } from '../services/bufferPreloadService';

interface PlayerProps {
  media: Media;
  onClose: () => void;
  nextEpisode?: {
    title: string;
    season: number;
    episode: number;
    stream_url?: string;
  } | null;
  onPlayNext?: () => void;
}

const Player: React.FC<PlayerProps> = ({ media, onClose, nextEpisode, onPlayNext }) => {
  // Disable SpatialNav — Player has own arrow key handlers (seek, volume)
  const { setEnabled } = useSpatialNav();
  useEffect(() => {
    setEnabled(false);
    return () => setEnabled(true);
  }, [setEnabled]);

  // ═══ ESTADOS ═══
  const [showControls, setShowControls] = useState(true);
  const [fallbackTrailer, setFallbackTrailer] = useState<string | null>(null);
  const [loadingFallback, setLoadingFallback] = useState(false);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [savedProgress, setSavedProgress] = useState<number>(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showResumeToast, setShowResumeToast] = useState(false);
  const [showNextEpisode, setShowNextEpisode] = useState(false);
  const [nextEpisodeCountdown, setNextEpisodeCountdown] = useState(10);
  const [hasReachedEnd, setHasReachedEnd] = useState(false);
  const [volume, setVolume] = useState(1);
  const [streamError, setStreamError] = useState(false);
  const [connectionError, setConnectionError] = useState(false);
  const [retryToken, setRetryToken] = useState(0);
  const [alternativeUrl, setAlternativeUrl] = useState<string | null>(null);
  const triedAlternative = useRef(false);

  // ═══ HLS QUALITY & STATS ═══
  const [qualityLevels, setQualityLevels] = useState<QualityLevel[]>([]);
  const [currentQuality, setCurrentQuality] = useState<QualityLevel | null>(null);
  const [streamStats, setStreamStats] = useState<StreamStats | null>(null);
  const [showQualityMenu, setShowQualityMenu] = useState(false);
  const [isAutoQuality, setIsAutoQuality] = useState(true);
  const [hlsRetryInfo, setHlsRetryInfo] = useState<{ attempt: number; max: number } | null>(null);
  const [isStreamBuffering, setIsStreamBuffering] = useState(false);
  const [showSubtitleMenu, setShowSubtitleMenu] = useState(false);

  // ═══ REFS ═══
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const hlsManagerRef = useRef<HlsStreamingManager | null>(null);
  const retryButtonRef = useRef<HTMLButtonElement | null>(null);
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const controlsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nextEpTimeoutRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hasAppliedResume = useRef(false);
  const preloadTriggeredRef = useRef(false);

  const tmdbId = media.tmdb_id || media.id;

  // ═══ LEGENDAS ═══
  const {
    tracks: subtitleTracks,
    activeTrackId: activeSubtitleId,
    currentCue,
    style: subtitleStyle,
    loadFromFile: loadSubtitleFile,
    removeTrack: removeSubtitleTrack,
    selectTrack: selectSubtitle,
    updateStyle: updateSubtitleStyle,
    resetStyle: resetSubtitleStyle,
  } = useSubtitles({ videoRef });

  // ═══════════════════════════════════════════════════════
  // 1. RESTORE — Buscar progresso salvo ao montar
  // ═══════════════════════════════════════════════════════
  useEffect(() => {
    if (tmdbId) {
      userService.getProgress(tmdbId).then(seconds => {
        if (seconds > 10) {
          setSavedProgress(seconds);
          console.log(`[Player] ▶ Progresso salvo: ${formatTime(seconds)}`);
        }
      }).catch(() => { });
    }
  }, [tmdbId]);

  // ═══════════════════════════════════════════════════════
  // 2. AUTO-SAVE — Salvar a cada 10s (filtro <10s e >95%)
  // ═══════════════════════════════════════════════════════
  useEffect(() => {
    if (!media.stream_url || !tmdbId) return;

    progressIntervalRef.current = setInterval(() => {
      if (videoRef.current && !videoRef.current.paused) {
        const ct = videoRef.current.currentTime;
        const dur = videoRef.current.duration;
        const percentage = dur > 0 ? ct / dur : 0;

        // ⚡ FILTRO: Não salvar se < 10s ou > 95%
        if (ct > 10 && percentage < 0.95) {
          userService.saveProgress(
            tmdbId, media.type, ct,
            isFinite(dur) ? dur : undefined
          ).catch(() => { });
        }

        // Se chegou a 95%, marcar como concluído (limpa progresso)
        if (percentage >= 0.95 && !hasReachedEnd) {
          setHasReachedEnd(true);
          userService.saveProgress(
            tmdbId, media.type, 0,
            isFinite(dur) ? dur : undefined
          ).catch(() => { });
          console.log('[Player] ✓ Conteúdo concluído (>95%)');
        }
      }
    }, 10000);

    return () => {
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
      // Salvar progresso final ao desmontar
      if (videoRef.current && tmdbId) {
        const ft = videoRef.current.currentTime;
        const dur = videoRef.current.duration;
        const pct = dur > 0 ? ft / dur : 0;
        if (ft > 10 && pct < 0.95) {
          userService.saveProgress(tmdbId, media.type, ft, isFinite(dur) ? dur : undefined);
        }
      }
    };
  }, [media.stream_url, tmdbId, media.type, hasReachedEnd]);

  // ═══════════════════════════════════════════════════════
  // 3. FALLBACK — Buscar trailer se não tem stream_url OU se URL falhou
  // ═══════════════════════════════════════════════════════
  useEffect(() => {
    const hasWorkingStream = (media.stream_url || alternativeUrl) && !streamError;
    const needsFallback = !hasWorkingStream && media.tmdb_id && media.tmdb_id > 0;
    if (needsFallback && !fallbackTrailer) {
      setLoadingFallback(true);
      getTrailer(media.tmdb_id, media.type)
        .then(key => setFallbackTrailer(key || null))
        .catch(() => setFallbackTrailer(null))
        .finally(() => setLoadingFallback(false));
    }
  }, [media, streamError, alternativeUrl]);

  // Se o `stream_url` for do YouTube, não usar o YouTube como fonte principal.
  // Tentar buscar uma URL real no Supabase (via `getStreamUrl`). Se não achar,
  // marcar erro para que o fallback (trailer) seja usado.
  useEffect(() => {
    const url = media.stream_url;
    const isYouTube = !!url && (url.includes('youtube') || url.includes('youtu.be'));
    if (isYouTube) {
      // reset state
      setAlternativeUrl(null);
      setStreamError(false);
      setLoadingFallback(true);
      (async () => {
        try {
          const alt = await getStreamUrl(media.title, media.type, media.tmdb_id);
          if (alt && !alt.includes('youtube')) {
            console.log('[Player] Substituindo YouTube por URL real encontrada:', alt);
            setAlternativeUrl(alt);
            setStreamError(false);
          } else {
            console.log('[Player] Nenhuma URL real encontrada para substituir YouTube — usando trailer fallback');
            setStreamError(true);
            setIsPlaying(false);
          }
        } catch (e) {
          console.warn('[Player] Erro ao buscar URL alternativa para YouTube:', e);
          setStreamError(true);
          setIsPlaying(false);
        } finally {
          setLoadingFallback(false);
        }
      })();
    }
  }, [media]);

  const isVideoStream = useCallback((url?: string | null) => {
    if (!url) return false;
    // Verifica extensões conhecidas
    if (/\.(m3u8|mp4|m4v|webm|ogg|avi|mov|wmv|flv|mkv)(\?|$)/i.test(url)) {
      return true;
    }
    // Verifica se é uma URL de stream comum (sem extensão mas com parâmetros de stream)
    if (/\/stream|\/video|\/play|\/media|\/content/i.test(url)) {
      return true;
    }
    // Verifica se é uma URL HTTP/HTTPS sem extensão (possível stream direto)
    if (/^https?:\/\/[^\/]+\//i.test(url) && !/\.[a-z]{2,4}(\?|$)/i.test(url.split('?')[0])) {
      return true;
    }
    return false;
  }, []);

  // Handler para erro de carregamento de vídeo — tenta URL alternativa antes do trailer
  const handleVideoError = useCallback(async () => {
    const failedUrl = alternativeUrl || media.stream_url;
    console.warn(`[Player] ✗ Stream falhou: ${failedUrl?.substring(0, 60)}...`);

    // Se ainda não tentou buscar URL alternativa no Supabase, tentar agora
    if (!triedAlternative.current && media.title) {
      triedAlternative.current = true;
      console.log(`[Player] Buscando URL alternativa no Supabase para "${media.title}"...`);
      try {
        const altUrl = await getStreamUrl(media.title, media.type, media.tmdb_id);
        if (altUrl && altUrl !== media.stream_url && altUrl !== alternativeUrl) {
          console.log(`[Player] ✓ URL alternativa encontrada: ${altUrl.substring(0, 60)}...`);
          setAlternativeUrl(altUrl);
          setStreamError(false);
          setConnectionError(false);
          return; // Não cair no trailer — vai tentar a nova URL
        }
      } catch { /* ignore */ }
    }

    // Sem alternativa — fallback para trailer
    console.warn('[Player] Sem URL alternativa — ativando fallback trailer');
    setStreamError(true);
    setConnectionError(isVideoStream(failedUrl));
    setIsPlaying(false);
  }, [media.stream_url, media.title, media.type, media.tmdb_id, alternativeUrl, isVideoStream]);

  useEffect(() => {
    if (connectionError) {
      setTimeout(() => {
        retryButtonRef.current?.focus();
      }, 0);
    }
  }, [connectionError]);

  // ═══════════════════════════════════════════════════════
  // 4. CONTROLES — Auto-hide após 4 segundos (mouse + teclado)
  // ═══════════════════════════════════════════════════════
  const resetControls = useCallback(() => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => setShowControls(false), 4000);
  }, []);

  useEffect(() => {
    const handleMouseMove = () => resetControls();
    const handleKeyActivity = () => resetControls();
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('keydown', handleKeyActivity);
    resetControls();
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('keydown', handleKeyActivity);
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    };
  }, [resetControls]);





  useEffect(() => {
    return () => { if (nextEpTimeoutRef.current) clearInterval(nextEpTimeoutRef.current); };
  }, []);

  const cancelNextEpisode = useCallback(() => {
    if (nextEpTimeoutRef.current) clearInterval(nextEpTimeoutRef.current);
    setShowNextEpisode(false);
  }, []);

  // ═══════════════════════════════════════════════════════
  // HANDLERS
  // ═══════════════════════════════════════════════════════
  const handleClose = useCallback(() => {
    if (videoRef.current && tmdbId) {
      const ft = videoRef.current.currentTime;
      const dur = videoRef.current.duration;
      const pct = dur > 0 ? ft / dur : 0;
      if (ft > 10 && pct < 0.95) {
        userService.saveProgress(tmdbId, media.type, ft, isFinite(dur) ? dur : undefined);
      }
    }
    // Destruir instância HLS Manager
    if (hlsManagerRef.current) {
      hlsManagerRef.current.destroy();
      hlsManagerRef.current = null;
    }
    // Destruir instância HLS legada (fallback Safari)
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
    // Cancelar preloads
    try { getBufferPreloadManager().cancelAll(); } catch {}
    setShowQualityMenu(false);
    setShowSubtitleMenu(false);
    onClose();
  }, [media, tmdbId]);

  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => { });
    } else {
      document.exitFullscreen();
    }
  }, []);

  const toggleMute = useCallback(() => {
    if (videoRef.current) {
      videoRef.current.muted = !videoRef.current.muted;
      setIsMuted(videoRef.current.muted);
    }
  }, []);

  const adjustVolume = useCallback((delta: number) => {
    if (videoRef.current) {
      const newVol = Math.max(0, Math.min(1, videoRef.current.volume + delta));
      videoRef.current.volume = newVol;
      setVolume(newVol);
      setIsMuted(newVol === 0);
    }
  }, []);

  // ═══════════════════════════════════════════════════════
  // 6. NEXT EPISODE — Countdown de 10s ao terminar
  // ═══════════════════════════════════════════════════════
  const handleVideoEnded = useCallback(() => {
    setIsPlaying(false);

    // Se for série e tiver próximo episódio, aguarda 5s e toca
    if (media.type === 'series' && nextEpisode && onPlayNext) {
      setShowNextEpisode(true);
      setNextEpisodeCountdown(5); // Reduzido para 5s para agilidade
      let count = 5;
      nextEpTimeoutRef.current = setInterval(() => {
        count--;
        setNextEpisodeCountdown(count);
        if (count <= 0) {
          if (nextEpTimeoutRef.current) clearInterval(nextEpTimeoutRef.current);
          onPlayNext();
        }
      }, 1000);
    } else {
      // Se não for série ou não tiver próximo, volta pra home
      handleClose();
    }
  }, [nextEpisode, onPlayNext, media.type, handleClose]);

  // ═══════════════════════════════════════════════════════
  // 5. KEYBOARD — Atalhos (Espaço, ←→, F, M, ↑↓, Esc)
  // ═══════════════════════════════════════════════════════
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Backspace') {
        e.preventDefault();
        if (showQualityMenu) {
          setShowQualityMenu(false);
          return;
        }
        if (showSubtitleMenu) {
          setShowSubtitleMenu(false);
          return;
        }
        handleClose();
        return;
      }
      if (!videoRef.current) return;
      switch (e.key) {
        case ' ':
        case 'k':
          e.preventDefault();
          videoRef.current.paused ? videoRef.current.play() : videoRef.current.pause();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          videoRef.current.currentTime = Math.max(0, videoRef.current.currentTime - 10);
          break;
        case 'ArrowRight':
          e.preventDefault();
          videoRef.current.currentTime = Math.min(videoRef.current.duration, videoRef.current.currentTime + 10);
          break;
        case 'f':
          e.preventDefault();
          toggleFullscreen();
          break;
        case 'm':
          e.preventDefault();
          toggleMute();
          break;
        case 'ArrowUp':
          e.preventDefault();
          adjustVolume(0.1);
          break;
        case 'ArrowDown':
          e.preventDefault();
          adjustVolume(-0.1);
          break;
        case 'q':
          e.preventDefault();
          setShowQualityMenu(prev => !prev);
          break;
        case 'c':
          e.preventDefault();
          setShowSubtitleMenu(prev => !prev);
          break;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleClose, toggleFullscreen, toggleMute, adjustVolume, showQualityMenu, showSubtitleMenu]);

  const handleTimeUpdate = useCallback(() => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
      setDuration(videoRef.current.duration || 0);
    }
  }, []);

  const handleCanPlay = useCallback(() => {
    if (videoRef.current && savedProgress > 10 && !hasAppliedResume.current) {
      hasAppliedResume.current = true;
      videoRef.current.currentTime = savedProgress;
      setShowResumeToast(true);
      console.log(`[Player] ▶ Retomando de ${formatTime(savedProgress)}`);
      setTimeout(() => setShowResumeToast(false), 4000);
    }
  }, [savedProgress]);

  const handleSeek = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!videoRef.current || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const pct = x / rect.width;
    videoRef.current.currentTime = pct * duration;
  }, [duration]);

  // ═══════════════════════════════════════════════════════
  // BUFFER PRELOAD — Preload inicial e próximo episódio
  // ═══════════════════════════════════════════════════════
  useEffect(() => {
    const activeUrl = alternativeUrl || media.stream_url;
    if (!activeUrl || !/\.m3u8(\?|$)/i.test(activeUrl)) return;

    const contentId = String(tmdbId || media.title);
    const preloader = getBufferPreloadManager();

    // Preload dos primeiros 10s ao montar
    preloader.preloadInitialSegments(activeUrl, contentId).catch(() => {});

    return () => {
      preloader.cancelAll();
    };
  }, [alternativeUrl, media.stream_url, tmdbId, media.title]);

  // Preload do próximo episódio quando faltam 60s
  useEffect(() => {
    if (!nextEpisode?.stream_url || preloadTriggeredRef.current) return;
    if (duration <= 0 || currentTime <= 0) return;

    const remaining = duration - currentTime;
    if (remaining <= 60 && remaining > 0) {
      preloadTriggeredRef.current = true;
      const episodeUrl = nextEpisode.stream_url;
      if (/\.m3u8(\?|$)/i.test(episodeUrl)) {
        const contentId = `next-${nextEpisode.season}x${nextEpisode.episode}`;
        getBufferPreloadManager().preloadNextEpisode(episodeUrl, contentId).catch(() => {});
        console.log(`[Player] Preloading próximo episódio S${nextEpisode.season}E${nextEpisode.episode}`);
      }
    }
  }, [currentTime, duration, nextEpisode]);

  // ═══════════════════════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════════════════════
  function formatTime(s: number): string {
    if (!isFinite(s) || s < 0) return '0:00';
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = Math.floor(s % 60);
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
    return `${m}:${String(sec).padStart(2, '0')}`;
  }

  const progressPct = duration > 0 ? (currentTime / duration) * 100 : 0;

  // ═══════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════
  return (
    <div
      ref={containerRef}
      className="fixed inset-0 w-screen h-screen bg-black z-9999 flex items-center justify-center overflow-hidden group"
      onMouseMove={resetControls}
      onClick={resetControls}
    >
      {/* ═══ VIDEO SOURCE ═══ */}
      {(alternativeUrl || media.stream_url) && !streamError && !((alternativeUrl || media.stream_url) || '').includes('youtube') ? (() => {
        const activeUrl = alternativeUrl || media.stream_url!;
        const isHLS = /\.m3u8(\?|$)/i.test(activeUrl);
        const isMP4 = /\.mp4(\?|$)/i.test(activeUrl) || (!isHLS && /\.(m4v|webm|ogg)(\?|$)/i.test(activeUrl));
        return (
          <video
            key={`${activeUrl}-${retryToken}`}
            ref={(el) => {
              videoRef.current = el;
              // Integração HLS via HlsStreamingManager (ABR + retry + quality selector)
              if (el && isHLS) {
                // Limpar instâncias anteriores
                if (hlsManagerRef.current) {
                  hlsManagerRef.current.destroy();
                  hlsManagerRef.current = null;
                }
                if (hlsRef.current) {
                  hlsRef.current.destroy();
                  hlsRef.current = null;
                }

                if (HlsStreamingManager.isSupported()) {
                  const manager = new HlsStreamingManager();
                  const success = manager.initialize(el, activeUrl, {
                    onQualityLevelsReady: (levels) => {
                      setQualityLevels(levels);
                    },
                    onQualityChanged: (level) => {
                      setCurrentQuality(level);
                    },
                    onStatsUpdate: (stats) => {
                      setStreamStats(stats);
                      setIsAutoQuality(stats.isAutoQuality);
                    },
                    onManifestParsed: () => {
                      // Autoplay tratado internamente pelo manager
                    },
                    onError: (fatal, details) => {
                      console.warn(`[Player] HLS ${fatal ? 'FATAL' : 'não-fatal'}: ${details}`);
                    },
                    onRecovery: (attempt, max) => {
                      setHlsRetryInfo({ attempt, max });
                      console.log(`[Player] HLS recovery ${attempt}/${max}`);
                    },
                    onFatalError: () => {
                      setHlsRetryInfo(null);
                      handleVideoError();
                    },
                    onBuffering: (buffering) => {
                      setIsStreamBuffering(buffering);
                    },
                  });

                  if (success) {
                    hlsManagerRef.current = manager;
                    // Guardar referência HLS interna para compatibilidade
                    hlsRef.current = manager.getHlsInstance();
                  } else {
                    handleVideoError();
                  }
                } else if (HlsStreamingManager.hasNativeHlsSupport(el)) {
                  // Safari nativo
                  el.src = activeUrl;
                }
              } else if (el && !isHLS) {
                // Para MP4 e outros formatos diretos, configurar source diretamente
                el.src = activeUrl;
                if (activeUrl.includes('supabase')) {
                  el.crossOrigin = 'anonymous';
                }
              }
            }}
            className="w-full h-full object-contain"
            autoPlay={!isHLS}
            preload={isMP4 ? "metadata" : "none"}
            onCanPlay={handleCanPlay}
            onTimeUpdate={handleTimeUpdate}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            onEnded={handleVideoEnded}
            onError={!isHLS ? handleVideoError : undefined}
            onLoadStart={() => {
              if (isMP4) {
                console.log('[Player] Iniciando carregamento MP4 direto');
              }
            }}
          />
        );
      })() : connectionError ? (
        <div className="absolute inset-0 flex items-center justify-center bg-black">
          <div className="z-10 text-center flex flex-col items-center gap-4">
            <VideoOff className="w-16 h-16 text-white/60" />
            <p className="text-2xl text-white font-black uppercase tracking-widest">Erro de Conexão</p>
            <button
              ref={retryButtonRef}
              onClick={() => {
                setStreamError(false);
                setConnectionError(false);
                triedAlternative.current = false;
                setRetryToken((t) => t + 1);
                setIsPlaying(true);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  setStreamError(false);
                  setConnectionError(false);
                  triedAlternative.current = false;
                  setRetryToken((t) => t + 1);
                  setIsPlaying(true);
                }
              }}
              tabIndex={0}
              className="px-6 py-3 bg-red-600 hover:bg-red-500 text-white font-black rounded-xl transition-all focus:outline-none focus:ring-2 focus:ring-white/60"
            >
              Tentar Novamente
            </button>
          </div>
        </div>
      ) : loadingFallback ? (
        <div className="absolute inset-0 flex items-center justify-center bg-black">
          <div className="w-12 h-12 border-4 border-red-600 border-t-transparent rounded-full animate-spin" />
          <p className="absolute mt-20 text-white/40 text-xs uppercase tracking-widest">Buscando stream...</p>
        </div>
      ) : fallbackTrailer ? (
        <div className="absolute inset-0 w-full h-full bg-black">
          <iframe
            src={`https://www.youtube.com/embed/${fallbackTrailer}?autoplay=1&rel=0&modestbranding=1`}
            className="w-full h-full border-0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
            title={`${media.title} - Trailer`}
          />
          <div className="absolute top-20 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 z-20 pointer-events-none">
            <div className="bg-red-600/90 text-white text-[10px] uppercase tracking-[0.3em] font-bold px-4 py-1.5 rounded-full backdrop-blur-sm">
              Trailer Oficial
            </div>
            <p className="text-white/50 text-[9px] uppercase tracking-widest">Stream não disponível — exibindo trailer</p>
          </div>
        </div>
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-black">
          <img src={media.backdrop} alt="" className="absolute inset-0 w-full h-full object-cover opacity-30 blur-sm" />
          <div className="z-10 text-center">
            <VideoOff className="w-16 h-16 text-white/50 mb-4 mx-auto" />
            <p className="text-xl text-white font-medium italic uppercase tracking-widest">Conteúdo Temporariamente Indisponível</p>
          </div>
        </div>
      )}

      {/* ═══ RESUME TOAST ═══ */}
      {showResumeToast && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-top-4 duration-500">
          <div className="bg-white/10 backdrop-blur-2xl rounded-2xl px-6 py-3 border border-white/20 shadow-2xl">
            <p className="text-sm text-white/90 flex items-center gap-2">
              <Play size={14} fill="white" className="text-green-400" />
              Continuando de <strong className="text-green-400">{formatTime(savedProgress)}</strong>
            </p>
          </div>
        </div>
      )}

      {/* ═══ BUFFERING INDICATOR ═══ */}
      {isStreamBuffering && !showControls && (
        <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
          <div className="flex flex-col items-center gap-3">
            <div className="w-12 h-12 border-4 border-red-600 border-t-transparent rounded-full animate-spin" />
            {streamStats && streamStats.networkSpeed > 0 && (
              <div className="bg-black/60 backdrop-blur-sm rounded-xl px-4 py-2 flex items-center gap-2">
                <Wifi className="w-3 h-3 text-white/40" />
                <span className="text-[10px] text-white/40 font-mono">{streamStats.networkSpeed.toFixed(1)} Mbps</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══ HLS RETRY OVERLAY ═══ */}
      {hlsRetryInfo && (
        <div className="absolute top-20 right-8 z-50 animate-in fade-in slide-in-from-right-4 duration-300">
          <div className="bg-yellow-500/10 backdrop-blur-2xl rounded-2xl px-5 py-3 border border-yellow-500/20 shadow-2xl">
            <p className="text-xs text-yellow-400/90 flex items-center gap-2 font-medium">
              <WifiOff size={14} />
              Reconectando... ({hlsRetryInfo.attempt}/{hlsRetryInfo.max})
            </p>
          </div>
        </div>
      )}

      {/* ═══ SUBTITLE OVERLAY ═══ */}
      <SubtitleOverlay cue={currentCue} style={subtitleStyle} />

      {/* ═══ NEXT EPISODE OVERLAY ═══ */}
      {showNextEpisode && nextEpisode && (
        <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center animate-in fade-in duration-500">
          <div className="bg-white/5 backdrop-blur-2xl border border-white/10 rounded-4xl p-8 max-w-md w-full mx-4 shadow-2xl">
            <p className="text-white/40 text-xs uppercase tracking-[0.3em] font-bold mb-3">Próximo Episódio</p>
            <h3 className="text-2xl font-black text-white mb-1">
              S{String(nextEpisode.season).padStart(2, '0')}E{String(nextEpisode.episode).padStart(2, '0')}
            </h3>
            <p className="text-white/70 text-sm mb-6">{nextEpisode.title}</p>

            <div className="flex items-center gap-6 mb-6">
              <div className="relative w-16 h-16">
                <svg className="w-16 h-16 -rotate-90" viewBox="0 0 64 64">
                  <circle cx="32" cy="32" r="28" fill="none" stroke="white" strokeOpacity="0.1" strokeWidth="4" />
                  <circle
                    cx="32" cy="32" r="28" fill="none" stroke="#E50914" strokeWidth="4"
                    strokeDasharray={`${(nextEpisodeCountdown / 5) * 175.9} 175.9`}
                    strokeLinecap="round"
                    className="transition-all duration-1000 ease-linear"
                  />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-xl font-black text-white">
                  {nextEpisodeCountdown}
                </span>
              </div>
              <p className="text-white/50 text-sm">Reproduzindo automaticamente...</p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => { cancelNextEpisode(); onPlayNext?.(); }}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); cancelNextEpisode(); onPlayNext?.(); } }}
                tabIndex={0}
                className="flex-1 py-3 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-colors focus:outline-none focus:ring-2 focus:ring-white/50"
              >
                <SkipForward size={18} /> Reproduzir Agora
              </button>
              <button
                onClick={cancelNextEpisode}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); cancelNextEpisode(); } }}
                tabIndex={0}
                className="px-6 py-3 bg-white/10 hover:bg-white/20 text-white/70 font-bold rounded-xl transition-colors focus:outline-none focus:ring-2 focus:ring-[#E50914]"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ TOP BAR ═══ */}
      <div className={`absolute top-0 inset-x-0 p-8 md:p-12 flex justify-between items-start transition-all duration-700 z-10 ${showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'} bg-linear-to-b from-black/80 to-transparent`}>
        <div className="flex flex-col gap-2">
          <span className="text-red-600 uppercase tracking-[0.5em] font-black text-[10px]">RED X Player</span>
          <h2 className="text-2xl md:text-5xl font-black tracking-tighter drop-shadow-2xl">{media.title}</h2>
          <div className="flex gap-4 items-center">
            {media.year && (
              <span className="text-xs text-white/40 font-bold uppercase tracking-widest bg-white/5 px-3 py-1 rounded-lg border border-white/10">
                {media.year}
              </span>
            )}
            <span className="text-xs text-white/40 font-bold uppercase tracking-widest">
              {media.type === 'series' ? 'Série' : 'Filme'}
            </span>
          </div>
        </div>
        <button
          onClick={handleClose}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleClose(); } }}
          tabIndex={0}
          className="w-12 h-12 md:w-16 md:h-16 rounded-full glass border border-white/20 flex items-center justify-center hover:bg-red-600 transition-all shadow-2xl focus:outline-none focus:ring-2 focus:ring-[#E50914] focus:bg-red-600"
          title="Fechar Player"
        >
          <X className="w-6 h-6" />
        </button>
      </div>

      {/* ═══ CENTER CONTROLS ═══ */}
      {showControls && media.stream_url && (
        <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
          <div className="flex gap-8 md:gap-16 items-center pointer-events-auto animate-in zoom-in-90 duration-300">
            <button
              onClick={() => { if (videoRef.current) videoRef.current.currentTime -= 10; }}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); if (videoRef.current) videoRef.current.currentTime -= 10; } }}
              tabIndex={0}
              className="w-16 h-16 md:w-24 md:h-24 rounded-full glass border border-white/10 flex items-center justify-center hover:bg-white/10 transition-all focus:outline-none focus:ring-2 focus:ring-[#E50914] focus:bg-white/10"
              title="Retroceder 10s"
            >
              <Rewind className="w-6 h-6" />
            </button>
            <button
              onClick={() => {
                if (videoRef.current) {
                  videoRef.current.paused ? videoRef.current.play() : videoRef.current.pause();
                }
              }}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); if (videoRef.current) { videoRef.current.paused ? videoRef.current.play() : videoRef.current.pause(); } } }}
              tabIndex={0}
              className="w-24 h-24 md:w-36 md:h-36 rounded-full glass border border-white/30 flex items-center justify-center hover:scale-110 active:scale-95 transition-all bg-white/5 focus:outline-none focus:ring-4 focus:ring-[#E50914] focus:scale-110"
              title={isPlaying ? 'Pausar' : 'Reproduzir'}
            >
              {isPlaying ? (
                <Pause className="w-10 h-10 text-red-600" />
              ) : (
                <Play className="w-10 h-10 text-red-600 ml-1" fill="currentColor" />
              )}
            </button>
            <button
              onClick={() => { if (videoRef.current) videoRef.current.currentTime += 10; }}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); if (videoRef.current) videoRef.current.currentTime += 10; } }}
              tabIndex={0}
              className="w-16 h-16 md:w-24 md:h-24 rounded-full glass border border-white/10 flex items-center justify-center hover:bg-white/10 transition-all focus:outline-none focus:ring-2 focus:ring-[#E50914] focus:bg-white/10"
              title="Avançar 10s"
            >
              <FastForward className="w-6 h-6" />
            </button>
          </div>
        </div>
      )}

      {/* ═══ BOTTOM BAR — Progress + Controls ═══ */}
      <div className={`absolute bottom-0 inset-x-0 transition-all duration-700 z-10 ${showControls ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8 pointer-events-none'}`}>
        {/* Progress Bar Scrubber */}
        {(alternativeUrl || media.stream_url) && !(alternativeUrl || media.stream_url || '').includes('youtube') && !streamError && (
          <div className="px-8 md:px-12 mb-2">
            <div
              className="relative h-2 bg-white/10 rounded-full cursor-pointer group hover:h-3 transition-all"
              onClick={handleSeek}
            >
              <div
                className="absolute inset-y-0 left-0 bg-red-600 rounded-full transition-all"
                style={{ width: `${progressPct}%` }}
              />
              <div
                className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-red-600 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ left: `calc(${progressPct}% - 8px)` }}
              />
            </div>
            <div className="flex justify-between mt-1.5 text-[11px] text-white/40 font-mono">
              <span>{formatTime(currentTime)}</span>
              <span>-{formatTime(Math.max(0, duration - currentTime))}</span>
            </div>
          </div>
        )}

        {/* Bottom Controls */}
        <div className="px-8 md:px-12 pb-8 md:pb-12">
          <div className="glass p-4 md:p-6 rounded-4xl md:rounded-5xl border border-white/10 pointer-events-auto flex justify-between items-center shadow-2xl">
            <div className="flex gap-4 md:gap-8 items-center">
              <button
                onClick={toggleMute}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); toggleMute(); } }}
                tabIndex={0}
                className="text-white/40 hover:text-red-500 transition-colors focus:outline-none focus:text-red-500 focus:ring-2 focus:ring-[#E50914] rounded-lg"
                title={isMuted ? 'Ativar som' : 'Mudo'}
              >
                {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
              </button>
              <div className="hidden md:flex items-center w-24">
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={isMuted ? 0 : volume}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value);
                    setVolume(v);
                    if (videoRef.current) {
                      videoRef.current.volume = v;
                      videoRef.current.muted = v === 0;
                      setIsMuted(v === 0);
                    }
                  }}
                  aria-label="Volume"
                  className="w-full h-1 bg-white/20 rounded-full appearance-none cursor-pointer accent-red-600 focus:outline-none focus:ring-2 focus:ring-[#E50914] focus:ring-offset-1 focus:ring-offset-black"
                />
              </div>
              <SubtitleManager
                tracks={subtitleTracks}
                activeTrackId={activeSubtitleId}
                style={subtitleStyle}
                onSelectTrack={selectSubtitle}
                onLoadFile={loadSubtitleFile}
                onRemoveTrack={removeSubtitleTrack}
                onUpdateStyle={updateSubtitleStyle}
                onResetStyle={resetSubtitleStyle}
                isOpen={showSubtitleMenu}
                onToggle={() => setShowSubtitleMenu(prev => !prev)}
              />

              {/* ═══ QUALITY SELECTOR COMPONENT ═══ */}
              <QualitySelector
                qualityLevels={qualityLevels}
                currentQuality={currentQuality}
                isAutoQuality={isAutoQuality}
                streamStats={streamStats}
                hlsManager={hlsManagerRef.current}
                onQualityChange={(level, isAuto) => {
                  setIsAutoQuality(isAuto);
                  if (level) setCurrentQuality(level);
                }}
              />
            </div>

            {/* ═══ STREAM INFO BADGE (HLS) ═══ */}
            <div className="flex items-center gap-3">
              {/* Network speed indicator */}
              {streamStats && streamStats.networkSpeed > 0 && (
                <div className="hidden md:flex items-center gap-1.5 text-[10px] font-mono">
                  <Wifi className={`w-3.5 h-3.5 ${
                    streamStats.networkSpeed >= 10 ? 'text-green-400/60' :
                    streamStats.networkSpeed >= 5 ? 'text-yellow-400/60' :
                    streamStats.networkSpeed >= 2 ? 'text-orange-400/60' : 'text-red-400/60'
                  }`} />
                  <span className="text-white/30">{streamStats.networkSpeed.toFixed(1)}</span>
                </div>
              )}

              {/* Current quality badge */}
              {currentQuality && (
                <span className="text-white/20 text-[10px] font-bold uppercase tracking-widest hidden md:block">
                  {currentQuality.height}p
                </span>
              )}

              <span className="text-white/30 text-xs font-bold uppercase tracking-widest hidden md:block">
                {media.title}
              </span>
            </div>

            <div className="flex gap-4 items-center">
              {nextEpisode && onPlayNext && (
                <button
                  onClick={onPlayNext}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); onPlayNext?.(); } }}
                  tabIndex={0}
                  className="text-white/40 hover:text-red-500 transition-colors flex items-center gap-2 focus:outline-none focus:text-red-500 focus:ring-2 focus:ring-[#E50914] rounded-lg"
                  title="Próximo Episódio"
                >
                  <SkipForward className="w-5 h-5" />
                  <span className="text-xs hidden md:inline">Próximo</span>
                </button>
              )}
              <button
                onClick={toggleFullscreen}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); toggleFullscreen(); } }}
                tabIndex={0}
                className="text-white/40 hover:text-red-500 transition-colors focus:outline-none focus:text-red-500 focus:ring-2 focus:ring-[#E50914] rounded-lg"
                title="Tela Cheia (F)"
              >
                <Maximize className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Player;
