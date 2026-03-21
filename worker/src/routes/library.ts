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

// ---------------------------------------------------------------------------
// GET /api/library
// ---------------------------------------------------------------------------

export async function getLibrary(request: AuthRequest, env: Env): Promise<Response> {
  const rows = await env.DB.prepare(
    `SELECT song_id, title, artist, key, bpm, chords_url, genre, era, tags, notes, is_public, added_at
     FROM user_library
     WHERE user_id = ?
     ORDER BY title ASC`,
  )
    .bind(request.user!.id)
    .all<Record<string, unknown>>();

  return json((rows.results ?? []).map(shapeLibraryRow));
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

  // Optional body: { is_public?: boolean }
  let isPublic = 0;
  try {
    const body = await request.json<{ is_public?: boolean }>();
    isPublic = body.is_public ? 1 : 0;
  } catch { /* no body */ }

  // Read the marketplace song — snapshot all fields
  const song = await env.DB.prepare(
    `SELECT title, artist, default_key, default_bpm, chords_url, genre, era, tags
     FROM songs WHERE id = ?`,
  )
    .bind(songId)
    .first<{
      title: string;
      artist: string;
      default_key: string | null;
      default_bpm: number | null;
      chords_url: string | null;
      genre: string | null;
      era: string | null;
      tags: string | null;
    }>();

  if (!song) return error(404, { error: 'Song not found in marketplace' });

  // Insert snapshot — user_library.key maps to songs.default_key, etc.
  await env.DB.prepare(
    `INSERT INTO user_library
       (user_id, song_id, title, artist, key, bpm, chords_url, genre, era, tags, notes, is_public)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?)`,
  )
    .bind(
      userId,
      songId,
      song.title,
      song.artist,
      song.default_key,
      song.default_bpm,
      song.chords_url,
      song.genre,
      song.era,
      song.tags,
      isPublic,
    )
    .run();

  const added = await env.DB.prepare(
    `SELECT song_id, title, artist, key, bpm, chords_url, genre, era, tags, notes, is_public, added_at
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
    chords_url?: string;
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
  if (body.chords_url !== undefined) { sets.push('chords_url = ?'); values.push(body.chords_url); }
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
    `SELECT song_id, title, artist, key, bpm, chords_url, genre, era, tags, notes, is_public, added_at
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
    chords_url?: string;
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
       (user_id, song_id, title, artist, key, bpm, chords_url, genre, era, tags, notes, is_public)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
  )
    .bind(
      userId,
      songId,
      body.title.trim(),
      body.artist.trim(),
      body.key ?? null,
      body.bpm ?? null,
      body.chords_url ?? null,
      JSON.stringify(body.genre ?? []),
      body.era ?? null,
      JSON.stringify(body.tags ?? []),
      body.notes ?? null,
    )
    .run();

  const added = await env.DB.prepare(
    `SELECT song_id, title, artist, key, bpm, chords_url, genre, era, tags, notes, is_public, added_at
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
