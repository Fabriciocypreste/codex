
import React, { useState, useEffect } from 'react';
import { Page, UserProfile, Media } from './types';

// ═══ LAZY LOADING — Todas as páginas carregam sob demanda ═══
// Login e Navigation carregam imediato (são a primeira tela)
import Login from './pages/Login';
import Navigation from './components/Navigation';

// Profiles carrega imediato (tela após login — evita tela preta)
import Profiles from './pages/Profiles';
// Páginas do app — lazy loaded
const Home = React.lazy(() => import('./pages/Home'));
const Movies = React.lazy(() => import('./pages/Movies'));
const Series = React.lazy(() => import('./pages/Series'));
const Kids = React.lazy(() => import('./pages/Kids'));
const MyList = React.lazy(() => import('./pages/MyList'));
const LiveTV = React.lazy(() => import('./pages/LiveTV'));
const Details = React.lazy(() => import('./pages/Details'));
const Player = React.lazy(() => import('./pages/Player'));
const Settings = React.lazy(() => import('./pages/Settings'));
const Search = React.lazy(() => import('./pages/Search'));

// Admin Pages — Lazy loaded (só carrega quando acessar /admin)
const AdminDashboard = React.lazy(() => import('./pages/admin/Dashboard'));
const AdminSubscribers = React.lazy(() => import('./pages/admin/Subscribers'));
const AdminFinance = React.lazy(() => import('./pages/admin/Finance'));
const AdminIPTV = React.lazy(() => import('./pages/admin/IPTV'));
const AdminVOD = React.lazy(() => import('./pages/admin/VOD'));
const AdminResellers = React.lazy(() => import('./pages/admin/Resellers'));
const AdminSecurity = React.lazy(() => import('./pages/admin/Security'));
const AdminSettings = React.lazy(() => import('./pages/admin/Settings'));
const AdminCatalogControl = React.lazy(() => import('./pages/admin/CatalogControl'));
const AdminIngestion = React.lazy(() => import('./pages/admin/Ingestion'));
const StreamTester = React.lazy(() => import('./pages/admin/StreamTester'));
const AdminP2PSettings = React.lazy(() => import('./pages/admin/P2PSettings'));
import AdminRoute from './components/AdminRoute';

// Suspense fallback para lazy loading
const LazyFallback = () => (
  <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'radial-gradient(ellipse at center, rgba(229,9,20,0.06) 0%, rgba(11,11,15,0.97) 60%, #0B0B0F 100%)' }}>
    <div className="flex flex-col items-center gap-5">
      <div className="relative">
        <svg className="w-20 h-20 animate-spin" style={{ animationDuration: '2.5s' }} viewBox="0 0 80 80">
          <circle cx="40" cy="40" r="36" fill="none" stroke="rgba(229,9,20,0.15)" strokeWidth="2" />
          <circle cx="40" cy="40" r="36" fill="none" stroke="#E50914" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="60 170" />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <img src="/logored.png" alt="Redflix" className="h-8 w-auto object-contain opacity-80" style={{ animation: 'pulse 2s ease-in-out infinite' }} />
        </div>
      </div>
      <p className="text-[10px] font-semibold uppercase tracking-[0.4em] text-white/25">Carregando...</p>
    </div>
  </div>
);

