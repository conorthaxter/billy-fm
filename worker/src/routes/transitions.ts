import { error, json } from 'itty-router';
import type { Env } from '../index';
import type { AuthRequest } from '../middleware';

// ---------------------------------------------------------------------------
// GET /api/library/:songId/transitions
// Returns transitions FROM this song, including the target song's title/artist.
// ---------------------------------------------------------------------------

export async function listTransitions(request: AuthRequest, env: Env): Promise<Response> {
  const { songId } = request.params as { songId: string };
  const userId = request.user!.id;

  const rows = await env.DB.prepare(
    `SELECT t.id, t.to_song_id, t.notes, t.created_at,
            COALESCE(ul.title,  s.title)  AS to_title,
            COALESCE(ul.artist, s.artist) AS to_artist
     FROM song_transitions t
     LEFT JOIN user_library ul ON ul.user_id = ? AND ul.song_id = t.to_song_id
     LEFT JOIN songs s ON s.id = t.to_song_id
     WHERE t.user_id = ? AND t.from_song_id = ?
     ORDER BY t.created_at DESC`,
  )
    .bind(userId, userId, songId)
    .all<Record<string, unknown>>();

  return json(rows.results ?? []);
}

// ---------------------------------------------------------------------------
// POST /api/library/:songId/transitions
// Body: { to_song_id: string, notes?: string }
// ---------------------------------------------------------------------------

export async function createTransition(request: AuthRequest, env: Env): Promise<Response> {
  const { songId } = request.params as { songId: string };
  const userId = request.user!.id;

  const body = await request.json<{ to_song_id?: string; notes?: string }>();

  if (!body.to_song_id) return error(400, { error: 'to_song_id is required' });
  if (body.to_song_id === songId) return error(400, { error: 'A song cannot transition to itself' });

  const id = crypto.randomUUID();
  try {
    await env.DB.prepare(
      `INSERT INTO song_transitions (id, user_id, from_song_id, to_song_id, notes)
       VALUES (?, ?, ?, ?, ?)`,
    )
      .bind(id, userId, songId, body.to_song_id, body.notes ?? null)
      .run();
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes('UNIQUE')) return error(409, { error: 'Transition already exists' });
    throw e;
  }

  const created = await env.DB.prepare(
    `SELECT t.id, t.to_song_id, t.notes, t.created_at,
            COALESCE(ul.title,  s.title)  AS to_title,
            COALESCE(ul.artist, s.artist) AS to_artist
     FROM song_transitions t
     LEFT JOIN user_library ul ON ul.user_id = ? AND ul.song_id = t.to_song_id
     LEFT JOIN songs s ON s.id = t.to_song_id
     WHERE t.id = ?`,
  )
    .bind(userId, id)
    .first<Record<string, unknown>>();

  return json(created!, { status: 201 });
}

// ---------------------------------------------------------------------------
// DELETE /api/transitions/:id
// ---------------------------------------------------------------------------

export async function deleteTransition(request: AuthRequest, env: Env): Promise<Response> {
  const { id } = request.params as { id: string };
  const userId = request.user!.id;

  const existing = await env.DB.prepare(
    `SELECT 1 FROM song_transitions WHERE id = ? AND user_id = ?`,
  )
    .bind(id, userId)
    .first();

  if (!existing) return error(404, { error: 'Transition not found' });

  await env.DB.prepare(`DELETE FROM song_transitions WHERE id = ? AND user_id = ?`)
    .bind(id, userId)
    .run();

  return json({ ok: true });
}
