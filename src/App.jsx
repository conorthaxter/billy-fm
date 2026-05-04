import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { SettingsProvider } from './contexts/SettingsContext';
import { PlayStateProvider, usePlayState } from './contexts/PlayStateContext';

import { getMe, logout as apiLogout, redirectToGoogle, patchMe } from './api/auth';

import LoginPage            from './pages/LoginPage';
import DashboardPage        from './pages/DashboardPage';
import MarketplacePage      from './pages/MarketplacePage';
import PlaylistsPage        from './pages/PlaylistsPage';
import PlaylistDetailPage   from './pages/PlaylistDetailPage';
import SongbookPage         from './pages/SongbookPage';
import ClientSetPage        from './pages/ClientSetPage';
import RequestQueuePage     from './pages/RequestQueuePage';
import RightPanel           from './components/RightPanel';
import SplashScreen         from './components/SplashScreen';
import MailingListPrompt    from './components/MailingListPrompt';

import './styles/global.css';

// ---------------------------------------------------------------------------
// Auth context — consumed via useAuth()
// ---------------------------------------------------------------------------

export const AuthContext = createContext(null);

function AuthProvider({ children }) {
  const [user,      setUser]      = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try { setUser(await getMe()); }
    catch { setUser(null); }
    finally { setIsLoading(false); }
  }, []);

  useEffect(() => { refresh(); }, []); // eslint-disable-line

  const login = useCallback(() => { redirectToGoogle(); }, []);

  const logout = useCallback(async () => {
    try { await apiLogout(); } catch { /* ignore */ }
    setUser(null);
  }, []);

  const updateUser = useCallback(async (fields) => {
    const updated = await patchMe(fields);
    setUser(updated);
    return updated;
  }, []);

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout, updateUser, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Auth complete — handles mobile Safari token handoff after OAuth redirect
// ---------------------------------------------------------------------------

function AuthComplete() {
  const { refresh } = useContext(AuthContext);
  const navigate = useNavigate();

  useEffect(() => {
    const s = new URLSearchParams(window.location.search).get('s');
    if (s) { try { localStorage.setItem('bfm_token', s); } catch { /* ignore */ } }
    refresh().then(() => navigate('/dashboard', { replace: true }));
  }, []); // eslint-disable-line

  return <div className="empty-state">Signing in…</div>;
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
// Mobile bottom panel — NP bar + queue sheet (hidden on desktop via CSS)
// ---------------------------------------------------------------------------

function MobileBottomPanel() {
  const { user } = useContext(AuthContext);
  const location = useLocation();
  const ctx = usePlayState();
  const [queueOpen, setQueueOpen] = useState(false);

  const hide = !user || ['/login', '/'].some(p => location.pathname === p) ||
    ['/r/', '/set/', '/songbook/', '/wedding/', '/request/'].some(p => location.pathname.startsWith(p));

  const { nowPlaying, queue, playSong, removeFromQueue, clearNP, dashExtras = {} } = ctx || {};
  const { onSelectSong = () => {} } = dashExtras;

  useEffect(() => {
    document.body.classList.toggle('mobile-np-active', !hide && !!nowPlaying);
    return () => document.body.classList.remove('mobile-np-active');
  }, [hide, nowPlaying]);

  useEffect(() => { if (!nowPlaying) setQueueOpen(false); }, [nowPlaying]);

  if (hide || !ctx) return null;

  return (
    <div className="mobile-bottom-root">
      {/* Queue sheet — slides up from above the NP bar */}
      <div className={`mobile-queue-sheet${queueOpen ? ' open' : ''}`}>
        <div className="mqs-handle-bar" onClick={() => setQueueOpen(false)} />
        <div className="mqs-header">
          <span className="mqs-title">Queue ({queue.length})</span>
          <button className="nb" onClick={() => setQueueOpen(false)}>✕</button>
        </div>
        <div className="mqs-list">
          {queue.map((s, i) => (
            <div key={s.song_id} className="mqs-item">
              <div className="mqs-item-info" onClick={() => { playSong(s); onSelectSong(s); setQueueOpen(false); }}>
                <div className="mqs-item-title">{s.title}</div>
                <div className="mqs-item-sub">{s.artist}{s.key ? ` · ${s.key}` : ''}</div>
              </div>
              <button className="mqs-remove" onClick={() => removeFromQueue(i)}>✕</button>
            </div>
          ))}
          {queue.length === 0 && <div className="mqs-empty">Queue is empty</div>}
        </div>
      </div>

      {/* NP bar */}
      {nowPlaying && (
        <div className="mobile-np-bar" onClick={() => setQueueOpen(o => !o)}>
          <div className="mnp-info">
            <div className="mnp-title">{nowPlaying.title}</div>
            <div className="mnp-meta">{nowPlaying.artist}{nowPlaying.key ? ` · ${nowPlaying.key}` : ''}</div>
          </div>
          <div className="mnp-actions" onClick={e => e.stopPropagation()}>
            {nowPlaying.chords_url && (
              <a className="mnp-chords" href={nowPlaying.chords_url} target="_blank" rel="noopener"
                onClick={e => e.stopPropagation()}>chords</a>
            )}
            <button className="mnp-queue-btn" onClick={e => { e.stopPropagation(); setQueueOpen(o => !o); }}>
              {queueOpen ? '↓' : '↑'}{queue.length > 0 ? ` ${queue.length}` : ''}
            </button>
            <button className="mnp-close" onClick={e => { e.stopPropagation(); clearNP(); }}>✕</button>
          </div>
        </div>
      )}
    </div>
  );
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
    location.pathname.startsWith('/set/') ||
    location.pathname.startsWith('/songbook/') ||
    location.pathname.startsWith('/wedding/') ||
    location.pathname.startsWith('/request/');

  if (hide || !ctx) return null;

  const {
    nowPlaying, queue, playHistory, session, dashExtras,
    playSong, clearNP, removeFromQueue, reorderQueue,
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
            <MailingListPrompt />
            <Routes>
              <Route path="/" element={<RootRedirect />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/auth-complete" element={<AuthComplete />} />
              <Route path="/dashboard" element={<RequireAuth><DashboardPage /></RequireAuth>} />
              <Route path="/marketplace" element={<RequireAuth><MarketplacePage /></RequireAuth>} />
              <Route path="/playlists" element={<RequireAuth><PlaylistsPage /></RequireAuth>} />
              <Route path="/playlists/:id" element={<RequireAuth><PlaylistDetailPage /></RequireAuth>} />
              <Route path="/songbook/:userId" element={<SongbookPage />} />
              <Route path="/set/:slug"     element={<ClientSetPage />} />
              <Route path="/request/:slug" element={<RequestQueuePage />} />
            </Routes>
            <GlobalRightPanel />
            <MobileBottomPanel />
          </PlayStateProvider>
        </AuthProvider>
      </SettingsProvider>
    </BrowserRouter>
  );
}
