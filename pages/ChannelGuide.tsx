import React, { useEffect, useRef, useMemo, useState, useCallback } from 'react';
import { X, Play } from 'lucide-react';
import { Channel } from '../types';
import {
  getChannelSchedule,
  getCurrentProgramme,
  getProgrammeProgress,
  formatTime,
  hasEPG,
  EPGProgramme,
} from '../services/epgService';
import { playSelectSound, playBackSound, playNavigateSound } from '../utils/soundEffects';
import { useSpatialNav } from '../hooks/useSpatialNavigation';

/* ═══ Estilos glass (referência Vision Pro) ═══ */
const GLASS_PANEL: React.CSSProperties = {
  background: 'rgba(0, 0, 0, 0.15)',
  backdropFilter: 'blur(24px)',
  WebkitBackdropFilter: 'blur(24px)',
  border: '1px solid rgba(255, 255, 255, 0.05)',
  boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.2)',
};

const PROGRAM_BLOCK: React.CSSProperties = {
  background: 'rgba(255, 255, 255, 0.1)',
  backdropFilter: 'blur(8px)',
  WebkitBackdropFilter: 'blur(8px)',
  border: '1px solid rgba(255, 255, 255, 0.12)',
};

const PROGRAM_HIGHLIGHT: React.CSSProperties = {
  background: 'linear-gradient(135deg, rgba(230, 20, 60, 0.7) 0%, rgba(139, 0, 0, 0.4) 100%)',
  border: '1px solid rgba(255, 100, 100, 0.4)',
  boxShadow: '0 4px 20px rgba(200, 0, 0, 0.3)',
};

const CHANNEL_ACTIVE: React.CSSProperties = {
  background: 'rgba(255, 255, 255, 0.15)',
  border: '1px solid rgba(255, 255, 255, 0.3)',
  boxShadow: '0 0 20px rgba(255, 255, 255, 0.05)',
};

interface ChannelGuideProps {
  channels: Channel[];
  onBack: () => void;
  onSelectChannel: (channel: Channel) => void;
}

const HOUR_WIDTH = 320;
const ROW_HEIGHT = 96;
const HOURS = 12;

