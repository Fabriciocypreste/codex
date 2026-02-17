import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Media } from '../types';
import MediaRow from '../components/MediaRow';
import HeroBanner from '../components/HeroBanner';
import StreamingPlatforms, { platforms } from '../components/StreamingPlatforms';
import { Film, Tv } from 'lucide-react';

const ROW_HEIGHT = 320;
const VISIBLE_BUFFER = 3;

function useRowWindowing(totalRows: number) {
  const [visibleRange, setVisibleRange] = useState({ start: 0, end: VISIBLE_BUFFER * 2 });

  useEffect(() => {
    const handler = () => {
      const scrollY = window.scrollY;
      const viewportH = window.innerHeight;
      const heroOffset = 600;
      const startRow = Math.max(0, Math.floor((scrollY - heroOffset) / ROW_HEIGHT) - VISIBLE_BUFFER);
      const endRow = Math.min(totalRows - 1, Math.ceil((scrollY + viewportH - heroOffset) / ROW_HEIGHT) + VISIBLE_BUFFER);
      setVisibleRange(prev => {
        if (prev.start === startRow && prev.end === endRow) return prev;
        return { start: startRow, end: endRow };
      });
    };
    window.addEventListener('scroll', handler, { passive: true });
    handler();
    return () => window.removeEventListener('scroll', handler);
  }, [totalRows]);

  return visibleRange;
}

interface RowDescriptor {
  key: string;
  title: string;
  items: Media[];
  rowIndex: number;
  type: 'row' | 'header';
  headerIcon?: 'film' | 'tv';
}

const CatalogRows: React.FC<{
  recentlyAdded: Media[];
  trendingMovies: Media[];
  trendingSeries: Media[];
  movieGenreEntries: [string, Media[]][];
  seriesGenreEntries: [string, Media[]][];
  movieGenreStartRow: number;
  seriesGenreStartRow: number;
  RECENTLY_ADDED_ROW: number;
  TRENDING_MOVIES_ROW: number;
  TRENDING_SERIES_ROW: number;
  onSelect: (m: Media) => void;
  onPlay?: (m: Media) => void;
}> = React.memo(({
  recentlyAdded, trendingMovies, trendingSeries,
  movieGenreEntries, seriesGenreEntries,
  movieGenreStartRow, seriesGenreStartRow,
  RECENTLY_ADDED_ROW, TRENDING_MOVIES_ROW, TRENDING_SERIES_ROW,
  onSelect, onPlay,
}) => {
  const allRows = useMemo(() => {
    const rows: RowDescriptor[] = [];
    if (recentlyAdded.length > 0) rows.push({ key: 'recent', title: 'Recem Adicionados', items: recentlyAdded, rowIndex: RECENTLY_ADDED_ROW, type: 'row' });
    if (trendingMovies.length > 0) rows.push({ key: 'trend-movies', title: 'Filmes em Alta', items: trendingMovies, rowIndex: TRENDING_MOVIES_ROW, type: 'row' });
    rows.push({ key: 'header-films', title: 'Filmes', items: [], rowIndex: -1, type: 'header', headerIcon: 'film' });
    movieGenreEntries.forEach(([genre, items], idx) => rows.push({ key: `movie-${genre}`, title: genre, items, rowIndex: movieGenreStartRow + idx, type: 'row' }));
    if (trendingSeries.length > 0) rows.push({ key: 'trend-series', title: 'Series em Alta', items: trendingSeries, rowIndex: TRENDING_SERIES_ROW, type: 'row' });
    rows.push({ key: 'header-series', title: 'Series', items: [], rowIndex: -1, type: 'header', headerIcon: 'tv' });
    seriesGenreEntries.forEach(([genre, items], idx) => rows.push({ key: `series-${genre}`, title: genre, items, rowIndex: seriesGenreStartRow + idx, type: 'row' }));
    return rows;
  }, [recentlyAdded, trendingMovies, trendingSeries, movieGenreEntries, seriesGenreEntries, movieGenreStartRow, seriesGenreStartRow, RECENTLY_ADDED_ROW, TRENDING_MOVIES_ROW, TRENDING_SERIES_ROW]);

  const { start, end } = useRowWindowing(allRows.length);

  return (
    <>
      {allRows.map((row, idx) => {
        const isVisible = idx >= start && idx <= end;
        if (row.type === 'header') {
          const Icon = row.headerIcon === 'film' ? Film : Tv;
          return (
            <div key={row.key} className="px-12 pt-8">
              <div className="flex items-center gap-4 mb-2">
                <Icon className="w-6 h-6 text-[#E50914]" />
                <h2 className="text-3xl font-black tracking-tight">{row.title}</h2>
                <div className="h-0.5 flex-1 bg-linear-to-r from-[#E50914]/30 to-transparent" />
              </div>
            </div>
          );
        }
        if (!isVisible) {
          return <div key={row.key} style={{ height: `${ROW_HEIGHT}px` }} data-nav-row={row.rowIndex} />;
        }
        return (
          <MediaRow
            key={row.key}
            title={row.title}
            items={row.items}
            onSelect={onSelect}
            onPlay={onPlay}
            rowIndex={row.rowIndex}
          />
        );
      })}
    </>
  );
});

