import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  fetchSeriesDetail,
  fetchMovieDetail,
  fetchSeriesCredits,
  fetchSimilarSeries,
  getImageUrl,
  fetchSeasonEpisodes,
  fetchSeriesImages,
  fetchSeriesVideos,
  fetchSeriesProviders,
  fetchPersonDetail,
  searchMulti
} from '../services/tmdb';
import { SeriesDetail, CastMember, CrewMember, SimilarSeries, Episode, Video, WatchProvider, PersonDetail, Media } from '../types';
import GlassPanel from '../components/GlassPanel';
import { Home, Film, Tv, Radio, Plus, Smile, Search } from 'lucide-react';
import { playBackSound, playSelectSound } from '../utils/soundEffects';

// --- UI Components Local Helper ---

const RedXLogo: React.FC<{ className?: string }> = ({ className = "h-10" }) => (
  <div className={`flex items-center gap-1 font-black italic tracking-tighter cursor-default ${className}`}>
    <span className="text-white">RED</span>
    <span className="text-red-600 red-text-glow">X</span>
  </div>
);

const useTiltEffect = (intensity = 15) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!containerRef.current || !cardRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const rotateX = (rect.height / 2 - y) / intensity;
    const rotateY = (x - rect.width / 2) / intensity;

    cardRef.current.style.transform = `rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(1.05)`;
    containerRef.current.style.setProperty('--x', `${x}px`);
    containerRef.current.style.setProperty('--y', `${y}px`);
  };

  const handleMouseLeave = () => {
    if (!cardRef.current) return;
    cardRef.current.style.transform = `rotateX(0deg) rotateY(0deg) scale(1)`;
  };

  return { containerRef, cardRef, handleMouseMove, handleMouseLeave };
};

const TiltCard: React.FC<{ children: React.ReactNode; className?: string; innerClassName?: string; intensity?: number; onClick?: () => void }> = ({ children, className = '', innerClassName = '', intensity = 15, onClick }) => {
  const { containerRef, cardRef, handleMouseMove, handleMouseLeave } = useTiltEffect(intensity);
  return (
    <div ref={containerRef} onMouseMove={handleMouseMove} onMouseLeave={handleMouseLeave} onClick={onClick} className={`tilt-container relative ${className}`}>
      <div ref={cardRef} className={`tilt-card relative h-full transition-transform duration-300 ease-out ${innerClassName}`}>
        <div className="tilt-shine"></div>
        {children}
      </div>
    </div>
  );
};

const VisionKeyboard: React.FC<{ onKeyClick: (key: string) => void; onBackspace: () => void }> = ({ onKeyClick, onBackspace }) => {
  const keys = [
    ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
    ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
    ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', 'Ç'],
    ['Z', 'X', 'C', 'V', 'B', 'N', 'M', ',', '.', '?']
  ];

  return (
    <div className="space-y-2 md:space-y-4 p-4 md:p-8 bg-white/5 rounded-[2rem] md:rounded-[3rem] backdrop-blur-xl shadow-2xl overflow-x-auto no-scrollbar w-full max-w-full border border-white/10">
      {keys.map((row, i) => (
        <div key={i} className="flex justify-start md:justify-center gap-2 md:gap-4 min-w-max md:min-w-0">
          {row.map(key => (
            <button key={key} onClick={() => onKeyClick(key)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); onKeyClick(key); } }} tabIndex={0} className="keyboard-key shrink-0 !w-10 !h-10 md:!w-[60px] md:!h-[60px] !text-sm md:!text-xl focus:outline-none focus:ring-2 focus:ring-[#E50914]">
              {key}
            </button>
          ))}
        </div>
      ))}
      <div className="flex justify-center gap-2 md:gap-4 pt-2 md:pt-4">
        <button onClick={() => onKeyClick(' ')} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); onKeyClick(' '); } }} tabIndex={0} className="keyboard-key !w-[160px] md:!w-[300px] !h-10 md:!h-[60px] !rounded-full !text-xs md:!text-sm focus:outline-none focus:ring-2 focus:ring-[#E50914]">ESPAÇO</button>
        <button onClick={onBackspace} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); onBackspace(); } }} tabIndex={0} className="keyboard-key !w-[80px] md:!w-[140px] !h-10 md:!h-[60px] !rounded-full text-red-500 !text-xs md:!text-sm focus:outline-none focus:ring-2 focus:ring-[#E50914]">APAGAR</button>
      </div>
    </div>
  );
};

const CastSkeleton: React.FC = () => (
  <div className="flex gap-6 md:gap-10 overflow-hidden pb-12 px-2">
    {[1, 2, 3, 4, 5, 6].map(i => (
      <div key={i} className="flex-shrink-0 w-32 md:w-40 space-y-4 animate-pulse">
        <div className="w-32 h-44 md:w-40 md:h-56 rounded-[2rem] md:rounded-[2.5rem] bg-white/5 border border-white/10" />
        <div className="space-y-2">
          <div className="h-4 bg-white/5 rounded w-3/4 mx-auto" />
          <div className="h-2 bg-white/5 rounded w-1/2 mx-auto" />
        </div>
      </div>
    ))}
  </div>
);

