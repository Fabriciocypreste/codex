
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
import Navigation from './components/Navigation';

// Admin Pages
import AdminDashboard from './pages/admin/Dashboard';
import AdminSubscribers from './pages/admin/Subscribers';
import AdminFinance from './pages/admin/Finance';
import AdminIPTV from './pages/admin/IPTV';
import AdminVOD from './pages/admin/VOD';
import AdminResellers from './pages/admin/Resellers';
import AdminSecurity from './pages/admin/Security';
import AdminSettings from './pages/admin/Settings';
import AdminCatalogControl from './pages/admin/CatalogControl';
import AdminIngestion from './pages/admin/Ingestion';
import StreamTester from './pages/admin/StreamTester';

import { getAllMovies, getAllSeries } from './services/supabaseService';
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
        // 1. Fetch Real Content (Movies & Series)
        const [dbMovies, dbSeries] = await Promise.all([
          getAllMovies(),
          getAllSeries()
        ]);

        let dbMoviesTyped = (dbMovies || []).map(m => ({ ...m, type: 'movie' as const })) as Media[];
        let dbSeriesTyped = (dbSeries || []).map(s => ({ ...s, type: 'series' as const })) as Media[];

        // 2. Client-side Deduplication
        dbMoviesTyped = removeDuplicates(dbMoviesTyped);
        dbSeriesTyped = removeDuplicates(dbSeriesTyped);

        // 3. Filtro de ano desativado temporariamente para restaurar visibilidade
        // dbMoviesTyped = dbMoviesTyped.filter(m => (m.year || 0) >= 2018);

        // Sanitizar: remover temporadas soltas, itens inválidos
        const cleanMovies = sanitizeMediaList(dbMoviesTyped);
        const cleanSeries = sanitizeMediaList(dbSeriesTyped);

        // Exibir dados do DB imediatamente
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
        <div className="flex flex-col items-center justify-center h-full gap-4">
          <div className="w-16 h-16 border-4 border-[#E50914] border-t-transparent rounded-full animate-spin" />
          <p className="text-white/40 font-medium tracking-widest uppercase">Carregando...</p>
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
        return <Kids movies={movies} onSelectMedia={(m) => navigate(Page.DETAILS, m)} onPlayMedia={handlePlayMedia} />;
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
        <header className="fixed top-0 left-0 right-0 z-50 flex items-center pointer-events-none bg-gradient-to-b from-black/80 to-transparent pt-4 pb-12 px-12">
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
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/admin/subscribers" element={<AdminSubscribers />} />
            <Route path="/admin/finance" element={<AdminFinance />} />
            <Route path="/admin/iptv" element={<AdminIPTV />} />
            <Route path="/admin/vod" element={<AdminVOD />} />
            <Route path="/admin/resellers" element={<AdminResellers />} />
            <Route path="/admin/security" element={<AdminSecurity />} />
            <Route path="/admin/settings" element={<AdminSettings />} />
            <Route path="/admin/catalog" element={<AdminCatalogControl />} />
            <Route path="/admin/ingestion" element={<AdminIngestion />} />
            <Route path="/admin/stream-test" element={<StreamTester />} />
            {/* Fallback to legacy app for all other routes */}
            <Route path="/*" element={<LegacyApp />} />
          </Routes>
        </Router>
      </AuthProvider>
    </ConfigProvider>
  );
};

export default App;
