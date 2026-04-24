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
  handlePatchMe,
} from './auth';
import { listSongs, getSong, createSong, patchSong } from './routes/songs';
import {
  getLibrary,
  addToLibrary,
  patchLibraryEntry,
  removeFromLibrary,
  createPrivateSong,
  importAllSongs,
} from './routes/library';
import {
  listPlaylists,
  createPlaylist,
  getPlaylist,
  patchPlaylist,
  deletePlaylist,
  setPlaylistSongs,
  addPlaylistSong,
  removePlaylistSong,
  patchPlaylistSong,
  lockPlaylist,
  listSubmissions,
  listPlaylistRequests,
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
import { sendNotificationEmail } from './email';

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
router.get('/auth/me',   withAuth, handleMe);
router.patch('/auth/me', withAuth, handlePatchMe);

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
router.post('/api/library/import-all', withAuth, importAllSongs);
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
router.post('/api/playlists/:id/songs',               withAuth, addPlaylistSong);
router.delete('/api/playlists/:id/songs/:songId',     withAuth, removePlaylistSong);
router.patch('/api/playlists/:id/songs/:songId',      withAuth, patchPlaylistSong);
router.patch('/api/playlists/:id/lock',               withAuth, lockPlaylist);
router.get('/api/playlists/:id/requests',             withAuth, listPlaylistRequests);
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

// ---------------------------------------------------------------------------
// Weekly cron — notify artist of new mailing list opt-ins
// Runs every Monday at 4pm UTC (wrangler.toml: "0 16 * * 1")
// ---------------------------------------------------------------------------

async function handleScheduled(env: Env): Promise<void> {
  const rows = await env.DB.prepare(
    `SELECT email, display_name, opted_in_at
     FROM users
     WHERE mailing_list_opt_in = 1
       AND opted_in_at > datetime('now', '-7 days')
     ORDER BY opted_in_at DESC`,
  ).all<{ email: string; display_name: string; opted_in_at: string }>();

  const newOptIns = rows.results ?? [];
  if (!newOptIns.length) return;

  const lines = newOptIns.map(
    (u) => `  ${u.display_name} <${u.email}> — ${u.opted_in_at}`,
  );

  const body = [
    `${newOptIns.length} new mailing list subscriber${newOptIns.length !== 1 ? 's' : ''} this week:`,
    '',
    ...lines,
    '',
    'Add these to your Substack list.',
  ].join('\n');

  await sendNotificationEmail(env, {
    to: env.ARTIST_EMAIL ?? '',
    subject: 'URGENT: ADD EMAILS TO SUBSTACK LIST',
    body,
  });
}

export default {
  fetch: (request: Request, env: Env, ctx: ExecutionContext) =>
    router.fetch(request, env, ctx),

  scheduled: (_event: ScheduledEvent, env: Env, ctx: ExecutionContext) => {
    ctx.waitUntil(handleScheduled(env));
  },
};
