import { error, json } from 'itty-router';
import type { Env } from '../index';
import type { AuthRequest } from '../middleware';

// ---------------------------------------------------------------------------
// POST /api/history — log a play event
// ---------------------------------------------------------------------------

export async function logPlay(request: AuthRequest, env: Env): Promise<Response> {
  const body = await request.json<{ song_id?: string; session_id?: string }>();

  if (!body.song_id) return error(400, { error: 'song_id is required' });

  // Verify the song exists
  const song = await env.DB.prepare(`SELECT id FROM songs WHERE id = ?`)
    .bind(body.song_id)
    .first<{ id: string }>();

  if (!song) return error(404, { error: 'Song not found' });

  // If session_id provided, verify it belongs to this user
  if (body.session_id) {
    const session = await env.DB.prepare(
      `SELECT id FROM sessions WHERE id = ? AND user_id = ?`,
    )
      .bind(body.session_id, request.user!.id)
      .first<{ id: string }>();

    if (!session) return error(404, { error: 'Session not found' });
  }

  const id = crypto.randomUUID();

  await env.DB.prepare(
    `INSERT INTO play_history (id, user_id, song_id, session_id)
     VALUES (?, ?, ?, ?)`,
  )
    .bind(id, request.user!.id, body.song_id, body.session_id ?? null)
    .run();

  const created = await env.DB.prepare(`SELECT * FROM play_history WHERE id = ?`)
    .bind(id)
    .first<Record<string, unknown>>();

  return json(created!, { status: 201 });
}

// ---------------------------------------------------------------------------
// GET /api/history
// ---------------------------------------------------------------------------

export async function getHistory(request: AuthRequest, env: Env): Promise<Response> {
  const url        = new URL(request.url);
  const sessionId  = url.searchParams.get('session_id');
  const limit      = Math.min(500, Math.max(1, parseInt(url.searchParams.get('limit')  ?? '50',  10)));
  const offset     = Math.max(0,               parseInt(url.searchParams.get('offset') ?? '0',   10));

  const conditions: string[] = ['h.user_id = ?'];
  const bindings: unknown[]  = [request.user!.id];

  if (sessionId) {
    conditions.push('h.session_id = ?');
    bindings.push(sessionId);
  }

  const where = `WHERE ${conditions.join(' AND ')}`;

  const countRow = await env.DB.prepare(
    `SELECT COUNT(*) AS total FROM play_history h ${where}`,
  )
    .bind(...bindings)
    .first<{ total: number }>();

  const rows = await env.DB.prepare(
    `SELECT h.id, h.song_id, h.session_id, h.played_at,
            s.title, s.artist
     FROM play_history h
     JOIN songs s ON s.id = h.song_id
     ${where}
     ORDER BY h.played_at DESC
     LIMIT ? OFFSET ?`,
  )
    .bind(...bindings, limit, offset)
    .all<Record<string, unknown>>();

  return json({
    history: rows.results ?? [],
    total:   countRow?.total ?? 0,
    limit,
    offset,
  });
}
