import { error, json } from 'itty-router';
import type { IRequest } from 'itty-router';
import type { Env } from '../index';
import { parseCookies } from '../middleware';
import { sendNotificationEmail } from '../email';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SetRequest = IRequest & { clientSet?: Record<string, unknown> };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function clientCookieName(slug: string): string {
  return `bfm_cs_${slug}`;
}

async function deriveToken(slug: string, password: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(`client-set:${slug}:${password}`),
  );
  return btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

async function fetchSetBySlug(env: Env, slug: string): Promise<Record<string, unknown> | null> {
  // Try share_slug first, fall back to id (for playlists created before share_slug was backfilled)
  const bySlug = await env.DB.prepare(
    `SELECT * FROM playlists WHERE share_slug = ? AND playlist_type = 'client_set'`,
  )
    .bind(slug)
    .first<Record<string, unknown>>();
  if (bySlug) return bySlug;

  return env.DB.prepare(
    `SELECT * FROM playlists WHERE id = ?`,
  )
    .bind(slug)
    .first<Record<string, unknown>>();
}

function isLocked(set: Record<string, unknown>): boolean {
  return !!(set.is_locked);
}

function parseJsonField(value: string | null | undefined): string[] {
  if (!value) return [];
  try { return JSON.parse(value as string); } catch { return []; }
}

// ---------------------------------------------------------------------------
// withClientSetAuth middleware
// Validates the per-slug session cookie. Attaches set to request.clientSet.
// ---------------------------------------------------------------------------

export async function withClientSetAuth(
  request: SetRequest,
  env: Env,
): Promise<Response | undefined> {
  const { slug } = request.params as { slug: string };
  const set = await fetchSetBySlug(env, slug);
  if (!set) return error(404, { error: 'Set not found' });

  if (set.password) {
    const cookies = parseCookies(request.headers.get('Cookie'));
    const token = cookies[clientCookieName(slug)];
    if (!token) return error(401, { error: 'Client session required' });

    const expected = await deriveToken(slug, set.password as string, env.SESSION_SECRET);
    if (token !== expected) return error(401, { error: 'Invalid or expired session' });
  }

  request.clientSet = set;
}

// ---------------------------------------------------------------------------
// POST /api/sets/:slug/verify — password check, issues session cookie
// ---------------------------------------------------------------------------

export async function verifyClientSet(request: IRequest, env: Env): Promise<Response> {
  const { slug } = request.params as { slug: string };
  const set = await fetchSetBySlug(env, slug);
  if (!set) return error(404, { error: 'Set not found' });

  const body = await request.json<{ password?: string }>().catch(() => ({}));

  if (set.password) {
    if (!body.password) return error(400, { error: 'password required' });
    if (body.password !== set.password) return error(401, { error: 'Incorrect password' });
  }

  const token = await deriveToken(
    slug,
    (set.password as string) ?? '',
    env.SESSION_SECRET,
  );

  // SameSite=None; Secure so cookie works inside cross-origin iframes (conor.bio)
  const cookie = [
    `${clientCookieName(slug)}=${token}`,
    'HttpOnly',
    'Secure',
    'SameSite=None',
    'Path=/',
    'Max-Age=604800', // 7 days
  ].join('; ');

  return new Response(JSON.stringify({ ok: true, has_password: !!set.password }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': cookie,
    },
  });
}

// ---------------------------------------------------------------------------
// GET /api/sets/:slug — get set + songs + off-list requests
// ---------------------------------------------------------------------------

