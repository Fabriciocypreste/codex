import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Media } from '../types';
import MediaCard from '../components/MediaCard';
import HeroBanner from '../components/HeroBanner';
import { Search, Film } from 'lucide-react';
import StreamingPlatforms, { platforms } from '../components/StreamingPlatforms';
import MediaRow from '../components/MediaRow';
import { playSelectSound } from '../utils/soundEffects';
import { getAllMovies } from '../services/supabaseService';

interface MoviesProps {
    movies: Media[];
    moviesByGenre: Map<string, Media[]>;
    trendingMovies: Media[];
    onSelectMedia: (media: Media) => void;
    onPlayMedia?: (media: Media) => void;
}

const COLS_PER_ROW = 6;

const Movies: React.FC<MoviesProps> = ({ movies, moviesByGenre, trendingMovies, onSelectMedia, onPlayMedia }) => {
    const [featured, setFeatured] = useState<Media | null>(null);
    const [filter, setFilter] = useState<string | null>(null);
    const [localMovies, setLocalMovies] = useState<Media[] | null>(null);
    const [localMoviesByGenre, setLocalMoviesByGenre] = useState<Map<string, Media[]>>(new Map());

    useEffect(() => {
        if (trendingMovies.length > 0) {
            const randomIndex = Math.floor(Math.random() * Math.min(trendingMovies.length, 10));
            setFeatured(trendingMovies[randomIndex] || null);
        }
    }, [trendingMovies]);

    // Fallback: se não houver movies vindos do App, buscar direto do Supabase (útil para teste)
    useEffect(() => {
        if ((movies?.length || 0) === 0 && localMovies === null) {
            (async () => {
                try {
                    const dbMovies = await getAllMovies();
                    const typed = dbMovies.map(m => ({ ...m, type: 'movie' } as Media));
                    setLocalMovies(typed);
                    const map = new Map<string, Media[]>();
                    typed.forEach(item => {
                        const g = Array.isArray(item.genre) && item.genre.length > 0 ? item.genre[0] : 'Outros';
                        if (!map.has(g)) map.set(g, []);
                        map.get(g)!.push(item);
                    });
                    setLocalMoviesByGenre(map);
                } catch (e) {
                    console.error('Fallback getAllMovies failed', e);
                    setLocalMovies([]);
                }
            })();
        }
    }, [movies, localMovies]);

    const effectiveMovies = (movies && movies.length > 0) ? movies : (localMovies || []);
    const effectiveMoviesByGenre = (moviesByGenre && moviesByGenre.size > 0) ? moviesByGenre : localMoviesByGenre;

    const filteredMovies = useMemo(() => filter
        ? effectiveMovies.filter(m => m.title.toLowerCase().includes(filter.toLowerCase()))
        : null, [effectiveMovies, filter]);

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
                    <HeroBanner mediaType="movie" onPlayMedia={onPlayMedia} onSelectMedia={onSelectMedia} dbMedia={effectiveMovies} />
                </div>
            )}

            {/* Conteúdo com margem ajustada (mesma lógica da Home) */}
            <div className={`modern-home-content relative z-20 ${filter ? 'mt-32' : ''}`}>

                {/* Streaming Platforms */}
                <StreamingPlatforms onSelectPlatform={(name) => setFilter(name)} />

                {/* Filter Panel (Only visible if filtered, or maybe as part of the content flow) */}
                {/* Na Home, o filtro aparece dentro do fluxo. Aqui, vamos manter a lógica: */}

                {/* Se houver filtro, mostrar cabeçalho de filtro */}
                {filter && (
                    <div className="px-12 flex justify-between items-center mb-12">
                        <h1 className="text-5xl font-black">{filter ? 'Filtrado' : 'Filmes'}</h1>
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
                                    placeholder="Buscar filmes..."
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

                {/* If not filtered, show standard Search/Filter header in the content flow if desired? 
            Or just replicate Home exactly? 
            Home doesn't have the Search Input visible by default, only StreamingPlatforms.
            Let's stick to Home's clean look unless filtered.
        */}

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
                                    placeholder="Buscar filmes..."
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
                        {filteredMovies && filteredMovies.length > 0 && (
                            <MediaRow
                                title="Filmes encontrados"
                                items={filteredMovies}
                                onSelect={handleSelect}
                                onPlay={onPlayMedia}
                                rowIndex={4}
                            />
                        )}
                    </section>
                ) : filter ? (
                    <div className="px-12 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-8">
                        {filteredMovies?.map((m, idx) => {
                            const visualRow = Math.floor(idx / COLS_PER_ROW);
                            const colInRow = idx % COLS_PER_ROW;
                            return (
                                <div
                                    key={`${m.type}-${m.tmdb_id || m.id}`}
                                    data-nav-row={4 + visualRow}
                                    data-nav-item
                                    data-nav-col={colInRow}
                                    tabIndex={0}
                                    onKeyDown={(e) => handleKeySelect(e, m)}
                                    className="focus:outline-none focus:ring-2 focus:ring-[#E50914] rounded-xl"
                                >
                                    <MediaCard media={m} onClick={() => { playSelectSound(); handleSelect(m); }} />
                                </div>
                            );
                        })}
                        {filteredMovies?.length === 0 && (
                            <div className="col-span-full text-center py-32 opacity-20">
                                <p className="text-2xl font-black uppercase tracking-[0.5em]">Nenhum filme encontrado</p>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="space-y-4">
                        {trendingMovies.length > 0 && (
                            <MediaRow
                                title="🔥 Em Alta"
                                items={trendingMovies}
                                onSelect={handleSelect}
                                onPlay={onPlayMedia}
                                rowIndex={4}
                            />
                        )}

                        {Array.from(effectiveMoviesByGenre.entries()).map(([genre, items], idx) => (
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

export default React.memo(Movies);