const ChannelGuide: React.FC<ChannelGuideProps> = ({ channels, onBack, onSelectChannel }) => {
  // Desabilitar spatial nav — ChannelGuide tem seu próprio handler de D-pad
  const { setEnabled } = useSpatialNav();
  useEffect(() => {
    setEnabled(false);
    return () => setEnabled(true);
  }, [setEnabled]);

  const gridRef = useRef<HTMLDivElement>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const assistirBtnRef = useRef<HTMLButtonElement>(null);
  const [selectedProg, setSelectedProg] = useState<{ prog: EPGProgramme; channel: Channel } | null>(null);
  const [tick, setTick] = useState(0);
  const [focusedChIdx, setFocusedChIdx] = useState(0);

  // Canais com EPG; se nenhum tiver EPG (ex: EPG não carregou), mostrar todos
  const epgChannels = useMemo(() => {
    const withEpg = channels.filter(c => hasEPG(c.name));
    return withEpg.length > 0 ? withEpg : channels;
  }, [channels]);

  const baseTime = useMemo(() => {
    const d = new Date();
    d.setMinutes(0, 0, 0);
    d.setHours(d.getHours() - 2);
    return d;
  }, []);

  const timeSlots = useMemo(
    () => Array.from({ length: HOURS }, (_, i) => {
      const t = new Date(baseTime);
      t.setHours(baseTime.getHours() + i);
      return t;
    }),
    [baseTime],
  );

  // Scroll horizontal para hora atual no mount
  useEffect(() => {
    if (gridRef.current) {
      const now = new Date();
      const px = ((now.getTime() - baseTime.getTime()) / 3600000) * HOUR_WIDTH;
      gridRef.current.scrollLeft = Math.max(0, px - 200);
    }
  }, [baseTime]);

  // Tick a cada 60s para atualizar progresso
  useEffect(() => {
    const iv = setInterval(() => setTick(t => t + 1), 60000);
    return () => clearInterval(iv);
  }, []);

  // Escape / D-Pad
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (selectedProg) {
        if (e.key === 'Escape' || e.key === 'Backspace') {
          e.preventDefault();
          e.stopPropagation();
          playBackSound();
          setSelectedProg(null);
        }
        return;
      }

      switch (e.key) {
        case 'Escape':
        case 'Backspace': {
          const tag = (e.target as HTMLElement)?.tagName;
          if (tag === 'INPUT' || tag === 'TEXTAREA') return;
          e.preventDefault();
          e.stopPropagation();
          playBackSound();
          onBack();
          break;
        }
        case 'ArrowUp':
          e.preventDefault();
          playNavigateSound();
          setFocusedChIdx(prev => Math.max(0, prev - 1));
          break;
        case 'ArrowDown':
          e.preventDefault();
          playNavigateSound();
          setFocusedChIdx(prev => Math.min(epgChannels.length - 1, prev + 1));
          break;
        case 'ArrowLeft':
          e.preventDefault();
          if (gridRef.current) gridRef.current.scrollLeft -= HOUR_WIDTH;
          break;
        case 'ArrowRight':
          e.preventDefault();
          if (gridRef.current) gridRef.current.scrollLeft += HOUR_WIDTH;
          break;
        case 'Enter':
          e.preventDefault();
          playSelectSound();
          if (epgChannels[focusedChIdx]) {
            onSelectChannel(epgChannels[focusedChIdx]);
          }
          break;
      }
    };
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, [selectedProg, onBack, epgChannels, focusedChIdx]);

  // Auto-scroll sidebar para canal focado
  useEffect(() => {
    if (sidebarRef.current) {
      const items = sidebarRef.current.querySelectorAll('[data-ch-item]');
      const item = items[focusedChIdx] as HTMLElement;
      if (item) item.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [focusedChIdx]);

  // Auto-scroll grid rows para canal focado
  useEffect(() => {
    if (gridRef.current) {
      const rows = gridRef.current.querySelectorAll('[data-ch-row]');
      const row = rows[focusedChIdx] as HTMLElement;
      if (row) {
        const container = gridRef.current;
        const rowTop = row.offsetTop - container.offsetTop;
        container.scrollTo({ top: rowTop - 60, behavior: 'smooth' });
      }
    }
  }, [focusedChIdx]);

  // Auto-focus Assistir Canal quando popup abre
  useEffect(() => {
    if (selectedProg && assistirBtnRef.current) {
      assistirBtnRef.current.focus();
    }
  }, [selectedProg]);

  const now = new Date();
  const totalWidth = HOURS * HOUR_WIDTH;

  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col p-5 gap-5 overflow-hidden"
      style={{ background: '#000', fontFamily: "'Inter', system-ui, -apple-system, sans-serif" }}
    >
      {/* ═══ HEADER ═══ */}
      <header className="flex justify-between items-stretch h-24 gap-4 shrink-0">
        {/* Painel título */}
        <div className="flex-1 rounded-3xl px-8 py-5 flex flex-col justify-center" style={GLASS_PANEL}>
          <h1
            className="text-2xl tracking-tight text-white mb-0.5 font-bold uppercase"
            style={{ textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}
          >
            Guia de Programação
          </h1>
          <div className="flex items-center text-white/50 text-[11px] font-semibold tracking-widest uppercase">
            <span>{epgChannels.length} Canais</span>
            <span className="mx-3 opacity-30">•</span>
            <span>
              {now.toLocaleDateString('pt-BR', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </span>
          </div>
        </div>

        {/* Relógio + Fechar */}
        <div className="flex items-center gap-4">
          <div className="rounded-3xl px-7 h-full flex items-center" style={GLASS_PANEL}>
            <span className="text-3xl font-light tracking-widest text-white/90 tabular-nums">
              {now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
          <button
            onClick={() => {
              playBackSound();
              onBack();
            }}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                e.preventDefault();
                playBackSound();
                onBack();
              }
            }}
            tabIndex={0}
            className="aspect-square h-full rounded-3xl flex items-center justify-center hover:bg-white/10 transition-colors group focus:outline-none focus:ring-2 focus:ring-[#E50914]"
            style={GLASS_PANEL}
          >
            <X size={22} className="text-white/60 group-hover:text-white transition-colors" />
          </button>
        </div>
      </header>

      {/* ═══ MAIN CONTENT ═══ */}
      <section className="flex flex-1 gap-5 overflow-hidden min-h-0">
        {/* ── Sidebar de Canais ── */}
        <aside
          ref={sidebarRef}
          className="w-72 rounded-3xl p-3 flex flex-col gap-1.5 overflow-y-auto shrink-0 epg-no-scrollbar"
          style={GLASS_PANEL}
        >
          {epgChannels.map((channel, idx) => {
            const isFocused = idx === focusedChIdx;
            const currentProg = getCurrentProgramme(channel.name);
            return (
              <button
                key={channel.name}
                data-ch-item={idx}
                onClick={() => {
                  playSelectSound();
                  setFocusedChIdx(idx);
                  onSelectChannel(channel);
                }}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    playSelectSound();
                    onSelectChannel(channel);
                  }
                }}
                tabIndex={0}
                className={`rounded-2xl flex items-center gap-4 p-4 cursor-pointer shrink-0 transition-all duration-200 text-left focus:outline-none ${
                  isFocused ? '' : 'opacity-70 hover:opacity-100 hover:bg-white/5'
                }`}
                style={isFocused ? CHANNEL_ACTIVE : { border: '1px solid transparent' }}
              >
                <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0 overflow-hidden">
                  {channel.logo ? (
                    <img
                      src={channel.logo}
                      alt=""
                      className="w-full h-full object-contain p-1"
                      onError={e => {
                        const el = e.target as HTMLImageElement;
                        el.style.display = 'none';
                        const fallback = el.nextElementSibling as HTMLElement;
                        if (fallback) fallback.style.display = 'flex';
                      }}
                    />
                  ) : null}
                  <span
                    className="text-xs font-bold text-white/40"
                    style={{ display: channel.logo ? 'none' : 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    {channel.name.substring(0, 2).toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <span
                    className={`text-sm font-bold tracking-wide block truncate ${
                      isFocused ? 'text-white' : 'text-white/80'
                    }`}
                  >
                    {channel.name}
                  </span>
                  {currentProg && (
                    <span className="text-[10px] text-white/40 font-medium truncate block mt-0.5">
                      {currentProg.title}
                    </span>
                  )}
                  {channel.category && (
                    <span className="text-[9px] text-white/25 font-bold uppercase tracking-wider block">
                      {channel.category}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </aside>

        {/* ── Grade de Programação ── */}
        <div className="flex-1 rounded-3xl flex flex-col relative overflow-hidden" style={GLASS_PANEL}>
          {/* Scrollable grid */}
          <div
            ref={gridRef}
            className="flex-1 overflow-auto epg-no-scrollbar relative"
          >
            <div style={{ width: `${totalWidth}px`, minHeight: '100%' }}>
              {/* Time header (sticky top) */}
              <div
                className="sticky top-0 z-20 flex h-11 border-b border-white/5"
                style={{ background: 'rgba(0, 0, 0, 0.5)', backdropFilter: 'blur(16px)' }}
              >
                {timeSlots.map((t, i) => (
                  <div
                    key={i}
                    className="shrink-0 flex items-center pl-5"
                    style={{
                      width: `${HOUR_WIDTH}px`,
                      borderLeft: i > 0 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                    }}
                  >
                    <span className="text-xs text-white/40 font-bold tracking-widest uppercase">
                      {t.getHours().toString().padStart(2, '0')}:00
                    </span>
                  </div>
                ))}
              </div>

              {/* Linhas de canal / programa */}
              <div className="flex flex-col gap-3 p-5">
                {epgChannels.map((channel, chIdx) => {
                  const schedule = getChannelSchedule(channel.name, 60);
                  const isFocusedRow = chIdx === focusedChIdx;
                  return (
                    <div
                      key={channel.name}
                      data-ch-row={chIdx}
                      className={`relative flex items-stretch gap-3 transition-all duration-200 ${
                        isFocusedRow ? '' : 'opacity-50'
                      }`}
                      style={{ height: `${ROW_HEIGHT}px` }}
                    >
                      {/* Linhas guia verticais para horas */}
                      {timeSlots.map((_, i) =>
                        i > 0 ? (
                          <div
                            key={i}
                            className="absolute top-0 bottom-0 pointer-events-none"
                            style={{
                              left: `${i * HOUR_WIDTH}px`,
                              borderLeft: '1px solid rgba(255,255,255,0.03)',
                            }}
                          />
                        ) : null,
                      )}

                      {schedule.map((prog, i) => {
                        const startOff =
                          (prog.start.getTime() - baseTime.getTime()) / 3600000;
                        const dur =
                          (prog.stop.getTime() - prog.start.getTime()) / 3600000;
                        if (startOff + dur < 0 || startOff > HOURS) return null;
                        const left = Math.max(0, startOff) * HOUR_WIDTH;
                        const width =
                          Math.min(dur, HOURS - Math.max(0, startOff)) * HOUR_WIDTH;
                        if (width < 20) return null;
                        const isCurrent = prog.start <= now && prog.stop > now;
                        const progress = isCurrent ? getProgrammeProgress(prog) : 0;

                        return (
                          <div
                            key={`${prog.start.getTime()}-${i}`}
                            onClick={() => {
                              playSelectSound();
                              setSelectedProg({ prog, channel });
                            }}
                            onKeyDown={e => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                playSelectSound();
                                setSelectedProg({ prog, channel });
                              }
                            }}
                            tabIndex={0}
                            role="button"
                            className="absolute top-0 bottom-0 rounded-2xl overflow-hidden cursor-pointer transition-all duration-200 flex flex-col justify-center focus:outline-none focus:ring-2 focus:ring-[#E50914]"
                            style={{
                              left: `${left}px`,
                              width: `${Math.max(width - 6, 40)}px`,
                              padding: '16px 20px',
                              ...(isCurrent ? PROGRAM_HIGHLIGHT : PROGRAM_BLOCK),
                            }}
                            onMouseEnter={e => {
                              if (!isCurrent) {
                                const el = e.currentTarget;
                                el.style.background = 'rgba(255, 255, 255, 0.18)';
                                el.style.borderColor = 'rgba(255, 255, 255, 0.25)';
                                el.style.transform = 'scale(1.01)';
                              }
                            }}
                            onMouseLeave={e => {
                              if (!isCurrent) {
                                const el = e.currentTarget;
                                el.style.background = 'rgba(255, 255, 255, 0.1)';
                                el.style.borderColor = 'rgba(255, 255, 255, 0.12)';
                                el.style.transform = 'scale(1)';
                              }
                            }}
                          >
                            <h3
                              className={`font-black uppercase tracking-wide leading-tight truncate ${
                                isCurrent
                                  ? 'text-lg text-white drop-shadow-md'
                                  : 'text-sm text-white/80'
                              }`}
                            >
                              {prog.title}
                            </h3>
                            {width > 100 && (
                              <span
                                className={`text-[10px] font-bold mt-1 ${
                                  isCurrent ? 'text-white/70' : 'text-white/40'
                                }`}
                              >
                                {formatTime(prog.start)} – {formatTime(prog.stop)}
                              </span>
                            )}
                            {/* Barra de progresso no programa atual */}
                            {isCurrent && (
                              <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-black/30 rounded-b-2xl overflow-hidden">
                                <div
                                  className="h-full transition-all duration-1000"
                                  style={{
                                    width: `${progress}%`,
                                    background:
                                      'linear-gradient(to right, white, rgba(255,255,255,0.8), rgba(255,255,255,0.5))',
                                    boxShadow: '0 0 10px rgba(255,255,255,0.5)',
                                  }}
                                />
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ── Linha vertical do horário atual ── */}
            {(() => {
              const nowPx =
                ((now.getTime() - baseTime.getTime()) / 3600000) * HOUR_WIDTH;
              return (
                <div
                  className="absolute top-0 bottom-0 w-px z-25 pointer-events-none"
                  style={{
                    left: `${nowPx}px`,
                    background:
                      'linear-gradient(to bottom, rgba(52,211,153,0.5), rgba(52,211,153,0.08))',
                  }}
                >
                  <div
                    className="sticky top-0 -ml-1.5 w-3 h-3 rounded-full"
                    style={{
                      background: 'rgba(52,211,153,0.7)',
                      boxShadow: '0 0 12px rgba(52,211,153,0.5)',
                    }}
                  />
                </div>
              );
            })()}
          </div>

          {/* Fade inferior */}
          <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-black/50 to-transparent pointer-events-none rounded-b-3xl" />
        </div>
      </section>

      {/* ═══ POPUP DETALHE DO PROGRAMA ═══ */}
      {selectedProg && (
        <div className="absolute inset-0 z-50 flex items-end justify-center pb-8 pointer-events-none">
          <div
            className="pointer-events-auto max-w-lg w-full mx-4 rounded-3xl p-6 space-y-3"
            style={{
              background:
                'linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.04) 100%)',
              backdropFilter: 'blur(40px)',
              WebkitBackdropFilter: 'blur(40px)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              boxShadow:
                '0 8px 60px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.08)',
              animation: 'slideUp 0.3s ease-out',
            }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center overflow-hidden">
                  {selectedProg.channel.logo ? (
                    <img
                      src={selectedProg.channel.logo}
                      alt=""
                      className="w-full h-full object-contain p-1"
                      onError={e => {
                        const el = e.target as HTMLImageElement;
                        el.style.display = 'none';
                        const fb = el.nextElementSibling as HTMLElement;
                        if (fb) fb.style.display = 'flex';
                      }}
                    />
                  ) : null}
                  <span
                    className="text-[10px] font-bold text-white/40"
                    style={{ display: selectedProg.channel.logo ? 'none' : 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    {selectedProg.channel.name.substring(0, 2).toUpperCase()}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-white/40 font-bold uppercase tracking-wider">
                    {selectedProg.channel.name}
                  </span>
                  <h3 className="text-base font-black uppercase text-white leading-tight">
                    {selectedProg.prog.title}
                  </h3>
                </div>
              </div>
              <button
                onClick={() => setSelectedProg(null)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    playBackSound();
                    setSelectedProg(null);
                  }
                }}
                tabIndex={0}
                className="w-9 h-9 rounded-xl bg-white/5 border border-white/8 flex items-center justify-center text-white/30 hover:text-white hover:bg-white/10 transition-all focus:outline-none focus:ring-2 focus:ring-[#E50914]"
              >
                <X size={14} />
              </button>
            </div>

            <div className="flex items-center gap-2 text-[10px] text-white/40">
              <span className="font-bold">
                {formatTime(selectedProg.prog.start)} –{' '}
                {formatTime(selectedProg.prog.stop)}
              </span>
              {selectedProg.prog.category && (
                <span className="px-2 py-0.5 rounded-lg bg-white/5 border border-white/5 text-white/30">
                  {selectedProg.prog.category}
                </span>
              )}
              {selectedProg.prog.episode && (
                <span className="text-white/25">{selectedProg.prog.episode}</span>
              )}
            </div>

            {selectedProg.prog.description &&
              !/^\[\d/.test(selectedProg.prog.description) && (
                <p className="text-xs text-white/40 leading-relaxed">
                  {selectedProg.prog.description}
                </p>
              )}

            <button
              ref={assistirBtnRef}
              onClick={() => {
                playSelectSound();
                onSelectChannel(selectedProg.channel);
                setSelectedProg(null);
              }}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  playSelectSound();
                  onSelectChannel(selectedProg.channel);
                  setSelectedProg(null);
                }
              }}
              className="flex items-center gap-2 px-5 py-2.5 rounded-2xl text-xs font-bold text-white/80 hover:text-white transition-all focus:outline-none focus:ring-2 focus:ring-[#E50914]"
              style={{
                background: 'rgba(255, 255, 255, 0.08)',
                backdropFilter: 'blur(8px)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
              }}
            >
              <Play size={14} fill="currentColor" /> Assistir Canal
            </button>
          </div>
        </div>
      )}

      {/* ═══ Ambient overlay (efeito sutil de cor) ═══ */}
      <div
        className="fixed inset-0 pointer-events-none mix-blend-soft-light opacity-20"
        style={{
          background:
            'linear-gradient(to bottom right, rgba(99,102,241,0.3), transparent, rgba(244,63,94,0.2))',
        }}
      />

      {/* ═══ Hide scrollbars ═══ */}
      <style>{`
        .epg-no-scrollbar::-webkit-scrollbar { display: none; }
        .epg-no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        @keyframes slideUp {
          from { transform: translateY(20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
};

export default ChannelGuide;
