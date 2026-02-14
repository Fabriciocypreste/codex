import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Media } from '../types';
import MediaCard from '../components/MediaCard';
import HeroBanner from '../components/HeroBanner';
import { Search, Tv } from 'lucide-react';
import StreamingPlatforms, { platforms } from '../components/StreamingPlatforms';
import MediaRow from '../components/MediaRow';
import { playSelectSound } from '../utils/soundEffects';
import { getAllSeries } from '../services/supabaseService';

interface SeriesProps {
  series: Media[];
  seriesByGenre: Map<string, Media[]>;
  trendingSeries: Media[];
  onSelectMedia: (media: Media) => void;
  onPlayMedia?: (media: Media) => void;
}

const COLS_PER_ROW = 6;

const Series: React.FC<SeriesProps> = ({ series, seriesByGenre, trendingSeries, onSelectMedia, onPlayMedia }) => {
  const [featured, setFeatured] = useState<Media | null>(null);
  const [filter, setFilter] = useState<string | null>(null);
  const [localSeries, setLocalSeries] = useState<Media[] | null>(null);
  const [localSeriesByGenre, setLocalSeriesByGenre] = useState<Map<string, Media[]>>(new Map());

  useEffect(() => {
    if (trendingSeries.length > 0) {
      const randomIndex = Math.floor(Math.random() * Math.min(trendingSeries.length, 10));
      setFeatured(trendingSeries[randomIndex] || null);
    }
  }, [trendingSeries]);

  // Fallback: se não houver series vindas do App, buscar direto do Supabase (útil para teste)
  useEffect(() => {
    if ((series?.length || 0) === 0 && localSeries === null) {
      (async () => {
        try {
          const dbSeries = await getAllSeries();
          const typed = dbSeries.map(s => ({ ...s, type: 'series' } as Media));
          setLocalSeries(typed);
          const map = new Map<string, Media[]>();
          typed.forEach(item => {
            const g = Array.isArray(item.genre) && item.genre.length > 0 ? item.genre[0] : 'Outros';
            if (!map.has(g)) map.set(g, []);
            map.get(g)!.push(item);
          });
          setLocalSeriesByGenre(map);
        } catch (e) {
          console.error('Fallback getAllSeries failed', e);
          setLocalSeries([]);
        }
      })();
    }
  }, [series, localSeries]);

  const effectiveSeries = (series && series.length > 0) ? series : (localSeries || []);
  const effectiveSeriesByGenre = (seriesByGenre && seriesByGenre.size > 0) ? seriesByGenre : localSeriesByGenre;

  const filteredSeries = useMemo(() => filter
    ? effectiveSeries.filter(s => s.title.toLowerCase().includes(filter.toLowerCase()))
    : null, [effectiveSeries, filter]);

  const handleSelect = useCallback((m: Media) => onSelectMedia(m), [onSelectMedia]);

  const handleKeySelect = useCallback((e: React.KeyboardEvent, m: Media) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      playSelectSound();
      handleSelect(m);
    }
  }, [handleSelect]);

  return (
    <div className="w-full space-y-4 pb-20 animate-fade-in relative">
      {/* Hero Banner (Only shown if no filter) */}
      {!filter && (
        <div className="mt-0 relative z-0">
          <HeroBanner mediaType="tv" onPlayMedia={onPlayMedia} onSelectMedia={onSelectMedia} dbMedia={effectiveSeries} />
        </div>
      )}

      {/* Conteúdo com margem ajustada (mesma lógica da Home) */}
      <div className={`modern-home-content relative z-20 ${filter ? 'mt-32' : ''}`}>

        {/* Streaming Platforms */}
        <StreamingPlatforms onSelectPlatform={(name) => setFilter(name)} />

        {/* Filter Panel */}
        {filter && (
          <div className="px-12 flex justify-between items-center mb-12">
            <h1 className="text-5xl font-black">{filter ? 'Filtrado' : 'Séries'}</h1>
            <div
              className="flex items-center gap-4 glass p-2 px-4 rounded-full border-white/20"
              data-nav-row={3}
            >
              <button
                onClick={() => { playSelectSound(); setFilter(null); }}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); playSelectSound(); setFilter(null); } }}
                data-nav-item
                data-nav-col={0}
                tabIndex={0}
                className={`px-5 py-2 rounded-full font-bold text-sm transition-all focus:outline-none focus:ring-2 focus:ring-[#E50914] ${!filter ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white'}`}
              >
                Todos
              </button>
              <div className="h-6 w-px bg-white/20" />
              <div className="relative">
                <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-white/30" />
                <input
                  type="text"
                  placeholder="Buscar séries..."
                  onChange={(e) => setFilter(e.target.value)}
                  data-nav-item
                  data-nav-col={1}
                  tabIndex={0}
                  className="bg-transparent border-none outline-none pl-10 py-2 text-sm text-white w-48 placeholder:text-white/20 focus:ring-2 focus:ring-[#E50914] rounded-full"
                />
              </div>
            </div>
          </div>
        )}

        {!filter && (
          <div className="px-12 flex justify-end items-center mb-4">
            <div
              className="flex items-center gap-4 glass p-2 px-4 rounded-full border-white/20"
              data-nav-row={3}
            >
              <div className="relative">
                <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-white/30" />
                <input
                  type="text"
                  placeholder="Buscar séries..."
                  onChange={(e) => setFilter(e.target.value)}
                  data-nav-item
                  data-nav-col={1}
                  tabIndex={0}
                  className="bg-transparent border-none outline-none pl-10 py-2 text-sm text-white w-48 placeholder:text-white/20 focus:ring-2 focus:ring-[#E50914] rounded-full"
                />
              </div>
            </div>
          </div>
        )}

        {filter && platforms.find(p => p.name === filter) ? (
          <section className="space-y-8 animate-in fade-in duration-1000">
            <div className="px-12 flex items-center gap-8 mb-12">
              <div className="w-48 h-24 glass rounded-3xl p-6 flex items-center justify-center border border-white/10 shadow-3xl">
                <img
                  src={platforms.find(p => p.name === filter)?.logo}
                  alt={filter}
                  className="w-full h-full object-contain filter brightness-0 invert"
                />
              </div>
              <div className="h-1.5 w-20 bg-red-600 shadow-[0_0_20px_rgba(255,0,0,0.5)]"></div>
            </div>
            {filteredSeries && filteredSeries.length > 0 && (
              <MediaRow
                title="Séries encontradas"
                items={filteredSeries}
                onSelect={handleSelect}
                onPlay={onPlayMedia}
                rowIndex={4}
              />
            )}
          </section>
        ) : filter ? (
          <div className="px-12 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-8">
            {filteredSeries?.map((s, idx) => {
              const visualRow = Math.floor(idx / COLS_PER_ROW);
              const colInRow = idx % COLS_PER_ROW;
              return (
                <div
                  key={`${s.type}-${s.tmdb_id || s.id}`}
                  data-nav-row={4 + visualRow}
                  data-nav-item
                  data-nav-col={colInRow}
                  tabIndex={0}
                  onKeyDown={(e) => handleKeySelect(e, s)}
                  className="focus:outline-none focus:ring-2 focus:ring-[#E50914] rounded-xl"
                >
                  <MediaCard media={s} onClick={() => { playSelectSound(); handleSelect(s); }} />
                </div>
              );
            })}
            {filteredSeries?.length === 0 && (
              <div className="col-span-full text-center py-32 opacity-20">
                <p className="text-2xl font-black uppercase tracking-[0.5em]">Nenhuma série encontrada</p>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {trendingSeries.length > 0 && (
              <MediaRow
                title="🔥 Em Alta"
                items={trendingSeries}
                onSelect={handleSelect}
                onPlay={onPlayMedia}
                rowIndex={4}
              />
            )}

            {Array.from(effectiveSeriesByGenre.entries()).map(([genre, items], idx) => (
              <MediaRow
                key={genre}
                title={genre}
                items={items}
                onSelect={handleSelect}
                onPlay={onPlayMedia}
                rowIndex={5 + idx}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default React.memo(Series);
