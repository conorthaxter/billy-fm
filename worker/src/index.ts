import { AutoRouter, error, json } from 'itty-router';
import {
  corsPreflight,
  corsify,
  withAuth,
  withAuthOrService,
  type AuthRequest,
} from './middleware';
import {
  handleGoogleRedirect,
  handleGoogleCallback,
  handleLogout,
  handleMe,
} from './auth';
import { listSongs, getSong, createSong, patchSong } from './routes/songs';
import {
  getLibrary,
  addToLibrary,
  patchLibraryEntry,
  removeFromLibrary,
  createPrivateSong,
} from './routes/library';
import {
  listPlaylists,
  createPlaylist,
  getPlaylist,
  patchPlaylist,
  deletePlaylist,
  setPlaylistSongs,
  patchPlaylistSong,
  lockPlaylist,
  listSubmissions,
} from './routes/playlists';
import {
  verifyClientSet,
  withClientSetAuth,
  getClientSet,
  addClientSetSong,
  removeClientSetSong,
  reorderClientSet,
  patchClientSetSong,
  submitOffListRequest,
  submitClientSet,
  getSnapshot,
} from './routes/sets';
import { createSession, patchSession, listSessions } from './routes/sessions';
import { logPlay, getHistory } from './routes/history';
import { importCsv, spotifySearch, spotifyConfirm } from './routes/import';
import { listTransitions, createTransition, deleteTransition } from './routes/transitions';
import { getSongbook } from './routes/songbook';
import { getRepertoire } from './routes/repertoire';
import { listNotifications, markNotificationRead, markAllNotificationsRead } from './routes/notifications';

// ---------------------------------------------------------------------------
// Env bindings (declared in wrangler.toml)
// ---------------------------------------------------------------------------

