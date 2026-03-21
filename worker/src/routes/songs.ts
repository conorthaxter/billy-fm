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

function shapeSong(row: Record<string, unknown>) {
  return {
    ...row,
    genre: parseJsonField(row.genre as string | null),
    tags: parseJsonField(row.tags as string | null),
  };
}

function chordsUrl(title: string, artist: string): string {
  return `https://www.google.com/search?q=${encodeURIComponent(`${title} ${artist} chords site:ultimate-guitar.com`)}`;
}

// ---------------------------------------------------------------------------
// GET /api/songs
// ---------------------------------------------------------------------------

// Sort options for the ORDER BY clause.
// library_count is a column alias in the SELECT, valid in SQLite ORDER BY.
const SORT_MAP: Record<string, string> = {
  title:   's.title ASC',
  popular: 'library_count DESC, s.title ASC',
  newest:  's.created_at DESC',
  key:     's.default_key ASC, s.title ASC',
  bpm:     's.default_bpm ASC, s.title ASC',
};

export async function listSongs(request: AuthRequest, env: Env): Promise<Response> {
  const url    = new URL(request.url);
  const search = url.searchParams.get('search') ?? '';
  // genre and era accept comma-separated values for multi-select filtering
  const genreParam = url.searchParams.get('genre') ?? '';
  const eraParam   = url.searchParams.get('era')   ?? '';
  const key        = url.searchParams.get('key')   ?? '';
  const sort       = url.searchParams.get('sort')  ?? 'title';
  const page   = Math.max(1, parseInt(url.searchParams.get('page')  ?? '1',  10));
  const limit  = Math.min(200, Math.max(1, parseInt(url.searchParams.get('limit') ?? '50', 10)));
  const offset = (page - 1) * limit;

  const conditions: string[] = [];
  const bindings: unknown[]  = [];

  if (search) {
    // Match title, artist, genre JSON blob, or tags JSON blob
    conditions.push(`(s.title LIKE ? OR s.artist LIKE ? OR s.genre LIKE ? OR s.tags LIKE ?)`);
    bindings.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
  }

  if (genreParam) {
    const genres = genreParam.split(',').map(g => g.trim()).filter(Boolean);
    if (genres.length === 1) {
      conditions.push(`s.genre LIKE ?`);
      bindings.push(`%${genres[0]}%`);
    } else if (genres.length > 1) {
      // OR across selected genres
      conditions.push(`(${genres.map(() => 's.genre LIKE ?').join(' OR ')})`);
      bindings.push(...genres.map(g => `%${g}%`));
    }
  }

  if (eraParam) {
    const eras = eraParam.split(',').map(e => e.trim()).filter(Boolean);
    if (eras.length === 1) {
      conditions.push(`s.era = ?`);
      bindings.push(eras[0]);
    } else if (eras.length > 1) {
      conditions.push(`s.era IN (${eras.map(() => '?').join(',')})`);
      bindings.push(...eras);
    }
  }

  if (key) {
    conditions.push(`s.default_key = ?`);
    bindings.push(key);
  }

  const where   = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const orderBy = SORT_MAP[sort] ?? SORT_MAP.title;

  const countRow = await env.DB.prepare(
    `SELECT COUNT(*) AS total FROM songs s ${where}`,
  )
    .bind(...bindings)
    .first<{ total: number }>();

  const total = countRow?.total ?? 0;

  const rows = await env.DB.prepare(
    `SELECT s.*,
            (SELECT COUNT(*) FROM user_library ul WHERE ul.song_id = s.id) AS library_count
     FROM songs s
     ${where}
     ORDER BY ${orderBy}
     LIMIT ? OFFSET ?`,
  )
    .bind(...bindings, limit, offset)
    .all<Record<string, unknown>>();

  return json({
    songs: (rows.results ?? []).map(shapeSong),
    total,
    page,
  });
}

// ---------------------------------------------------------------------------
// GET /api/songs/:id
// ---------------------------------------------------------------------------

export async function getSong(request: AuthRequest, env: Env): Promise<Response> {
  const { id } = request.params as { id: string };

  const row = await env.DB.prepare(
    `SELECT s.*,
            (SELECT COUNT(*) FROM user_library ul WHERE ul.song_id = s.id) AS library_count
     FROM songs s
     WHERE s.id = ?`,
  )
    .bind(id)
    .first<Record<string, unknown>>();

  if (!row) return error(404, { error: 'Song not found' });

  return json(shapeSong(row));
}

