import React, { useEffect, useRef, useMemo, useState } from 'react';
import { ArrowLeft, Clock, X, Play } from 'lucide-react';
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

interface ChannelGuideProps {
  channels: Channel[];
  onBack: () => void;
  onSelectChannel: (channel: Channel) => void;
}

const HOUR_WIDTH = 360;
const ROW_HEIGHT = 68;
const CHANNEL_COL = 200;
const HOURS = 12;

const ChannelGuide: React.FC<ChannelGuideProps> = ({ channels, onBack, onSelectChannel }) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const assistirBtnRef = useRef<HTMLButtonElement>(null);
  const [selectedProg, setSelectedProg] = useState<{ prog: EPGProgramme; channel: Channel } | null>(null);
  const [tick, setTick] = useState(0);
  const [focusedChIdx, setFocusedChIdx] = useState(0);

  const epgChannels = useMemo(() => channels.filter(c => hasEPG(c.nome)), [channels]);

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

  // Scroll to current time on mount
  useEffect(() => {
    if (scrollRef.current) {
      const now = new Date();
      const px = ((now.getTime() - baseTime.getTime()) / 3600000) * HOUR_WIDTH;
      scrollRef.current.scrollLeft = Math.max(0, px - 300);
    }
  }, [baseTime]);

  // Tick every 60s for progress updates
  useEffect(() => {
    const iv = setInterval(() => setTick(t => t + 1), 60000);
    return () => clearInterval(iv);
  }, []);

  // Escape to close + D-Pad navigation for EPG grid
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (selectedProg) {
        // When popup is open, only Escape/Back closes it
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
          if (scrollRef.current) scrollRef.current.scrollLeft -= HOUR_WIDTH;
          break;
        case 'ArrowRight':
          e.preventDefault();
          if (scrollRef.current) scrollRef.current.scrollLeft += HOUR_WIDTH;
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

  // Auto-scroll to focused channel row
  useEffect(() => {
    if (scrollRef.current) {
      const rows = scrollRef.current.querySelectorAll('[data-ch-row]');
      const row = rows[focusedChIdx] as HTMLElement;
      if (row) row.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [focusedChIdx]);

  // Auto-focus Assistir Canal when popup opens
  useEffect(() => {
    if (selectedProg && assistirBtnRef.current) {
      assistirBtnRef.current.focus();
    }
  }, [selectedProg]);

  const now = new Date();
  const nowPx = ((now.getTime() - baseTime.getTime()) / 3600000) * HOUR_WIDTH + CHANNEL_COL;
  const totalWidth = HOURS * HOUR_WIDTH + CHANNEL_COL;

  return (
    <div className="fixed inset-0 z-[9999] bg-black/[0.93] backdrop-blur-2xl flex flex-col animate-in fade-in duration-300">
      {/* ═══ HEADER ═══ */}
      <div className="shrink-0 flex items-center justify-between px-6 h-14 border-b border-white/[0.06] bg-linear-to-r from-white/[0.03] to-transparent">
        <div className="flex items-center gap-4">
          <button onClick={() => { playBackSound(); onBack(); }} className="w-9 h-9 rounded-xl bg-white/[0.06] border border-white/[0.1] flex items-center justify-center text-white/50 hover:bg-white/[0.12] hover:text-white transition-all focus:outline-none focus:ring-2 focus:ring-[#E50914]">
            <ArrowLeft size={16} />
          </button>
          <div>
            <h1 className="text-sm font-black italic tracking-tight uppercase">
              <span className="text-white">Guia de</span> <span className="text-[#E50914]">Programação</span>
            </h1>
            <p className="text-[8px] text-white/25 font-bold uppercase tracking-widest">
              {epgChannels.length} canais • {now.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.06]">
            <Clock size={12} className="text-white/30" />
            <span className="text-xs text-white/50 font-bold tabular-nums">
              {now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
          <button onClick={onBack} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); playBackSound(); onBack(); } }} tabIndex={0} className="w-8 h-8 rounded-lg bg-white/[0.04] border border-white/[0.06] flex items-center justify-center text-white/30 hover:text-white hover:bg-white/[0.1] transition-all focus:outline-none focus:ring-2 focus:ring-[#E50914]">
            <X size={14} />
          </button>
        </div>
      </div>

      {/* ═══ EPG GRID ═══ */}
      <div ref={scrollRef} className="flex-1 overflow-auto hide-scrollbar relative">
        <div style={{ width: `${totalWidth}px` }}>
          {/* ── Time header (sticky top) ── */}
          <div className="sticky top-0 z-20 flex h-8 bg-black/80 backdrop-blur-xl border-b border-white/[0.06]">
            <div
              className="sticky left-0 z-30 shrink-0 bg-black/90 backdrop-blur-xl border-r border-white/[0.06] flex items-center px-4"
              style={{ width: `${CHANNEL_COL}px` }}
            >
              <span className="text-[8px] font-bold text-white/20 uppercase tracking-widest">Canal</span>
            </div>
            {timeSlots.map((t, i) => (
              <div key={i} className="shrink-0 flex items-center px-4 border-r border-white/[0.04]" style={{ width: `${HOUR_WIDTH}px` }}>
                <span className="text-[10px] text-white/35 font-bold tabular-nums">
                  {t.getHours().toString().padStart(2, '0')}:00
                </span>
              </div>
            ))}
          </div>

          {/* ── Channel rows ── */}
          {epgChannels.map((channel, chIdx) => {
            const schedule = getChannelSchedule(channel.nome, 60);
            const isFocusedRow = chIdx === focusedChIdx;
            return (
              <div key={channel.nome} data-ch-row={chIdx} className={`flex border-b border-white/[0.03] transition-colors ${isFocusedRow ? 'bg-white/[0.06] ring-1 ring-[#E50914]/60' : ''}`} style={{ height: `${ROW_HEIGHT}px` }}>
                {/* Channel badge – sticky left */}
                <button
                  onClick={() => onSelectChannel(channel)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); playSelectSound(); onSelectChannel(channel); } }}
                  className="sticky left-0 z-10 shrink-0 flex items-center gap-3 px-4 bg-black/80 backdrop-blur-xl border-r border-white/[0.06] hover:bg-white/[0.06] transition-all group focus:outline-none focus:ring-2 focus:ring-[#E50914]"
                  style={{ width: `${CHANNEL_COL}px` }}
                >
                  <div className="w-8 h-8 rounded-lg p-1 bg-white/[0.05] border border-white/[0.08] flex items-center justify-center shrink-0 group-hover:bg-white/[0.1] transition-all">
                    <img src={channel.logo} className="max-w-full max-h-full object-contain" />
                  </div>
                  <div className="flex-1 min-w-0 text-left">
                    <span className="text-[10px] font-bold text-white/60 truncate block group-hover:text-white transition-colors">
                      {channel.nome}
                    </span>
                    <span className="text-[8px] text-white/20 font-bold uppercase">{channel.genero}</span>
                  </div>
                </button>

                {/* Programme blocks */}
                <div className="relative flex-1">
                  {timeSlots.map((_, i) => (
                    <div key={i} className="absolute top-0 bottom-0 border-r border-white/[0.025]" style={{ left: `${i * HOUR_WIDTH}px` }} />
                  ))}

                  {schedule.map((prog, i) => {
                    const startOff = (prog.start.getTime() - baseTime.getTime()) / 3600000;
                    const dur = (prog.stop.getTime() - prog.start.getTime()) / 3600000;
                    if (startOff + dur < 0 || startOff > HOURS) return null;
                    const left = Math.max(0, startOff) * HOUR_WIDTH;
                    const width = Math.min(dur, HOURS - Math.max(0, startOff)) * HOUR_WIDTH;
                    if (width < 10) return null;
                    const isCurrent = prog.start <= now && prog.stop > now;
                    const progress = isCurrent ? getProgrammeProgress(prog) : 0;

                    return (
                      <div
                        key={`${prog.start.getTime()}-${i}`}
                        onClick={() => { playSelectSound(); setSelectedProg({ prog, channel }); }}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); playSelectSound(); setSelectedProg({ prog, channel }); } }}
                        tabIndex={0}
                        role="button"
                        className={`absolute top-1 bottom-1 rounded-lg px-2.5 py-1 overflow-hidden cursor-pointer transition-all duration-200 flex flex-col justify-center focus:outline-none focus:ring-2 focus:ring-[#E50914]
                          ${isCurrent
                            ? 'bg-[#E50914] border border-[#E50914]/60 shadow-[0_2px_16px_rgba(229,9,20,0.3)]'
                            : 'bg-white/[0.03] border border-white/[0.05] hover:bg-white/[0.07] hover:border-white/[0.1]'}`}
                        style={{ left: `${left}px`, width: `${Math.max(width - 3, 30)}px` }}
                      >
                        <span className={`text-[10px] font-bold truncate leading-tight ${isCurrent ? 'text-white' : 'text-white/50'}`}>
                          {prog.title}
                        </span>
                        {width > 80 && (
                          <span className={`text-[8px] truncate ${isCurrent ? 'text-white/70' : 'text-white/25'}`}>
                            {formatTime(prog.start)} – {formatTime(prog.stop)}
                          </span>
                        )}
                        {isCurrent && (
                          <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-black/20">
                            <div
                              className="h-full bg-white/60 transition-all duration-1000"
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Current-time vertical line ── */}
        <div
          className="absolute top-0 bottom-0 w-px z-25 pointer-events-none"
          style={{
            left: `${nowPx}px`,
            background: 'linear-gradient(to bottom, rgba(52,211,153,0.4), rgba(52,211,153,0.08))',
          }}
        >
          <div className="sticky top-0 -ml-1 w-2 h-2 rounded-full bg-emerald-400/60 shadow-[0_0_8px_rgba(52,211,153,0.4)]" />
        </div>
      </div>

      {/* ═══ PROGRAMME DETAIL POPUP ═══ */}
      {selectedProg && (
        <div className="absolute inset-0 z-50 flex items-end justify-center pb-8 pointer-events-none">
          <div className="pointer-events-auto max-w-lg w-full mx-4 bg-linear-to-br from-white/[0.1] to-white/[0.04] backdrop-blur-2xl rounded-2xl border border-white/[0.15] p-5 space-y-3 shadow-[0_8px_60px_rgba(0,0,0,0.7),inset_0_1px_0_rgba(255,255,255,0.08)] animate-in slide-in-from-bottom-4 duration-300">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg p-1 bg-white/[0.06] border border-white/[0.1] flex items-center justify-center">
                  <img src={selectedProg.channel.logo} className="max-w-full max-h-full object-contain" />
                </div>
                <div>
                  <span className="text-[10px] text-white/40 font-bold uppercase">{selectedProg.channel.nome}</span>
                  <h3 className="text-sm font-black uppercase text-white leading-tight">{selectedProg.prog.title}</h3>
                </div>
              </div>
              <button
                onClick={() => setSelectedProg(null)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); playBackSound(); setSelectedProg(null); } }}
                tabIndex={0}
                className="w-7 h-7 rounded-lg bg-white/[0.06] border border-white/[0.08] flex items-center justify-center text-white/30 hover:text-white transition-all focus:outline-none focus:ring-2 focus:ring-[#E50914]"
              >
                <X size={12} />
              </button>
            </div>

            <div className="flex items-center gap-2 text-[9px] text-white/40">
              <span className="font-bold">
                {formatTime(selectedProg.prog.start)} – {formatTime(selectedProg.prog.stop)}
              </span>
              {selectedProg.prog.category && (
                <span className="px-1.5 py-0.5 rounded bg-white/[0.06] border border-white/[0.06] text-white/30">
                  {selectedProg.prog.category}
                </span>
              )}
              {selectedProg.prog.episode && (
                <span className="text-white/25">{selectedProg.prog.episode}</span>
              )}
            </div>

            {selectedProg.prog.description && !/^\[\d/.test(selectedProg.prog.description) && (
              <p className="text-xs text-white/40 leading-relaxed">{selectedProg.prog.description}</p>
            )}

            <button
              ref={assistirBtnRef}
              onClick={() => {
                playSelectSound();
                onSelectChannel(selectedProg.channel);
                setSelectedProg(null);
              }}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); playSelectSound(); onSelectChannel(selectedProg.channel); setSelectedProg(null); } }}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/[0.08] border border-white/[0.1] text-xs font-bold text-white/70 hover:bg-white/[0.15] transition-all focus:outline-none focus:ring-2 focus:ring-[#E50914]"
            >
              <Play size={14} fill="currentColor" /> Assistir Canal
            </button>
          </div>
        </div>
      )}

      <style>{`
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
};

export default ChannelGuide;
