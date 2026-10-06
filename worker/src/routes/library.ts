import { error, json } from 'itty-router';
import type { Env } from '../index';
import type { AuthRequest } from '../middleware';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseJsonField(value: string | null): string[] {
  if (!value) return [];
  try {
    return JSON.parse(value);
  } catch {
    return [];
  }
}

function shapeLibraryRow(row: Record<string, unknown>) {
  return {
    ...row,
    genre: parseJsonField(row.genre as string | null),
    tags:  parseJsonField(row.tags  as string | null),
  };
}

// Fold any semitone count into -5..6 so stored offsets stay small.
function normalizeOffset(n: number): number {
  const m = ((n % 12) + 12) % 12;
  return m > 6 ? m - 12 : m;
}

function isOwner(request: AuthRequest, env: Env): boolean {
  const email = request.user?.email?.toLowerCase();
  return !!email && !!env.ARTIST_EMAIL && email === env.ARTIST_EMAIL.toLowerCase();
}

// ---------------------------------------------------------------------------
// GET /api/library
// ---------------------------------------------------------------------------

export async function getLibrary(request: AuthRequest, env: Env): Promise<Response> {
  const userId = request.user!.id;
  const rows = await env.DB.prepare(
    `SELECT ul.song_id, ul.title, ul.artist, ul.key, ul.bpm, ul.transpose_offset, ul.genre, ul.era, ul.tags, ul.notes, ul.is_public, ul.added_at,
       s.needs_work, s.work_note,
       s.default_key,
       (COALESCE(ul.chord_chart, s.chord_chart) IS NOT NULL) AS has_chart,
       (SELECT COUNT(*) FROM playlist_songs ps JOIN playlists p ON p.id = ps.playlist_id
        WHERE ps.song_id = ul.song_id AND p.user_id = ?) AS playlist_count,
       (SELECT MAX(p.created_at) FROM playlist_songs ps JOIN playlists p ON p.id = ps.playlist_id
        WHERE ps.song_id = ul.song_id AND p.user_id = ?) AS last_playlist_at
     FROM user_library ul
     LEFT JOIN songs s ON s.id = ul.song_id
     WHERE ul.user_id = ?
     ORDER BY ul.title ASC`,
  )
    .bind(userId, userId, userId)
    .all<Record<string, unknown>>();

  return json((rows.results ?? []).map(shapeLibraryRow));
}

// ---------------------------------------------------------------------------
// GET /api/library/:songId/chart
// Precedence: the user's own chart overrides the canonical songs chart.
// ---------------------------------------------------------------------------

export async function getChart(request: AuthRequest, env: Env): Promise<Response> {
  const { songId } = request.params as { songId: string };
  const userId = request.user!.id;

  const row = await env.DB.prepare(
    `SELECT COALESCE(ul.chord_chart, s.chord_chart) AS chord_chart,
            COALESCE(ul.transpose_offset, 0)        AS transpose_offset,
            ul.chord_chart IS NOT NULL              AS is_personal
     FROM songs s
     LEFT JOIN user_library ul ON ul.song_id = s.id AND ul.user_id = ?
     WHERE s.id = ?`,
  )
    .bind(userId, songId)
    .first<Record<string, unknown>>();

  if (!row) return error(404, { error: 'Song not found' });
  return json(row);
}

// ---------------------------------------------------------------------------
// PUT /api/library/:songId/chart  — owner only; auto-adds the song to the library
// Body: { chord_chart: string } in the song's canonical (original) key.
// ---------------------------------------------------------------------------

export async function putChart(request: AuthRequest, env: Env): Promise<Response> {
  if (!isOwner(request, env)) return error(403, { error: 'Chart editing is not available for this account' });

  const { songId } = request.params as { songId: string };
  const userId = request.user!.id;

  const body = await request.json<{ chord_chart?: string }>();
  if (typeof body.chord_chart !== 'string' || !body.chord_chart.trim()) {
    return error(400, { error: 'chord_chart is required' });
  }

  // Auto-add: same snapshot as addToLibrary. INSERT OR IGNORE keeps an existing row untouched.
  await env.DB.prepare(
    `INSERT OR IGNORE INTO user_library
       (user_id, song_id, title, artist, key, bpm, genre, era, tags, notes, is_public)
     SELECT ?, id, title, artist, default_key, default_bpm, genre, era, tags, NULL, 1
     FROM songs WHERE id = ?`,
  ).bind(userId, songId).run();

  const result = await env.DB.prepare(
    `UPDATE user_library SET chord_chart = ? WHERE user_id = ? AND song_id = ?`,
  ).bind(body.chord_chart, userId, songId).run();

  if (!(result.meta as { changes: number }).changes) return error(404, { error: 'Song not found' });
  return json({ ok: true });
}