// ---------------------------------------------------------------------------
// POST /api/songs
// ---------------------------------------------------------------------------

export async function createSong(request: AuthRequest, env: Env): Promise<Response> {
  const body = await request.json<{
    title?: string;
    artist?: string;
    default_key?: string;
    default_bpm?: number;
    chords_url?: string;
    genre?: string[];
    tags?: string[];
    era?: string;
  }>();

  const title  = body.title?.trim();
  const artist = body.artist?.trim();

  if (!title || !artist) {
    return error(400, { error: 'title and artist are required' });
  }

  // Check for exact duplicate
  const existing = await env.DB.prepare(
    `SELECT id FROM songs WHERE title = ? AND artist = ?`,
  )
    .bind(title, artist)
    .first<{ id: string }>();

  if (existing) return error(409, { error: 'Song already exists in marketplace' });

  const id        = crypto.randomUUID();
  const genreJson = JSON.stringify(body.genre ?? []);
  const tagsJson  = JSON.stringify(body.tags  ?? []);
  const url       = body.chords_url?.trim() || chordsUrl(title, artist);

  await env.DB.prepare(
    `INSERT INTO songs (id, title, artist, default_key, default_bpm, chords_url, genre, era, tags, added_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      id,
      title,
      artist,
      body.default_key ?? null,
      body.default_bpm ?? null,
      url,
      genreJson,
      body.era ?? null,
      tagsJson,
      request.user!.id,
    )
    .run();

  const created = await env.DB.prepare(`SELECT * FROM songs WHERE id = ?`)
    .bind(id)
    .first<Record<string, unknown>>();

  return json(shapeSong(created!), { status: 201 });
}

// ---------------------------------------------------------------------------
// PATCH /api/songs/:id
// ---------------------------------------------------------------------------

export async function patchSong(request: AuthRequest, env: Env): Promise<Response> {
  const { id } = request.params as { id: string };

  const song = await env.DB.prepare(
    `SELECT id, added_by FROM songs WHERE id = ?`,
  )
    .bind(id)
    .first<{ id: string; added_by: string }>();

  if (!song) return error(404, { error: 'Song not found' });
  if (song.added_by !== request.user!.id) {
    return error(403, { error: 'Only the song creator can edit it' });
  }

  const body = await request.json<{
    title?: string;
    artist?: string;
    default_key?: string;
    default_bpm?: number;
    chords_url?: string;
    genre?: string[];
    tags?: string[];
    era?: string;
  }>();

  // Build SET clause from provided fields only
  const sets: string[]   = [];
  const values: unknown[] = [];

  if (body.title       !== undefined) { sets.push('title = ?');       values.push(body.title.trim()); }
  if (body.artist      !== undefined) { sets.push('artist = ?');      values.push(body.artist.trim()); }
  if (body.default_key !== undefined) { sets.push('default_key = ?'); values.push(body.default_key); }
  if (body.default_bpm !== undefined) { sets.push('default_bpm = ?'); values.push(body.default_bpm); }
  if (body.chords_url  !== undefined) { sets.push('chords_url = ?');  values.push(body.chords_url); }
  if (body.genre       !== undefined) { sets.push('genre = ?');       values.push(JSON.stringify(body.genre)); }
  if (body.tags        !== undefined) { sets.push('tags = ?');        values.push(JSON.stringify(body.tags)); }
  if (body.era         !== undefined) { sets.push('era = ?');         values.push(body.era); }

  if (sets.length === 0) return error(400, { error: 'No fields to update' });

  values.push(id);

  await env.DB.prepare(`UPDATE songs SET ${sets.join(', ')} WHERE id = ?`)
    .bind(...values)
    .run();

  const updated = await env.DB.prepare(
    `SELECT s.*,
            (SELECT COUNT(*) FROM user_library ul WHERE ul.song_id = s.id) AS library_count
     FROM songs s WHERE s.id = ?`,
  )
    .bind(id)
    .first<Record<string, unknown>>();

  return json(shapeSong(updated!));
}
