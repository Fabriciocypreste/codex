import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Radio, Tv, Trophy, Film, Newspaper, Star, Clock, BookOpen, Baby, Music, Heart, Globe, Lock, Play, Search, X, Signal, LayoutGrid, ChevronRight, Settings, Home, MonitorPlay, Volume2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Channel } from '../types';
import { channelsService } from '../services/channelsService';
import {
  initEPG,
  getCurrentProgramme,
  getNextProgramme,
  getChannelSchedule,
  getProgrammeProgress,
  formatTime,
  hasEPG,
  EPGProgramme,
} from '../services/epgService';
import ChannelGuide from './ChannelGuide';
import LiveTVVideo from '../components/LiveTVVideo';
import { useSpatialNav } from '../hooks/useSpatialNavigation';
import { playNavigateSound, playSelectSound, playBackSound } from '../utils/soundEffects';

// --- Mock para Navegação Espacial (TV BOX) ---
const useFocusable = () => ({
  ref: useRef<any>(null),
  focused: false,
  focusSelf: () => { }
});

// ═══ HISTÓRICO DE CANAIS ASSISTIDOS (localStorage) ═══
const HISTORY_KEY = 'redx-channel-history';
const HISTORY_MAX = 20;

function getChannelHistory(): string[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function addChannelToHistory(channel: Channel) {
  try {
    const id = channel.id || channel.name;
    let history = getChannelHistory();
    // Remove duplicata e adiciona no topo
    history = history.filter(h => h !== id);
    history.unshift(id);
    // Limitar tamanho
    if (history.length > HISTORY_MAX) history = history.slice(0, HISTORY_MAX);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  } catch {}
}

const CATEGORIES = [
  { id: 'all', name: 'Todos', icon: <LayoutGrid /> },
  { id: 'recentes', name: 'Recentes', icon: <Clock />, match: ['__recentes__'] },
  { id: 'abertos', name: 'TV Aberta', icon: <Tv />, match: ['abertos', 'tv aberta', 'aberto'] },
  { id: 'esportes', name: 'Esportes', icon: <Trophy />, match: ['esportes', 'esporte', 'sport', 'sports', 'ppv'] },
  { id: 'filmes', name: 'Filmes e Séries', icon: <Film />, match: ['filmes', 'series', 'filme', 'serie'] },
  { id: 'noticias', name: 'Notícias', icon: <Newspaper />, match: ['noticias', 'noticia', 'news', 'jornalismo'] },
  { id: 'variedades', name: 'Variedades', icon: <Star />, match: ['variedades', 'variedade', 'entretenimento'] },
  { id: '24h', name: '24h', icon: <Clock />, match: ['24h', '24hs', '24 horas'] },
  { id: 'docs', name: 'Documentários', icon: <BookOpen />, match: ['documentarios', 'documentario', 'docs', 'discovery'] },
  { id: 'infantil', name: 'Infantil', icon: <Baby />, match: ['infantil', 'kids', 'infantis', 'desenhos', 'crianca'] },
  { id: 'musica', name: 'Música', icon: <Music />, match: ['musica', 'music', 'clips', 'clipe'] },
  { id: 'religiosos', name: 'Religiosos', icon: <Heart />, match: ['religiosos', 'religiao', 'igreja', 'gospel'] },
  { id: 'globo', name: 'Globo', icon: <Globe />, match: ['globo'] },
  { id: 'premiere', name: 'Premiere', icon: <Lock />, match: ['premiere'] },
  { id: 'teste', name: 'Teste', icon: <Signal />, match: ['teste'] },
];

const SidebarItem: React.FC<{
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  expanded?: boolean;
  focused?: boolean;
  onClick?: () => void;
}> = ({ icon, label, active, expanded, focused, onClick }) => (
  <button
    onClick={onClick}
    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); onClick?.(); } }}
    tabIndex={0}
    className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg mx-1 transition-all duration-300 group relative outline-none focus:ring-2 focus:ring-[#E50914]
      ${active || focused ? 'bg-[#E50914]/[0.15] text-white backdrop-blur-xl border border-[#E50914]/[0.3] shadow-[0_4px_20px_rgba(229,9,20,0.15)]' : 'text-[#C0C0C0]/60 hover:text-[#C0C0C0] hover:bg-white/[0.04] border border-transparent focus:text-[#C0C0C0] focus:bg-white/[0.04]'}`}
  >
    <div className="shrink-0 [&>svg]:w-4 [&>svg]:h-4 text-[#C0C0C0]">{icon}</div>
    <span className={`text-[9px] font-black uppercase tracking-[0.15em] transition-all duration-500 whitespace-nowrap
      ${expanded ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-10 pointer-events-none'}`}>
      {label}
    </span>
    {active && !expanded && (
      <div className="absolute left-0 w-[3px] h-5 bg-[#E50914] rounded-r-full shadow-[0_0_10px_rgba(229,9,20,0.4)]" />
    )}
  </button>
);

const LiveTV: React.FC<{ onBack?: () => void }> = ({ onBack }) => {
  const navigate = useNavigate();
  // Disable global spatial nav to prevent conflict with our own key handler
  const { setEnabled } = useSpatialNav();
  useEffect(() => {
    setEnabled(false);
    return () => setEnabled(true);
  }, [setEnabled]);

  const [channels, setChannels] = useState<Channel[]>([]);
  const [filteredChannels, setFilteredChannels] = useState<Channel[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
  const [activeCategoryId, setActiveCategoryId] = useState('all');
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [focusArea, setFocusArea] = useState<'sidebar' | 'channels'>('channels');
  const [focusedCategoryIndex, setFocusedCategoryIndex] = useState(0);
  const [epgReady, setEpgReady] = useState(false);
  const [epgTick, setEpgTick] = useState(0); // força re-render a cada 60s
  const [showChannelGuide, setShowChannelGuide] = useState(false);
  const [zappingOSD, setZappingOSD] = useState(false); // OSD de troca de canal

  const listRef = useRef<HTMLDivElement>(null);
  const zappingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const activeCategories = useMemo(() => {
    if (channels.length === 0) return CATEGORIES;
    return CATEGORIES.filter(cat => {
      if (cat.id === 'all') return true;
      if (cat.id === 'recentes') {
        // Mostrar "Recentes" apenas se houver histórico
        return getChannelHistory().length > 0;
      }
      if (!cat.match) return true;
      return channels.some(c =>
        cat.match!.some(m => (c.category || '').toLowerCase().includes(m))
      );
    });
  }, [channels]);

  // OSD de zapping: mostra info do canal por 3s ao trocar com Up/Down
  const showZappingOSD = useCallback(() => {
    setZappingOSD(true);
    if (zappingTimerRef.current) clearTimeout(zappingTimerRef.current);
    zappingTimerRef.current = setTimeout(() => setZappingOSD(false), 3000);
  }, []);

  // Auto-hide menu 2s após selecionar canal
  const scheduleHideMenu = useCallback(() => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => {
      setIsMenuOpen(false);
    }, 2000);
  }, []);

  // Limpar timers ao desmontar
  useEffect(() => {
    return () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      if (zappingTimerRef.current) clearTimeout(zappingTimerRef.current);
    };
  }, []);

  // Carregar dados iniciais + EPG
  useEffect(() => {
    const init = async () => {
      setIsLoading(true);
      const data = await channelsService.loadChannels();
      setChannels(data);
      setFilteredChannels(data);
      // Iniciar com o último canal assistido (se houver histórico)
      const history = getChannelHistory();
      let initialChannel: Channel | null = null;
      if (history.length > 0) {
        initialChannel = data.find(c => (c.id || c.name) === history[0]) || null;
      }
      if (!initialChannel && data.length > 0) initialChannel = data[0];
      if (initialChannel) setSelectedChannel(initialChannel);
      // Se houver histórico, iniciar na categoria Recentes
      if (history.length > 0) setActiveCategoryId('recentes');
      setIsLoading(false);

      // Carregar EPG em background (não bloqueia UI)
      initEPG().then(() => setEpgReady(true)).catch(() => {});
    };
    init();
  }, []);

  // Atualizar EPG a cada 60 segundos (para barra de progresso e programa atual)
  useEffect(() => {
    if (!epgReady) return;
    const interval = setInterval(() => setEpgTick((t) => t + 1), 60000);
    return () => clearInterval(interval);
  }, [epgReady]);

  // Filtro de canais
  useEffect(() => {
    let result = channels;

    // Filtrar por categoria
    if (activeCategoryId === 'recentes') {
      // Histórico: ordenar canais pela ordem do histórico
      const history = getChannelHistory();
      const historyChannels: Channel[] = [];
      for (const id of history) {
        const ch = channels.find(c => (c.id || c.name) === id);
        if (ch) historyChannels.push(ch);
      }
      result = historyChannels;
    } else if (activeCategoryId === 'teste') {
      result = channels.filter(c => (c.category || '').toLowerCase() === 'teste');
    } else if (activeCategoryId !== 'all') {
      const cat = CATEGORIES.find(c => c.id === activeCategoryId);
      if (cat?.match) {
        result = channels.filter(c =>
          cat.match?.some(m => (c.category || '').toLowerCase().includes(m))
        );
      }
    }

    // Filtrar por busca
    if (searchQuery.trim()) {
      const lowerQuery = searchQuery.toLowerCase();
      result = result.filter(c => c.name.toLowerCase().includes(lowerQuery));
    }

    setFilteredChannels(result);
    setFocusedIndex(0);
    setFocusedCategoryIndex(Math.max(0, activeCategories.findIndex((c) => c.id === activeCategoryId)));
  }, [activeCategoryId, searchQuery, channels, activeCategories]);

  // Navegação por teclado (TV Box) — throttle para não correr
  const keyThrottleRef = useRef<number>(0);
  const lastKeyTimeRef = useRef<number>(0);
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Guard: ignorar eventos duplicados (ex: double-dispatch bug)
      const now = Date.now();
      if (now - lastKeyTimeRef.current < 80) return;
      lastKeyTimeRef.current = now;
      // Handler global para tecla Back/Escape
      if (e.key === 'Escape' || e.key === 'Backspace') {
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA') return;
        e.preventDefault();
        e.stopPropagation();
        playBackSound();
        // 1. Fechar guia de canais se aberto
        if (showChannelGuide) {
          setShowChannelGuide(false);
          return;
        }
        // 2. Se menu aberto → fechar menu (voltar para fullscreen)
        if (isMenuOpen) {
          setIsMenuOpen(false);
          return;
        }
        // 3. Se menu fechado (fullscreen) → sair da página
        if (onBack) { onBack(); } else { navigate(-1); }
        return;
      }
      if (!isMenuOpen) {
        // ═══ MODO FULLSCREEN (vídeo aberto, menu fechado) ═══
        // Comportamento estilo TV profissional:
        // - Enter/OK: abre menu de canais
        // - Esquerda: abre menu lateral (sidebar)
        // - Cima/Baixo: zapping (troca canal direto sem abrir menu)
        // - Direita: nada (ignora)
        if (e.key === 'Enter') {
          e.preventDefault();
          setIsMenuOpen(true);
          setFocusArea('channels');
          if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
        } else if (e.key === 'ArrowLeft') {
          e.preventDefault();
          setIsMenuOpen(true);
          setFocusArea('sidebar');
          setIsSidebarExpanded(true);
          if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
        } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
          e.preventDefault();
          // Zapping: trocar canal diretamente sem abrir menu
          const currentIdx = filteredChannels.findIndex(
            c => c.stream_url === selectedChannel?.stream_url && c.name === selectedChannel?.name
          );
          let newIdx = currentIdx;
          if (e.key === 'ArrowUp') {
            newIdx = currentIdx > 0 ? currentIdx - 1 : filteredChannels.length - 1;
          } else {
            newIdx = currentIdx < filteredChannels.length - 1 ? currentIdx + 1 : 0;
          }
          if (filteredChannels[newIdx]) {
            playNavigateSound();
            const ch = filteredChannels[newIdx];
            addChannelToHistory(ch);
            setSelectedChannel(ch);
            setFocusedIndex(newIdx);
            showZappingOSD();
          }
        }
        return;
      }

      // Throttle: ignora repetição rápida do teclado (300ms entre cada movimento)
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        const now = Date.now();
        if (now - keyThrottleRef.current < 300) return;
        keyThrottleRef.current = now;
      }

      switch (e.key) {
        case 'ArrowUp':
          playNavigateSound();
          if (focusArea === 'channels') {
            setFocusedIndex(prev => Math.max(0, prev - 1));
          } else {
            setFocusedCategoryIndex(prev => Math.max(0, prev - 1));
          }
          break;
        case 'ArrowDown':
          playNavigateSound();
          if (focusArea === 'channels') {
            setFocusedIndex(prev => Math.min(filteredChannels.length - 1, prev + 1));
          } else {
            setFocusedCategoryIndex(prev => Math.min(activeCategories.length - 1, prev + 1));
          }
          break;
        case 'Enter':
          e.preventDefault();
          e.stopPropagation();
          if (focusArea === 'channels') {
            if (filteredChannels[focusedIndex]) {
              playSelectSound();
              const ch = filteredChannels[focusedIndex];
              addChannelToHistory(ch);
              setSelectedChannel(ch);
              scheduleHideMenu();
            }
          } else {
            const cat = activeCategories[focusedCategoryIndex];
            if (cat) {
              playSelectSound();
              setActiveCategoryId(cat.id);
              setSearchQuery('');
            }
          }
          break;
        case 'ArrowRight':
          setFocusArea('channels');
          setIsSidebarExpanded(false);
          break;
        case 'ArrowLeft':
          setFocusArea('sidebar');
          setIsSidebarExpanded(true);
          break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isMenuOpen, filteredChannels, focusedIndex, focusedCategoryIndex, focusArea, showChannelGuide, navigate, scheduleHideMenu, selectedChannel, showZappingOSD, activeCategories, onBack]);

  // Scroll automático para item focado
  useEffect(() => {
    if (listRef.current) {
      const child = listRef.current.children[focusedIndex] as HTMLElement;
      if (child) child.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [focusedIndex]);

  if (isLoading) return (
    <div className="h-screen w-full flex items-center justify-center bg-black">
      <div className="w-12 h-12 border-4 border-[#E50914] border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="relative h-screen w-full bg-black overflow-hidden font-sans select-none">

      {/* PLAYER FULLSCREEN (BACKGROUND) */}
      <div className="absolute inset-0 z-0">
        {selectedChannel ? (
          <div className="w-full h-full bg-black">
            {/* Player de vídeo — HLS.js para m3u8 (TV Box/WebView); YouTube iframe; MP4 nativo */}
            {selectedChannel.stream_url ? (
              selectedChannel.stream_url.includes('youtube.com/watch') || selectedChannel.stream_url.includes('youtu.be') ? (
                <iframe
                  key={selectedChannel.stream_url}
                  src={`https://www.youtube.com/embed/${selectedChannel.stream_url.split('v=')[1] || selectedChannel.stream_url.split('/').pop()}?autoplay=1&mute=0&rel=0`}
                  className="w-full h-full border-0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                  title={selectedChannel.name}
                />
              ) : (
                <LiveTVVideo
                  streamUrl={selectedChannel.stream_url}
                  channelName={selectedChannel.name}
                />
              )
            ) : null}
            {/* Logo overlay quando não tem URL */}
            {!selectedChannel.stream_url && (
              <>
                {selectedChannel.logo && (
                  <>
                    <div className="absolute inset-0 flex items-center justify-center opacity-20 blur-2xl">
                      <img src={selectedChannel.logo} alt="" className="w-1/2 h-1/2 object-contain" onError={e => (e.target as HTMLElement).style.display = 'none'} />
                    </div>
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
                      <img src={selectedChannel.logo} alt="" className="h-40 w-auto mx-auto mb-8 object-contain drop-shadow-[0_0_50px_rgba(229,9,20,0.5)]" onError={e => (e.target as HTMLElement).style.display = 'none'} />
                    </div>
                  </>
                )}
                {!selectedChannel.logo && (
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
                    <span className="text-6xl font-black text-white/30">{selectedChannel.name.substring(0, 2).toUpperCase()}</span>
                  </div>
                )}
                <div className="absolute bottom-24 left-1/2 -translate-x-1/2 z-10 flex items-center justify-center gap-4 text-white/40">
                  <div className="w-2 h-2 rounded-full bg-red-600 animate-pulse" />
                  <span className="text-xs font-black uppercase tracking-[0.3em]">Conectando ao Stream...</span>
                </div>
              </>
            )}
            <div className="absolute inset-0 bg-linear-to-t from-black via-transparent to-black/40" />
          </div>
        ) : (
          <div className="w-full h-full bg-zinc-950 flex items-center justify-center">
            <Radio size={80} className="text-zinc-800 animate-pulse" />
          </div>
        )}

        {/* Overlay para destaque quando o menu está aberto */}
        <div className={`absolute inset-0 bg-black/60 transition-opacity duration-1000 ${isMenuOpen ? 'opacity-100' : 'opacity-0'}`} />
        <div className={`absolute inset-0 bg-linear-to-r from-black/90 via-black/40 to-transparent transition-opacity duration-1000 ${isMenuOpen ? 'opacity-100' : 'opacity-0'}`} />
      </div>

      {/* ═══ OSD DE ZAPPING — aparece ao trocar canal com Up/Down ═══ */}
      {zappingOSD && selectedChannel && !isMenuOpen && (
        <div className="absolute top-8 left-1/2 -translate-x-1/2 z-[100] animate-in fade-in slide-in-from-top-4 duration-300 pointer-events-none">
          <div className="flex items-center gap-4 bg-black/80 backdrop-blur-2xl border border-white/15 rounded-2xl px-6 py-4 shadow-[0_8px_40px_rgba(0,0,0,0.7)]">
            {/* Logo */}
            <div className="w-14 h-14 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center overflow-hidden shrink-0">
              {selectedChannel.logo ? (
                <img src={selectedChannel.logo} alt="" className="w-10 h-10 object-contain" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
              ) : (
                <span className="text-sm font-black text-white/50">{selectedChannel.name.substring(0, 2).toUpperCase()}</span>
              )}
            </div>
            {/* Info */}
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] font-black text-[#E50914] tabular-nums">
                  CH {filteredChannels.findIndex(c => c.stream_url === selectedChannel.stream_url && c.name === selectedChannel.name) + 1}
                </span>
                <span className="text-[8px] px-2 py-0.5 bg-white/10 rounded text-white/40 font-bold uppercase">{selectedChannel.category}</span>
              </div>
              <h3 className="text-lg font-black uppercase tracking-tight text-white leading-none">{selectedChannel.name}</h3>
              {epgReady && (() => {
                const prog = getCurrentProgramme(selectedChannel.name);
                return prog ? (
                  <p className="text-[10px] text-white/50 mt-1 truncate max-w-[250px]">{formatTime(prog.start)} — {prog.title}</p>
                ) : null;
              })()}
            </div>
            {/* Indicador ao vivo */}
            <div className="flex items-center gap-1.5 ml-4">
              <div className="w-2 h-2 rounded-full bg-red-600 animate-pulse" />
              <span className="text-[8px] font-black text-red-500 uppercase tracking-widest">AO VIVO</span>
            </div>
          </div>
        </div>
      )}

      {/* INTERFACE DO USUÁRIO */}
      <div
        className={`relative z-50 flex h-full transition-all duration-700 cubic-bezier(0.19, 1, 0.22, 1) ${isMenuOpen ? 'translate-x-0' : '-translate-x-[200px] opacity-0 pointer-events-none'}`}
        onMouseEnter={() => { if (hideTimerRef.current) clearTimeout(hideTimerRef.current); }}
        onMouseLeave={() => { if (selectedChannel) scheduleHideMenu(); }}
      >

        {/* MENU (sidebar + lista) */}
        <div className="flex h-full">
        {/* 1. SIDEBAR */}
        <aside
          className={`h-full bg-linear-to-b from-white/[0.04] to-white/[0.01] backdrop-blur-2xl border-r border-white/[0.08] flex flex-col py-4 transition-all duration-500 ease-in-out shadow-[4px_0_30px_rgba(0,0,0,0.3)]
            ${isSidebarExpanded ? 'w-[200px]' : 'w-[60px]'}`}
          onMouseEnter={() => setIsSidebarExpanded(true)}
          onMouseLeave={() => setIsSidebarExpanded(false)}
        >
          <div className={`flex items-center px-4 mb-4 gap-3 ${!isSidebarExpanded && 'justify-center'}`}>
            <button
              onClick={() => onBack ? onBack() : navigate(-1)}
              className="p-2 bg-white/10 hover:bg-white/20 rounded-xl transition-colors focus:outline-none focus:ring-2 focus:ring-[#E50914]"
              title="Voltar"
            >
              <ChevronRight size={16} className="text-white rotate-180" />
            </button>
            {isSidebarExpanded && (
              <span className="font-black text-lg tracking-tighter italic text-white">Red<span className="text-[#E50914]">flix</span></span>
            )}
          </div>

          <div className="flex-1 overflow-y-auto hide-scrollbar space-y-0.5 px-1">
            {activeCategories.map((cat, idx) => (
              <SidebarItem
                key={cat.id}
                icon={cat.icon}
                label={cat.name}
                active={activeCategoryId === cat.id}
                focused={focusArea === 'sidebar' && focusedCategoryIndex === idx}
                expanded={isSidebarExpanded}
                onClick={() => {
                  setActiveCategoryId(cat.id);
                  setSearchQuery('');
                  setFocusedCategoryIndex(idx);
                  setFocusArea('sidebar');
                }}
              />
            ))}
          </div>


        </aside>

        {/* 2. LISTA DE CANAIS */}
        <div className="w-[320px] h-full flex flex-col glass-effect border-r border-white/10 shadow-2xl">
          <div className="p-4 pb-3 space-y-3">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <h2 className="text-lg font-black italic tracking-tighter uppercase text-white">Guia de <span className="text-[#E50914]">Canais</span></h2>
                <div className="flex items-center gap-2 text-white/40 text-[8px] font-bold uppercase tracking-[0.3em]">
                  <div className="w-1.5 h-1.5 rounded-full bg-white/40 animate-pulse" />
                  {activeCategories.find(c => c.id === activeCategoryId)?.name || CATEGORIES.find(c => c.id === activeCategoryId)?.name}
                </div>
              </div>
              <button
                onClick={() => setShowChannelGuide(true)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); playSelectSound(); setShowChannelGuide(true); } }}
                tabIndex={0}
                className="px-2.5 py-1.5 rounded-lg bg-white/[0.06] border border-white/[0.08] text-[8px] font-black uppercase tracking-widest text-white/40 hover:bg-white/[0.12] hover:text-white transition-all flex items-center gap-1.5 shrink-0 focus:outline-none focus:ring-2 focus:ring-[#E50914] focus:bg-white/[0.12] focus:text-white"
              >
                <BookOpen size={11} /> Guia
              </button>
            </div>

            <div className="relative group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-white/40 transition-colors" size={14} />
              <input
                type="text"
                placeholder="Buscar..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl py-2 pl-9 pr-3 text-xs focus:outline-none focus:ring-1 focus:ring-white/20 focus:bg-white/[0.08] transition-all font-medium text-white placeholder-white/20"
              />
            </div>
          </div>

          <div ref={listRef} className="flex-1 overflow-y-auto px-3 pb-4 space-y-2.5 hide-scrollbar">
            {filteredChannels.map((channel, idx) => {
              const isFocusedItem = focusedIndex === idx;
              const isSelected = selectedChannel?.stream_url === channel.stream_url;
              return (
              <button
                key={channel.name + channel.stream_url}
                data-nav-item
                data-nav-col={idx}
                tabIndex={0}
                onClick={() => {
                  addChannelToHistory(channel);
                  setSelectedChannel(channel);
                  scheduleHideMenu();
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { e.preventDefault(); playSelectSound(); addChannelToHistory(channel); setSelectedChannel(channel); scheduleHideMenu(); }
                }}
                onMouseEnter={() => setFocusedIndex(idx)}
                className={`w-full group flex items-center gap-3.5 rounded-2xl transition-all duration-300 relative focus:outline-none
                  ${isFocusedItem
                    ? 'scale-[1.02] z-10'
                    : 'hover:scale-[1.01]'}`}
                style={{
                  padding: '12px 14px',
                  background: isFocusedItem
                    ? 'rgba(255, 255, 255, 0.12)'
                    : 'rgba(255, 255, 255, 0.04)',
                  backdropFilter: 'blur(20px)',
                  WebkitBackdropFilter: 'blur(20px)',
                  border: isFocusedItem
                    ? '1px solid rgba(255, 255, 255, 0.25)'
                    : '1px solid rgba(255, 255, 255, 0.06)',
                  boxShadow: isFocusedItem
                    ? '0 8px 32px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.12), 0 0 0 1px rgba(229,9,20,0.3)'
                    : '0 2px 12px rgba(0,0,0,0.2)',
                  borderRadius: '16px',
                }}
              >
                {/* Número do canal */}
                <div className={`w-8 text-center shrink-0 transition-colors duration-200 ${isFocusedItem ? 'text-[#E50914]' : 'text-[#E50914]/40'}`}>
                  <span className="text-[11px] font-black tabular-nums">{100 + idx + 1}</span>
                </div>

                {/* Logo do canal */}
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 transition-all duration-300 overflow-hidden"
                  style={{
                    background: isFocusedItem ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.06)',
                    border: isFocusedItem ? '1px solid rgba(255,255,255,0.2)' : '1px solid rgba(255,255,255,0.08)',
                    boxShadow: isFocusedItem ? '0 4px 16px rgba(0,0,0,0.4)' : '0 2px 8px rgba(0,0,0,0.2)',
                    transform: isFocusedItem ? 'scale(1.08)' : 'scale(1)',
                  }}
                >
                  {channel.logo ? (
                    <img
                      src={channel.logo}
                      alt=""
                      className="w-8 h-8 object-contain drop-shadow-[0_1px_4px_rgba(255,255,255,0.1)]"
                      onError={e => {
                        const el = e.target as HTMLImageElement;
                        el.style.display = 'none';
                        const fb = el.nextElementSibling as HTMLElement;
                        if (fb) fb.style.display = 'flex';
                      }}
                    />
                  ) : null}
                  <span
                    className="text-[10px] font-black text-white/50"
                    style={{ display: channel.logo ? 'none' : 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    {channel.name.substring(0, 2).toUpperCase()}
                  </span>
                </div>

                {/* Info do canal */}
                <div className="flex-1 text-left overflow-hidden min-w-0">
                  <div className={`text-[12px] font-extrabold uppercase tracking-tight truncate transition-colors duration-200 ${isFocusedItem ? 'text-white' : 'text-white/75'}`}>
                    {channel.name}
                  </div>
                  {(() => {
                    const prog = epgReady ? getCurrentProgramme(channel.name) : null;
                    if (prog) {
                      return (
                        <div className="mt-0.5">
                          <div className={`text-[9px] font-semibold truncate transition-colors duration-200 ${isFocusedItem ? 'text-white/55' : 'text-white/30'}`}>
                            {formatTime(prog.start)} {prog.title}
                          </div>
                          <div className="w-full h-[2px] mt-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                            <div
                              className="h-full rounded-full transition-all duration-1000"
                              style={{
                                width: `${getProgrammeProgress(prog)}%`,
                                background: 'linear-gradient(90deg, #E50914, rgba(229,9,20,0.4))',
                              }}
                            />
                          </div>
                        </div>
                      );
                    }
                    return (
                      <div className={`text-[9px] font-bold uppercase tracking-wider truncate mt-0.5 transition-colors duration-200 ${isFocusedItem ? 'text-white/40' : 'text-white/25'}`}>
                        {channel.category}
                      </div>
                    );
                  })()}
                </div>

                {/* Indicador de canal tocando */}
                {isSelected && !isFocusedItem && (
                  <div className="flex items-center gap-1 shrink-0">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#E50914] shadow-[0_0_6px_rgba(229,9,20,0.5)] animate-pulse" />
                  </div>
                )}
              </button>
              );
            })}
          </div>
        </div>
        </div>{/* FIM MENU */}

        {/* 3. INFO DO CANAL (DIREITA) — centralizado */}
        {selectedChannel && (
          <div className="flex-1 flex items-center justify-center animate-in fade-in slide-in-from-left-10 duration-1000">
            <div className="max-w-lg w-full bg-linear-to-br from-white/[0.07] to-white/[0.02] backdrop-blur-2xl p-6 rounded-[1.5rem] border border-white/[0.12] space-y-4 shadow-[0_8px_60px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.08)] scale-[0.8] origin-center">
              {/* Header badges */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="bg-white/[0.12] backdrop-blur-2xl border border-white/[0.18] px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest flex items-center gap-2 shadow-[0_2px_12px_rgba(255,255,255,0.06)]">
                    <Play size={10} fill="currentColor" /> Assistindo Agora
                  </div>
                  <span className="px-2.5 py-1 bg-white/[0.06] rounded-lg border border-white/[0.08] text-[8px] font-bold uppercase tracking-wider text-white/50">{selectedChannel.category}</span>
                </div>
                <span className="text-[8px] text-white/30 font-bold uppercase tracking-widest">UHD 4K</span>
              </div>

              {/* Canal header */}
              <div className="flex items-center gap-4 py-1">
                <div className="w-16 h-16 rounded-2xl p-2.5 flex items-center justify-center overflow-hidden shrink-0 bg-white/[0.08] backdrop-blur-2xl border border-white/[0.12] shadow-[0_4px_20px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.1)]">
                  {selectedChannel.logo ? (
                    <img
                      src={selectedChannel.logo}
                      alt=""
                      className="w-full h-full object-contain drop-shadow-[0_2px_10px_rgba(255,255,255,0.12)]"
                      onError={e => {
                        const el = e.target as HTMLImageElement;
                        el.style.display = 'none';
                        const fb = el.nextElementSibling as HTMLElement;
                        if (fb) fb.style.display = 'flex';
                      }}
                    />
                  ) : null}
                  <span
                    className="text-lg font-black text-white/50"
                    style={{ display: selectedChannel.logo ? 'none' : 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    {selectedChannel.name.substring(0, 2).toUpperCase()}
                  </span>
                </div>
                <div>
                  <h1 className="text-2xl md:text-3xl font-black italic tracking-tighter uppercase text-white leading-none drop-shadow-[0_2px_8px_rgba(0,0,0,0.5)]">
                    {selectedChannel.name}
                  </h1>
                  <div className="h-0.5 w-12 bg-linear-to-r from-white/30 to-transparent mt-2 rounded-full" />
                </div>
              </div>

              {/* === PROGRAMAÇÃO EPG === */}
              <div className="w-full max-w-[560px] mx-auto">
                <div className="rounded-2xl border border-white/[0.12] bg-white/[0.05] backdrop-blur-2xl p-4 shadow-[0_8px_32px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.08)]">
                  <div className="flex items-center gap-2 mb-2">
                    {selectedChannel.logo ? (
                      <img
                        src={selectedChannel.logo}
                        alt=""
                        className="w-6 h-6 object-contain rounded"
                        onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                    ) : (
                      <span className="w-6 h-6 flex items-center justify-center rounded bg-white/10 text-[8px] font-bold text-white/50">
                        {selectedChannel.name.substring(0, 2).toUpperCase()}
                      </span>
                    )}
                    <span className="text-sm font-black italic tracking-tight uppercase text-white">{selectedChannel.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-[#E50914] uppercase tracking-widest">Programação</span>
                    <div className="h-px flex-1 bg-linear-to-r from-[#E50914]/30 to-transparent" />
                    {epgReady && hasEPG(selectedChannel.name) && (
                      <span className="text-[7px] font-bold text-[#E50914]/70 uppercase tracking-widest flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-[#E50914]/70 animate-pulse" />EPG</span>
                    )}
                  </div>

                  {(() => {
                    if (!epgReady) {
                      return (
                        <div className="mt-3 p-3 rounded-xl border border-white/[0.06] bg-white/[0.04] backdrop-blur-2xl">
                          <div className="flex items-center gap-2 text-white/40 text-xs">
                            <div className="w-3 h-3 border-2 border-white/20 border-t-white/50 rounded-full animate-spin" />
                            Carregando guia de programação...
                          </div>
                        </div>
                      );
                    }

                    const currentProg = getCurrentProgramme(selectedChannel.name);
                    const nextProg = getNextProgramme(selectedChannel.name);
                    const schedule = getChannelSchedule(selectedChannel.name, 8);

                    if (!currentProg && schedule.length === 0) {
                      return (
                        <div className="mt-3 p-3 rounded-xl border border-white/[0.06] bg-white/[0.04] backdrop-blur-2xl">
                          <h3 className="text-sm font-black uppercase text-white/80 mb-1">Sem grade disponível</h3>
                          <p className="text-xs text-white/40 font-medium italic leading-relaxed">
                            Transmissão do canal {selectedChannel.name} com tecnologia Redflix.
                          </p>
                        </div>
                      );
                    }

                    return (
                      <div className="mt-3 grid grid-cols-[1fr_1.1fr] gap-3">
                        <div className="flex flex-col gap-3">
                          {currentProg ? (
                            <div className="p-4 rounded-xl border border-white/[0.12] bg-linear-to-br from-white/[0.08] to-white/[0.03] backdrop-blur-2xl space-y-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_4px_24px_rgba(0,0,0,0.3)] overflow-hidden h-full">
                              <div className="flex items-center gap-2">
                                <div className="flex items-center gap-1.5 px-2.5 py-1 bg-white/[0.15] backdrop-blur-2xl border border-white/[0.2] rounded-lg text-[8px] font-black uppercase tracking-widest shadow-[0_2px_8px_rgba(255,255,255,0.04)]">
                                  <Play size={8} fill="currentColor" /> Agora
                                </div>
                                <span className="text-[9px] text-white/40 font-bold">
                                  {formatTime(currentProg.start)} - {formatTime(currentProg.stop)}
                                </span>
                                {currentProg.isLive && (
                                  <span className="text-[8px] text-emerald-400/60 font-black uppercase animate-pulse flex items-center gap-1"><span className="w-1 h-1 rounded-full bg-emerald-400/60" />AO VIVO</span>
                                )}
                              </div>
                              <h3 className="text-sm md:text-base font-black uppercase text-white leading-tight tracking-tight line-clamp-2">{currentProg.title}</h3>
                              {currentProg.category && (
                                <div className="flex items-center gap-2">
                                  <span className="text-[8px] px-2 py-0.5 rounded-md bg-white/[0.07] border border-white/[0.08] text-white/50 font-bold uppercase">{currentProg.category}</span>
                                  {currentProg.episode && <span className="text-[8px] text-white/25 font-bold">{currentProg.episode}</span>}
                                </div>
                              )}
                              {currentProg.description && !/^\[\d/.test(currentProg.description) && (
                                <p className="text-[10px] text-white/40 font-medium leading-relaxed line-clamp-2 italic">{currentProg.description}</p>
                              )}
                              <div className="mt-auto space-y-1 pt-1">
                                <div className="w-full h-[3px] rounded-full bg-white/[0.06] overflow-hidden">
                                  <div
                                    className="h-full bg-linear-to-r from-white/50 via-white/40 to-white/20 rounded-full transition-all duration-1000 shadow-[0_0_8px_rgba(255,255,255,0.15)]"
                                    style={{ width: `${getProgrammeProgress(currentProg)}%` }}
                                  />
                                </div>
                                <div className="flex justify-between text-[8px] text-white/25 font-medium">
                                  <span>{formatTime(currentProg.start)}</span>
                                  <span className="text-white/35">{Math.round(getProgrammeProgress(currentProg))}%</span>
                                  <span>{formatTime(currentProg.stop)}</span>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="p-4 rounded-xl border border-white/[0.06] bg-white/[0.04] backdrop-blur-2xl">
                              <h3 className="text-sm font-black uppercase text-white/80 mb-1">Sem programa atual</h3>
                              <p className="text-xs text-white/40 font-medium italic leading-relaxed">
                                O guia está disponível para consulta abaixo.
                              </p>
                            </div>
                          )}
                        </div>

                        <div className="flex flex-col gap-3">
                          {nextProg && (
                            <div className="p-3.5 rounded-xl border border-white/[0.07] bg-white/[0.04] backdrop-blur-xl overflow-hidden">
                              <div className="flex items-center gap-2 mb-1.5">
                                <span className="text-[8px] font-black uppercase tracking-widest text-white/35">A seguir</span>
                                <span className="text-[9px] text-white/25 font-bold">{formatTime(nextProg.start)}</span>
                                {nextProg.category && <span className="text-[7px] px-1.5 py-0.5 rounded-md bg-white/[0.04] border border-white/[0.06] text-white/25 font-bold">{nextProg.category}</span>}
                              </div>
                              <h4 className="text-xs font-bold text-white/70 truncate">{nextProg.title}</h4>
                              {nextProg.description && !/^\[\d/.test(nextProg.description) && (
                                <p className="text-[10px] text-white/30 italic truncate mt-1">{nextProg.description}</p>
                              )}
                            </div>
                          )}

                          {schedule.length > 2 && (
                            <div className="rounded-xl border border-white/[0.06] bg-white/[0.025] backdrop-blur-xl overflow-hidden">
                              <div className="px-3.5 py-2 border-b border-white/[0.06]">
                                <span className="text-[8px] font-black uppercase tracking-widest text-white/30">Grade de programação</span>
                              </div>
                              <div className="max-h-36 overflow-y-auto hide-scrollbar">
                                {schedule.slice(0, 8).map((prog, i) => {
                                  const isCurrent = prog.start <= new Date() && prog.stop > new Date();
                                  return (
                                    <div
                                      key={`${prog.start.getTime()}-${i}`}
                                      className={`px-3.5 py-2 flex items-center gap-3 border-b border-white/[0.03] last:border-0 transition-colors ${isCurrent ? 'bg-white/[0.06]' : 'hover:bg-white/[0.02]'}`}
                                    >
                                      <span className={`text-[9px] font-bold shrink-0 w-10 tabular-nums ${isCurrent ? 'text-white/70' : 'text-white/25'}`}>
                                        {formatTime(prog.start)}
                                      </span>
                                      {isCurrent && <span className="w-1 h-1 rounded-full bg-white/40 shrink-0" />}
                                      <span className={`text-[10px] truncate ${isCurrent ? 'text-white/90 font-bold' : 'text-white/45'}`}>
                                        {prog.title}
                                      </span>
                                      {prog.isLive && <span className="text-[7px] text-white/40 font-black shrink-0 ml-auto">LIVE</span>}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>

              <div className="flex gap-2.5 pt-1">
                <button tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); playSelectSound(); setShowChannelGuide(true); } }} className="px-4 py-2.5 rounded-xl flex items-center gap-2 text-[9px] font-black uppercase tracking-widest bg-white/[0.06] border border-white/[0.08] hover:bg-white/[0.12] hover:border-white/[0.15] backdrop-blur-xl transition-all duration-300 shadow-[0_2px_12px_rgba(0,0,0,0.2)] focus:outline-none focus:ring-2 focus:ring-[#E50914]">
                  <BookOpen size={13} /> Guia Completo
                </button>
                <button tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); playSelectSound(); } }} className="px-4 py-2.5 rounded-xl flex items-center gap-2 text-[9px] font-black uppercase tracking-widest bg-white/[0.06] border border-white/[0.08] hover:bg-white/[0.12] hover:border-white/[0.15] backdrop-blur-xl transition-all duration-300 shadow-[0_2px_12px_rgba(0,0,0,0.2)] focus:outline-none focus:ring-2 focus:ring-[#E50914]">
                  <MonitorPlay size={13} /> Qualidade
                </button>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* GATILHO PARA ABRIR MENU QUANDO FECHADO */}
      {!isMenuOpen && (
        <button
          onClick={() => setIsMenuOpen(true)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); playSelectSound(); setIsMenuOpen(true); } }}
          tabIndex={0}
          className="fixed left-0 inset-y-0 w-24 flex items-center justify-center group z-[1000] hover:bg-black/40 transition-all focus:outline-none"
        >
          <div className="w-16 h-16 rounded-full bg-white/[0.05] backdrop-blur-xl border border-white/[0.1] flex items-center justify-center text-white/40 group-hover:scale-125 group-hover:bg-white/[0.15] group-hover:text-white group-focus:scale-125 group-focus:bg-white/[0.15] group-focus:text-white transition-all shadow-2xl">
            <ChevronRight size={40} />
          </div>
        </button>
      )}

      {/* GUIA DE PROGRAMAÇÃO OVERLAY */}
      {showChannelGuide && (
        <ChannelGuide
          channels={channels}
          onBack={() => setShowChannelGuide(false)}
          onSelectChannel={(ch) => {
            addChannelToHistory(ch);
            setSelectedChannel(ch);
            setShowChannelGuide(false);
            scheduleHideMenu();
          }}
        />
      )}

      <style>{`
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        .vision-btn { 
          background: rgba(255, 255, 255, 0.05);
          backdrop-filter: blur(20px);
        }
      `}</style>
    </div>
  );
};

export default LiveTV;
