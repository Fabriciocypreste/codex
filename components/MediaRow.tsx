import React, { useRef, useMemo, useState, useEffect } from 'react';
import { Media } from '../types';
import MediaCard from './MediaCard';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { deduplicateMedia, getMediaPoster, PLACEHOLDER_POSTER } from '../utils/mediaUtils';

interface MediaRowProps {
    title: string;
    items: Media[];
    onSelect: (media: Media) => void;
    onPlay?: (media: Media) => void;
    showProgress?: boolean;
    rowIndex?: number;
}

const MediaRow: React.FC<MediaRowProps> = React.memo(({ title, items, onSelect, onPlay, showProgress, rowIndex = 0 }) => {
    const rowRef = useRef<HTMLDivElement>(null);
    const sectionRef = useRef<HTMLDivElement>(null);
    const [isVisible, setIsVisible] = useState(false);

    // Lazy rendering: only render content when row is near viewport
    useEffect(() => {
        if (!sectionRef.current) return;
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setIsVisible(true);
                    observer.disconnect();
                }
            },
            { rootMargin: '400px' } // Pre-load 400px before visible
        );
        observer.observe(sectionRef.current);
        return () => observer.disconnect();
    }, []);

    // Deduplicate and filter invalid items
    const validItems = useMemo(() => {
        const deduped = deduplicateMedia(items);
        return deduped.filter(m => {
            const poster = getMediaPoster(m);
            return poster !== PLACEHOLDER_POSTER || m.backdrop;
        });
    }, [items]);

    const scroll = useMemo(() => (direction: 'left' | 'right') => {
        if (rowRef.current) {
            const { scrollLeft, clientWidth } = rowRef.current;
            const scrollTo = direction === 'left'
                ? scrollLeft - clientWidth * 0.8
                : scrollLeft + clientWidth * 0.8;
            rowRef.current.scrollTo({ left: scrollTo, behavior: 'smooth' });
        }
    }, []);

    // Don't render empty rows
    if (validItems.length === 0) return null;

    return (
        <section ref={sectionRef} data-nav-row={rowIndex} className="px-12 relative group mt-8">
            <h2 className="text-2xl font-bold mb-8 flex items-center gap-4">
                {title}
                <div className="h-px flex-1 bg-linear-to-r from-white/20 to-transparent" />
            </h2>

            <div className="relative">
                {/* Navigation Buttons */}
                <button
                    onClick={() => scroll('left')}
                    className="absolute left-[-40px] top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-black/40 border border-white/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-20 hover:bg-black/60 active:scale-95"
                    aria-label="Scroll Left"
                    tabIndex={-1}
                >
                    <ChevronLeft className="w-6 h-6" />
                </button>

                <button
                    onClick={() => scroll('right')}
                    className="absolute right-[-40px] top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-black/40 border border-white/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-20 hover:bg-black/60 active:scale-95"
                    aria-label="Scroll Right"
                    tabIndex={-1}
                >
                    <ChevronRight className="w-6 h-6" />
                </button>

                <div
                    ref={rowRef}
                    data-nav-scroll
                    className="flex gap-5 overflow-x-auto pb-12 px-4 -mx-4 scrollbar-hide scroll-smooth"
                    style={{
                        scrollbarWidth: 'none',
                        msOverflowStyle: 'none'
                    }}
                >
                    {isVisible ? validItems.map((m, idx) => (
                        <div key={`${m.type}-${m.tmdb_id || m.id}`} className="relative flex-shrink-0">
                            <MediaCard media={m} onClick={() => onSelect(m)} onPlay={onPlay ? () => onPlay(m) : undefined} colIndex={idx} />
                            {showProgress && (
                                <div className="absolute bottom-4 left-4 right-4 h-1 bg-white/20 rounded-full overflow-hidden">
                                    <div className="h-full bg-[#E50914] w-[60%]" />
                                </div>
                            )}
                        </div>
                    )) : (
                        /* Placeholder while off-screen */
                        <div style={{ height: '384px', width: '100%' }} className="bg-white/5 rounded-[24px] animate-pulse" />
                    )}
                </div>
            </div>
        </section>
    );
});

MediaRow.displayName = 'MediaRow';
export default MediaRow;