export async function getClientSet(request: SetRequest, env: Env): Promise<Response> {
  const set = request.clientSet!;
  const id = set.id as string;

  // Songs: return title, artist, tags only — no key/BPM/chords/notes
  const songsResult = await env.DB.prepare(
    `SELECT ps.song_id, ps.position, ps.notes AS playlist_notes, ps.is_played,
            COALESCE(s.title, '') AS title,
            COALESCE(s.artist, '') AS artist,
            s.tags
     FROM playlist_songs ps
     JOIN songs s ON s.id = ps.song_id
     WHERE ps.playlist_id = ?
     ORDER BY ps.position ASC`,
  )
    .bind(id)
    .all<Record<string, unknown>>();

  const songs = (songsResult.results ?? []).map((row) => ({
    song_id: row.song_id,
    position: row.position,
    notes: row.playlist_notes,
    is_played: !!row.is_played,
    title: row.title,
    artist: row.artist,
    tags: parseJsonField(row.tags as string | null),
  }));

  const requestsResult = await env.DB.prepare(
    `SELECT id, request_text, requester_note, created_at
     FROM off_list_requests
     WHERE playlist_id = ?
     ORDER BY created_at ASC`,
  )
    .bind(id)
    .all<Record<string, unknown>>();

  // Fetch artist name for the client-facing header
  const artistRow = await env.DB.prepare(
    `SELECT id, display_name FROM users WHERE id = ?`,
  )
    .bind(set.user_id as string)
    .first<{ id: string; display_name: string }>();

  return json({
    id,
    title: set.title,
    playlist_type: set.playlist_type,
    color_scheme: set.color_scheme ?? 'standard',
    is_locked: !!set.is_locked,
    locked_at: set.locked_at ?? null,
    off_list_requests_limit: (set.off_list_requests as number) ?? 0,
    event_date: set.event_date ?? null,
    client_name: set.client_name ?? null,
    artist_id: artistRow?.id ?? null,
    artist_name: artistRow?.display_name ?? null,
    songs,
    off_list_requests: requestsResult.results ?? [],
  });
}

// ---------------------------------------------------------------------------
// POST /api/sets/:slug/songs — add a song to the set
// ---------------------------------------------------------------------------

export async function addClientSetSong(request: SetRequest, env: Env): Promise<Response> {
  const set = request.clientSet!;
  if (isLocked(set)) return error(403, { error: 'Set is locked' });

  const body = await request.json<{ song_id?: string; position?: number; notes?: string }>();
  if (!body.song_id) return error(400, { error: 'song_id required' });

  const song = await env.DB.prepare(
    `SELECT id, title, artist, tags FROM songs WHERE id = ?`,
  )
    .bind(body.song_id)
    .first<{ id: string; title: string; artist: string; tags: string | null }>();
  if (!song) return error(404, { error: 'Song not found' });

  const existing = await env.DB.prepare(
    `SELECT 1 FROM playlist_songs WHERE playlist_id = ? AND song_id = ?`,
  )
    .bind(set.id, body.song_id)
    .first();
  if (existing) return error(409, { error: 'Song already in set' });

  let position = body.position ?? null;
  if (position === null) {
    const maxRow = await env.DB.prepare(
      `SELECT MAX(position) AS max_pos FROM playlist_songs WHERE playlist_id = ?`,
    )
      .bind(set.id)
      .first<{ max_pos: number | null }>();
    position = (maxRow?.max_pos ?? -1) + 1;
  }

  await env.DB.prepare(
    `INSERT INTO playlist_songs (playlist_id, song_id, position, notes) VALUES (?, ?, ?, ?)`,
  )
    .bind(set.id, body.song_id, position, body.notes ?? null)
    .run();

  await env.DB.prepare(
    `UPDATE playlists SET updated_at = datetime('now') WHERE id = ?`,
  )
    .bind(set.id)
    .run();

  return json({
    song_id: body.song_id,
    position,
    title: song.title,
    artist: song.artist,
    tags: parseJsonField(song.tags),
  }, { status: 201 });
}

// ---------------------------------------------------------------------------
// DELETE /api/sets/:slug/songs/:songId
// ---------------------------------------------------------------------------

export async function removeClientSetSong(request: SetRequest, env: Env): Promise<Response> {
  const set = request.clientSet!;
  if (isLocked(set)) return error(403, { error: 'Set is locked' });

  const { songId } = request.params as { songId: string };

  const existing = await env.DB.prepare(
    `SELECT 1 FROM playlist_songs WHERE playlist_id = ? AND song_id = ?`,
  )
    .bind(set.id, songId)
    .first();
  if (!existing) return error(404, { error: 'Song not in set' });

  await env.DB.prepare(
    `DELETE FROM playlist_songs WHERE playlist_id = ? AND song_id = ?`,
  )
    .bind(set.id, songId)
    .run();

  await env.DB.prepare(
    `UPDATE playlists SET updated_at = datetime('now') WHERE id = ?`,
  )
    .bind(set.id)
    .run();

  return json({ ok: true });
}

// ---------------------------------------------------------------------------
// PUT /api/sets/:slug/order — full replace of ordered song list
// ---------------------------------------------------------------------------

