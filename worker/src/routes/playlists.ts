import { error, json } from 'itty-router';
import type { Env } from '../index';
import type { AuthRequest } from '../middleware';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseJsonField(value: string | null): string[] {
  if (!value) return [];
  try { return JSON.parse(value); } catch { return []; }
}

/** 8-char URL-safe slug from crypto random bytes */
function randomSlug(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '')
    .slice(0, 8);
}

async function resolveUserId(env: Env, userId: string): Promise<string> {
  if (userId !== 'service') return userId;
  const firstUser = await env.DB.prepare(`SELECT id FROM users LIMIT 1`).first<{ id: string }>();
  return firstUser?.id ?? userId;
}

async function assertOwner(
  env: Env,
  playlistId: string,
  userId: string,
): Promise<{ id: string } | Response> {
  const resolvedId = await resolveUserId(env, userId);
  const row = await env.DB.prepare(
    `SELECT id FROM playlists WHERE id = ? AND user_id = ?`,
  )
    .bind(playlistId, resolvedId)
    .first<{ id: string }>();

  if (!row) return error(404, { error: 'Playlist not found' });
  return row;
}

// ---------------------------------------------------------------------------
// GET /api/playlists
// ---------------------------------------------------------------------------

export async function listPlaylists(request: AuthRequest, env: Env): Promise<Response> {
  const rows = await env.DB.prepare(
    `SELECT p.id, p.title, p.playlist_type, p.is_public, p.is_favorited, p.share_slug, p.updated_at,
            (SELECT COUNT(*) FROM playlist_songs ps WHERE ps.playlist_id = p.id) AS song_count
     FROM playlists p
     WHERE p.user_id = ?
     ORDER BY p.is_favorited DESC, p.updated_at DESC`,
  )
    .bind(request.user!.id)
    .all<Record<string, unknown>>();

  return json(rows.results ?? []);
}

// ---------------------------------------------------------------------------
// POST /api/playlists
// ---------------------------------------------------------------------------

