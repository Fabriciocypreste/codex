import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Media } from '../types';
import { supabase } from '../services/supabaseService';
import { useSpatialNav } from '../hooks/useSpatialNavigation';
import MediaCard from '../components/MediaCard';
import { motion, AnimatePresence } from 'framer-motion';
import { FaSearch, FaTimes, FaFilm, FaTv, FaBackspace } from 'react-icons/fa';
import { playSelectSound, playNavigateSound } from '../utils/soundEffects';

// ═══ TECLADO VIRTUAL VISIONOS ═══
const KEYBOARD_ROWS = [
  ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', 'Ç'],
  ['Z', 'X', 'C', 'V', 'B', 'N', 'M', '.', '-', '⌫'],
  ['ESPAÇO'],
];

interface SearchProps {
  onSelectMedia: (media: Media) => void;
  onPlayMedia: (media: Media) => void;
}

const Search: React.FC<SearchProps> = ({ onSelectMedia, onPlayMedia }) => {
  const { setPosition } = useSpatialNav();
  
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Media[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedType, setSelectedType] = useState<'all' | 'movie' | 'series'>('all');
  const [hasSearched, setHasSearched] = useState(false);
  const [focusedRow, setFocusedRow] = useState(0);
  const [focusedCol, setFocusedCol] = useState(0);
  const [focusArea, setFocusArea] = useState<'keyboard' | 'filters' | 'results'>('keyboard');
  const [focusedResultIdx, setFocusedResultIdx] = useState(0);
  const keyboardRef = useRef<HTMLDivElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  // Debounced search
  const searchTimerRef = useRef<NodeJS.Timeout>();
  
  const performSearch = useCallback(async (searchQuery: string, type: string) => {
    if (!searchQuery.trim()) {
      setResults([]);
      setHasSearched(false);
      return;
    }

    setLoading(true);
    try {
      const searchTerm = searchQuery.trim();
      
      let movieResults: Media[] = [];
      if (type === 'all' || type === 'movie') {
        const { data: movies, error: movieError } = await supabase
          .from('movies')
          .select('*')
          .or(`title.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%`)
          .eq('status', 'published')
          .limit(20);

        if (!movieError && movies) {
          movieResults = movies.map(m => ({
            ...m,
            type: 'movie' as const,
            rating: m.rating || 'N/A',
            year: m.year || new Date().getFullYear(),
            duration: m.duration || '',
            genre: m.genre || [],
            backdrop: m.backdrop || '',
            poster: m.poster || '',
            logo_url: m.logo_url || '',
            stream_url: m.stream_url || '',
            trailer_url: m.trailer_url || '',
            use_trailer: m.use_trailer || false,
            platform: m.platform || '',
            status: m.status || 'published',
            stars: m.stars || [],
            director: m.director || '',
            seasons: m.seasons || 0,
            trailer_key: m.trailer_key || '',
            group_title: m.group_title || ''
          }));
        }
      }

      let seriesResults: Media[] = [];
      if (type === 'all' || type === 'series') {
        const { data: series, error: seriesError } = await supabase
          .from('series')
          .select('*')
          .or(`title.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%`)
          .eq('status', 'published')
          .limit(20);

        if (!seriesError && series) {
          seriesResults = series.map(s => ({
            ...s,
            type: 'series' as const,
            rating: s.rating || 'N/A',
            year: s.year || new Date().getFullYear(),
            duration: s.duration || '',
            genre: s.genre || [],
            backdrop: s.backdrop || '',
            poster: s.poster || '',
            logo_url: s.logo_url || '',
            stream_url: s.stream_url || '',
            trailer_url: s.trailer_url || '',
            use_trailer: s.use_trailer || false,
            platform: s.platform || '',
            status: s.status || 'published',
            stars: s.stars || [],
            director: s.director || '',
            seasons: s.seasons || 0,
            trailer_key: s.trailer_key || '',
            group_title: s.group_title || ''
          }));
        }
      }

      const allResults = [...movieResults, ...seriesResults];
      setResults(allResults);
      setHasSearched(true);
    } catch (error) {
      console.error('Erro na busca:', error);
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Disparar busca com debounce ao alterar query
  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => performSearch(query, selectedType), 400);
    return () => { if (searchTimerRef.current) clearTimeout(searchTimerRef.current); };
  }, [query, selectedType, performSearch]);

  // Tecla pressionada no teclado virtual
  const handleKeyPress = useCallback((key: string) => {
    playSelectSound();
    if (key === '⌫') {
      setQuery(prev => prev.slice(0, -1));
    } else if (key === 'ESPAÇO') {
      setQuery(prev => prev + ' ');
    } else {
      setQuery(prev => prev + key.toLowerCase());
    }
  }, []);

  const clearSearch = useCallback(() => {
    setQuery('');
    setResults([]);
    setHasSearched(false);
    playSelectSound();
  }, []);

  const handleTypeChange = useCallback((type: 'all' | 'movie' | 'series') => {
    setSelectedType(type);
    playSelectSound();
  }, []);

  // ═══ NAVEGAÇÃO D-PAD ═══
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key;

      if (focusArea === 'keyboard') {
        const currentRow = KEYBOARD_ROWS[focusedRow];
        if (key === 'ArrowRight') {
          e.preventDefault();
          playNavigateSound();
          setFocusedCol(prev => Math.min(prev + 1, currentRow.length - 1));
        } else if (key === 'ArrowLeft') {
          e.preventDefault();
          playNavigateSound();
          setFocusedCol(prev => Math.max(prev - 1, 0));
        } else if (key === 'ArrowDown') {
          e.preventDefault();
          playNavigateSound();
          if (focusedRow < KEYBOARD_ROWS.length - 1) {
            const nextRow = KEYBOARD_ROWS[focusedRow + 1];
            setFocusedRow(prev => prev + 1);
            setFocusedCol(prev => Math.min(prev, nextRow.length - 1));
          } else if (results.length > 0) {
            setFocusArea('results');
            setFocusedResultIdx(0);
          }
        } else if (key === 'ArrowUp') {
          e.preventDefault();
          playNavigateSound();
          if (focusedRow > 0) {
            const prevRow = KEYBOARD_ROWS[focusedRow - 1];
            setFocusedRow(prev => prev - 1);
            setFocusedCol(prev => Math.min(prev, prevRow.length - 1));
          }
        } else if (key === 'Enter') {
          e.preventDefault();
          const pressedKey = KEYBOARD_ROWS[focusedRow][focusedCol];
          handleKeyPress(pressedKey);
        }
      } else if (focusArea === 'results') {
        const cols = 5;
        const totalResults = results.length;
        if (key === 'ArrowRight') {
          e.preventDefault();
          playNavigateSound();
          setFocusedResultIdx(prev => Math.min(prev + 1, totalResults - 1));
        } else if (key === 'ArrowLeft') {
          e.preventDefault();
          playNavigateSound();
          setFocusedResultIdx(prev => Math.max(prev - 1, 0));
        } else if (key === 'ArrowDown') {
          e.preventDefault();
          playNavigateSound();
          const next = focusedResultIdx + cols;
          if (next < totalResults) setFocusedResultIdx(next);
        } else if (key === 'ArrowUp') {
          e.preventDefault();
          playNavigateSound();
          const prev = focusedResultIdx - cols;
          if (prev >= 0) {
            setFocusedResultIdx(prev);
          } else {
            setFocusArea('keyboard');
            setFocusedRow(KEYBOARD_ROWS.length - 1);
            setFocusedCol(0);
          }
        } else if (key === 'Enter') {
          e.preventDefault();
          if (results[focusedResultIdx]) {
            playSelectSound();
            onSelectMedia(results[focusedResultIdx]);
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [focusArea, focusedRow, focusedCol, focusedResultIdx, results, handleKeyPress, onSelectMedia]);

  // Scroll automático no resultado focado
  useEffect(() => {
    if (focusArea === 'results') {
      const el = document.getElementById(`search-result-${focusedResultIdx}`);
      el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [focusArea, focusedResultIdx]);

  return (
    <div className="relative min-h-screen w-full bg-[#0B0B0F] text-white overflow-y-auto overflow-x-hidden">
      {/* Background */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(229,9,20,0.06)_0%,transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,rgba(229,9,20,0.04)_0%,transparent_50%)]" />
      </div>

      <div className="relative z-10 w-full max-w-6xl mx-auto px-6 py-8 flex flex-col gap-6">
        
        {/* Header */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center"
        >
          <h1 className="text-3xl font-black italic tracking-tighter uppercase">
            Buscar <span className="text-[#E50914]">Conteúdo</span>
          </h1>
          <p className="text-sm text-white/40 font-medium mt-1">Use o teclado para digitar</p>
        </motion.div>

        {/* Barra de texto (display) */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-2xl mx-auto"
        >
          <div
            className="relative flex items-center gap-3 px-5 py-3.5 rounded-2xl border backdrop-blur-2xl overflow-hidden"
            style={{
              background: 'linear-gradient(135deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.03) 100%)',
              borderColor: query ? 'rgba(229,9,20,0.4)' : 'rgba(255,255,255,0.12)',
              boxShadow: query
                ? '0 0 30px rgba(229,9,20,0.1), inset 0 1px 0 rgba(255,255,255,0.08)'
                : '0 4px 24px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.08)',
            }}
          >
            {/* Highlight visionOS */}
            <div className="absolute top-0 left-6 right-6 h-[1px] rounded-full" style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent)' }} />
            
            <FaSearch className="text-white/30 text-base shrink-0" />
            <div className="flex-1 min-h-[28px] flex items-center">
              {query ? (
                <span className="text-lg font-semibold text-white tracking-wide">{query}<span className="animate-pulse text-[#E50914] ml-0.5">|</span></span>
              ) : (
                <span className="text-lg text-white/25 italic">Buscar filmes e séries...</span>
              )}
            </div>
            {query && (
              <button
                onClick={clearSearch}
                className="p-2 rounded-xl bg-white/[0.08] hover:bg-white/[0.15] border border-white/[0.1] transition-all"
              >
                <FaTimes className="text-sm text-white/50" />
              </button>
            )}
            {loading && (
              <div className="w-5 h-5 border-2 border-[#E50914] border-t-transparent rounded-full animate-spin shrink-0" />
            )}
          </div>
        </motion.div>

        {/* Layout: Teclado à esquerda, Resultados à direita */}
        <div className="flex gap-6 items-start">
          
          {/* ═══ TECLADO VIRTUAL VISIONOS ═══ */}
          <motion.div
            ref={keyboardRef}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="shrink-0 w-[520px]"
          >
            <div
              className="rounded-3xl border backdrop-blur-2xl p-4 space-y-2"
              style={{
                background: 'linear-gradient(135deg, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0.02) 100%)',
                borderColor: 'rgba(255,255,255,0.1)',
                boxShadow: '0 8px 40px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.08)',
              }}
            >
              {/* Highlight superior */}
              <div className="absolute top-0 left-8 right-8 h-[1px] rounded-full" style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent)' }} />

              {KEYBOARD_ROWS.map((row, rowIdx) => (
                <div key={rowIdx} className="flex justify-center gap-1.5">
                  {row.map((key, colIdx) => {
                    const isFocused = focusArea === 'keyboard' && focusedRow === rowIdx && focusedCol === colIdx;
                    const isSpace = key === 'ESPAÇO';
                    const isBackspace = key === '⌫';

                    return (
                      <button
                        key={`${rowIdx}-${colIdx}`}
                        onClick={() => handleKeyPress(key)}
                        tabIndex={-1}
                        className={`
                          relative rounded-xl font-bold uppercase transition-all duration-200 select-none
                          flex items-center justify-center
                          ${isSpace ? 'flex-1 h-10 text-[10px] tracking-[0.3em]' : 'w-[46px] h-11 text-sm'}
                          ${isFocused
                            ? 'scale-110 z-20 text-white border-[#E50914]/60 shadow-[0_0_20px_rgba(229,9,20,0.3),0_4px_16px_rgba(0,0,0,0.4)]'
                            : 'text-white/70 border-white/[0.08] hover:text-white hover:bg-white/[0.1]'
                          }
                          border backdrop-blur-xl
                        `}
                        style={{
                          background: isFocused
                            ? 'linear-gradient(135deg, rgba(229,9,20,0.25) 0%, rgba(229,9,20,0.08) 50%, rgba(255,255,255,0.06) 100%)'
                            : 'linear-gradient(135deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 100%)',
                        }}
                      >
                        {/* Top highlight visionOS */}
                        <div
                          className={`absolute top-0 left-2 right-2 h-[1px] rounded-full transition-opacity ${isFocused ? 'opacity-50' : 'opacity-15'}`}
                          style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.6), transparent)' }}
                        />
                        {isBackspace ? <FaBackspace className="text-base" /> : key}
                      </button>
                    );
                  })}
                </div>
              ))}

              {/* Ações rápidas abaixo do teclado */}
              <div className="flex gap-2 pt-2 border-t border-white/[0.06]">
                {[
                  { key: 'all' as const, label: 'Tudo' },
                  { key: 'movie' as const, label: 'Filmes', icon: FaFilm },
                  { key: 'series' as const, label: 'Séries', icon: FaTv },
                ].map(({ key, label, icon: Icon }) => (
                  <button
                    key={key}
                    onClick={() => handleTypeChange(key)}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border backdrop-blur-xl
                      ${selectedType === key
                        ? 'text-white border-[#E50914]/40'
                        : 'text-white/40 border-white/[0.06] hover:text-white/60'
                      }`}
                    style={{
                      background: selectedType === key
                        ? 'linear-gradient(135deg, rgba(229,9,20,0.2) 0%, rgba(229,9,20,0.05) 100%)'
                        : 'linear-gradient(135deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.01) 100%)',
                    }}
                  >
                    {Icon && <Icon className="text-xs" />}
                    {label}
                  </button>
                ))}
                {query && (
                  <button
                    onClick={clearSearch}
                    className="px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest text-white/40 border border-white/[0.06] hover:text-[#E50914] hover:border-[#E50914]/30 transition-all backdrop-blur-xl"
                    style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.01) 100%)' }}
                  >
                    Limpar
                  </button>
                )}
              </div>
            </div>
          </motion.div>

          {/* ═══ RESULTADOS ═══ */}
          <div ref={resultsRef} className="flex-1 min-w-0">
            <AnimatePresence mode="wait">
              {loading && !hasSearched ? (
                <motion.div
                  key="loading"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex flex-col items-center gap-4 py-16"
                >
                  <div className="w-10 h-10 border-3 border-[#E50914] border-t-transparent rounded-full animate-spin" />
                  <p className="text-sm text-white/40">Buscando...</p>
                </motion.div>
              ) : hasSearched && results.length === 0 ? (
                <motion.div
                  key="no-results"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="text-center py-16"
                >
                  <FaSearch className="text-4xl text-white/10 mx-auto mb-3" />
                  <h3 className="text-lg font-bold text-white/40 mb-1">Nenhum resultado</h3>
                  <p className="text-xs text-white/20">Tente outras palavras-chave</p>
                </motion.div>
              ) : results.length > 0 ? (
                <motion.div
                  key="results"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="space-y-4"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black uppercase tracking-widest text-white/30">
                      {results.length} resultado{results.length !== 1 ? 's' : ''}
                    </span>
                    <div className="h-px flex-1 bg-white/[0.06]" />
                  </div>

                  <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-5 gap-y-8">
                    {results.map((media, index) => {
                      const isResultFocused = focusArea === 'results' && focusedResultIdx === index;
                      return (
                        <div
                          key={`${media.type}-${media.id}`}
                          id={`search-result-${index}`}
                          className={`transition-all duration-200 rounded-2xl p-1 ${isResultFocused ? 'scale-105 ring-2 ring-[#E50914] z-10' : ''}`}
                        >
                          <MediaCard
                            media={media}
                            onClick={() => {
                              playSelectSound();
                              onSelectMedia(media);
                            }}
                            onPlay={() => {
                              playSelectSound();
                              onPlayMedia(media);
                            }}
                            size="md"
                          />
                        </div>
                      );
                    })}
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="text-center py-16"
                >
                  <FaSearch className="text-5xl text-white/[0.06] mx-auto mb-4" />
                  <h3 className="text-lg font-bold text-white/20 mb-1">Busque por conteúdo</h3>
                  <p className="text-xs text-white/10">Use o teclado para digitar</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Search;