import React, { useEffect, useRef, useState } from 'react';
import { isNativePlatform, playNative } from '../services/nativePlayerService';

interface LiveTVVideoProps {
  streamUrl: string;
  channelName: string;
  isYouTube?: boolean;
  onBack?: () => void;
}

/**
 * Player de vídeo para LiveTV (Canais).
 * - Sem vinheta (zapping ágil).
 * - Capacitor (Fire Stick/TV Box): ExoPlayer nativo. Fallback playNative se .m3u8 falhar no WebView.
 * - Browser: <video> HTML nativo (sem HLS.js).
 * - Áudio: desmutado após play (TV Box).
 * - object-contain para proporção correta + spinner de carregamento.
 */
const LiveTVVideo: React.FC<LiveTVVideoProps> = ({ streamUrl, channelName, isYouTube }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const nativeLaunchedRef = useRef<string | null>(null);
  const [muted, setMuted] = useState(true);
  const [loading, setLoading] = useState(true);

  // ExoPlayer nativo para Capacitor (Fire Stick/TV Box) — WebView não suporta m3u8 bem
  useEffect(() => {
    if (!streamUrl || isYouTube) return;
    if (!isNativePlatform()) return;
    if (nativeLaunchedRef.current === streamUrl) return;
    nativeLaunchedRef.current = streamUrl;

    console.log('[LiveTV] Abrindo ExoPlayer nativo (live):', streamUrl.substring(0, 80));
    playNative(streamUrl, channelName, 0, true).then(() => {
      console.log('[LiveTV] ExoPlayer fechou');
      nativeLaunchedRef.current = null;
    });
  }, [streamUrl, channelName, isYouTube]);

  // <video> HTML nativo para browser (sem HLS.js)
  useEffect(() => {
    if (isNativePlatform()) return;
    const video = videoRef.current;
    if (!video || !streamUrl || isYouTube) return;

    setMuted(true);
    setLoading(true);
    console.log('[LiveTV] Stream HTML nativo:', streamUrl.substring(0, 80));
    if (streamUrl.includes('supabase')) video.crossOrigin = 'anonymous';
    video.src = streamUrl;
    video.load();
    video.play().then(() => {
      setMuted(false);
      setLoading(false);
    }).catch((err) => {
      console.warn('[LiveTV] Erro playback:', err);
      setLoading(false);
    });

    return () => {
      video.pause();
      video.removeAttribute('src');
      video.load();
    };
  }, [streamUrl, isYouTube]);

  if (isYouTube) return null;

  if (isNativePlatform()) {
    return (
      <div className="w-full h-full bg-black flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 border-4 border-red-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-white/40 text-xs uppercase tracking-widest">Abrindo player...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full bg-black flex items-center justify-center">
      {loading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 z-10">
          <div className="w-12 h-12 border-4 border-red-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-white/40 text-xs uppercase tracking-widest">Carregando...</p>
        </div>
      )}
      <video
        ref={videoRef}
        key={streamUrl}
        autoPlay
        playsInline
        muted={muted}
        preload="auto"
        controls={false}
        className="w-full h-full object-contain"
        crossOrigin={streamUrl.includes('supabase') ? 'anonymous' : undefined}
        onLoadedData={() => setLoading(false)}
        onError={() => {
          console.warn('[LiveTV] Erro no stream:', streamUrl?.substring(0, 50));
          setLoading(false);
        }}
      />
    </div>
  );
};

export default LiveTVVideo;