export async function createPlaylist(request: AuthRequest, env: Env): Promise<Response> {
  const body = await request.json<{
    title?: string;
    playlist_type?: string;
    notes?: string;
    is_public?: boolean;
    client_name?: string;
    event_date?: string;
    // Client set fields (Phase 3f)
    color_scheme?: string;
    source?: string;
    source_gig_id?: string;
    metadata?: Record<string, unknown> | string;
    password?: string;
    off_list_requests?: number;
    is_locked?: boolean;
  }>();

  if (!body.title?.trim()) return error(400, { error: 'title is required' });

  const id   = crypto.randomUUID();
  const slug = randomSlug();

  const ownerId = await resolveUserId(env, request.user!.id);
  if (ownerId === 'service') return error(500, { error: 'No users found to assign playlist ownership' });

  // Normalise metadata to a JSON string
  const metadataStr = body.metadata
    ? (typeof body.metadata === 'string' ? body.metadata : JSON.stringify(body.metadata))
    : '{}';

  try {
    await env.DB.prepare(
      `INSERT INTO playlists
         (id, user_id, title, playlist_type, notes, is_public, client_name, event_date, share_slug,
          color_scheme, source, source_gig_id, metadata, password, off_list_requests, is_locked)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        id,
        ownerId,
        body.title.trim(),
        body.playlist_type ?? 'set',
        body.notes ?? null,
        body.is_public ? 1 : 0,
        body.client_name ?? null,
        body.event_date ?? null,
        slug,
        body.color_scheme ?? 'standard',
        body.source ?? null,
        body.source_gig_id ?? null,
        metadataStr,
        body.password ?? null,
        body.off_list_requests ?? 0,
        body.is_locked ? 1 : 0,
      )
      .run();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[createPlaylist] DB insert failed:', msg, {
      user_id: ownerId,
      body,
    });
    return error(500, { error: 'DB insert failed', detail: msg, user_id: ownerId });
  }

  const created = await env.DB.prepare(`SELECT * FROM playlists WHERE id = ?`)
    .bind(id)
    .first<Record<string, unknown>>();

  return json(created!, { status: 201 });
}

// ---------------------------------------------------------------------------
// GET /api/playlists/:id
// ---------------------------------------------------------------------------

export async function getPlaylist(request: AuthRequest, env: Env): Promise<Response> {
  const { id } = request.params as { id: string };
  const userId = request.user!.id;

  const playlist = await env.DB.prepare(
    `SELECT * FROM playlists WHERE id = ? AND user_id = ?`,
  )
    .bind(id, userId)
    .first<Record<string, unknown>>();

  if (!playlist) return error(404, { error: 'Playlist not found' });

  // Songs joined with user_library for the user's personal copy of each song.
  // Falls back to marketplace data (s.*) for any field the user hasn't snapshotted yet,
  // but in practice every song_id in playlist_songs must also be in user_library
  // (added via POST /api/library/:songId first).
  const songs = await env.DB.prepare(
    `SELECT ps.song_id,
            ps.position,
            ps.notes        AS playlist_notes,
            ps.is_played,
            ps.requested_by,
            COALESCE(ul.title,      s.title)       AS title,
            COALESCE(ul.artist,     s.artist)      AS artist,
            COALESCE(ul.key,        s.default_key) AS key,
            COALESCE(ul.bpm,        s.default_bpm) AS bpm,
            COALESCE(ul.chords_url, s.chords_url)  AS chords_url,
            COALESCE(ul.genre,      s.genre)       AS genre,
            COALESCE(ul.era,        s.era)         AS era,
            COALESCE(ul.tags,       s.tags)        AS tags,
            ul.notes        AS library_notes
     FROM playlist_songs ps
     JOIN songs s ON s.id = ps.song_id
     LEFT JOIN user_library ul ON ul.song_id = ps.song_id AND ul.user_id = ?
     WHERE ps.playlist_id = ?
     ORDER BY ps.position ASC`,
  )
    .bind(userId, id)
    .all<Record<string, unknown>>();

  const shapedSongs = (songs.results ?? []).map((row) => ({
    ...row,
    genre: parseJsonField(row.genre as string | null),
    tags:  parseJsonField(row.tags  as string | null),
  }));

  return json({ ...playlist, songs: shapedSongs });
}

// ---------------------------------------------------------------------------
// PATCH /api/playlists/:id
// ---------------------------------------------------------------------------

export async function patchPlaylist(request: AuthRequest, env: Env): Promise<Response> {
  const { id } = request.params as { id: string };

  const check = await assertOwner(env, id, request.user!.id);
  if (check instanceof Response) return check;

  const body = await request.json<{
    title?: string;
    notes?: string;
    is_public?: boolean;
    is_favorited?: boolean;
    client_name?: string;
    event_date?: string;
    playlist_type?: string;
    tip_enabled?: boolean;
    tip_venmo?: string;
    tip_message?: string;
    tip_minimum?: number;
  }>();

  const sets: string[]    = [];
  const values: unknown[] = [];

  if (body.title         !== undefined) { sets.push('title = ?');         values.push(body.title.trim()); }
  if (body.notes         !== undefined) { sets.push('notes = ?');         values.push(body.notes); }
  if (body.is_public     !== undefined) { sets.push('is_public = ?');     values.push(body.is_public ? 1 : 0); }
  if (body.is_favorited  !== undefined) { sets.push('is_favorited = ?');  values.push(body.is_favorited ? 1 : 0); }
  if (body.client_name   !== undefined) { sets.push('client_name = ?');   values.push(body.client_name); }
  if (body.event_date    !== undefined) { sets.push('event_date = ?');    values.push(body.event_date); }
  if (body.playlist_type !== undefined) { sets.push('playlist_type = ?'); values.push(body.playlist_type); }
  if (body.tip_enabled   !== undefined) { sets.push('tip_enabled = ?');   values.push(body.tip_enabled ? 1 : 0); }
  if (body.tip_venmo     !== undefined) { sets.push('tip_venmo = ?');     values.push(body.tip_venmo); }
  if (body.tip_message   !== undefined) { sets.push('tip_message = ?');   values.push(body.tip_message); }
  if (body.tip_minimum   !== undefined) { sets.push('tip_minimum = ?');   values.push(body.tip_minimum); }

  if (sets.length === 0) return error(400, { error: 'No fields to update' });

  sets.push(`updated_at = datetime('now')`);
  values.push(id);

  await env.DB.prepare(`UPDATE playlists SET ${sets.join(', ')} WHERE id = ?`)
    .bind(...values)
    .run();

  const updated = await env.DB.prepare(`SELECT * FROM playlists WHERE id = ?`)
    .bind(id)
    .first<Record<string, unknown>>();

  return json(updated!);
}

// ---------------------------------------------------------------------------
// DELETE /api/playlists/:id
// ---------------------------------------------------------------------------

export async function deletePlaylist(request: AuthRequest, env: Env): Promise<Response> {
  const { id } = request.params as { id: string };

  const check = await assertOwner(env, id, request.user!.id);
  if (check instanceof Response) return check;

  // playlist_songs has ON DELETE CASCADE via the playlist FK, but D1 doesn't
  // enforce FK cascades by default — delete child rows explicitly.
  await env.DB.prepare(`DELETE FROM playlist_songs WHERE playlist_id = ?`).bind(id).run();
  await env.DB.prepare(`DELETE FROM playlists WHERE id = ?`).bind(id).run();

  return json({ ok: true });
}

// ---------------------------------------------------------------------------
// PUT /api/playlists/:id/songs  — full replace
// ---------------------------------------------------------------------------

export async function setPlaylistSongs(request: AuthRequest, env: Env): Promise<Response> {
  const { id } = request.params as { id: string };

  const check = await assertOwner(env, id, request.user!.id);
  if (check instanceof Response) return check;

  const body = await request.json<{
    songs?: { song_id: string; position: number; notes?: string }[];
  }>();

  const songs = body.songs ?? [];

  // Validate positions are unique
  const positions = songs.map((s) => s.position);
  if (new Set(positions).size !== positions.length) {
    return error(400, { error: 'Duplicate positions in songs array' });
  }

  // Delete existing, insert new — done as sequential awaits (D1 doesn't batch
  // statements with variable-length inputs cleanly via the REST API).
  await env.DB.prepare(`DELETE FROM playlist_songs WHERE playlist_id = ?`).bind(id).run();

  for (const song of songs) {
    await env.DB.prepare(
      `INSERT INTO playlist_songs (playlist_id, song_id, position, notes)
       VALUES (?, ?, ?, ?)`,
    )
      .bind(id, song.song_id, song.position, song.notes ?? null)
      .run();
  }

  // Touch updated_at on the playlist
  await env.DB.prepare(`UPDATE playlists SET updated_at = datetime('now') WHERE id = ?`)
    .bind(id)
    .run();

  return json({ ok: true, count: songs.length });
}

// ---------------------------------------------------------------------------
// PATCH /api/playlists/:id/songs/:songId
// ---------------------------------------------------------------------------

export async function patchPlaylistSong(request: AuthRequest, env: Env): Promise<Response> {
  const { id, songId } = request.params as { id: string; songId: string };

  const check = await assertOwner(env, id, request.user!.id);
  if (check instanceof Response) return check;

  const existing = await env.DB.prepare(
    `SELECT 1 FROM playlist_songs WHERE playlist_id = ? AND song_id = ?`,
  )
    .bind(id, songId)
    .first();

  if (!existing) return error(404, { error: 'Song not in playlist' });

  const body = await request.json<{ is_played?: boolean; notes?: string }>();

  const sets: string[]    = [];
  const values: unknown[] = [];

  if (body.is_played !== undefined) { sets.push('is_played = ?'); values.push(body.is_played ? 1 : 0); }
  if (body.notes     !== undefined) { sets.push('notes = ?');     values.push(body.notes); }

  if (sets.length === 0) return error(400, { error: 'No fields to update' });

  values.push(id, songId);

  await env.DB.prepare(
    `UPDATE playlist_songs SET ${sets.join(', ')} WHERE playlist_id = ? AND song_id = ?`,
  )
    .bind(...values)
    .run();

  const updated = await env.DB.prepare(
    `SELECT * FROM playlist_songs WHERE playlist_id = ? AND song_id = ?`,
  )
    .bind(id, songId)
    .first<Record<string, unknown>>();

  return json(updated!);
}
