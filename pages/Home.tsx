import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Media } from '../types';
import MediaRow from '../components/MediaRow';
import HeroBanner from '../components/HeroBanner';
import StreamingPlatforms, { platforms } from '../components/StreamingPlatforms';
import { Film, Tv } from 'lucide-react';

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

  // Busca filtra no conteúdo real do DB
  const allContent = useMemo(() => [...movies, ...series], [movies, series]);
  const filteredMedia = useMemo(() => filter
    ? allContent.filter(m =>
      m.title.toLowerCase().includes(filter.toLowerCase())
    )
    : null, [allContent, filter]);

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
      {/* Hero Banner */}
      {!filter && (
        <div className="mt-0 relative z-0">
          <HeroBanner onPlayMedia={onPlayMedia} onSelectMedia={onSelectMedia} dbMedia={[...movies, ...series]} />
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
          <>
            {/* Recém Adicionados - conteúdo com stream_url (inserido via admin) */}
            {recentlyAdded.length > 0 && (
              <MediaRow
                title="⭐ Recém Adicionados"
                items={recentlyAdded}
                onSelect={handleSelectMedia}
                onPlay={onPlayMedia}
                rowIndex={RECENTLY_ADDED_ROW}
              />
            )}

            {/* Trending TMDB */}
            {trendingMovies.length > 0 && (
              <MediaRow
                title="🔥 Filmes em Alta"
                items={trendingMovies}
                onSelect={handleSelectMedia}
                onPlay={onPlayMedia}
                rowIndex={TRENDING_MOVIES_ROW}
              />
            )}

            {/* FILMES do Banco - por Gênero (enriquecidos com TMDB) */}
            <div className="px-12 pt-8">
              <div className="flex items-center gap-4 mb-2">
                <Film className="w-6 h-6 text-[#E50914]" />
                <h2 className="text-3xl font-black tracking-tight">Filmes</h2>
                <div className="h-0.5 flex-1 bg-linear-to-r from-[#E50914]/30 to-transparent" />
              </div>
            </div>

            {Array.from(moviesByGenre.entries()).map(([genre, items], idx) => (
              <MediaRow
                key={`movie-${genre}`}
                title={genre}
                items={items}
                onSelect={handleSelectMedia}
                onPlay={onPlayMedia}
                rowIndex={movieGenreStartRow + idx}
              />
            ))}

            {/* Trending Séries */}
            {trendingSeries.length > 0 && (
              <div className="pt-4">
                <MediaRow
                  title="🔥 Séries em Alta"
                  items={trendingSeries}
                  onSelect={handleSelectMedia}
                  onPlay={onPlayMedia}
                  rowIndex={TRENDING_SERIES_ROW}
                />
              </div>
            )}

            {/* SÉRIES do Banco - por Gênero (enriquecidas com TMDB) */}
            <div className="px-12 pt-8">
              <div className="flex items-center gap-4 mb-2">
                <Tv className="w-6 h-6 text-[#E50914]" />
                <h2 className="text-3xl font-black tracking-tight">Séries</h2>
                <div className="h-0.5 flex-1 bg-linear-to-r from-[#E50914]/30 to-transparent" />
              </div>
            </div>

            {Array.from(seriesByGenre.entries()).map(([genre, items], idx) => (
              <MediaRow
                key={`series-${genre}`}
                title={genre}
                items={items}
                onSelect={handleSelectMedia}
                onPlay={onPlayMedia}
                rowIndex={seriesGenreStartRow + idx}
              />
            ))}
          </>
        )}
      </div>
    </div>
  );
};

export default React.memo(Home);
