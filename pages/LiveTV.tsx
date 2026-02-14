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
import { useSpatialNav } from '../hooks/useSpatialNavigation';
import { playNavigateSound, playSelectSound, playBackSound } from '../utils/soundEffects';

// --- Mock para Navegação Espacial (TV BOX) ---
const useFocusable = () => ({
  ref: useRef<any>(null),
  focused: false,
  focusSelf: () => { }
});

const CATEGORIES = [
  { id: 'all', name: 'Todos', icon: <LayoutGrid /> },
  { id: 'abertos', name: 'TV Aberta', icon: <Tv />, match: ['abertos', 'tv aberta', 'aberto'] },
  { id: 'esportes', name: 'Esportes', icon: <Trophy />, match: ['esportes', 'esporte', 'sport', 'sports'] },
  { id: 'filmes', name: 'Filmes e Séries', icon: <Film />, match: ['filmes', 'series', 'filme', 'serie'] },
  { id: 'noticias', name: 'Notícias', icon: <Newspaper />, match: ['noticias', 'noticia', 'news'] },
  { id: 'variedades', name: 'Variedades', icon: <Star />, match: ['variedades', 'variedade'] },
  { id: '24h', name: '24h', icon: <Clock />, match: ['24h', '24hs', '24 horas'] },
  { id: 'docs', name: 'Documentários', icon: <BookOpen />, match: ['documentarios', 'documentario', 'docs', 'discovery'] },
  { id: 'infantil', name: 'Infantil', icon: <Baby />, match: ['infantil', 'kids', 'infantis', 'desenhos'] },
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
      ${active || focused ? 'bg-white/[0.1] text-white backdrop-blur-xl border border-white/[0.15] shadow-[0_4px_20px_rgba(0,0,0,0.3)]' : 'text-white/40 hover:text-white/70 hover:bg-white/[0.04] border border-transparent focus:text-white/70 focus:bg-white/[0.04]'}`}
  >
    <div className="shrink-0 [&>svg]:w-4 [&>svg]:h-4">{icon}</div>
    <span className={`text-[9px] font-black uppercase tracking-[0.15em] transition-all duration-500 whitespace-nowrap
      ${expanded ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-10 pointer-events-none'}`}>
      {label}
    </span>
    {active && !expanded && (
      <div className="absolute left-0 w-[3px] h-5 bg-white/50 rounded-r-full shadow-[0_0_10px_rgba(255,255,255,0.2)]" />
    )}
  </button>
);

// ═══ CANAIS DE TESTE (HARDCODED) ═══
const TEST_CHANNELS: Channel[] = [
  { nome: 'COM Brasil', url: 'https://br5093.streamingdevideo.com.br/abc/abc/playlist.m3u8', logo: 'https://i.imgur.com/c8ztQnF.png', genero: 'teste' },
  { nome: 'SBT', url: 'https://www.youtube.com/watch?v=ABVQXgr2LW4', logo: 'https://logodownload.org/wp-content/uploads/2013/12/sbt-logo.png', genero: 'teste' },
  { nome: 'AgroBrasil TV', url: 'http://45.162.230.234:1935/agrobrasiltv/agrobrasiltv/playlist.m3u8', logo: 'https://upload.wikimedia.org/wikipedia/pt/6/60/Logo_AgroBrasilTV.jpg', genero: 'teste' },
  { nome: 'Futura', url: 'https://tv.unisc.br/hls/test.m3u8', logo: 'https://upload.wikimedia.org/wikipedia/commons/c/ce/Canal_Futura_2022.svg', genero: 'teste' },
  { nome: 'RBC', url: 'https://www.youtube.com/watch?v=oUdd3CsxYaE', logo: 'https://portal.rbc1.com.br/public/portal/img/layout/logorbc.png', genero: 'teste' },
  { nome: 'Anime TV', url: 'https://stmv1.srvif.com/animetv/animetv/playlist.m3u8', logo: 'https://i.imgur.com/fuuv2uP.jpg', genero: 'teste' },
  { nome: 'Record News', url: 'https://stream.ads.ottera.tv/playlist.m3u8?network_id=2116', logo: 'https://upload.wikimedia.org/wikipedia/commons/4/46/Record_News_logo_2023.svg', genero: 'teste' },
  { nome: 'ISTV', url: 'https://video08.logicahost.com.br/istvnacional/srt.stream/istvnacional.m3u8', logo: 'https://upload.wikimedia.org/wikipedia/pt/b/b5/Logotipo_da_ISTV.png', genero: 'teste' },
  { nome: 'Rede Brasil', url: 'https://video09.logicahost.com.br/redebrasiloficial/redebrasiloficial/playlist.m3u8', logo: 'https://upload.wikimedia.org/wikipedia/commons/d/d1/Marca_rede_brasil_rgb-color.png', genero: 'teste' },
  { nome: 'TV Câmara', url: 'https://stream3.camara.gov.br/tv1/manifest.m3u8', logo: 'https://i.imgur.com/UpV2PRk.png', genero: 'teste' },
  { nome: 'TVE RS', url: 'http://selpro1348.procergs.com.br:1935/tve/stve/playlist.m3u8', logo: 'https://upload.wikimedia.org/wikipedia/commons/c/c2/Logotipo_da_TVE_RS.png', genero: 'teste' },
  { nome: 'TV Cultura', url: 'https://player-tvcultura.stream.uol.com.br/live/tvcultura.m3u8', logo: 'https://upload.wikimedia.org/wikipedia/commons/8/82/Cultura_logo_2013.svg', genero: 'teste' },
];

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

  const listRef = useRef<HTMLDivElement>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-hide menu 2s após selecionar canal
  const scheduleHideMenu = useCallback(() => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => {
      setIsMenuOpen(false);
    }, 2000);
  }, []);

  // Limpar timer ao desmontar
  useEffect(() => {
    return () => { if (hideTimerRef.current) clearTimeout(hideTimerRef.current); };
  }, []);

  // Carregar dados iniciais + EPG
  useEffect(() => {
    const init = async () => {
      setIsLoading(true);
      const data = await channelsService.loadChannels();
      setChannels(data);
      setFilteredChannels(data);
      if (data.length > 0) setSelectedChannel(data[0]);
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

    // Se a categoria é 'teste', usar canais hardcoded
    if (activeCategoryId === 'teste') {
      result = TEST_CHANNELS;
    } else if (activeCategoryId !== 'all') {
      const cat = CATEGORIES.find(c => c.id === activeCategoryId);
      if (cat?.match) {
        result = channels.filter(c =>
          cat.match?.some(m => c.genero.toLowerCase().includes(m))
        );
      }
    }

    // Filtrar por busca
    if (searchQuery.trim()) {
      const lowerQuery = searchQuery.toLowerCase();
      result = result.filter(c => c.nome.toLowerCase().includes(lowerQuery));
    }

    setFilteredChannels(result);
    setFocusedIndex(0);
    setFocusedCategoryIndex(Math.max(0, CATEGORIES.findIndex((c) => c.id === activeCategoryId)));
  }, [activeCategoryId, searchQuery, channels]);

  // Navegação por teclado (TV Box) — throttle para não correr
  const keyThrottleRef = useRef<number>(0);
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Handler global para tecla Back/Escape
      if (e.key === 'Escape' || e.key === 'Backspace') {
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA') return;
        e.preventDefault();
        e.stopPropagation();
        playBackSound();
        if (showChannelGuide) {
          setShowChannelGuide(false);
          return;
        }
        if (!isMenuOpen) {
          navigate(-1);
          return;
        }
        setIsMenuOpen(false);
        return;
      }
      if (!isMenuOpen) {
        if (e.key === 'Enter' || e.key === 'ArrowLeft') setIsMenuOpen(true);
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
            setFocusedCategoryIndex(prev => Math.min(CATEGORIES.length - 1, prev + 1));
          }
          break;
        case 'Enter':
          if (focusArea === 'channels') {
            if (filteredChannels[focusedIndex]) {
              playSelectSound();
              setSelectedChannel(filteredChannels[focusedIndex]);
              scheduleHideMenu();
            }
          } else {
            const cat = CATEGORIES[focusedCategoryIndex];
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
  }, [isMenuOpen, filteredChannels, focusedIndex, focusedCategoryIndex, focusArea, showChannelGuide, navigate, scheduleHideMenu]);

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
            {/* Player de vídeo com a URL real do canal */}
            {selectedChannel.url ? (
              selectedChannel.url.includes('youtube.com/watch') || selectedChannel.url.includes('youtu.be') ? (
                <iframe
                  key={selectedChannel.url}
                  src={`https://www.youtube.com/embed/${selectedChannel.url.split('v=')[1] || selectedChannel.url.split('/').pop()}?autoplay=1&mute=0&rel=0`}
                  className="w-full h-full border-0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                  title={selectedChannel.nome}
                />
              ) : (
              <video
                key={selectedChannel.url}
                src={selectedChannel.url}
                autoPlay
                controls={false}
                className="w-full h-full object-cover"
                onError={(e) => {
                  // Se falha o player nativo, tenta com iframe
                  const target = e.currentTarget;
                  target.style.display = 'none';
                  const iframe = target.nextElementSibling as HTMLElement;
                  if (iframe) iframe.style.display = 'block';
                }}
              />
              )
            ) : null}
            {/* Fallback iframe para streams HLS/DASH */}
            <iframe
              key={`iframe-${selectedChannel.url}`}
              src={selectedChannel.url}
              className="w-full h-full border-0"
              style={{ display: selectedChannel.url ? 'none' : 'block' }}
              allow="autoplay; encrypted-media; fullscreen"
              title={selectedChannel.nome}
            />
            {/* Logo overlay quando não tem URL */}
            {!selectedChannel.url && (
              <>
                <div className="absolute inset-0 flex items-center justify-center opacity-20 blur-2xl">
                  <img src={selectedChannel.logo} className="w-1/2 h-1/2 object-contain" />
                </div>
                <div className="text-center z-10">
                  <img src={selectedChannel.logo} className="h-40 w-auto mx-auto mb-8 object-contain drop-shadow-[0_0_50px_rgba(229,9,20,0.5)]" />
                  <div className="flex items-center justify-center gap-4 text-white/40">
                    <div className="w-2 h-2 rounded-full bg-red-600 animate-pulse" />
                    <span className="text-xs font-black uppercase tracking-[0.3em]">Conectando ao Stream...</span>
                  </div>
                </div>
              </>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black/40" />
          </div>
        ) : (
          <div className="w-full h-full bg-zinc-950 flex items-center justify-center">
            <Radio size={80} className="text-zinc-800 animate-pulse" />
          </div>
        )}

        {/* Overlay para destaque quando o menu está aberto */}
        <div className={`absolute inset-0 bg-black/60 transition-opacity duration-1000 ${isMenuOpen ? 'opacity-100' : 'opacity-0'}`} />
        <div className={`absolute inset-0 bg-gradient-to-r from-black/90 via-black/40 to-transparent transition-opacity duration-1000 ${isMenuOpen ? 'opacity-100' : 'opacity-0'}`} />
      </div>

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
          className={`h-full bg-gradient-to-b from-white/[0.04] to-white/[0.01] backdrop-blur-2xl border-r border-white/[0.08] flex flex-col py-4 transition-all duration-500 ease-in-out shadow-[4px_0_30px_rgba(0,0,0,0.3)]
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
              <span className="font-black text-lg tracking-tighter italic text-white">RED<span className="text-[#E50914]">X</span></span>
            )}
          </div>

          <div className="flex-1 overflow-y-auto hide-scrollbar space-y-0.5 px-1">
            {CATEGORIES.map((cat, idx) => (
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
                <h2 className="text-lg font-black italic tracking-tighter uppercase text-white">Guia de <span className="text-white/40">Canais</span></h2>
                <div className="flex items-center gap-2 text-white/40 text-[8px] font-bold uppercase tracking-[0.3em]">
                  <div className="w-1.5 h-1.5 rounded-full bg-white/40 animate-pulse" />
                  {CATEGORIES.find(c => c.id === activeCategoryId)?.name}
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

          <div ref={listRef} className="flex-1 overflow-y-auto px-3 pb-4 space-y-1 hide-scrollbar">
            {filteredChannels.map((channel, idx) => (
              <button
                key={channel.nome + channel.url}
                data-nav-item
                data-nav-col={idx}
                tabIndex={0}
                onClick={() => {
                  setSelectedChannel(channel);
                  scheduleHideMenu();
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { e.preventDefault(); playSelectSound(); setSelectedChannel(channel); scheduleHideMenu(); }
                }}
                onMouseEnter={() => setFocusedIndex(idx)}
                className={`w-full group flex items-center gap-3 p-2 rounded-xl transition-all duration-300 relative focus:outline-none focus:ring-2 focus:ring-[#E50914]
                  ${focusedIndex === idx
                    ? 'bg-white/[0.12] text-white backdrop-blur-2xl border border-white/[0.2] shadow-[0_4px_30px_rgba(0,0,0,0.4)] scale-[1.02] z-10'
                    : 'bg-white/[0.03] text-white/60 hover:bg-white/[0.07] border border-transparent'}`}
              >
                <div className={`w-6 text-[8px] font-black text-center ${focusedIndex === idx ? 'text-white/60' : 'text-white/20'}`}>
                  {100 + idx + 1}
                </div>
                {/* Ícone de canal com efeito de vidro */}
                <div className={`w-10 h-10 rounded-xl p-1.5 flex items-center justify-center shrink-0 transition-all duration-300 overflow-hidden
                  ${focusedIndex === idx
                    ? 'bg-gradient-to-br from-white/[0.15] to-white/[0.06] border border-white/[0.25] shadow-[0_4px_16px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.1)] scale-110'
                    : 'bg-gradient-to-br from-white/[0.08] to-white/[0.03] border border-white/[0.1] shadow-[0_2px_8px_rgba(0,0,0,0.3)]'}`}
                >
                  <img src={channel.logo} className="max-w-full max-h-full object-contain drop-shadow-[0_2px_8px_rgba(255,255,255,0.1)]" />
                </div>
                <div className="flex-1 text-left overflow-hidden">
                  <div className={`text-[11px] font-black uppercase tracking-tight truncate ${focusedIndex === idx ? 'text-white' : 'text-white/70'}`}>
                    {channel.nome}
                  </div>
                  {(() => {
                    const prog = epgReady ? getCurrentProgramme(channel.nome) : null;
                    if (prog) {
                      return (
                        <>
                          <div className={`text-[8px] font-semibold truncate ${focusedIndex === idx ? 'text-white/60' : 'text-white/35'}`}>
                            {prog.isLive && <span className="text-white/50 mr-1">●</span>}
                            {formatTime(prog.start)} {prog.title}
                          </div>
                          <div className="w-full h-[2px] mt-0.5 rounded-full bg-white/[0.06] overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-white/40 to-white/15 rounded-full transition-all duration-1000"
                              style={{ width: `${getProgrammeProgress(prog)}%` }}
                            />
                          </div>
                        </>
                      );
                    }
                    return (
                      <div className={`text-[8px] font-bold uppercase tracking-widest truncate ${focusedIndex === idx ? 'text-white/50' : 'text-white/30'}`}>
                        {channel.genero}
                      </div>
                    );
                  })()}
                </div>
                {selectedChannel?.url === channel.url && !(focusedIndex === idx) && (
                  <div className="w-1.5 h-1.5 rounded-full bg-white/50 shadow-[0_0_8px_rgba(255,255,255,0.3)]" />
                )}
              </button>
            ))}
          </div>
        </div>
        </div>{/* FIM MENU */}

        {/* 3. INFO DO CANAL (DIREITA) — centralizado */}
        {selectedChannel && (
          <div className="flex-1 flex items-center justify-center animate-in fade-in slide-in-from-left-10 duration-1000">
            <div className="max-w-lg w-full bg-gradient-to-br from-white/[0.07] to-white/[0.02] backdrop-blur-2xl p-6 rounded-[1.5rem] border border-white/[0.12] space-y-4 shadow-[0_8px_60px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.08)] scale-[0.8] origin-center">
              {/* Header badges */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="bg-white/[0.12] backdrop-blur-2xl border border-white/[0.18] px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest flex items-center gap-2 shadow-[0_2px_12px_rgba(255,255,255,0.06)]">
                    <Play size={10} fill="currentColor" /> Assistindo Agora
                  </div>
                  <span className="px-2.5 py-1 bg-white/[0.06] rounded-lg border border-white/[0.08] text-[8px] font-bold uppercase tracking-wider text-white/50">{selectedChannel.genero}</span>
                </div>
                <span className="text-[8px] text-white/30 font-bold uppercase tracking-widest">UHD 4K</span>
              </div>

              {/* Canal header */}
              <div className="flex items-center gap-4 py-1">
                <div className="w-16 h-16 rounded-2xl p-2.5 flex items-center justify-center overflow-hidden shrink-0 bg-white/[0.08] backdrop-blur-2xl border border-white/[0.12] shadow-[0_4px_20px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.1)]">
                  <img src={selectedChannel.logo} className="w-full h-full object-contain drop-shadow-[0_2px_10px_rgba(255,255,255,0.12)]" />
                </div>
                <div>
                  <h1 className="text-2xl md:text-3xl font-black italic tracking-tighter uppercase text-white leading-none drop-shadow-[0_2px_8px_rgba(0,0,0,0.5)]">
                    {selectedChannel.nome}
                  </h1>
                  <div className="h-0.5 w-12 bg-gradient-to-r from-white/30 to-transparent mt-2 rounded-full" />
                </div>
              </div>

              {/* === PROGRAMAÇÃO EPG === */}
              <div className="w-full max-w-[560px] mx-auto">
                <div className="rounded-2xl border border-white/[0.12] bg-white/[0.05] backdrop-blur-2xl p-4 shadow-[0_8px_32px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.08)]">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-white/60 uppercase tracking-widest">Programação</span>
                    <div className="h-px flex-1 bg-gradient-to-r from-white/10 to-transparent" />
                    {epgReady && hasEPG(selectedChannel.nome) && (
                      <span className="text-[7px] font-bold text-emerald-400/50 uppercase tracking-widest flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400/50 animate-pulse" />EPG</span>
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

                    const currentProg = getCurrentProgramme(selectedChannel.nome);
                    const nextProg = getNextProgramme(selectedChannel.nome);
                    const schedule = getChannelSchedule(selectedChannel.nome, 8);

                    if (!currentProg && schedule.length === 0) {
                      return (
                        <div className="mt-3 p-3 rounded-xl border border-white/[0.06] bg-white/[0.04] backdrop-blur-2xl">
                          <h3 className="text-sm font-black uppercase text-white/80 mb-1">Sem grade disponível</h3>
                          <p className="text-xs text-white/40 font-medium italic leading-relaxed">
                            Transmissão do canal {selectedChannel.nome} com tecnologia RedX.
                          </p>
                        </div>
                      );
                    }

                    return (
                      <div className="mt-3 grid grid-cols-[1.2fr_1fr] gap-3">
                        <div className="flex flex-col gap-3">
                          {currentProg ? (
                            <div className="p-4 rounded-xl border border-white/[0.12] bg-gradient-to-br from-white/[0.08] to-white/[0.03] backdrop-blur-2xl space-y-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_4px_24px_rgba(0,0,0,0.3)]">
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
                              <h3 className="text-base font-black uppercase text-white leading-tight tracking-tight">{currentProg.title}</h3>
                              {currentProg.category && (
                                <div className="flex items-center gap-2">
                                  <span className="text-[8px] px-2 py-0.5 rounded-md bg-white/[0.07] border border-white/[0.08] text-white/50 font-bold uppercase">{currentProg.category}</span>
                                  {currentProg.episode && <span className="text-[8px] text-white/25 font-bold">{currentProg.episode}</span>}
                                </div>
                              )}
                              {currentProg.description && !/^\[\d/.test(currentProg.description) && (
                                <p className="text-[11px] text-white/40 font-medium leading-relaxed line-clamp-3">{currentProg.description}</p>
                              )}
                              <div className="space-y-1 pt-1">
                                <div className="w-full h-[3px] rounded-full bg-white/[0.06] overflow-hidden">
                                  <div
                                    className="h-full bg-gradient-to-r from-white/50 via-white/40 to-white/20 rounded-full transition-all duration-1000 shadow-[0_0_8px_rgba(255,255,255,0.15)]"
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
                            <div className="p-3.5 rounded-xl border border-white/[0.07] bg-white/[0.04] backdrop-blur-xl">
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
          channels={[...channels, ...(activeCategoryId === 'teste' ? TEST_CHANNELS : [])]}
          onBack={() => setShowChannelGuide(false)}
          onSelectChannel={(ch) => {
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
