import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { SettingsProvider } from './contexts/SettingsContext';
import { PlayStateProvider, usePlayState } from './contexts/PlayStateContext';

import { getMe, logout as apiLogout, redirectToGoogle } from './api/auth';

import LoginPage            from './pages/LoginPage';
import DashboardPage        from './pages/DashboardPage';
import MarketplacePage      from './pages/MarketplacePage';
import PlaylistsPage        from './pages/PlaylistsPage';
import PlaylistDetailPage   from './pages/PlaylistDetailPage';
import PublicRepertoirePage from './pages/PublicRepertoirePage';
import WeddingBuilderPage   from './pages/WeddingBuilderPage';
import RequestQueuePage     from './pages/RequestQueuePage';
import RightPanel           from './components/RightPanel';
import SplashScreen         from './components/SplashScreen';

import './styles/global.css';

// ---------------------------------------------------------------------------
// Auth context — consumed via useAuth()
// ---------------------------------------------------------------------------

export const AuthContext = createContext(null);

function AuthProvider({ children }) {
  const [user,      setUser]      = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    getMe()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setIsLoading(false));
  }, []);

  const login = useCallback(() => { redirectToGoogle(); }, []);

  const logout = useCallback(async () => {
    try { await apiLogout(); } catch { /* ignore */ }
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Route guard
// ---------------------------------------------------------------------------

function RequireAuth({ children }) {
  const { user, isLoading } = useContext(AuthContext);
  const location = useLocation();
  if (isLoading) return <div className="empty-state">Loading…</div>;
  if (!user)     return <Navigate to="/login" state={{ from: location }} replace />;
  return children;
}

function RootRedirect() {
  const { user, isLoading } = useContext(AuthContext);
  if (isLoading) return <div className="empty-state">Loading…</div>;
  return <Navigate to={user ? '/dashboard' : '/login'} replace />;
}

// ---------------------------------------------------------------------------
// Global Right Panel — shown on all authenticated pages
// ---------------------------------------------------------------------------

function GlobalRightPanel() {
  const { user } = useContext(AuthContext);
  const location = useLocation();
  const ctx = usePlayState();

  // Hide on public / unauthenticated pages
  const hide = !user || ['/login', '/'].some(p => location.pathname === p) ||
    location.pathname.startsWith('/r/') ||
    location.pathname.startsWith('/wedding/') ||
    location.pathname.startsWith('/request/');

  if (hide || !ctx) return null;

  const {
    nowPlaying, queue, playHistory, session, dashExtras,
    playSong, clearNP, addToQueue, removeFromQueue, reorderQueue,
    dropSongIntoQueue, clearQueue, clearHistory, removeFromHistory,
    reorderHistory, startNewSession, handleDropToNP, handleDropToPP, handleDragFromNP,
  } = ctx;

  const {
    songs = [],
    suggestions = [],
    ppCollapsed = false,
    onTogglePP = () => {},
    onSelectSong = () => {},
    onClearNPData = () => {},
    onNewSession,
    onSaveSession,
    onClearSession,
    onDismissSuggestion = () => {},
    onAddSuggestionToQueue = () => {},
    onOpenDialog,
  } = dashExtras;

  function handleClearHistory() {
    if (onOpenDialog) {
      onOpenDialog('Clear play history?', 'This removes all previously played data.', () => {
        clearHistory();
      });
    } else {
      clearHistory();
    }
  }

  function handleClearQueue() {
    if (!queue.length) return;
    if (onOpenDialog) {
      onOpenDialog('Clear queue?', '', () => clearQueue());
    } else {
      clearQueue();
    }
  }

  return (
    <RightPanel
      songs={songs}
      nowPlaying={nowPlaying}
      playHistory={playHistory}
      session={session}
      queue={queue}
      suggestions={suggestions}
      ppCollapsed={ppCollapsed}
      onTogglePP={onTogglePP}
      onClearHistory={handleClearHistory}
      onRemoveHistory={removeFromHistory}
      onSelectSong={onSelectSong}
      onPlaySong={song => { playSong(song); onSelectSong?.(song); }}
      onClearNP={clearNP}
      onClearNPData={onClearNPData}
      onNewSession={onNewSession ?? startNewSession}
      onSaveSession={onSaveSession}
      onClearSession={onClearSession ?? (() => { clearNP(); clearQueue(); })}
      onRemoveFromQueue={removeFromQueue}
      onClearQueue={handleClearQueue}
      onReorderQueue={reorderQueue}
      onDropSong={(song, idx) => dropSongIntoQueue(song, idx)}
      onAddSuggestionToQueue={onAddSuggestionToQueue}
      onDismissSuggestion={onDismissSuggestion}
      onDropToNP={handleDropToNP}
      onDropToPP={handleDropToPP}
      onDragFromNP={handleDragFromNP}
      onReorderHistory={reorderHistory}
      onSelectNP={onSelectSong}
    />
  );
}

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------

export default function App() {
  const [showSplash, setShowSplash] = useState(() => {
    if (sessionStorage.getItem('bfm_splash_shown')) return false;
    sessionStorage.setItem('bfm_splash_shown', '1');
    return true;
  });

  return (
    <BrowserRouter basename="/app">
      <SettingsProvider>
        <AuthProvider>
          <PlayStateProvider>
            {showSplash && <SplashScreen onDone={() => setShowSplash(false)} />}
            <Routes>
              <Route path="/" element={<RootRedirect />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/dashboard" element={<RequireAuth><DashboardPage /></RequireAuth>} />
              <Route path="/marketplace" element={<RequireAuth><MarketplacePage /></RequireAuth>} />
              <Route path="/playlists" element={<RequireAuth><PlaylistsPage /></RequireAuth>} />
              <Route path="/playlists/:id" element={<RequireAuth><PlaylistDetailPage /></RequireAuth>} />
              <Route path="/r/:slug"       element={<PublicRepertoirePage />} />
              <Route path="/wedding/:slug" element={<WeddingBuilderPage />} />
              <Route path="/request/:slug" element={<RequestQueuePage />} />
            </Routes>
            <GlobalRightPanel />
          </PlayStateProvider>
        </AuthProvider>
      </SettingsProvider>
    </BrowserRouter>
  );
}