export async function reorderClientSet(request: SetRequest, env: Env): Promise<Response> {
  const set = request.clientSet!;
  if (isLocked(set)) return error(403, { error: 'Set is locked' });

  const body = await request.json<{
    songs?: { song_id: string; position: number; notes?: string }[];
  }>();
  const songs = body.songs ?? [];

  const positions = songs.map((s) => s.position);
  if (new Set(positions).size !== positions.length) {
    return error(400, { error: 'Duplicate positions' });
  }

  await env.DB.prepare(
    `DELETE FROM playlist_songs WHERE playlist_id = ?`,
  )
    .bind(set.id)
    .run();

  for (const song of songs) {
    await env.DB.prepare(
      `INSERT INTO playlist_songs (playlist_id, song_id, position, notes) VALUES (?, ?, ?, ?)`,
    )
      .bind(set.id, song.song_id, song.position, song.notes ?? null)
      .run();
  }

  await env.DB.prepare(
    `UPDATE playlists SET updated_at = datetime('now') WHERE id = ?`,
  )
    .bind(set.id)
    .run();

  return json({ ok: true, count: songs.length });
}

// ---------------------------------------------------------------------------
// PATCH /api/sets/:slug/songs/:songId — update note / is_played per song
// ---------------------------------------------------------------------------

export async function patchClientSetSong(request: SetRequest, env: Env): Promise<Response> {
  const set = request.clientSet!;
  if (isLocked(set)) return error(403, { error: 'Set is locked' });

  const { songId } = request.params as { songId: string };

  const existing = await env.DB.prepare(
    `SELECT 1 FROM playlist_songs WHERE playlist_id = ? AND song_id = ?`,
  )
    .bind(set.id, songId)
    .first();
  if (!existing) return error(404, { error: 'Song not in set' });

  const body = await request.json<{ notes?: string; is_played?: boolean }>();
  const sets: string[] = [];
  const values: unknown[] = [];

  if (body.notes     !== undefined) { sets.push('notes = ?');     values.push(body.notes); }
  if (body.is_played !== undefined) { sets.push('is_played = ?'); values.push(body.is_played ? 1 : 0); }

  if (sets.length === 0) return error(400, { error: 'No fields to update' });

  values.push(set.id, songId);
  await env.DB.prepare(
    `UPDATE playlist_songs SET ${sets.join(', ')} WHERE playlist_id = ? AND song_id = ?`,
  )
    .bind(...values)
    .run();

  const updated = await env.DB.prepare(
    `SELECT song_id, position, notes, is_played FROM playlist_songs WHERE playlist_id = ? AND song_id = ?`,
  )
    .bind(set.id, songId)
    .first<Record<string, unknown>>();

  return json(updated!);
}

// ---------------------------------------------------------------------------
// POST /api/sets/:slug/requests — off-list request (checks count limit)
// ---------------------------------------------------------------------------

export async function submitOffListRequest(request: SetRequest, env: Env): Promise<Response> {
  const set = request.clientSet!;
  if (isLocked(set)) return error(403, { error: 'Set is locked' });

  const limit = (set.off_list_requests as number) ?? 0;
  if (limit > 0) {
    const countRow = await env.DB.prepare(
      `SELECT COUNT(*) AS cnt FROM off_list_requests WHERE playlist_id = ?`,
    )
      .bind(set.id)
      .first<{ cnt: number }>();
    if ((countRow?.cnt ?? 0) >= limit) {
      return error(403, { error: `Off-list request limit (${limit}) reached` });
    }
  }

  const body = await request.json<{ request_text?: string; requester_note?: string }>();
  if (!body.request_text?.trim()) return error(400, { error: 'request_text required' });

  const id = crypto.randomUUID();
  await env.DB.prepare(
    `INSERT INTO off_list_requests (id, playlist_id, request_text, requester_note)
     VALUES (?, ?, ?, ?)`,
  )
    .bind(id, set.id, body.request_text.trim(), body.requester_note ?? '')
    .run();

  return json({ id, request_text: body.request_text.trim(), ok: true }, { status: 201 });
}

// ---------------------------------------------------------------------------
// POST /api/sets/:slug/submit — lock set, save snapshot, notify artist
// ---------------------------------------------------------------------------

