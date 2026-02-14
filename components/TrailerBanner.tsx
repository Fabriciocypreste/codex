import React, { useState, useEffect } from 'react';
import { Media } from '../types';
import { getMediaDetailsByID } from '../services/tmdb';
import { Play, Info } from 'lucide-react';

interface TrailerBannerProps {
  media: Media;
  onSelect: (media: Media) => void;
  title: string;
}

const TrailerBanner: React.FC<TrailerBannerProps> = ({ media, onSelect, title }) => {
  const [trailerKey, setTrailerKey] = useState<string | undefined>();
  const [logoUrl, setLogoUrl] = useState<string | undefined>();
  const [showVideo, setShowVideo] = useState(false);

  const [backdropUrl, setBackdropUrl] = useState<string | undefined>(media.backdrop);

  useEffect(() => {
    const fetchData = async () => {
      let newTrailer = media.trailer_key;
      let newLogo = media.logo_url;
      let newBackdrop = media.backdrop;

      // Se faltar qualquer dado essencial e tmdb_id é válido, buscamos detalhes completos no TMDB
      const validTmdbId = media.tmdb_id && Number(media.tmdb_id) > 0;
      if (validTmdbId && (!newTrailer || !newLogo || !newBackdrop || !newBackdrop.startsWith('http'))) {
        const details = await getMediaDetailsByID(media.tmdb_id, media.type);
        if (details) {
          if (!newTrailer && details.trailer) newTrailer = details.trailer;
          if (!newLogo && details.logo) newLogo = details.logo;
          // Prioriza backdrop do TMDB se o atual nao for HTTP (local/invalido) ou se quisermos forçar
          if (details.backdrop) newBackdrop = details.backdrop;
        }
      }

      setTrailerKey(newTrailer);
      setLogoUrl(newLogo);
      setBackdropUrl(newBackdrop);

      if (newTrailer) {
        const timer = setTimeout(() => setShowVideo(true), 20000);
        return () => clearTimeout(timer);
      }
    };
    fetchData();
  }, [media]);

  return (
    <section className="relative w-full h-[100vh] min-h-[600px] flex items-end group overflow-hidden p-0 m-0">
      {/* Background Image */}
      <div className={`absolute inset-0 transition-opacity duration-1000 ${showVideo ? 'opacity-0' : 'opacity-100'}`}>
        <img
          src={backdropUrl || media.backdrop}
          alt={media.title}
          className="w-full h-full object-cover brightness-[0.6] scale-105 group-hover:scale-110 transition-transform duration-[10s]"
        />
      </div>

      {/* Video Trailer */}
      {showVideo && trailerKey && (
        <div className="absolute inset-0 z-0 overflow-hidden">
          <iframe
            title={`Trailer de ${media.title}`}
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 min-w-full min-h-full w-auto h-auto aspect-video object-cover pointer-events-none scale-[1.3]"
            src={`https://www.youtube.com/embed/${trailerKey}?autoplay=1&mute=1&controls=0&loop=1&playlist=${trailerKey}&modestbranding=1&rel=0`}
            frameBorder="0"
            allow="autoplay; encrypted-media"
          />
          <div className="absolute inset-0 bg-black/40" />
        </div>
      )}

      {/* Gradient Mask */}
      <div className="absolute inset-0 bg-linear-to-t from-black via-black/30 to-transparent opacity-90 z-10" />

      <div className="relative z-20 flex flex-col justify-end h-full w-full max-w-full px-0 pb-32 md:pb-40" data-nav-row={1}>
        <div className="mb-2 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full glass border-white/20 text-[8px] font-bold uppercase tracking-widest">
          <span className="w-1 h-1 rounded-full bg-[#E50914] animate-pulse" />
          {title}
        </div>

        {logoUrl ? (
          <img
            src={logoUrl}
            alt={media.title}
            className="max-h-12 md:max-h-16 w-auto object-contain mb-3 drop-shadow-[0_0_20px_rgba(0,0,0,0.5)]"
          />
        ) : (
          <h1 className="text-5xl md:text-7xl font-black mb-6 drop-shadow-2xl leading-tight">{media.title}</h1>
        )}
        <p className="text-lg md:text-2xl text-white/70 mb-8 max-w-2xl">
          {media.description}
        </p>
        <div className="flex gap-4">
          <button
            data-nav-item
            data-nav-col={0}
            tabIndex={0}
            onClick={() => onSelect(media)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); onSelect(media); }}}
            className="px-8 py-3 rounded-full bg-[#E50914] text-white text-lg font-bold flex items-center gap-2 hover:bg-white hover:text-[#E50914] transition-all scale-100 active:scale-95 shadow-xl outline-none focus:ring-2 focus:ring-[#E50914] focus:scale-105"
          >
            <Play className="w-5 h-5" /> Assistir
          </button>
          <button
            data-nav-item
            data-nav-col={1}
            tabIndex={0}
            onClick={() => onSelect(media)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); onSelect(media); }}}
            className="px-8 py-3 rounded-full bg-white/10 border border-white/20 text-white text-lg font-bold flex items-center gap-2 hover:bg-white hover:text-[#E50914] transition-all scale-100 active:scale-95 shadow-xl outline-none focus:ring-2 focus:ring-[#E50914] focus:scale-105"
          >
            <Info className="w-5 h-5" /> Minha Lista
          </button>
        </div>
      </div>
    </section>
  );
};

export default TrailerBanner;
