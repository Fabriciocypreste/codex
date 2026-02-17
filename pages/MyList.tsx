
import React, { useState, useEffect, useCallback } from 'react';
import { Media } from '../types';
import MediaCard from '../components/MediaCard';
import { Trash2, PlusCircle, Loader2, BookmarkCheck, Clock } from 'lucide-react';
import { userService } from '../services/userService';
import { getAllMovies, getAllSeries } from '../services/supabaseService';
import { playSelectSound } from '../utils/soundEffects';

interface MyListProps {
  onSelectMedia: (media: Media) => void;
  onPlayMedia?: (media: Media) => void;
}

type ListTab = 'watchlist' | 'watch_later';

const COLS_PER_ROW = 6;

const MyList: React.FC<MyListProps> = ({ onSelectMedia, onPlayMedia }) => {
  const [myList, setMyList] = useState<Media[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<ListTab>('watchlist');
  const [removingId, setRemovingId] = useState<string | null>(null);

  const loadList = useCallback(async () => {
    setLoading(true);
    try {
      const [libraryItems, dbMovies, dbSeries] = await Promise.all([
        userService.getLibraryItems(activeTab),
        getAllMovies(),
        getAllSeries(),
      ]);

      const allContent: Media[] = [
        ...dbMovies.map(m => ({ ...m, type: 'movie' as const })),
        ...dbSeries.map(s => ({ ...s, type: 'series' as const }))
      ];
      const tmdbIds = new Set(libraryItems.map((li: any) => Number(li.tmdb_id)));
      const matched = allContent.filter(m => tmdbIds.has(Number(m.tmdb_id)));
      setMyList(matched);
    } catch (err) {
      console.error('[MyList] Erro ao carregar lista:', err);
      setMyList([]);
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => { loadList(); }, [loadList]);

  const handleRemove = async (media: Media) => {
    setRemovingId(media.id);
    try {
      await userService.toggleLibraryItem(Number(media.tmdb_id), media.type, activeTab);
      setMyList(prev => prev.filter(m => m.id !== media.id));
    } catch (err) {
      console.error('[MyList] Erro ao remover:', err);
    } finally {
      setRemovingId(null);
    }
  };

  const tabs: { id: ListTab; label: string; icon: typeof BookmarkCheck }[] = [
    { id: 'watchlist', label: 'Watchlist', icon: BookmarkCheck },
    { id: 'watch_later', label: 'Assistir Depois', icon: Clock },
  ];

  const handleTabSelect = (tab: ListTab) => {
    playSelectSound();
    setActiveTab(tab);
  };

  return (
    <div className="w-full max-w-7xl mx-auto space-y-8 pb-20 animate-fade-in px-12" style={{ paddingTop: '5cm' }}>
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-4xl font-black">Minha Lista</h1>
        <div className="text-white/40 text-sm font-medium uppercase tracking-[0.2em]">
          {myList.length} {myList.length === 1 ? 'Item Salvo' : 'Itens Salvos'}
        </div>
      </div>

      {/* Tabs — D-Pad navigable */}
      <div className="flex gap-4" data-nav-row={0}>
        {tabs.map((tab, idx) => (
          <button
            key={tab.id}
            data-nav-item
            data-nav-col={idx}
            tabIndex={0}
            onClick={() => handleTabSelect(tab.id)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleTabSelect(tab.id); } }}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-bold uppercase tracking-wider transition-all outline-none focus:ring-2 focus:ring-[#E50914] focus:scale-105 ${
              activeTab === tab.id
                ? 'bg-white text-black'
                : 'glass text-white/60 hover:text-white hover:bg-white/10'
            }`}
          >
            <tab.icon className="w-4 h-4" /> {tab.label}
          </button>
        ))}
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-32">
          <Loader2 className="w-10 h-10 animate-spin text-white/40" />
        </div>
      )}

      {/* Empty State */}
      {!loading && myList.length === 0 && (
        <div className="flex flex-col items-center justify-center py-32 gap-4 text-white/30">
          <PlusCircle className="w-16 h-16" />
          <p className="text-xl font-bold">Nenhum item na {activeTab === 'watchlist' ? 'Watchlist' : 'lista Assistir Depois'}</p>
          <p className="text-sm">Adicione filmes e séries usando o botão + nos cards</p>
        </div>
      )}

      {/* Grid — each card is D-Pad navigable */}
      {!loading && myList.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-8">
          {myList.map((m, idx) => {
            const visualRow = Math.floor(idx / COLS_PER_ROW);
            const colInRow = idx % COLS_PER_ROW;
            return (
              <div
                key={m.id}
                className="relative group"
                data-nav-row={1 + visualRow}
                data-nav-item
                data-nav-col={colInRow}
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    playSelectSound();
                    onSelectMedia(m);
                  }
                }}
              >
                <MediaCard
                  media={m}
                  onClick={() => onSelectMedia(m)}
                  onPlay={onPlayMedia ? () => onPlayMedia(m) : undefined}
                  size="md"
                />
                <button
                  disabled={removingId === m.id}
                  onClick={() => handleRemove(m)}
                  tabIndex={-1}
                  className="absolute -top-3 -right-3 w-9 h-9 rounded-full glass border border-white/20 flex items-center justify-center opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-all hover:bg-red-500/30 hover:text-red-400 hover:border-red-500/40 disabled:opacity-50"
                >
                  {removingId === m.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default MyList;