import { getAllMovies, getAllSeries } from './services/supabaseService';
import { getCatalogWithFilters } from './services/supabaseService';
import { getCatalogSettings } from './services/catalogService';
import { canAccessContent } from './services/profileService';
import { fetchTMDBCatalog } from './services/tmdbCatalog';
import { getStreamUrl, clearStreamCache } from './services/streamService';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { BrowserRouter as Router, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { SpatialNavProvider, useSpatialNav } from './hooks/useSpatialNavigation';
import { sanitizeMediaList } from './utils/mediaUtils';
import { playBackSound, playSelectSound, initAudio } from './utils/soundEffects';
import { ConfigProvider } from './contexts/ConfigContext';
import { getNextEpisode } from './services/streamService';

// Função de filtro removida pois CatalogSettings não existe no banco oficial.
// O filtro de 2018 agora é aplicado diretamente no carregamento inicial.

// Unique helper
const removeDuplicates = (mediaList: Media[]) => {
  const seen = new Set();
  return mediaList.filter(m => {
    if (!m.tmdb_id) return true; // Keep internal legacy items without ID? Or remove? Safer to keep.
    if (seen.has(m.tmdb_id)) return false;
    seen.add(m.tmdb_id);
    return true;
  });
};


// Wrapper component to handle legacy state-based navigation alongside router
const LegacyAppInner: React.FC = () => {
  const [currentPage, setCurrentPage] = useState<Page>(Page.LOGIN);
  const [activeProfile, setActiveProfile] = useState<UserProfile | null>(null);
  const [selectedMedia, setSelectedMedia] = useState<Media | null>(null);
  const [movies, setMovies] = useState<Media[]>([]);
  const [series, setSeries] = useState<Media[]>([]);
  const [trendingMovies, setTrendingMovies] = useState<Media[]>([]);
  const [trendingSeries, setTrendingSeries] = useState<Media[]>([]);
  const [moviesByGenre, setMoviesByGenre] = useState<Map<string, Media[]>>(new Map());
  const [seriesByGenre, setSeriesByGenre] = useState<Map<string, Media[]>>(new Map());
  const [loading, setLoading] = useState(true);
  const [previousPage, setPreviousPage] = useState<Page>(Page.HOME);
  const [nextEpisodeData, setNextEpisodeData] = useState<{
    title: string; season: number; episode: number; stream_url?: string;
  } | null>(null);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const navigateRouter = useNavigate();
  const { savePosition, restorePosition, focusToFirstRow, setPosition, pushFocusTrap, popFocusTrap } = useSpatialNav();
  const { user, loading: authLoading } = useAuth();

  // ═══ AUTO-REDIRECT: se já existe sessão válida, pular Login e Planos ═══
  useEffect(() => {
    if (!authLoading && user && currentPage === Page.LOGIN) {
      setCurrentPage(Page.PROFILES); // Sempre ir para Profiles (tela de planos removida)
    }
  }, [authLoading, user, currentPage]);

  // TV Box: ao trocar de página, focar o primeiro item navegável
  // Páginas com Navigation (showNav) começam na row 1 (conteúdo), não row 0 (menu)
  const pagesWithRows = [Page.LOGIN, Page.PLANS, Page.PROFILES, Page.HOME, Page.MOVIES, Page.SERIES, Page.KIDS, Page.MY_LIST, Page.LIVE, Page.SEARCH];
  const pagesWithNav = [Page.HOME, Page.MOVIES, Page.SERIES, Page.KIDS, Page.MY_LIST, Page.SEARCH];
  useEffect(() => {
    if (!pagesWithRows.includes(currentPage)) return;
    const t = setTimeout(() => {
      if (pagesWithNav.includes(currentPage)) {
        // Focar no conteúdo (row 1 = HeroBanner/primeiro conteúdo), não no menu (row 0)
        setPosition(1, 0);
      } else {
        focusToFirstRow();
      }
    }, 200);
    return () => clearTimeout(t);
  }, [currentPage, focusToFirstRow, setPosition]);

  // ═══ CACHE + CARREGAMENTO PROGRESSIVO ═══
  // 1. Exibe cache local instantaneamente (0ms)
  // 2. Busca dados frescos do Supabase em background
  // 3. Atualiza cache para próxima abertura

  const CACHE_KEY = 'redx-catalog-cache';
  const CACHE_TTL = 30 * 60 * 1000; // 30 minutos

  const organizeByGenre = (items: Media[]): Map<string, Media[]> => {
    const map = new Map<string, Media[]>();
    items.forEach(item => {
      if (Array.isArray(item.genre)) {
        item.genre.forEach(g => {
          const clean = g.trim();
          if (!clean || clean.length < 2) return;
          if (!map.has(clean)) map.set(clean, []);
          map.get(clean)!.push(item);
        });
      }
    });
    return new Map(
      Array.from(map.entries())
        .filter(([_, items]) => items.length >= 2)
        .sort((a, b) => b[1].length - a[1].length)
    );
  };

  const sortByRating = (a: Media, b: Media) => {
    const ra = parseFloat(String(a.rating || '0'));
    const rb = parseFloat(String(b.rating || '0'));
    return rb - ra;
  };

  const applyCatalog = (cleanMovies: Media[], cleanSeries: Media[]) => {
    setMovies(cleanMovies);
    setSeries(cleanSeries);
    setTrendingMovies([...cleanMovies].sort(sortByRating).slice(0, 20));
    setTrendingSeries([...cleanSeries].sort(sortByRating).slice(0, 20));
    setMoviesByGenre(organizeByGenre(cleanMovies));
    setSeriesByGenre(organizeByGenre(cleanSeries));
  };

  useEffect(() => {
    const timerId = 'Catálogo-' + Date.now();
    const loadTimeout = setTimeout(() => setLoading(false), 15000); // Máx 15s
    const loadData = async () => {
      try {
        console.time(timerId);

        // ── FASE 1: Cache instantâneo (0ms de espera) ──
        let usedCache = false;
        try {
          const cached = localStorage.getItem(CACHE_KEY);
          if (cached) {
            const { movies: cm, series: cs, timestamp } = JSON.parse(cached);
            if (cm?.length > 0 && Date.now() - timestamp < CACHE_TTL) {
              const cachedMovies = cm.map((m: any) => ({ ...m, type: 'movie' as const })) as Media[];
              const cachedSeries = cs.map((s: any) => ({ ...s, type: 'series' as const })) as Media[];
              applyCatalog(cachedMovies, cachedSeries);
              setLoading(false);
              usedCache = true;
              try { console.timeEnd(timerId); } catch {}
              // Dados frescos em background (não bloquear)
              getCatalogSettings().then(catalogSettings => {
                const filters = catalogSettings ? { minYear: 2022, maxYear: catalogSettings.max_year, genres: catalogSettings.selected_genres, contentType: catalogSettings.content_type } : { minYear: 2022 };
                return getCatalogWithFilters(filters);
              }).then(({ movies: dbMovies, series: dbSeries }) => {
                const cleanMovies = sanitizeMediaList((dbMovies || []).map(m => ({ ...m, type: 'movie' as const })) as Media[]);
                const cleanSeries = sanitizeMediaList((dbSeries || []).map(s => ({ ...s, type: 'series' as const })) as Media[]);
                applyCatalog(removeDuplicates(cleanMovies), removeDuplicates(cleanSeries));
                try { localStorage.setItem(CACHE_KEY, JSON.stringify({ movies: cleanMovies.slice(0, 500), series: cleanSeries.slice(0, 500), timestamp: Date.now() })); } catch {}
              }).catch(() => {}).finally(() => { try { console.timeEnd(timerId); } catch {} });
              return;
            }
          }
        } catch {}

        // ── FASE 2: Buscar dados frescos do Supabase ──
        const catalogSettings = await getCatalogSettings();
        const filters = catalogSettings ? {
          minYear: 2022,
          maxYear: catalogSettings.max_year,
          genres: catalogSettings.selected_genres,
          contentType: catalogSettings.content_type
        } : { minYear: 2022 };

        const { movies: dbMovies, series: dbSeries } = await getCatalogWithFilters(filters);

        let dbMoviesTyped = (dbMovies || []).map(m => ({ ...m, type: 'movie' as const })) as Media[];
        let dbSeriesTyped = (dbSeries || []).map(s => ({ ...s, type: 'series' as const })) as Media[];

        dbMoviesTyped = removeDuplicates(dbMoviesTyped);
        dbSeriesTyped = removeDuplicates(dbSeriesTyped);

        const cleanMovies = sanitizeMediaList(dbMoviesTyped);
        const cleanSeries = sanitizeMediaList(dbSeriesTyped);

        applyCatalog(cleanMovies, cleanSeries);

        // ── FASE 3: Salvar no cache para próxima abertura ──
        try {
          const cacheData = {
            movies: cleanMovies.slice(0, 500),
            series: cleanSeries.slice(0, 500),
            timestamp: Date.now(),
          };
          localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));
        } catch {}

        console.timeEnd(timerId);
      } catch (err) {
        console.error('❌ Erro ao carregar catálogo:', err);
        try { console.timeEnd(timerId); } catch {}
      } finally {
        clearTimeout(loadTimeout);
        setLoading(false);
      }
    };
    loadData();
    return () => clearTimeout(loadTimeout);
  }, []);

  const navigate = (page: Page, media: Media | null = null) => {
    if (media) setSelectedMedia(media);
    setPreviousPage(currentPage);
    setCurrentPage(page);
  };

  const handlePlayMedia = async (media: Media) => {
    // Verificação de Controle Parental
    if (activeProfile && !canAccessContent(activeProfile, media.rating)) {
      console.warn(`[Parental] Blocked content "${media.title}" (Rating: ${media.rating}) for profile "${activeProfile.name}"`);
      playBackSound();
      // Em um app real, seria um modal bonito. Por enquanto, alert é funcional.
      alert(`Conteúdo bloqueado pela classificação indicativa (${media.rating || 'N/A'}).`);
      return;
    }

    console.log(`[handlePlayMedia] "${media.title}" | stream_url: ${media.stream_url ? 'SIM' : 'NÃO'} | tmdb_id: ${media.tmdb_id}`);

    // Se já tem stream_url, abrir direto
    if (media.stream_url) {
      console.log(`[handlePlayMedia] Abrindo stream direto: ${media.stream_url.substring(0, 80)}...`);
      savePosition('player-return');
      setPreviousPage(currentPage);
      setSelectedMedia(media);
      setCurrentPage(Page.PLAYER);
      return;
    }

    // Buscar no Supabase por título
    console.log(`[handlePlayMedia] Buscando stream_url no Supabase para: "${media.title}"`);
    const url = await getStreamUrl(media.title, media.type, media.tmdb_id);
    if (url) {
      console.log(`[handlePlayMedia] ✓ stream_url encontrada no Supabase: ${url.substring(0, 80)}...`);
      savePosition('player-return');
      setPreviousPage(currentPage);
      setSelectedMedia({ ...media, stream_url: url });
      setCurrentPage(Page.PLAYER);
      return;
    }

    console.warn(`[handlePlayMedia] ✗ Nenhuma stream_url encontrada para "${media.title}". Player abrirá com fallback trailer.`);
    savePosition('player-return');
    setPreviousPage(currentPage);
    setSelectedMedia(media);
    setCurrentPage(Page.PLAYER);
  };

  // ═══ NEXT EPISODE: buscar próximo episódio quando Player é aberto com série ═══
  useEffect(() => {
    if (currentPage !== Page.PLAYER || !selectedMedia || selectedMedia.type !== 'series') {
      setNextEpisodeData(null);
      return;
    }
    const fetchNext = async () => {
      if (!selectedMedia.tmdb_id) return;
      // Extrair season/episode do media atual (fallback S1E1)
      const season = (selectedMedia as any).season_number || 1;
      const episode = (selectedMedia as any).episode_number || 1;
      const result = await getNextEpisode(selectedMedia.tmdb_id, season, episode, user?.id);
      if (result) {
        setNextEpisodeData({
          title: result.title,
          season: result.season,
          episode: result.episode,
          stream_url: result.stream_url,
        });
      } else {
        setNextEpisodeData(null);
      }
    };
    fetchNext();
  }, [currentPage, selectedMedia, user?.id]);

  // ═══ AUTOPLAY: reproduzir próximo episódio automaticamente ═══
  const handlePlayNext = () => {
    if (!nextEpisodeData || !selectedMedia) return;
    const nextMedia: Media = {
      ...selectedMedia,
      title: nextEpisodeData.title,
      stream_url: nextEpisodeData.stream_url || '',
      season_number: nextEpisodeData.season,
      episode_number: nextEpisodeData.episode,
    } as Media;
    setNextEpisodeData(null);
    setSelectedMedia(nextMedia);
    // Player re-renderiza com novo media, busca próximo episódio no useEffect acima
  };

  const handleLogin = () => {
    setCurrentPage(Page.PROFILES); // Tela de planos removida
  };

  const handleProfileSelect = (profile: UserProfile) => {
    setActiveProfile(profile);
    setCurrentPage(profile.isKids ? Page.KIDS : Page.HOME);
  };

  const handleBackToHome = () => {
    const targetPage = activeProfile?.isKids ? Page.KIDS : Page.HOME;
    setCurrentPage(targetPage);
  };

  // Handle Back/Escape from TV remote globally
  const handleTVBack = () => {
    playBackSound();
    switch (currentPage) {
      case Page.DETAILS:
      case Page.PLAYER:
        handleBackToHome();
        break;
      case Page.MOVIES:
      case Page.SERIES:
      case Page.LIVE:
      case Page.MY_LIST:
      case Page.KIDS:
      case Page.SETTINGS:
      case Page.SEARCH:
      case Page.ADMIN:
        setCurrentPage(Page.HOME);
        setShowExitConfirm(false);
        break;
      case Page.HOME:
        if (showExitConfirm) {
          (window as any).__canExitApp = true;
        } else {
          setShowExitConfirm(true);
        }
        break;
      case Page.PROFILES:
        setCurrentPage(Page.LOGIN);
        break;
      default:
        break;
    }
  };

  // Global Back/Escape key handler for TV remote
  useEffect(() => {
    // Init audio on first user interaction
    const initOnce = () => {
      initAudio();
      window.removeEventListener('keydown', initOnce);
      window.removeEventListener('click', initOnce);
    };
    window.addEventListener('keydown', initOnce, { once: true });
    window.addEventListener('click', initOnce, { once: true });

    // Resetar flag de saida a cada mudanca de pagina
    (window as any).__canExitApp = false;

    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Backspace') {
        if (e.defaultPrevented) return;
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA') return;
        // Paginas com handler proprio de Back: deixar o componente tratar
        if (currentPage === Page.LIVE || currentPage === Page.PLAYER) return;
        e.preventDefault();
        handleTVBack();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [currentPage, activeProfile, showExitConfirm]);

  // Fechar dialog de saida ao navegar para outra pagina
  useEffect(() => {
    if (currentPage !== Page.HOME) setShowExitConfirm(false);
  }, [currentPage]);

  // Focus trap no modal de sair (TV Box: manter foco nos botoes)
  useEffect(() => {
    if (showExitConfirm) {
      pushFocusTrap('exit-confirm-modal');
      return () => popFocusTrap();
    }
  }, [showExitConfirm, pushFocusTrap, popFocusTrap]);

  const renderPage = () => {
    // Não bloquear Profiles/Plans com loading do catálogo — eles não precisam do catálogo
    const needsCatalog = ![Page.LOGIN, Page.PROFILES, Page.PLANS].includes(currentPage);
    if (loading && needsCatalog) {
      return (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'radial-gradient(ellipse at center, rgba(229,9,20,0.06) 0%, rgba(11,11,15,0.97) 60%, #0B0B0F 100%)' }}>
          <div className="flex flex-col items-center gap-5">
            <div className="relative">
              <svg className="w-20 h-20 animate-spin" style={{ animationDuration: '2.5s' }} viewBox="0 0 80 80">
                <circle cx="40" cy="40" r="36" fill="none" stroke="rgba(229,9,20,0.15)" strokeWidth="2" />
                <circle cx="40" cy="40" r="36" fill="none" stroke="#E50914" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="60 170" />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <img src="/logored.png" alt="Redflix" className="h-8 w-auto object-contain opacity-80" style={{ animation: 'pulse 2s ease-in-out infinite' }} />
              </div>
            </div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.4em] text-white/25">Carregando catálogo</p>
          </div>
        </div>
      );
    }

    switch (currentPage) {
      case Page.LOGIN:
        return <Login onLogin={handleLogin} onAdminAccess={() => {
          // Navegação direta para /admin
          window.location.href = '/admin/vod';
        }} />;
      case Page.PLANS:
        return <Profiles onSelect={handleProfileSelect} />; // Planos removido — fallback para Profiles
      case Page.PROFILES:
        return <Profiles onSelect={handleProfileSelect} />;
      case Page.HOME:
        return <Home
          movies={movies}
          series={series}
          trendingMovies={trendingMovies}
          trendingSeries={trendingSeries}
          moviesByGenre={moviesByGenre}
          seriesByGenre={seriesByGenre}
          onSelectMedia={(m) => navigate(Page.DETAILS, m)}
          onPlayMedia={handlePlayMedia}
        />;
      case Page.MOVIES:
        return <Movies
          movies={movies}
          moviesByGenre={moviesByGenre}
          trendingMovies={trendingMovies}
          onSelectMedia={(m) => navigate(Page.DETAILS, m)}
          onPlayMedia={handlePlayMedia}
        />;
      case Page.SERIES:
        return <Series
          series={series}
          seriesByGenre={seriesByGenre}
          trendingSeries={trendingSeries}
          onSelectMedia={(m) => navigate(Page.DETAILS, m)}
          onPlayMedia={handlePlayMedia}
        />;
      case Page.KIDS:
        return <Kids movies={movies} series={series} onSelectMedia={(m) => navigate(Page.DETAILS, m)} onPlayMedia={handlePlayMedia} />;
      case Page.MY_LIST:
        return <MyList onSelectMedia={(m) => navigate(Page.DETAILS, m)} onPlayMedia={handlePlayMedia} />;
      case Page.LIVE:
        return <LiveTV onBack={handleTVBack} />;
      case Page.DETAILS:
        return (
          <Details
            media={selectedMedia!}
            onPlay={() => handlePlayMedia(selectedMedia!)}
            onBack={handleBackToHome}
          />
        );
      case Page.PLAYER:
        return (
          <Player
            media={selectedMedia!}
            onClose={() => {
              setCurrentPage(Page.HOME);
              setNextEpisodeData(null);
              restorePosition('player-return');
            }}
            nextEpisode={nextEpisodeData}
            onPlayNext={handlePlayNext}
          />
        );
      case Page.ADMIN:
        return <AdminDashboard />;
      case Page.SETTINGS:
        return <Settings onBack={() => setCurrentPage(Page.HOME)} />;
      case Page.SEARCH:
        return <Search onSelectMedia={(m) => navigate(Page.DETAILS, m)} onPlayMedia={handlePlayMedia} />;
      default:
        return <Home movies={movies} series={series} trendingMovies={trendingMovies} trendingSeries={trendingSeries} moviesByGenre={moviesByGenre} seriesByGenre={seriesByGenre} onSelectMedia={(m) => navigate(Page.DETAILS, m)} />;
    }
  };

  const showNav = ![Page.LOGIN, Page.PLANS, Page.PROFILES, Page.PLAYER, Page.DETAILS, Page.ADMIN, Page.SETTINGS, Page.LIVE].includes(currentPage);

  // Background: poster do conteúdo com blur
  const getBackgroundImage = () => {
    if (selectedMedia) return selectedMedia.poster;
    // Trending TMDB para background (tem URLs TMDB garantidas)
    if (trendingMovies.length > 0) return trendingMovies[0]?.backdrop || trendingMovies[0]?.poster;
    if (currentPage === Page.MOVIES) return movies[0]?.poster;
    if (currentPage === Page.SERIES) return series[0]?.poster;
    return movies[0]?.poster || series[0]?.poster || '';
  };

  const bgImage = getBackgroundImage();

  return (
    <div className="relative min-h-screen w-full overflow-x-hidden overflow-y-auto flex flex-col items-center text-white">
      {/* Background Layer — blur reduzido para performance (Fire Stick) */}
      <div
        className="fixed inset-0 transition-opacity duration-1000 ease-in-out -z-10"
        style={{
          backgroundImage: bgImage ? `url(${bgImage})` : 'none',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          filter: currentPage === Page.PLAYER ? 'none' : 'brightness(0.3)',
          opacity: bgImage ? 1 : 0,
        }}
      />

      {/* Ambient Gradient Overlay */}
      <div className="fixed inset-0 bg-linear-to-b from-transparent via-[#0B0B0F]/40 to-[#0B0B0F] pointer-events-none -z-10" />

      {/* Navigation Header (Top - Transparent) */}
      {showNav && (
        <header className="fixed top-0 left-0 right-0 z-50 flex items-center pointer-events-none bg-linear-to-b from-black/80 to-transparent pt-4 pb-12 px-12">
          <div className="w-full pointer-events-auto">
            <Navigation
              currentPage={currentPage}
              onNavigate={navigate}
              profile={activeProfile}
              onProfileClick={() => setCurrentPage(Page.SETTINGS)}
            />
          </div>
        </header>
      )}

      {/* Main Content Area */}
      <main className={`w-full flex-1 flex flex-col items-center ${[Page.LIVE, Page.DETAILS, Page.SETTINGS].includes(currentPage) ? 'p-0 pt-0' : 'p-0'}`}>
        <React.Suspense fallback={<LazyFallback />}>
          {renderPage()}
        </React.Suspense>
      </main>

      {/* Volumetric Light Effects */}
      <div className="fixed -bottom-24 left-1/2 -translate-x-1/2 w-200 h-100 bg-[#E50914]/10 rounded-full pointer-events-none -z-5" />

      {/* Modal: Tem certeza que deseja sair? (pressionar Voltar 2x na Home) */}
      {showExitConfirm && (
        <div id="exit-confirm-modal" className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/85" role="dialog" aria-modal="true" aria-labelledby="exit-confirm-title">
          <div className="bg-[#121217] border border-white/10 rounded-3xl p-8 max-w-sm mx-4 shadow-2xl" data-nav-row={0}>
            <p id="exit-confirm-title" className="text-lg font-bold text-white mb-6 text-center">
              Tem certeza que deseja sair?
            </p>
            <p className="text-sm text-white/50 mb-6 text-center">
              Pressione Voltar novamente ou selecione uma opção
            </p>
            <div className="flex gap-4">
              <button
                data-nav-item
                data-nav-col={0}
                onClick={() => {
                  playSelectSound();
                  setShowExitConfirm(false);
                }}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); playSelectSound(); setShowExitConfirm(false); } }}
                tabIndex={0}
                className="flex-1 py-3 px-4 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold transition-colors focus:outline-none focus:ring-2 focus:ring-white"
              >
                Não
              </button>
              <button
                data-nav-item
                data-nav-col={1}
                onClick={() => {
                  playSelectSound();
                  setShowExitConfirm(false);
                  (window as any).__canExitApp = true;
                }}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); playSelectSound(); setShowExitConfirm(false); (window as any).__canExitApp = true; } }}
                tabIndex={0}
                className="flex-1 py-3 px-4 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold transition-colors focus:outline-none focus:ring-2 focus:ring-red-500"
              >
                Sim
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const LegacyApp: React.FC = () => (
  <SpatialNavProvider>
    <LegacyAppInner />
  </SpatialNavProvider>
);

