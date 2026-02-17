/**
 * Player 100% HTML5 — Filmes e Séries
 * - Vinheta em filmes/séries
 * - ExoPlayer nativo no Capacitor (Fire Stick/TV Box)
 * - Tag <video> nativa no browser (MP4, WebM, M3U8 nativo)
 * - Zero HLS.js
 * - Progresso salvo a cada 10s no Supabase
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Media } from '../types';
import { VideoOff, X, Rewind, Pause, Play, FastForward, Volume2, VolumeX, Maximize, SkipForward } from 'lucide-react';
import { getTrailer } from '../services/tmdb';
import { userService } from '../services/userService';
import { getStreamUrl } from '../services/streamService';
import { useSpatialNav } from '../hooks/useSpatialNavigation';
import { isNativePlatform, playNative } from '../services/nativePlayerService';

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
  const { setEnabled } = useSpatialNav();
  useEffect(() => {
    setEnabled(false);
    return () => setEnabled(true);
  }, [setEnabled]);

  // ═══ VINHETA — antes de cada vídeo (6s), enquanto conteúdo carrega em paralelo ═══
  const [showIntro, setShowIntro] = useState(true);
  const introVideoRef = useRef<HTMLVideoElement | null>(null);

  // ═══ EXOPLAYER NATIVO — Fire Stick / TV Box ═══
  const nativeLaunchedRef = useRef(false);
  useEffect(() => {
    if (nativeLaunchedRef.current || showIntro) return;
    const url = media.stream_url;
    if (!url || url.includes('youtube') || url.includes('youtu.be')) return;
    if (!isNativePlatform()) return;

    nativeLaunchedRef.current = true;
    const tmdbId = media.tmdb_id || media.id;
    userService.getProgress(tmdbId).then(savedSec => {
      const startPos = savedSec > 10 ? savedSec : 0;
      playNative(url, media.title, startPos).then(finalPos => {
        if (finalPos > 10 && tmdbId) userService.saveProgress(tmdbId, media.type, finalPos).catch(() => {});
        onClose();
      });
    }).catch(() => {
      playNative(url, media.title, 0).then(() => onClose());
    });
  }, [showIntro, media.stream_url, media.title, media.tmdb_id, media.id, media.type, onClose]);

  const [showControls, setShowControls] = useState(true);
  const [fallbackTrailer, setFallbackTrailer] = useState<string | null>(null);
  const [loadingFallback, setLoadingFallback] = useState(false);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [savedProgress, setSavedProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showResumeToast, setShowResumeToast] = useState(false);
  const [showNextEpisode, setShowNextEpisode] = useState(false);
  const [nextEpisodeCountdown, setNextEpisodeCountdown] = useState(10);
  const [volume, setVolume] = useState(1);
  const [streamError, setStreamError] = useState(false);
  const [retryToken, setRetryToken] = useState(0);
  const [alternativeUrl, setAlternativeUrl] = useState<string | null>(null);
  const triedAlternative = useRef(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const retryButtonRef = useRef<HTMLButtonElement | null>(null);
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const controlsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nextEpTimeoutRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hasAppliedResume = useRef(false);

  const tmdbId = media.tmdb_id || media.id;
  const activeUrl = alternativeUrl || media.stream_url || null;

  // ═══ RESTORE progresso ═══
  useEffect(() => {
    if (tmdbId) userService.getProgress(tmdbId).then(s => { if (s > 10) setSavedProgress(s); }).catch(() => {});
  }, [tmdbId]);

  // ═══ AUTO-SAVE a cada 10s ═══
  useEffect(() => {
    if (!activeUrl || !tmdbId) return;
    progressIntervalRef.current = setInterval(() => {
      const v = videoRef.current;
      if (!v || v.paused) return;
      const ct = v.currentTime, dur = v.duration;
      const pct = dur > 0 ? ct / dur : 0;
      if (ct > 10 && pct < 0.95) userService.saveProgress(tmdbId, media.type, ct, isFinite(dur) ? dur : undefined).catch(() => {});
    }, 10000);
    return () => {
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
      const v = videoRef.current;
      if (v && tmdbId) {
        const ft = v.currentTime, dur = v.duration;
        const pct = dur > 0 ? ft / dur : 0;
        if (ft > 10 && pct < 0.95) userService.saveProgress(tmdbId, media.type, ft, isFinite(dur) ? dur : undefined);
      }
    };
  }, [activeUrl, tmdbId, media.type]);

  // ═══ FALLBACK trailer ═══
  useEffect(() => {
    const needsFallback = (!activeUrl || streamError) && media.tmdb_id && media.tmdb_id > 0 && !fallbackTrailer;
    if (needsFallback) {
      setLoadingFallback(true);
      getTrailer(media.tmdb_id, media.type).then(k => setFallbackTrailer(k || null)).catch(() => setFallbackTrailer(null)).finally(() => setLoadingFallback(false));
    }
  }, [activeUrl, streamError, media.tmdb_id, media.type, fallbackTrailer]);

  // YouTube → buscar URL real
  const youtubeCheckRef = useRef(false);
  useEffect(() => {
    const url = media.stream_url;
    if (!url || !url.includes('youtube') && !url.includes('youtu.be') || youtubeCheckRef.current) return;
    youtubeCheckRef.current = true;
    getStreamUrl(media.title, media.type, media.tmdb_id).then(alt => {
      if (alt && !alt.includes('youtube')) { setAlternativeUrl(alt); setStreamError(false); }
      else { setStreamError(true); setIsPlaying(false); }
    }).catch(() => { setStreamError(true); setIsPlaying(false); }).finally(() => setLoadingFallback(false));
  }, [media.stream_url, media.title, media.type, media.tmdb_id]);

  const skipIntro = useCallback(() => {
    setShowIntro(false);
    if (introVideoRef.current) { introVideoRef.current.pause(); introVideoRef.current.src = ''; }
  }, []);

  useEffect(() => {
    if (!showIntro) return;
    const h = (e: KeyboardEvent) => { if (['Enter', ' ', 'Escape'].includes(e.key)) { e.preventDefault(); skipIntro(); } };
    window.addEventListener('keydown', h);
    const t = setTimeout(skipIntro, 6000); // vinheta 6s — conteúdo carrega em paralelo
    return () => { window.removeEventListener('keydown', h); clearTimeout(t); };
  }, [showIntro, skipIntro]);

  // ═══ CONTROLES — auto-hide 3s ═══
  const resetControls = useCallback(() => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => setShowControls(false), 3000);
  }, []);

  useEffect(() => {
    window.addEventListener('mousemove', resetControls);
    window.addEventListener('keydown', resetControls);
    resetControls();
    return () => {
      window.removeEventListener('mousemove', resetControls);
      window.removeEventListener('keydown', resetControls);
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    };
  }, [resetControls]);

  const cancelNextEpisode = useCallback(() => {
    if (nextEpTimeoutRef.current) clearInterval(nextEpTimeoutRef.current);
    setShowNextEpisode(false);
  }, []);

  const handleClose = useCallback(() => {
    const v = videoRef.current;
    if (v && tmdbId) {
      const ft = v.currentTime, dur = v.duration;
      const pct = dur > 0 ? ft / dur : 0;
      if (ft > 10 && pct < 0.95) userService.saveProgress(tmdbId, media.type, ft, isFinite(dur) ? dur : undefined);
    }
    if (v) { v.pause(); v.removeAttribute('src'); v.load(); }
    onClose();
  }, [media, tmdbId, onClose]);

  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return;
    document.fullscreenElement ? document.exitFullscreen() : containerRef.current.requestFullscreen().catch(() => {});
  }, []);

  const toggleMute = useCallback(() => {
    if (videoRef.current) {
      videoRef.current.muted = !videoRef.current.muted;
      setIsMuted(videoRef.current.muted);
    }
  }, []);

  const adjustVolume = useCallback((d: number) => {
    if (videoRef.current) {
      const n = Math.max(0, Math.min(1, videoRef.current.volume + d));
      videoRef.current.volume = n;
      setVolume(n);
      setIsMuted(n === 0);
    }
  }, []);

  const handleVideoEnded = useCallback(() => {
    setIsPlaying(false);
    if (media.type === 'series' && nextEpisode && onPlayNext) onPlayNext();
    else handleClose();
  }, [nextEpisode, onPlayNext, media.type, handleClose]);

  const handleVideoError = useCallback(async () => {
    if (!triedAlternative.current && media.title) {
      triedAlternative.current = true;
      try {
        const alt = await getStreamUrl(media.title, media.type, media.tmdb_id);
        if (alt && alt !== media.stream_url && alt !== alternativeUrl) {
          setAlternativeUrl(alt);
          setStreamError(false);
          setRetryToken(t => t + 1);
          return;
        }
      } catch {}
    }
    setStreamError(true);
    setIsPlaying(false);
  }, [media, alternativeUrl]);

  // ═══ KEYBOARD ═══
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Backspace') { e.preventDefault(); handleClose(); return; }
      const v = videoRef.current;
      if (!v) return;
      switch (e.key) {
        case 'Enter':
        case ' ':
          e.preventDefault();
          if (showNextEpisode && nextEpisode && onPlayNext) { cancelNextEpisode(); onPlayNext(); return; }
          v.paused ? v.play() : v.pause();
          break;
        case 'ArrowLeft': e.preventDefault(); v.currentTime = Math.max(0, v.currentTime - 10); break;
        case 'ArrowRight': e.preventDefault(); v.currentTime = Math.min(v.duration, v.currentTime + 10); break;
        case 'f': e.preventDefault(); toggleFullscreen(); break;
        case 'm': e.preventDefault(); toggleMute(); break;
        case 'ArrowUp': e.preventDefault(); adjustVolume(0.1); break;
        case 'ArrowDown': e.preventDefault(); adjustVolume(-0.1); break;
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [handleClose, toggleFullscreen, toggleMute, adjustVolume, showNextEpisode, nextEpisode, onPlayNext, cancelNextEpisode]);

  const handleTimeUpdate = useCallback(() => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
      setDuration(videoRef.current.duration || 0);
    }
  }, []);

  const handleCanPlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (savedProgress > 10 && !hasAppliedResume.current) {
      hasAppliedResume.current = true;
      v.currentTime = savedProgress;
      setShowResumeToast(true);
      setTimeout(() => setShowResumeToast(false), 4000);
    }
    v.play().then(() => { v.muted = false; setIsMuted(false); setVolume(v.volume); }).catch(() => {});
  }, [savedProgress]);

  const handleSeek = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!videoRef.current || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    videoRef.current.currentTime = ((e.clientX - rect.left) / rect.width) * duration;
  }, [duration]);

  // ═══ VIDEO SOURCE — 100% nativo, sem HLS.js ═══
  useEffect(() => {
    const v = videoRef.current;
    const url = activeUrl;
    if (!v || !url || url.includes('youtube')) return;

    v.src = url;
    if (url.includes('supabase')) v.crossOrigin = 'anonymous';
    v.load();
    v.play().then(() => { v.muted = false; setIsMuted(false); setVolume(v.volume); }).catch(() => {});

    return () => { v.pause(); v.removeAttribute('src'); v.load(); };
  }, [activeUrl, retryToken]);

  useEffect(() => {
    if (showIntro) return;
    const v = videoRef.current;
    if (v && activeUrl && !activeUrl.includes('youtube')) v.play().then(() => { v.muted = false; setIsMuted(false); }).catch(() => {});
  }, [showIntro, activeUrl]);

  const formatTime = (s: number) => {
    if (!isFinite(s) || s < 0) return '0:00';
    const m = Math.floor(s / 60), sec = Math.floor(s % 60);
    return `${m}:${String(sec).padStart(2, '0')}`;
  };
  const progressPct = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div ref={containerRef} className="fixed inset-0 w-screen h-screen bg-black z-[9999] flex items-center justify-center overflow-hidden group" onMouseMove={resetControls} onClick={resetControls}>
      {/* VINHETA — 6s, carregada da raiz (/vinheta.mp4) enquanto conteúdo principal baixa em paralelo */}
      {showIntro && (
        <div className="absolute inset-0 z-[9999] bg-black flex items-center justify-center">
          <video ref={introVideoRef} src="/vinheta.mp4" className="w-full h-full object-contain" autoPlay muted playsInline preload="auto" onEnded={skipIntro} onError={skipIntro} />
          <button onClick={skipIntro} className="absolute bottom-8 right-8 px-5 py-2 bg-white/10 backdrop-blur-md border border-white/20 text-white text-xs uppercase tracking-[2px] font-semibold rounded-full hover:bg-white/20">Pular ›</button>
        </div>
      )}

      {/* VIDEO */}
      {activeUrl && !streamError && !activeUrl.includes('youtube') ? (
        <video
          key={`player-${retryToken}`}
          ref={videoRef}
          className="w-full h-full object-contain"
          autoPlay
          muted
          playsInline
          preload="auto"
          crossOrigin={activeUrl.includes('supabase') ? 'anonymous' : undefined}
          onCanPlay={handleCanPlay}
          onTimeUpdate={handleTimeUpdate}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onEnded={handleVideoEnded}
          onError={handleVideoError}
        />
      ) : streamError ? (
        <div className="absolute inset-0 flex items-center justify-center bg-black">
          <div className="z-10 text-center flex flex-col items-center gap-4">
            <VideoOff className="w-16 h-16 text-white/60" />
            <p className="text-2xl text-white font-black uppercase tracking-widest">Erro de Conexão</p>
            <button ref={retryButtonRef} onClick={() => { setStreamError(false); triedAlternative.current = false; setRetryToken(t => t + 1); setIsPlaying(true); }} tabIndex={0} className="px-6 py-3 bg-red-600 hover:bg-red-500 text-white font-black rounded-xl">Tentar Novamente</button>
          </div>
        </div>
      ) : loadingFallback ? (
        <div className="absolute inset-0 flex items-center justify-center bg-black">
          <div className="w-12 h-12 border-4 border-red-600 border-t-transparent rounded-full animate-spin" />
          <p className="absolute mt-20 text-white/40 text-xs uppercase tracking-widest">Buscando stream...</p>
        </div>
      ) : fallbackTrailer ? (
        <div className="absolute inset-0 w-full h-full bg-black">
          <iframe src={`https://www.youtube.com/embed/${fallbackTrailer}?autoplay=1&rel=0&modestbranding=1`} className="w-full h-full border-0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen" title={`${media.title} - Trailer`} />
          <div className="absolute top-20 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
            <div className="bg-red-600/90 text-white text-[10px] uppercase tracking-[0.3em] font-bold px-4 py-1.5 rounded-full">Trailer Oficial</div>
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

      {showResumeToast && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-50">
          <div className="bg-white/10 backdrop-blur-2xl rounded-2xl px-6 py-3 border border-white/20">
            <p className="text-sm text-white/90 flex items-center gap-2"><Play size={14} fill="white" className="text-green-400" />Continuando de <strong className="text-green-400">{formatTime(savedProgress)}</strong></p>
          </div>
        </div>
      )}

      {/* TOP BAR */}
      <div className={`absolute top-0 inset-x-0 p-8 flex justify-between items-start transition-all duration-700 z-10 ${showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'} bg-gradient-to-b from-black/80 to-transparent`}>
        <div className="flex flex-col gap-2">
          <span className="text-red-600 uppercase tracking-[0.5em] font-black text-[10px]">Redflix Player</span>
          <h2 className="text-2xl font-black tracking-tighter">{media.title}</h2>
        </div>
        <button onClick={handleClose} tabIndex={0} className="w-12 h-12 rounded-full glass border border-white/20 flex items-center justify-center hover:bg-red-600 transition-all"><X className="w-6 h-6" /></button>
      </div>

      {/* CENTER CONTROLS */}
      {showControls && activeUrl && (
        <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
          <div className="flex gap-8 items-center pointer-events-auto">
            <button onClick={() => videoRef.current && (videoRef.current.currentTime -= 10)} tabIndex={0} className="w-16 h-16 rounded-full glass border border-white/10 flex items-center justify-center hover:bg-white/10"><Rewind className="w-6 h-6" /></button>
            <button onClick={() => videoRef.current && (videoRef.current.paused ? videoRef.current.play() : videoRef.current.pause())} tabIndex={0} className="w-24 h-24 rounded-full glass border border-white/30 flex items-center justify-center hover:scale-110 bg-white/5">
              {isPlaying ? <Pause className="w-10 h-10 text-red-600" /> : <Play className="w-10 h-10 text-red-600 ml-1" fill="currentColor" />}
            </button>
            <button onClick={() => videoRef.current && (videoRef.current.currentTime += 10)} tabIndex={0} className="w-16 h-16 rounded-full glass border border-white/10 flex items-center justify-center hover:bg-white/10"><FastForward className="w-6 h-6" /></button>
          </div>
        </div>
      )}

      {/* BOTTOM BAR */}
      <div className={`absolute bottom-0 inset-x-0 transition-all duration-700 z-10 ${showControls ? 'opacity-100' : 'opacity-0 translate-y-8 pointer-events-none'}`}>
        {activeUrl && !activeUrl.includes('youtube') && !streamError && (
          <div className="px-8 mb-2">
            <div className="relative h-2 bg-white/10 rounded-full cursor-pointer group hover:h-3" onClick={handleSeek}>
              <div className="absolute inset-y-0 left-0 bg-red-600 rounded-full transition-all" style={{ width: `${progressPct}%` }} />
            </div>
            <div className="flex justify-between mt-1.5 text-[11px] text-white/40 font-mono">
              <span>{formatTime(currentTime)}</span>
              <span>-{formatTime(Math.max(0, duration - currentTime))}</span>
            </div>
          </div>
        )}
        <div className="px-8 pb-8">
          <div className="glass p-4 rounded-3xl border border-white/10 flex justify-between items-center">
            <div className="flex gap-4 items-center">
              <button onClick={toggleMute} tabIndex={0} className="text-white/40 hover:text-red-500">{isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}</button>
              <input type="range" min="0" max="1" step="0.05" value={isMuted ? 0 : volume} onChange={e => { const v = parseFloat(e.target.value); setVolume(v); if (videoRef.current) { videoRef.current.volume = v; videoRef.current.muted = v === 0; setIsMuted(v === 0); } }} className="w-24 h-1 bg-white/20 rounded-full accent-red-600" />
            </div>
            <div className="flex gap-4">
              {nextEpisode && onPlayNext && <button onClick={onPlayNext} tabIndex={0} className="text-white/40 hover:text-red-500 flex items-center gap-2"><SkipForward className="w-5 h-5" />Próximo</button>}
              <button onClick={toggleFullscreen} tabIndex={0} className="text-white/40 hover:text-red-500"><Maximize className="w-5 h-5" /></button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Player;