export interface Env {
  DB: D1Database;
  FRONTEND_ORIGIN: string;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  GOOGLE_REDIRECT_URI: string;
  SESSION_SECRET: string;
  BILLY_FM_SERVICE_KEY: string;
  SPOTIFY_CLIENT_ID: string;
  SPOTIFY_CLIENT_SECRET: string;
  ENABLE_CLIENT_SETS?: string; // set to "true" to activate /api/sets/* routes
  RESEND_API_KEY?: string;
  ARTIST_EMAIL?: string;
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

const router = AutoRouter<AuthRequest, [Env, ExecutionContext]>({
  // corsPreflight short-circuits OPTIONS; corsify appends headers to responses
  before: [corsPreflight],
  finally: [corsify],
  catch: (err) => {
    console.error(err);
    const status = (err as { status?: number }).status ?? 500;
    const message = (err as Error).message ?? 'Internal Server Error';
    return error(status, { error: message });
  },
});

// ---------------------------------------------------------------------------
// Health check
// ---------------------------------------------------------------------------

router.get('/api/health', () => json({ ok: true }));

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

router.get('/auth/google', handleGoogleRedirect);
router.get('/auth/google/callback', handleGoogleCallback);
router.post('/auth/logout', handleLogout);
router.get('/auth/me', withAuth, handleMe);

// ---------------------------------------------------------------------------
// Songs (global marketplace)
// ---------------------------------------------------------------------------

router.get('/api/songs',     withAuthOrService, listSongs);
router.get('/api/songs/:id', getSong);
router.post('/api/songs',        withAuth, createSong);
router.patch('/api/songs/:id',   withAuth, patchSong);

// ---------------------------------------------------------------------------
// User Library
// ---------------------------------------------------------------------------

router.get('/api/library',              withAuth, getLibrary);
router.post('/api/library/private',    withAuth, createPrivateSong);
router.post('/api/library/:songId',    withAuth, addToLibrary);
router.patch('/api/library/:songId',   withAuth, patchLibraryEntry);
router.delete('/api/library/:songId',  withAuth, removeFromLibrary);

// ---------------------------------------------------------------------------
// Playlists
// ---------------------------------------------------------------------------

router.get('/api/playlists',                          withAuth, listPlaylists);
router.post('/api/playlists',                         withAuthOrService, createPlaylist);
router.get('/api/playlists/:id',                      withAuth, getPlaylist);
router.patch('/api/playlists/:id',                    withAuthOrService, patchPlaylist);
router.delete('/api/playlists/:id',                   withAuth, deletePlaylist);
router.put('/api/playlists/:id/songs',                withAuth, setPlaylistSongs);
router.patch('/api/playlists/:id/songs/:songId',      withAuth, patchPlaylistSong);
router.patch('/api/playlists/:id/lock',               withAuth, lockPlaylist);
router.get('/api/playlists/:id/submissions',          withAuth, listSubmissions);

// ---------------------------------------------------------------------------
// Client Sets (public-facing, password-protected)
// Gated behind ENABLE_CLIENT_SETS env var — returns 404 when disabled
// ---------------------------------------------------------------------------

const clientSetsEnabled = (_req: AuthRequest, env: Env): Response | undefined => {
  if (env.ENABLE_CLIENT_SETS !== 'true') return error(404, { error: 'Not found' }) as Response;
};

router.post('/api/sets/:slug/verify',                 clientSetsEnabled, verifyClientSet);
router.get('/api/sets/:slug',                         clientSetsEnabled, withClientSetAuth, getClientSet);
router.post('/api/sets/:slug/songs',                  clientSetsEnabled, withClientSetAuth, addClientSetSong);
router.delete('/api/sets/:slug/songs/:songId',        clientSetsEnabled, withClientSetAuth, removeClientSetSong);
router.put('/api/sets/:slug/order',                   clientSetsEnabled, withClientSetAuth, reorderClientSet);
router.patch('/api/sets/:slug/songs/:songId',         clientSetsEnabled, withClientSetAuth, patchClientSetSong);
router.post('/api/sets/:slug/requests',               clientSetsEnabled, withClientSetAuth, submitOffListRequest);
router.post('/api/sets/:slug/submit',                 clientSetsEnabled, withClientSetAuth, submitClientSet);
router.get('/api/sets/:slug/snapshot/:submissionId',  clientSetsEnabled, withClientSetAuth, getSnapshot);

// ---------------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------------

router.post('/api/sessions',    withAuth, createSession);
router.patch('/api/sessions/:id', withAuth, patchSession);
router.get('/api/sessions',     withAuth, listSessions);

// ---------------------------------------------------------------------------
// Play History
// ---------------------------------------------------------------------------

router.post('/api/history', withAuth, logPlay);
router.get('/api/history',  withAuth, getHistory);

// ---------------------------------------------------------------------------
// Import
// ---------------------------------------------------------------------------

router.post('/api/import/csv',              withAuth, importCsv);
router.get('/api/import/spotify/search',   withAuth, spotifySearch);
router.post('/api/import/spotify/confirm', withAuth, spotifyConfirm);

// ---------------------------------------------------------------------------
// Song Transitions
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

router.get('/api/notifications',           withAuth, listNotifications);
router.patch('/api/notifications/read-all', withAuth, markAllNotificationsRead);
router.patch('/api/notifications/:id',      withAuth, markNotificationRead);

// ---------------------------------------------------------------------------
// Public Songbook & Repertoire (no auth — public-safe fields only)
// ---------------------------------------------------------------------------

router.get('/api/songbook/:userId',    getSongbook);
router.get('/api/repertoire/:userId',  getRepertoire);

// ---------------------------------------------------------------------------
// Song Transitions
// ---------------------------------------------------------------------------

router.get('/api/library/:songId/transitions',  withAuth, listTransitions);
router.post('/api/library/:songId/transitions', withAuth, createTransition);
router.delete('/api/transitions/:id',           withAuth, deleteTransition);

// ---------------------------------------------------------------------------
// 404 catch-all
// ---------------------------------------------------------------------------

router.all('*', () => error(404, { error: 'Not found' }));

// ---------------------------------------------------------------------------
// Worker export
// ---------------------------------------------------------------------------

export default {
  fetch: (request: Request, env: Env, ctx: ExecutionContext) =>
    router.fetch(request, env, ctx),
};