// ---------------------------------------------------------------------------
// POST /api/library/import-all  — bulk snapshot-copy all public songs
// ---------------------------------------------------------------------------

export async function importAllSongs(request: AuthRequest, env: Env): Promise<Response> {
  const userId = request.user!.id;

  await env.DB.prepare(
    `INSERT OR IGNORE INTO user_library
       (user_id, song_id, title, artist, key, bpm, genre, era, tags, notes, is_public)
     SELECT ?, id, title, artist, default_key, default_bpm, genre, era, tags, NULL, 1
     FROM songs`,
  ).bind(userId).run();

  const result = await env.DB.prepare(
    `SELECT COUNT(*) AS n FROM user_library WHERE user_id = ?`,
  ).bind(userId).first<{ n: number }>();

  return json({ ok: true, count: result?.n ?? 0 });
}

// ---------------------------------------------------------------------------
// POST /api/library/:songId  — snapshot-add
// ---------------------------------------------------------------------------

export async function addToLibrary(request: AuthRequest, env: Env): Promise<Response> {
  const { songId } = request.params as { songId: string };
  const userId = request.user!.id;

  // Check if already in library
  const existing = await env.DB.prepare(
    `SELECT 1 FROM user_library WHERE user_id = ? AND song_id = ?`,
  )
    .bind(userId, songId)
    .first();

  if (existing) return error(409, { error: 'Song already in your library' });

  // Optional body: { is_public?: boolean } — defaults to public so songs
  // surface on conor.bio without an extra step; pass is_public: false to opt out.
  let isPublic = 1;
  try {
    const body = await request.json<{ is_public?: boolean }>();
    if (body.is_public !== undefined) isPublic = body.is_public ? 1 : 0;
  } catch { /* no body */ }

  // Read the marketplace song — snapshot all fields
  const song = await env.DB.prepare(
    `SELECT title, artist, default_key, default_bpm, genre, era, tags
     FROM songs WHERE id = ?`,
  )
    .bind(songId)
    .first<{
      title: string;
      artist: string;
      default_key: string | null;
      default_bpm: number | null;
      genre: string | null;
      era: string | null;
      tags: string | null;
    }>();

  if (!song) return error(404, { error: 'Song not found in marketplace' });

  // Insert snapshot — user_library.key maps to songs.default_key, etc.
  await env.DB.prepare(
    `INSERT INTO user_library
       (user_id, song_id, title, artist, key, bpm, genre, era, tags, notes, is_public)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?)`,
  )
    .bind(
      userId,
      songId,
      song.title,
      song.artist,
      song.default_key,
      song.default_bpm,
      song.genre,
      song.era,
      song.tags,
      isPublic,
    )
    .run();

  const added = await env.DB.prepare(
    `SELECT song_id, title, artist, key, bpm, transpose_offset, genre, era, tags, notes, is_public, added_at
     FROM user_library WHERE user_id = ? AND song_id = ?`,
  )
    .bind(userId, songId)
    .first<Record<string, unknown>>();

  return json(shapeLibraryRow(added!), { status: 201 });
}

// ---------------------------------------------------------------------------
// PATCH /api/library/:songId
// ---------------------------------------------------------------------------

