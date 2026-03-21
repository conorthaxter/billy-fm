import { AutoRouter, error, json } from 'itty-router';
import {
  corsPreflight,
  corsify,
  withAuth,
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
} from './routes/playlists';
import { createSession, patchSession, listSessions } from './routes/sessions';
import { logPlay, getHistory } from './routes/history';
import { importCsv, spotifySearch, spotifyConfirm } from './routes/import';
import { listTransitions, createTransition, deleteTransition } from './routes/transitions';

// ---------------------------------------------------------------------------
// Env bindings (declared in wrangler.toml)
// ---------------------------------------------------------------------------

export interface Env {
  DB: D1Database;
  FRONTEND_ORIGIN: string;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  GOOGLE_REDIRECT_URI: string;
  SESSION_SECRET: string; // reserved for future signed-token use
  SPOTIFY_CLIENT_ID: string;
  SPOTIFY_CLIENT_SECRET: string;
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

router.get('/api/songs',     listSongs);
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
router.post('/api/playlists',                         withAuth, createPlaylist);
router.get('/api/playlists/:id',                      withAuth, getPlaylist);
router.patch('/api/playlists/:id',                    withAuth, patchPlaylist);
router.delete('/api/playlists/:id',                   withAuth, deletePlaylist);
router.put('/api/playlists/:id/songs',                withAuth, setPlaylistSongs);
router.patch('/api/playlists/:id/songs/:songId',      withAuth, patchPlaylistSong);

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