export async function submitClientSet(request: SetRequest, env: Env): Promise<Response> {
  const set = request.clientSet!;
  if (isLocked(set)) return error(409, { error: 'Set already submitted' });

  const songsResult = await env.DB.prepare(
    `SELECT ps.song_id, ps.position, ps.notes AS playlist_notes, s.title, s.artist, s.tags
     FROM playlist_songs ps
     JOIN songs s ON s.id = ps.song_id
     WHERE ps.playlist_id = ?
     ORDER BY ps.position ASC`,
  )
    .bind(set.id)
    .all<Record<string, unknown>>();

  const offListResult = await env.DB.prepare(
    `SELECT id, request_text, requester_note, created_at
     FROM off_list_requests WHERE playlist_id = ?`,
  )
    .bind(set.id)
    .all<Record<string, unknown>>();

  const snapshot = {
    playlist_id: set.id,
    title: set.title,
    client_name: set.client_name ?? null,
    event_date: set.event_date ?? null,
    submitted_at: new Date().toISOString(),
    songs: (songsResult.results ?? []).map((r) => ({
      song_id: r.song_id,
      position: r.position,
      notes: r.playlist_notes ?? null,
      title: r.title,
      artist: r.artist,
      tags: parseJsonField(r.tags as string | null),
    })),
    off_list_requests: offListResult.results ?? [],
  };

  const submissionId = crypto.randomUUID();
  await env.DB.prepare(
    `INSERT INTO set_submissions (id, playlist_id, snapshot_json) VALUES (?, ?, ?)`,
  )
    .bind(submissionId, set.id, JSON.stringify(snapshot))
    .run();

  await env.DB.prepare(
    `UPDATE playlists SET is_locked = 1, locked_at = datetime('now'), updated_at = datetime('now')
     WHERE id = ?`,
  )
    .bind(set.id)
    .run();

  // Notify artist
  const artistRow = await env.DB.prepare(
    `SELECT user_id FROM playlists WHERE id = ?`,
  )
    .bind(set.id)
    .first<{ user_id: string }>();

  if (artistRow?.user_id) {
    const notifId = crypto.randomUUID();
    const notifTitle = `Set submitted: ${set.title as string}`;
    const notifBody = `${(set.client_name as string) ?? 'Your client'} has submitted their song selections.`;

    await env.DB.prepare(
      `INSERT INTO notifications (id, user_id, type, title, body, metadata)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        notifId,
        artistRow.user_id,
        'client_set_submitted',
        notifTitle,
        notifBody,
        JSON.stringify({ playlist_id: set.id, submission_id: submissionId }),
      )
      .run();

    // Email the artist — non-blocking, failure won't affect response
    const songList = snapshot.songs
      .map((s: { position: number; title: unknown; artist: unknown }) =>
        `  ${s.position + 1}. ${s.title} — ${s.artist}`)
      .join('\n');

    const emailBody = [
      notifBody,
      '',
      `Set: ${set.title as string}`,
      set.event_date ? `Event date: ${set.event_date as string}` : '',
      set.client_name ? `Client: ${set.client_name as string}` : '',
      '',
      `Songs (${snapshot.songs.length}):`,
      songList,
    ]
      .filter((line) => line !== undefined)
      .join('\n');

    if (env.ARTIST_EMAIL) {
      await sendNotificationEmail(env, {
        to: env.ARTIST_EMAIL,
        subject: `billy-fm: ${notifTitle}`,
        body: emailBody,
      }).catch((err) => console.error('[submit] email failed:', err));
    }
  }

  return json({ ok: true, submission_id: submissionId });
}

// ---------------------------------------------------------------------------
// GET /api/sets/:slug/snapshot/:submissionId
// ---------------------------------------------------------------------------

export async function getSnapshot(request: SetRequest, env: Env): Promise<Response> {
  const { submissionId } = request.params as { submissionId: string };
  const set = request.clientSet!;

  const row = await env.DB.prepare(
    `SELECT id, snapshot_json, submitted_at
     FROM set_submissions WHERE id = ? AND playlist_id = ?`,
  )
    .bind(submissionId, set.id)
    .first<{ id: string; snapshot_json: string; submitted_at: string }>();

  if (!row) return error(404, { error: 'Submission not found' });

  let snapshot: unknown;
  try { snapshot = JSON.parse(row.snapshot_json); } catch { snapshot = {}; }

  return json({
    submission_id: row.id,
    submitted_at: row.submitted_at,
    snapshot,
  });
}