export async function patchLibraryEntry(request: AuthRequest, env: Env): Promise<Response> {
  const { songId } = request.params as { songId: string };
  const userId = request.user!.id;

  const existing = await env.DB.prepare(
    `SELECT 1 FROM user_library WHERE user_id = ? AND song_id = ?`,
  )
    .bind(userId, songId)
    .first();

  if (!existing) return error(404, { error: 'Song not in your library' });

  const body = await request.json<{
    title?: string;
    artist?: string;
    key?: string;
    bpm?: number;
    transpose_offset?: number;
    genre?: string[];
    era?: string;
    tags?: string[];
    notes?: string;
    is_public?: boolean;
  }>();

  const sets: string[]    = [];
  const values: unknown[] = [];

  if (body.title      !== undefined) { sets.push('title = ?');      values.push(body.title.trim()); }
  if (body.artist     !== undefined) { sets.push('artist = ?');     values.push(body.artist.trim()); }
  if (body.key        !== undefined) { sets.push('key = ?');        values.push(body.key); }
  if (body.bpm        !== undefined) { sets.push('bpm = ?');        values.push(body.bpm); }
  if (body.transpose_offset !== undefined) {
    if (!Number.isInteger(body.transpose_offset)) return error(400, { error: 'transpose_offset must be an integer' });
    sets.push('transpose_offset = ?'); values.push(normalizeOffset(body.transpose_offset));
  }
  if (body.genre      !== undefined) { sets.push('genre = ?');      values.push(JSON.stringify(body.genre)); }
  if (body.era        !== undefined) { sets.push('era = ?');        values.push(body.era); }
  if (body.tags       !== undefined) { sets.push('tags = ?');       values.push(JSON.stringify(body.tags)); }
  if (body.notes      !== undefined) { sets.push('notes = ?');      values.push(body.notes); }
  if (body.is_public  !== undefined) { sets.push('is_public = ?');  values.push(body.is_public ? 1 : 0); }

  if (sets.length === 0) return error(400, { error: 'No fields to update' });

  values.push(userId, songId);

  await env.DB.prepare(
    `UPDATE user_library SET ${sets.join(', ')} WHERE user_id = ? AND song_id = ?`,
  )
    .bind(...values)
    .run();

  const updated = await env.DB.prepare(
    `SELECT song_id, title, artist, key, bpm, transpose_offset, genre, era, tags, notes, is_public, added_at
     FROM user_library WHERE user_id = ? AND song_id = ?`,
  )
    .bind(userId, songId)
    .first<Record<string, unknown>>();

  return json(shapeLibraryRow(updated!));
}

// ---------------------------------------------------------------------------
// POST /api/library/private  — private song (not in global songs table)
// ---------------------------------------------------------------------------

export async function createPrivateSong(request: AuthRequest, env: Env): Promise<Response> {
  const userId = request.user!.id;

  const body = await request.json<{
    title:      string;
    artist:     string;
    key?:       string;
    bpm?:       number;
    genre?:     string[];
    tags?:      string[];
    era?:       string;
    notes?:     string;
  }>();

  if (!body.title?.trim() || !body.artist?.trim()) {
    return error(400, { error: 'title and artist are required' });
  }

  // Generate a private song id — "private_" prefix makes it distinguishable
  const songId = 'private_' + crypto.randomUUID();

  await env.DB.prepare(
    `INSERT INTO user_library
       (user_id, song_id, title, artist, key, bpm, genre, era, tags, notes, is_public)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
  )
    .bind(
      userId,
      songId,
      body.title.trim(),
      body.artist.trim(),
      body.key ?? null,
      body.bpm ?? null,
      JSON.stringify(body.genre ?? []),
      body.era ?? null,
      JSON.stringify(body.tags ?? []),
      body.notes ?? null,
    )
    .run();

  const added = await env.DB.prepare(
    `SELECT song_id, title, artist, key, bpm, transpose_offset, genre, era, tags, notes, is_public, added_at
     FROM user_library WHERE user_id = ? AND song_id = ?`,
  )
    .bind(userId, songId)
    .first<Record<string, unknown>>();

  return json(shapeLibraryRow(added!), { status: 201 });
}

// ---------------------------------------------------------------------------
// DELETE /api/library/:songId
// ---------------------------------------------------------------------------

export async function removeFromLibrary(request: AuthRequest, env: Env): Promise<Response> {
  const { songId } = request.params as { songId: string };
  const userId = request.user!.id;

  const existing = await env.DB.prepare(
    `SELECT 1 FROM user_library WHERE user_id = ? AND song_id = ?`,
  )
    .bind(userId, songId)
    .first();

  if (!existing) return error(404, { error: 'Song not in your library' });

  await env.DB.prepare(
    `DELETE FROM user_library WHERE user_id = ? AND song_id = ?`,
  )
    .bind(userId, songId)
    .run();

  return json({ ok: true });
}