const ActorModal: React.FC<{ person: PersonDetail | null; onClose: () => void; isLoading: boolean }> = ({ person, onClose, isLoading }) => {
  if (!isLoading && !person) return null;

  return (
    <div className={`fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8 transition-all duration-500 ${person || isLoading ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
      <div className="absolute inset-0 bg-black/90 backdrop-blur-2xl" onClick={onClose} />
      <GlassPanel className="relative w-full max-w-5xl !p-8 md:!p-16 !rounded-[3rem] md:!rounded-[4rem] border border-white/10 shadow-3xl overflow-hidden max-h-[90vh] overflow-y-auto no-scrollbar">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 space-y-6">
            <div className="w-12 h-12 border-4 border-t-red-600 border-white/10 rounded-full animate-spin"></div>
            <p className="text-[10px] font-black uppercase tracking-[0.5em] text-white/30">Processando Identidade Vision</p>
          </div>
        ) : person && (
          <div className="grid grid-cols-1 md:grid-cols-12 gap-10 md:gap-16">
            <div className="md:col-span-4">
              <TiltCard intensity={20} className="w-full aspect-[2/3] animate-float">
                <img src={getImageUrl(person.profile_path, 'h632')} alt={person.name} className="w-full h-full object-cover rounded-[2.5rem] shadow-2xl border border-white/10" />
              </TiltCard>
            </div>
            <div className="md:col-span-8 space-y-8">
              <div>
                <h2 className="text-4xl md:text-7xl font-black tracking-tighter mb-4">{person.name}</h2>
                <div className="flex flex-wrap gap-4">
                  {person.birthday && <span className="text-[10px] font-black uppercase tracking-widest text-white/40 bg-white/5 px-4 py-2 rounded-full border border-white/5">Nascimento: {new Date(person.birthday).toLocaleDateString('pt-BR')}</span>}
                  {person.place_of_birth && <span className="text-[10px] font-black uppercase tracking-widest text-white/40 bg-white/5 px-4 py-2 rounded-full border border-white/5">{person.place_of_birth}</span>}
                </div>
              </div>
              <div className="space-y-4">
                <h4 className="text-[10px] font-black uppercase tracking-[0.4em] text-red-600">Trajetória Biográfica</h4>
                <p className="text-lg md:text-xl font-light text-white/70 leading-relaxed text-justify italic">{person.biography || "Nenhuma biografia disponível no banco de dados espacial."}</p>
              </div>
              <button onClick={onClose} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); onClose(); } }} tabIndex={0} className="vision-btn px-10 py-5 rounded-2xl font-black text-[10px] uppercase tracking-widest text-red-500 hover:text-white border border-red-600/20 focus:outline-none focus:ring-2 focus:ring-[#E50914] focus:text-white">FECHAR PERFIL</button>
            </div>
          </div>
        )}
      </GlassPanel>
    </div>
  );
};

const SearchModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (query.length > 2) {
        setIsSearching(true);
        try {
          const res = await searchMulti(query);
          setResults(res.filter((r: any) => r.media_type === 'tv' || r.media_type === 'movie' || r.media_type === 'person'));
        } catch (err) {
          console.error(err);
        } finally {
          setIsSearching(false);
        }
      } else {
        setResults([]);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [query]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-black/95 backdrop-blur-xl animate-in fade-in duration-500">
      <div className="responsive-container py-12 md:py-24 space-y-12 flex-1 flex flex-col">
        <div className="flex items-center justify-between">
          <RedXLogo className="h-6 md:h-10 opacity-40" />
          <button
            onClick={onClose}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); onClose(); } }}
            tabIndex={0}
            className="w-12 h-12 vision-btn rounded-full flex items-center justify-center text-white/60 hover:text-white focus:outline-none focus:ring-2 focus:ring-[#E50914] focus:text-white"
            title="Fechar busca"
            aria-label="Fechar busca"
          >
            <Search className="w-6 h-6" />
          </button>
        </div>

        <div className="space-y-8">
          <div className="relative max-w-4xl mx-auto">
            <div
              className="w-full vision-btn py-8 md:py-12 px-12 md:px-16 rounded-[3rem] md:rounded-[4rem] text-3xl md:text-6xl font-black tracking-tighter bg-white/5 border border-white/10 shadow-3xl h-24 md:h-32 flex items-center"
            >
              {query || <span className="opacity-10">O que você deseja experienciar?</span>}
            </div>
            {isSearching && (
              <div className="absolute right-12 top-1/2 -translate-y-1/2">
                <div className="w-8 h-8 border-4 border-t-red-600 border-white/10 rounded-full animate-spin"></div>
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto no-scrollbar py-12">
          {results.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6 md:gap-10">
              {results.map((item: any) => (
                <div key={item.id} className="group cursor-pointer" tabIndex={0} role="button" onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); playSelectSound(); } }}>
                  <div className="relative aspect-[2/3] rounded-[2rem] md:rounded-[2.5rem] overflow-hidden mb-4 border border-white/10 group-hover:border-red-600/50 group-focus:border-[#E50914]/50 group-focus:ring-2 group-focus:ring-[#E50914] transition-all shadow-2xl">
                    <img
                      src={getImageUrl(item.poster_path || item.profile_path, 'w500')}
                      alt={item.name || item.title}
                      className="w-full h-full object-cover group-hover:scale-110 group-focus:scale-110 transition-transform duration-1000"
                    />
                    <div className="absolute inset-0 bg-linear-to-t from-black via-transparent to-transparent opacity-0 group-hover:opacity-100 group-focus:opacity-100 transition-opacity p-6 flex flex-col justify-end">
                      <p className="text-[10px] font-black uppercase text-red-500 mb-1">{item.media_type}</p>
                      <p className="font-bold text-sm truncate">{item.name || item.title}</p>
                    </div>
                  </div>
                  <p className="text-center text-[10px] font-black uppercase tracking-widest text-white/20 truncate px-4 group-hover:text-white group-focus:text-white transition-colors">{item.name || item.title}</p>
                </div>
              ))}
            </div>
          ) : query.length > 2 && !isSearching ? (
            <div className="text-center py-24 opacity-20">
              <p className="text-2xl font-black uppercase tracking-[0.5em]">Nenhum sinal encontrado</p>
            </div>
          ) : (
            <div className="text-center py-24 opacity-10">
              <p className="text-xl font-light italic">Use o teclado espacial para varrer o multiverso RED X</p>
            </div>
          )}
        </div>

        <div className="pb-8">
          <VisionKeyboard
            onKeyClick={(k) => setQuery(prev => prev + k)}
            onBackspace={() => setQuery(prev => prev.slice(0, -1))}
          />
        </div>
      </div>
    </div>
  );
};

// --- Main Details Component ---

interface DetailsProps {
  media: Media;
  onPlay: () => void;
  onBack: () => void;
}

const Details: React.FC<DetailsProps> = ({ media, onPlay, onBack }) => {
  const [series, setSeries] = useState<SeriesDetail | null>(null);
  const [logoPath, setLogoPath] = useState<string | null>(null);
  const [cast, setCast] = useState<CastMember[]>([]);
  const [similar, setSimilar] = useState<SimilarSeries[]>([]);
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [videos, setVideos] = useState<Video[]>([]);
  const [providers, setProviders] = useState<WatchProvider[]>([]);
  const [selectedSeason, setSelectedSeason] = useState<number>(1);
  const [isLoading, setIsLoading] = useState(true);
  const [isTrailerActive, setIsTrailerActive] = useState(false);
  const [selectedPerson, setSelectedPerson] = useState<PersonDetail | null>(null);
  const [isPersonLoading, setIsPersonLoading] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    let isMounted = true;

    // Safety timeout to prevent infinite loading
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Timeout")), 8000)
    );

    try {
      setIsLoading(true);
      setError(null);

      const validTmdbId = media.tmdb_id && media.tmdb_id > 0;

      if (!validTmdbId) {
        setSeries(media as any);
        setIsLoading(false);
        return;
      }

      // Race between data fetch and timeout
      await Promise.race([
        (async () => {
          try {
            const detail = media.type === 'series'
              ? await fetchSeriesDetail(media.tmdb_id)
              : await fetchMovieDetail(media.tmdb_id);

            if (isMounted) setSeries(detail as any);

            const [credits, similarData, episodesData, images, vids, provs] = await Promise.all([
              fetchSeriesCredits(media.tmdb_id, media.type).catch(() => ({ cast: [] })),
              fetchSimilarSeries(media.tmdb_id, media.type).catch(() => []),
              media.type === 'series' ? fetchSeasonEpisodes(media.tmdb_id, 1).catch(() => []) : Promise.resolve([]),
              fetchSeriesImages(media.tmdb_id, media.type).catch(() => ({ logos: [] })),
              fetchSeriesVideos(media.tmdb_id, media.type).catch(() => []),
              fetchSeriesProviders(media.tmdb_id, media.type).catch(() => [])
            ]);

            if (isMounted) {
              setCast(credits.cast || []);
              setSimilar(similarData || []);
              setEpisodes(episodesData || []);
              setVideos(vids || []);
              setProviders(provs || []);

              const bestLogo = images?.logos?.find((l: any) => l.iso_639_1 === 'pt') || images?.logos?.find((l: any) => l.iso_639_1 === 'en') || images?.logos?.[0];
              setLogoPath(bestLogo?.file_path || null);
            }
          } catch (tmdbError) {
            console.warn("TMDB Error, using fallback:", tmdbError);
            if (isMounted) setSeries(media as any);
          }
        })(),
        timeoutPromise
      ]);

    } catch (err) {
      console.error("Details load error:", err);
      // Fallback on critical error/timeout
      if (isMounted) {
        setSeries(media as any);
        // Don't show error to user if we have fallback content, just log it
      }
    } finally {
      if (isMounted) setIsLoading(false);
    }

    return () => { isMounted = false; };
  }, [media]);

  useEffect(() => { loadData(); }, [loadData]);

  // Handle Back/Escape from TV remote on Details page
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Backspace') {
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA') return;
        e.preventDefault();
        e.stopPropagation();
        playBackSound();
        // Close modals first before navigating back
        if (isSearchOpen) {
          setIsSearchOpen(false);
          return;
        }
        if (selectedPerson || isPersonLoading) {
          setSelectedPerson(null);
          setIsPersonLoading(false);
          return;
        }
        onBack();
      }
    };
    // Use capture phase to intercept before App.tsx handler
    window.addEventListener('keydown', handler, { capture: true });
    return () => window.removeEventListener('keydown', handler, { capture: true });
  }, [onBack, isSearchOpen, selectedPerson, isPersonLoading]);

  const handleSeasonChange = async (num: number) => {
    setSelectedSeason(num);
    const validTmdbId = media.tmdb_id && media.tmdb_id > 0;
    if (!validTmdbId) return; // Sem tmdb_id válido, não pode buscar episódios
    try {
      const epData = await fetchSeasonEpisodes(media.tmdb_id, num);
      setEpisodes(epData);
    } catch (err) {
      console.error(err);
    }
  };

  const handlePersonClick = async (id: number) => {
    try {
      setIsPersonLoading(true);
      setSelectedPerson(null);
      const personData = await fetchPersonDetail(id);
      setSelectedPerson(personData);
    } catch (err) {
      console.error(err);
    } finally {
      setIsPersonLoading(false);
    }
  };

  if (error) return (
    <div className="min-h-screen flex items-center justify-center bg-black">
      <div className="glass p-8 md:p-16 rounded-[3rem] flex flex-col items-center text-center max-w-lg border border-red-600/20 shadow-[0_0_50px_rgba(229,9,20,0.1)]">
        <div className="w-20 h-20 bg-red-600/10 rounded-full flex items-center justify-center mb-6">
          <svg className="w-10 h-10 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <RedXLogo className="h-6 opacity-60 mb-6" />
        <h2 className="text-2xl font-black text-white mb-4">Sinal Interrompido</h2>
        <p className="text-white/50 mb-8 leading-relaxed">{error}</p>
        <button onClick={onBack} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); playBackSound(); onBack(); } }} tabIndex={0} className="vision-btn px-8 py-4 rounded-full font-bold text-sm border border-white/10 hover:bg-white/10 flex items-center gap-2 transition-all hover:scale-105 focus:outline-none focus:ring-2 focus:ring-[#E50914] focus:bg-white/10">
          <span>←</span> Retornar à Base
        </button>
      </div>
    </div>
  );

  if (isLoading || !series) return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'radial-gradient(ellipse at center, rgba(229,9,20,0.08) 0%, rgba(11,11,15,0.95) 60%, #0B0B0F 100%)' }}>
      <div className="flex flex-col items-center gap-5">
        {/* Logo REDX animada */}
        <div className="relative">
          {/* Anel giratório externo */}
          <svg className="w-20 h-20 animate-spin" style={{ animationDuration: '2.5s' }} viewBox="0 0 80 80">
            <circle cx="40" cy="40" r="36" fill="none" stroke="rgba(229,9,20,0.15)" strokeWidth="2" />
            <circle cx="40" cy="40" r="36" fill="none" stroke="#E50914" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="60 170" />
          </svg>
          {/* Logo no centro */}
          <div className="absolute inset-0 flex items-center justify-center">
            <img src="/logored.png" alt="REDX" className="h-8 w-auto object-contain opacity-80" style={{ animation: 'pulse 2s ease-in-out infinite' }} />
          </div>
        </div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.4em] text-white/25">Carregando detalhes</p>
      </div>
    </div>
  );

  return (
    <div className="relative min-h-screen bg-black text-white selection:bg-red-600/30 overflow-x-hidden w-full">
      <ActorModal person={selectedPerson} onClose={() => setSelectedPerson(null)} isLoading={isPersonLoading} />
      <SearchModal isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />

      {/* SPATIAL IMMERSIVE BACKGROUND */}
      <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none bg-black">
        <div
          className="absolute inset-0 bg-cover bg-center transition-all duration-1000 scale-110 opacity-60"
          style={{
            backgroundImage: `url(${getImageUrl(series.poster_path || series.backdrop_path, 'original')})`,
            filter: 'blur(30px) brightness(0.35) saturate(1.2)'
          }}
        />
        <div className="absolute inset-0 bg-linear-to-b from-black/40 via-transparent to-black" />
      </div>

      <header className="fixed top-0 left-0 right-0 z-[60] py-4 md:py-8 px-4 md:px-16 flex justify-between items-center transition-all duration-500 pointer-events-none">
        <div className="pointer-events-auto cursor-pointer" onClick={() => { playBackSound(); onBack(); }}>
          <button
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); playBackSound(); onBack(); } }}
            className="flex items-center gap-2 vision-btn px-6 py-3 rounded-full font-bold text-sm border border-white/10 hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-[#E50914]"
          >
            ← Voltar
          </button>
        </div>
        <div className="flex gap-3 md:gap-6 pointer-events-auto items-center">
          <div className="hidden lg:flex gap-4">
            {providers.slice(0, 3).map(p => (
              <div key={p.provider_id} className="w-8 h-8 rounded-lg overflow-hidden shadow-2xl opacity-40 hover:opacity-100 transition-opacity ring-1 ring-white/10">
                <img src={getImageUrl(p.logo_path, 'w200')} alt={p.provider_name} className="w-full h-full object-cover" />
              </div>
            ))}
          </div>
          <button
            onClick={() => setIsSearchOpen(true)}
            className="w-10 h-10 md:w-12 md:h-12 vision-btn rounded-full flex items-center justify-center shadow-3xl"
            title="Buscar"
            aria-label="Buscar"
          >
            <Search className="w-5 h-5 md:w-6 md:h-6 opacity-80" />
          </button>
        </div>
      </header>

      <section className="relative w-full h-[70vh] md:h-[85vh] z-10 mask-vignette overflow-hidden">
        {isTrailerActive && videos.length > 0 ? (
          <div className="absolute inset-0 z-0 scale-[1.35] brightness-75">
            <iframe src={`https://www.youtube.com/embed/${videos[0].key}?autoplay=1&controls=0&modestbranding=1&rel=0&mute=0`} className="w-full h-full pointer-events-none" allow="autoplay; encrypted-media" />
          </div>
        ) : (
          <div className="absolute inset-0 z-0 bg-cover bg-center transition-transform duration-2000 ease-out" style={{ backgroundImage: `url(${getImageUrl(series.backdrop_path, 'original')})` }} />
        )}
        <div className="absolute inset-0 bg-linear-to-t from-black via-black/30 to-transparent" />
        <div className="absolute inset-0 bg-linear-to-r from-black via-transparent to-transparent" />
        <div className="relative z-10 h-full responsive-container flex flex-col justify-end pb-20 md:pb-40 px-8">
          <div className="max-w-4xl animate-in fade-in slide-in-from-bottom-10 duration-1000 px-4 md:px-0">
            {logoPath ? (
              <img src={getImageUrl(logoPath, 'w780')} alt={series.name} className="h-5 md:h-12 w-auto mb-3 md:mb-5 object-contain drop-shadow-[0_25px_50px_rgba(0,0,0,0.85)]" />
            ) : (
              <h1 className="text-5xl md:text-9xl font-black mb-6 md:mb-8 tracking-tighter drop-shadow-2xl leading-[0.9]">{series.name}</h1>
            )}
            <p className="text-lg md:text-2xl font-light text-white/60 mb-8 md:mb-12 max-w-2xl italic drop-shadow-lg line-clamp-2 md:line-clamp-none">{series.tagline ? `"${series.tagline}"` : series.overview?.slice(0, 120)}</p>
            <div className="flex flex-wrap gap-2 md:gap-3" data-nav-row={0}>
              <button
                data-nav-item
                data-nav-col={0}
                tabIndex={0}
                onClick={onPlay}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); playSelectSound(); onPlay(); } }}
                className="vision-btn vision-btn-highlight red-glow-btn px-3 md:px-5 py-1.5 md:py-2.5 rounded-full font-black text-xs md:text-base flex items-center gap-2 group outline-none focus:ring-2 focus:ring-[#E50914] focus:scale-105">
                <div className="w-3.5 h-3.5 md:w-5 md:h-5 rounded-full bg-red-600 flex items-center justify-center text-white group-hover:scale-110 transition-transform shadow-[0_0_20px_rgba(255,0,0,0.6)]">
                  <svg className="w-3 h-3 md:w-4 md:h-4 fill-current ml-0.5" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                </div>
                Assistir Agora
              </button>
              <button
                data-nav-item
                data-nav-col={1}
                tabIndex={0}
                onClick={() => setIsTrailerActive(!isTrailerActive)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); playSelectSound(); setIsTrailerActive(!isTrailerActive); } }}
                className="vision-btn px-2.5 md:px-4 py-1.5 md:py-2.5 rounded-full font-bold text-xs md:text-base outline-none focus:ring-2 focus:ring-[#E50914] focus:scale-105">
                {isTrailerActive ? 'Fechar Trailer' : 'Trailer Oficial'}
              </button>
            </div>
          </div>
        </div>
      </section>

      <main className="relative z-20 space-y-24 md:space-y-48 mt-12 md:mt-24 px-8">
        <section className="responsive-container">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 md:gap-20 items-start">
            <div className="lg:col-span-4 flex justify-center relative">
              <div className="poster-aura scale-75 md:scale-100"></div>
              <TiltCard intensity={25} className="w-full max-w-[320px] md:max-w-[420px] animate-float" innerClassName="rounded-[2.5rem] md:rounded-[4rem] shadow-[0_80px_160px_rgba(0,0,0,0.95)] overflow-hidden thick-glass border border-white/20">
                <div className="absolute inset-0 bg-red-600/10 blur-[100px] -z-10 animate-pulse" style={{ transform: 'translateZ(-50px)' }}></div>
                <div className="relative overflow-hidden aspect-[2/3] w-full" style={{ transform: 'translateZ(30px)' }}>
                  <img src={getImageUrl(series.poster_path, 'w780')} alt={series.name} className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110" />
                  <div className="absolute inset-0 bg-linear-to-tr from-white/5 via-transparent to-white/10 mix-blend-overlay"></div>
                </div>
                <div className="absolute inset-0 flex flex-col justify-end p-8 md:p-12 bg-linear-to-t from-black via-black/30 to-transparent">
                  <div className="vision-btn px-8 py-4 rounded-3xl text-[10px] md:text-[12px] font-black tracking-[0.5em] uppercase text-red-500 shadow-2xl mx-auto border border-red-600/30 flex items-center gap-3 backdrop-blur-xl" style={{ transform: 'translateZ(100px)' }}>
                    <div className="w-2 h-2 rounded-full bg-red-600 animate-ping"></div>
                    RED X PREMIUM
                  </div>
                </div>
                <div className="absolute -inset-10 bg-red-600/5 blur-[120px] rounded-full opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" style={{ transform: 'translateZ(-80px)' }}></div>
              </TiltCard>
            </div>

            <div className="lg:col-span-8 space-y-12 md:space-y-16">
              <GlassPanel className="!p-8 md:!p-16 shadow-3xl relative group overflow-hidden border border-white/10">
                <div className="absolute -top-32 -right-32 w-80 h-80 bg-red-600/10 blur-[120px] rounded-full group-hover:bg-red-600/15 transition-colors"></div>
                <div className="flex flex-wrap gap-2 md:gap-4 mb-10 md:mb-14">
                  <span className="vision-btn px-4 md:px-6 py-2 rounded-full text-[9px] md:text-[10px] font-black text-red-500 shadow-lg border border-red-600/10">★ {series.vote_average?.toFixed(1)}</span>
                  <span className="vision-btn px-4 md:px-6 py-2 rounded-full text-[9px] md:text-[10px] font-black text-white/40 uppercase tracking-widest">{series.status}</span>
                  <span className="vision-btn px-4 md:px-6 py-2 rounded-full text-[9px] md:text-[10px] font-black text-white/30 uppercase tracking-widest">{series.genres?.slice(0, 2).map(g => g.name).join(' • ')}</span>
                </div>
                <h2 className="text-3xl md:text-5xl font-black mb-8 md:mb-10 tracking-tighter flex items-center gap-4 md:gap-6">
                  <div className="h-1.5 w-12 md:w-20 bg-red-600 shadow-[0_0_20px_rgba(255,0,0,0.6)]"></div>
                  Sinopse Spatial
                </h2>
                <p className="text-lg md:text-2xl font-light text-white/85 leading-[1.6] text-justify italic border-l-2 md:border-l-4 border-red-600/20 pl-6 md:pl-10 hyphens-auto">{series.overview}</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8 pt-12 md:pt-16 mt-12 md:mt-16 border-t border-white/5">
                  {[
                    { label: 'Rating', val: series.vote_average ? series.vote_average.toFixed(1) : '—', color: 'text-red-500' },
                    { label: 'Temps.', val: series.number_of_seasons ?? '—' },
                    { label: 'Eps.', val: series.number_of_episodes ?? '—' },
                    { label: 'Trend', val: series.popularity ? Math.round(series.popularity) : '—' }
                  ].map((stat, i) => (
                    <div key={i} className="space-y-1">
                      <p className="text-[9px] font-black text-white/20 uppercase tracking-[0.3em]">{stat.label}</p>
                      <p className={`text-xl md:text-3xl font-black ${stat.color || 'text-white'}`}>{stat.val}</p>
                    </div>
                  ))}
                </div>
              </GlassPanel>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-10">
                <GlassPanel className="!p-8 md:!p-10 shadow-xl border border-white/10">
                  <h3 className="text-[9px] md:text-[10px] font-black uppercase tracking-[0.4em] text-white/30 mb-6 md:mb-8">Spatial Metadata</h3>
                  <div className="space-y-4 md:space-y-6">
                    <div className="flex justify-between items-center text-base md:text-lg border-b border-white/5 pb-3"><span className="text-white/40 font-light">Ano</span><span className="font-bold">{new Date(series.first_air_date || series.release_date || '').getFullYear() || 'N/A'}</span></div>
                    <div className="flex justify-between items-center text-base md:text-lg border-b border-white/5 pb-3"><span className="text-white/40 font-light">Lançamento</span><span className="font-bold">{(series.first_air_date || series.release_date) ? new Date(series.first_air_date || series.release_date || '').toLocaleDateString('pt-BR') : 'N/A'}</span></div>
                    <div className="flex justify-between items-center text-base md:text-lg border-b border-white/5 pb-3"><span className="text-white/40 font-light">Classificação</span><span className="font-bold text-red-500">{series.adult ? '18+' : '14+'}</span></div>
                    {series.runtime ? <div className="flex justify-between items-center text-base md:text-lg border-b border-white/5 pb-3"><span className="text-white/40 font-light">Duração</span><span className="font-bold">{series.runtime} min</span></div> : null}
                    <div className="flex justify-between items-center text-base md:text-lg"><span className="text-white/40 font-light">Origem</span><span className="font-bold uppercase tracking-widest">{series.original_language}</span></div>
                  </div>
                </GlassPanel>
                <GlassPanel className="!p-8 md:!p-10 flex flex-col justify-center items-center text-center shadow-xl border border-white/10">
                  <p className="text-[9px] md:text-[10px] font-black uppercase tracking-[0.5em] text-red-600/50 mb-6 md:mb-8">Streaming Hub</p>
                  <div className="flex flex-wrap justify-center gap-4 md:gap-6">
                    {providers.slice(0, 4).map(p => (
                      <div key={p.provider_id} className="w-12 h-12 md:w-16 md:h-16 rounded-2xl md:rounded-3xl overflow-hidden shadow-2xl hover:scale-110 transition-transform duration-500 ring-1 ring-white/10">
                        <img src={getImageUrl(p.logo_path, 'w200')} className="w-full h-full object-cover" alt={p.provider_name} />
                      </div>
                    ))}
                    {providers.length === 0 && <span className="text-xs text-white/20 italic tracking-[0.3em] uppercase">Exclusivo RED X</span>}
                  </div>
                </GlassPanel>
              </div>
            </div>
          </div>
        </section>

        {media.type === 'series' && (
          <section className="responsive-container space-y-12 md:space-y-20">
            <div className="flex flex-col lg:flex-row items-center justify-between gap-8 md:gap-12">
              <div className="flex items-center gap-4 md:gap-6">
                <h2 className="text-4xl md:text-7xl font-black tracking-tighter">Episódios</h2>
                <div className="h-1.5 md:h-2 w-10 md:w-16 bg-red-600 animate-pulse shadow-[0_0_15px_rgba(255,0,0,0.5)]"></div>
              </div>
              {Array.isArray(series.seasons) && series.seasons.length > 0 && (
                <div className="flex gap-2 p-1.5 thick-glass rounded-full overflow-x-auto no-scrollbar max-w-full shadow-2xl border border-white/10" data-nav-row={1}>
                  {series.seasons.filter(s => s.season_number > 0).slice(0, 8).map((s, sIdx) => (
                    <button
                      key={s.id}
                      onClick={() => { playSelectSound(); handleSeasonChange(s.season_number); }}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); playSelectSound(); handleSeasonChange(s.season_number); } }}
                      data-nav-item
                      data-nav-col={sIdx}
                      tabIndex={0}
                      className={`px-4 md:px-8 py-2 md:py-3 rounded-full font-black text-[9px] md:text-[10px] uppercase tracking-[0.2em] transition-all whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-[#E50914] ${selectedSeason === s.season_number ? 'bg-white/15 text-white shadow-xl' : 'text-white/25 hover:text-white/60'}`}
                    >
                      {s.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4 md:gap-8">
              {episodes.map((ep, epIdx) => (
                <div
                  key={ep.id}
                  className="group h-full focus:outline-none focus:ring-2 focus:ring-[#E50914] rounded-[1.5rem]"
                  data-nav-row={2 + Math.floor(epIdx / 6)}
                  data-nav-item
                  data-nav-col={epIdx % 6}
                  tabIndex={0}
                  role="button"
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); playSelectSound(); onPlay(); } }}
                >
                  <TiltCard intensity={15} innerClassName="!bg-white/5 !rounded-[1.5rem] md:rounded-[2rem] p-3 md:p-4 group flex flex-col h-full shadow-lg border border-white/10">
                    <div className="relative aspect-video rounded-[1rem] md:rounded-[1.5rem] overflow-hidden mb-3 md:mb-4 shadow-md bg-black/50">
                      <img src={getImageUrl(ep.still_path, 'w500')} alt={ep.name} className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-all duration-700" loading="lazy" />
                      <div className="absolute top-2 right-2 md:top-3 md:right-3" style={{ transform: 'translateZ(30px)' }}>
                        <div className="vision-btn px-2 py-1 md:px-3 md:py-1.5 rounded-lg md:rounded-xl text-[8px] md:text-[9px] font-black text-red-500 shadow-xl border border-red-600/10">E{ep.episode_number}</div>
                      </div>
                    </div>
                    <div className="px-1 md:px-2 flex-1 flex flex-col justify-between" style={{ transform: 'translateZ(20px)' }}>
                      <div>
                        <h3 className="font-black text-xs md:text-sm mb-1.5 line-clamp-1 group-hover:text-red-500 transition-colors tracking-tight">{ep.name}</h3>
                        <p className="text-[8px] md:text-[10px] text-white/25 line-clamp-2 leading-relaxed font-light text-justify">{ep.overview || "Uma nova narrativa envolvente no universo RED X."}</p>
                      </div>
                    </div>
                  </TiltCard>
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="responsive-container space-y-12 md:space-y-20">
          <div className="flex flex-col md:flex-row justify-between items-center md:items-end gap-6">
            <div className="flex items-center gap-4 md:gap-6">
              <h2 className="text-3xl md:text-6xl font-black tracking-tighter text-center md:text-left">Elenco Estelar</h2>
              <div className="hidden md:block h-1.5 w-12 bg-white/10 rounded-full"></div>
            </div>
            <button className="text-[10px] font-black uppercase tracking-[0.5em] text-white/20 hover:text-red-600 transition-all border-b border-white/5 pb-1">Vision Engine</button>
          </div>

          {cast.length === 0 ? (
            <CastSkeleton />
          ) : (
            <div className="flex gap-6 md:gap-10 overflow-x-auto no-scrollbar pb-12 px-2" data-nav-row="cast">
              {cast.slice(0, 15).map((p, castIdx) => (
                <div key={p.id} className="flex-shrink-0 w-32 md:w-40 text-center" data-nav-item data-nav-col={castIdx}>
                  <TiltCard intensity={15} className="w-32 md:w-40 group cursor-pointer" innerClassName="!bg-transparent !p-0">
                    <div className="absolute inset-0 bg-red-600/10 blur-[30px] rounded-full scale-75 opacity-0 group-hover:opacity-100 transition-opacity" style={{ transform: 'translateZ(-10px)' }}></div>
                    <div
                      onClick={() => { playSelectSound(); handlePersonClick(p.id); }}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); playSelectSound(); handlePersonClick(p.id); } }}
                      tabIndex={0}
                      role="button"
                      className="relative w-32 h-44 md:w-40 md:h-56 rounded-[2rem] md:rounded-[2.5rem] overflow-hidden mb-4 md:mb-6 transition-all duration-1000 shadow-2xl ring-2 ring-white/10 group-hover:ring-red-600/40 focus:ring-[#E50914] focus:outline-none"
                      style={{ transform: 'translateZ(40px)' }}
                    >
                      <img src={getImageUrl(p.profile_path, 'w500')} alt={p.name} className="w-full h-full object-cover object-top grayscale-[0.2] group-hover:grayscale-0 group-hover:scale-110 transition-all duration-1000" style={{ transform: 'translateZ(0px)' }} />
                      <div className="absolute inset-0 bg-linear-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-all duration-700"></div>
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-700">
                        <div className="w-10 h-10 md:w-12 md:h-12 vision-btn rounded-full flex items-center justify-center shadow-3xl text-white border border-white/20" style={{ transform: 'translateZ(60px)' }}>
                          <svg className="w-5 h-5 md:w-6 md:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" /></svg>
                        </div>
                      </div>
                    </div>
                    <div style={{ transform: 'translateZ(80px)' }} className="pointer-events-none px-1">
                      <p className="font-black text-sm md:text-lg text-white mb-1 tracking-tighter truncate group-hover:text-red-500 transition-colors drop-shadow-xl">{p.name}</p>
                      <p className="text-[8px] md:text-[9px] font-black text-white/30 uppercase tracking-[0.2em] truncate drop-shadow-md">{p.character}</p>
                    </div>
                  </TiltCard>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="responsive-container pb-24 md:pb-64">
          <div className="flex items-center gap-6 md:gap-8 mb-16 md:mb-20">
            <h2 className="text-[9px] md:text-[11px] font-black tracking-[0.8em] text-white/15 uppercase whitespace-nowrap">Expansão Spatial</h2>
            <div className="h-px flex-1 bg-linear-to-r from-red-600/30 via-white/5 to-transparent"></div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-6 md:gap-12">
            {similar.slice(0, 6).map(item => (
              <div key={item.id} className="group cursor-pointer" tabIndex={0} role="button" onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); playSelectSound(); } }} >
                <div className="relative aspect-[2/3] rounded-[2rem] md:rounded-[3rem] overflow-hidden mb-6 md:mb-8 shadow-2xl transition-all duration-1000 group-hover:-translate-y-4 group-focus:-translate-y-4 border border-white/10 hover:border-white/30 focus-within:border-[#E50914]/50 focus-within:ring-2 focus-within:ring-[#E50914]">
                  <img src={getImageUrl(item.poster_path, 'w500')} alt={item.name} className="w-full h-full object-cover group-hover:scale-110 group-focus:scale-110 transition-transform duration-1000" loading="lazy" />
                  <div className="absolute inset-0 bg-linear-to-t from-red-950/95 via-black/10 to-transparent opacity-0 group-hover:opacity-100 group-focus:opacity-100 transition-all duration-700 flex flex-col justify-end p-6 md:p-8">
                    <p className="text-red-500 font-black text-[10px] mb-1">★ {item.vote_average.toFixed(1)}</p>
                    <p className="font-black text-[10px] md:text-xs uppercase tracking-[0.1em] truncate drop-shadow-lg">{item.name}</p>
                  </div>
                </div>
                <p className="text-center text-[9px] md:text-[10px] font-black uppercase tracking-[0.3em] text-white/10 group-hover:text-red-600 transition-colors truncate px-4">{item.name}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="relative z-20 py-24 md:py-48 bg-linear-to-b from-transparent to-red-950/20 border-t border-white/10">
        <div className="responsive-container text-center space-y-12 md:space-y-16">
          <RedXLogo className="h-8 md:h-10 justify-center opacity-30 hover:opacity-100 transition-all duration-700 scale-110" />
          <div className="flex justify-center flex-wrap gap-8 md:gap-16 text-[9px] md:text-[11px] font-black uppercase tracking-[0.5em] text-white/20">
            <a href="#" className="hover:text-red-600 transition-colors">Privacidade</a>
            <a href="#" className="hover:text-red-600 transition-colors">Spatial Cloud</a>
            <a href="#" className="hover:text-red-600 transition-colors">Suporte</a>
          </div>
          <div className="max-w-3xl mx-auto space-y-8 opacity-20">
            <div className="h-px w-20 bg-white/20 mx-auto"></div>
            <p className="text-[9px] md:text-[10px] font-light leading-loose tracking-[0.2em] uppercase text-white/80 text-center px-4">
              © {new Date().getFullYear()} RED X PREMIUM • SPATIAL OS v7.0.0
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Details;