const App: React.FC = () => {
  return (
    <ConfigProvider>
      <AuthProvider>
        <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <Routes>
            {/* Rotas Admin — protegidas por AdminRoute, lazy-loaded com Suspense */}
            <Route path="/admin" element={<AdminRoute><React.Suspense fallback={<LazyFallback />}><AdminDashboard /></React.Suspense></AdminRoute>} />
            <Route path="/admin/subscribers" element={<AdminRoute><React.Suspense fallback={<LazyFallback />}><AdminSubscribers /></React.Suspense></AdminRoute>} />
            <Route path="/admin/finance" element={<AdminRoute><React.Suspense fallback={<LazyFallback />}><AdminFinance /></React.Suspense></AdminRoute>} />
            <Route path="/admin/iptv" element={<AdminRoute><React.Suspense fallback={<LazyFallback />}><AdminIPTV /></React.Suspense></AdminRoute>} />
            <Route path="/admin/vod" element={<AdminRoute><React.Suspense fallback={<LazyFallback />}><AdminVOD /></React.Suspense></AdminRoute>} />
            <Route path="/admin/resellers" element={<AdminRoute><React.Suspense fallback={<LazyFallback />}><AdminResellers /></React.Suspense></AdminRoute>} />
            <Route path="/admin/security" element={<AdminRoute><React.Suspense fallback={<LazyFallback />}><AdminSecurity /></React.Suspense></AdminRoute>} />
            <Route path="/admin/settings" element={<AdminRoute><React.Suspense fallback={<LazyFallback />}><AdminSettings /></React.Suspense></AdminRoute>} />
            <Route path="/admin/catalog" element={<AdminRoute><React.Suspense fallback={<LazyFallback />}><AdminCatalogControl /></React.Suspense></AdminRoute>} />
            <Route path="/admin/ingestion" element={<AdminRoute><React.Suspense fallback={<LazyFallback />}><AdminIngestion /></React.Suspense></AdminRoute>} />
            <Route path="/admin/stream-test" element={<AdminRoute><React.Suspense fallback={<LazyFallback />}><StreamTester /></React.Suspense></AdminRoute>} />
            <Route path="/admin/p2p" element={<AdminRoute><React.Suspense fallback={<LazyFallback />}><AdminP2PSettings /></React.Suspense></AdminRoute>} />
            {/* Fallback to legacy app for all other routes */}
            <Route path="/*" element={<LegacyApp />} />
          </Routes>
        </Router>
      </AuthProvider>
    </ConfigProvider>
  );
};

export default App;
