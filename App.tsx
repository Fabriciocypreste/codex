
import React, { useState, useEffect } from 'react';
import { Page, UserProfile, Media } from './types';
import Login from './pages/Login';
import Profiles from './pages/Profiles';
import Home from './pages/Home';
import Movies from './pages/Movies';
import Series from './pages/Series';
import Kids from './pages/Kids';
import MyList from './pages/MyList';
import LiveTV from './pages/LiveTV';
import Details from './pages/Details';
import Player from './pages/Player';
import Settings from './pages/Settings';
import Search from './pages/Search';
import Navigation from './components/Navigation';

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
          <img src="/logored.png" alt="REDX" className="h-8 w-auto object-contain opacity-80" style={{ animation: 'pulse 2s ease-in-out infinite' }} />
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
import { playBackSound, initAudio } from './utils/soundEffects';
import { ConfigProvider } from './contexts/ConfigContext';

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
  const navigateRouter = useNavigate();
  const { savePosition, restorePosition } = useSpatialNav();

  useEffect(() => {
    const loadData = async () => {
      try {
        // 1. Buscar configurações do catálogo
        const catalogSettings = await getCatalogSettings();

        // 2. Preparar filtros — mínimo 2018 sempre
          // Filtro mínimo de ano alterado para 2022 (para testes)
          const filters = catalogSettings ? {
            minYear: 2022,
            maxYear: catalogSettings.max_year,
            genres: catalogSettings.selected_genres,
            contentType: catalogSettings.content_type
          } : { minYear: 2022 };

        // 3. Fetch Real Content com filtros aplicados
        const { movies: dbMovies, series: dbSeries } = await getCatalogWithFilters(filters);

        let dbMoviesTyped = (dbMovies || []).map(m => ({ ...m, type: 'movie' as const })) as Media[];
        let dbSeriesTyped = (dbSeries || []).map(s => ({ ...s, type: 'series' as const })) as Media[];

        // 4. Client-side Deduplication
        dbMoviesTyped = removeDuplicates(dbMoviesTyped);
        dbSeriesTyped = removeDuplicates(dbSeriesTyped);

        // 5. Sanitizar: remover temporadas soltas, itens inválidos
        const cleanMovies = sanitizeMediaList(dbMoviesTyped);
        const cleanSeries = sanitizeMediaList(dbSeriesTyped);

        // 6. Exibir dados do DB
        setMovies(cleanMovies);
        setSeries(cleanSeries);

        // 2. Enriquecer com TMDB (imagens oficiais) em background
        const catalog = await fetchTMDBCatalog(cleanMovies, cleanSeries);

        setTrendingMovies(catalog.trendingMovies);
        setTrendingSeries(catalog.trendingSeries);

        // Mesclar: enriched (com imagens TMDB) + restante do DB (com stream_url intacta)
        if (catalog.enrichedMovies.length > 0) {
          const enrichedIds = new Set(catalog.enrichedMovies.map(m => m.id));
          const remaining = cleanMovies.filter(m => !enrichedIds.has(m.id));
          // Re-deduplicate just in case
          setMovies(removeDuplicates([...catalog.enrichedMovies, ...remaining]));
        }
        if (catalog.enrichedSeries.length > 0) {
          const enrichedIds = new Set(catalog.enrichedSeries.map(s => s.id));
          const remaining = cleanSeries.filter(s => !enrichedIds.has(s.id));
          setSeries(removeDuplicates([...catalog.enrichedSeries, ...remaining]));
        }
        setMoviesByGenre(catalog.moviesByGenre);
        setSeriesByGenre(catalog.seriesByGenre);

        console.log(`✅ Catálogo: ${cleanMovies.length} filmes, ${cleanSeries.length} séries`);
      } catch (err) {
        console.error('❌ Erro ao carregar catálogo:', err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
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

  const handleLogin = () => {
    setCurrentPage(Page.PROFILES);
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
      case Page.SETTINGS:
      case Page.SEARCH:
      case Page.ADMIN:
        setCurrentPage(Page.HOME);
        break;
      case Page.HOME:
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

    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Backspace') {
        if (e.defaultPrevented) return; // Already handled by ActionModal or other
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA') return;
        e.preventDefault();
        handleTVBack();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [currentPage, activeProfile]);

  const renderPage = () => {
    if (loading && currentPage !== Page.LOGIN) {
      return (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'radial-gradient(ellipse at center, rgba(229,9,20,0.06) 0%, rgba(11,11,15,0.97) 60%, #0B0B0F 100%)' }}>
          <div className="flex flex-col items-center gap-5">
            <div className="relative">
              <svg className="w-20 h-20 animate-spin" style={{ animationDuration: '2.5s' }} viewBox="0 0 80 80">
                <circle cx="40" cy="40" r="36" fill="none" stroke="rgba(229,9,20,0.15)" strokeWidth="2" />
                <circle cx="40" cy="40" r="36" fill="none" stroke="#E50914" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="60 170" />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <img src="/logored.png" alt="REDX" className="h-8 w-auto object-contain opacity-80" style={{ animation: 'pulse 2s ease-in-out infinite' }} />
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
              restorePosition('player-return');
            }}
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

  const showNav = ![Page.LOGIN, Page.PROFILES, Page.PLAYER, Page.DETAILS, Page.ADMIN, Page.SETTINGS, Page.LIVE].includes(currentPage);

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
    <div className="relative min-h-screen w-full overflow-hidden flex flex-col items-center text-white">
      {/* Background Layer with Depth Blur */}
      <div
        className="fixed inset-0 transition-all duration-2000 ease-in-out -z-10 scale-105"
        style={{
          backgroundImage: bgImage ? `url(${bgImage})` : 'none',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          filter: currentPage === Page.PLAYER ? 'none' : 'blur(30px) brightness(0.35)',
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
        {renderPage()}
      </main>

      {/* Volumetric Light Effects */}
      <div className="fixed -bottom-24 left-1/2 -translate-x-1/2 w-200 h-100 bg-[#E50914]/10 blur-[120px] rounded-full pointer-events-none -z-5" />
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