interface HomeProps {
  movies: Media[];
  series: Media[];
  trendingMovies: Media[];
  trendingSeries: Media[];
  moviesByGenre: Map<string, Media[]>;
  seriesByGenre: Map<string, Media[]>;
  onSelectMedia: (media: Media) => void;
  onPlayMedia?: (media: Media) => void;
}

const Home: React.FC<HomeProps> = ({
  movies, series,
  trendingMovies, trendingSeries,
  moviesByGenre, seriesByGenre,
  onSelectMedia,
  onPlayMedia
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [filter, setFilter] = useState<string | null>(null);
  const [bgBackdrop, setBgBackdrop] = useState<string>('');
  const bgRef = useRef<HTMLDivElement>(null);

  // Callback estável para o HeroBanner informar o backdrop atual
  const handleBackdropChange = useCallback((url: string) => setBgBackdrop(url), []);

  // Banner usa trending TMDB (posters oficiais garantidos)
  const featuredList = useMemo(() => [...trendingMovies, ...trendingSeries].slice(0, 12), [trendingMovies, trendingSeries]);

  // Pre-compute genre entries for stable row indices
  const movieGenreEntries = useMemo(() => Array.from(moviesByGenre.entries()), [moviesByGenre]);
  const seriesGenreEntries = useMemo(() => Array.from(seriesByGenre.entries()), [seriesByGenre]);

  useEffect(() => {
    if (featuredList.length <= 1 || filter) return;
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % featuredList.length);
    }, 8000);
    return () => clearInterval(interval);
  }, [featuredList.length, filter]);

  useEffect(() => {
    setCurrentIndex(0);
  }, [featuredList.length]);

  // Mapeamento de nomes do componente → nomes reais no DB (parcial, case-insensitive)
  const platformAliases: Record<string, string[]> = useMemo(() => ({
    'Netflix': ['netflix'],
    'Prime Video': ['amazon prime video', 'prime video', 'amazon video'],
    'Disney+': ['disney plus', 'disney+'],
    'Max': ['hbo max', 'max'],
    'Globoplay': ['globoplay'],
    'Apple TV+': ['apple tv', 'apple tv+', 'apple tv store'],
    'Paramount+': ['paramount plus', 'paramount+'],
    'HBO Max': ['hbo max'],
    'Pluto TV': ['pluto tv'],
    'Crunchyroll': ['crunchyroll'],
    'Claro Video': ['claro video', 'claro tv'],
    'Warner Bros': ['warner'],
  }), []);

  // Busca filtra no conteúdo real do DB — agora filtra pelo campo `platform`
  const allContent = useMemo(() => [...movies, ...series], [movies, series]);
  const filteredMedia = useMemo(() => {
    if (!filter) return null;
    const aliases = platformAliases[filter] || [filter.toLowerCase()];
    return allContent.filter(m => {
      if (!m.platform) return false;
      const p = m.platform.toLowerCase();
      return aliases.some(alias => p.includes(alias));
    });
  }, [allContent, filter, platformAliases]);

  const handleSelectMedia = useCallback((m: Media) => onSelectMedia(m), [onSelectMedia]);

  // Row index counter for D-Pad navigation
  const RECENTLY_ADDED_ROW = 2;
  const TRENDING_MOVIES_ROW = 3;
  const movieGenreStartRow = TRENDING_MOVIES_ROW + 1;
  const TRENDING_SERIES_ROW = movieGenreStartRow + movieGenreEntries.length;
  const seriesGenreStartRow = TRENDING_SERIES_ROW + 1;

  // Recém adicionados: últimos 20 itens com stream_url (prioridade para conteúdo manual)
  const recentlyAdded = useMemo(() => {
    return [...movies, ...series]
      .filter(m => m.stream_url)
      .slice(0, 20);
  }, [movies, series]);

  return (
    <div className="w-full space-y-4 pb-20 animate-fade-in relative">
      {/* === FUNDO DA PÁGINA: backdrop do banner com 60% blur === */}
      {bgBackdrop && (
        <div
          ref={bgRef}
          className="fixed inset-0 w-screen h-screen z-[-1] transition-opacity duration-700"
        >
          <img
            src={bgBackdrop}
            alt=""
            className="w-full h-full object-cover"
            style={{
              filter: 'brightness(0.4)',
              transform: 'scale(1.15)',
            }}
          />
          {/* Overlay escuro para garantir contraste */}
          <div className="absolute inset-0 bg-black/50" />
        </div>
      )}

      {/* Hero Banner */}
      {!filter && (
        <div className="mt-0 relative z-0">
          <HeroBanner onPlayMedia={onPlayMedia} onSelectMedia={onSelectMedia} dbMedia={allContent} onBackdropChange={handleBackdropChange} />
        </div>
      )}

      {/* Conteúdo da Home com margem ajustada para Sidebar e Banner */}
      <div className="modern-home-content relative z-20">

        {/* Logos das Plataformas - Inserido entre Banner e Listas */}
        <StreamingPlatforms onSelectPlatform={(name) => setFilter(name)} />

        {/* Trending Movies Row */}
        {filter && (
          <section className="mt-12 space-y-8 pb-20">
            <div className="px-12 flex justify-between items-center mb-12">
              <div className="flex items-center gap-8 animate-in fade-in slide-in-from-left duration-1000">
                {platforms.find(p => p.name === filter) ? (
                  <div className="w-48 h-24 glass rounded-3xl p-6 flex items-center justify-center border border-white/10 shadow-3xl">
                    <img
                      src={platforms.find(p => p.name === filter)?.logo}
                      alt={filter}
                      className="w-full h-full object-contain filter brightness-0 invert"
                    />
                  </div>
                ) : (
                  <h2 className="text-5xl font-black tracking-tighter uppercase italic">
                    Resultados: <span className="text-red-600">{filter}</span>
                  </h2>
                )}
                <div className="h-1.5 w-20 bg-red-600 shadow-[0_0_20px_rgba(255,0,0,0.5)]"></div>
              </div>
              <button
                onClick={() => setFilter(null)}
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); setFilter(null); } }}
                className="vision-btn px-8 py-3 rounded-full text-[10px] font-black uppercase tracking-[0.3em] overflow-hidden group relative focus:outline-none focus:ring-2 focus:ring-[#E50914]"
              >
                <span className="relative z-10">Limpar Filtro</span>
                <div className="absolute inset-0 bg-red-600/20 translate-y-full group-hover:translate-y-0 transition-transform"></div>
              </button>
            </div>

            {filteredMedia && filteredMedia.length > 0 ? (
              <MediaRow
                title="Resultados"
                items={filteredMedia}
                onSelect={handleSelectMedia}
                onPlay={onPlayMedia}
                rowIndex={2}
              />
            ) : (
              <div className="text-center py-32 opacity-20">
                <p className="text-2xl font-black uppercase tracking-[0.5em]">Nenhum sinal encontrado</p>
              </div>
            )}
          </section>
        )}

        {/* Catálogo Real do Banco de Dados - organizado por gênero */}
        {!filter && (
          <CatalogRows
            recentlyAdded={recentlyAdded}
            trendingMovies={trendingMovies}
            trendingSeries={trendingSeries}
            movieGenreEntries={movieGenreEntries}
            seriesGenreEntries={seriesGenreEntries}
            movieGenreStartRow={movieGenreStartRow}
            seriesGenreStartRow={seriesGenreStartRow}
            RECENTLY_ADDED_ROW={RECENTLY_ADDED_ROW}
            TRENDING_MOVIES_ROW={TRENDING_MOVIES_ROW}
            TRENDING_SERIES_ROW={TRENDING_SERIES_ROW}
            onSelect={handleSelectMedia}
            onPlay={onPlayMedia}
          />
        )}
      </div>
    </div>
  );
};

export default React.memo(Home);
