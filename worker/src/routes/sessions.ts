import { error, json } from 'itty-router';
import type { Env } from '../index';
import type { AuthRequest } from '../middleware';

// ---------------------------------------------------------------------------
// POST /api/sessions — start a new live performance session
// ---------------------------------------------------------------------------

export async function createSession(request: AuthRequest, env: Env): Promise<Response> {
  const body = await request.json<{ title?: string }>();

  if (!body.title?.trim()) return error(400, { error: 'title is required' });

  const id = crypto.randomUUID();

  await env.DB.prepare(
    `INSERT INTO sessions (id, user_id, title) VALUES (?, ?, ?)`,
  )
    .bind(id, request.user!.id, body.title.trim())
    .run();

  const created = await env.DB.prepare(`SELECT * FROM sessions WHERE id = ?`)
    .bind(id)
    .first<Record<string, unknown>>();

  return json(created!, { status: 201 });
}

// ---------------------------------------------------------------------------
// PATCH /api/sessions/:id
// ---------------------------------------------------------------------------

export async function patchSession(request: AuthRequest, env: Env): Promise<Response> {
  const { id } = request.params as { id: string };

  const session = await env.DB.prepare(
    `SELECT id FROM sessions WHERE id = ? AND user_id = ?`,
  )
    .bind(id, request.user!.id)
    .first<{ id: string }>();

  if (!session) return error(404, { error: 'Session not found' });

  const body = await request.json<{
    title?: string;
    notes?: string;
    ended_at?: string;
  }>();

  const sets: string[]    = [];
  const values: unknown[] = [];

  if (body.title    !== undefined) { sets.push('title = ?');    values.push(body.title.trim()); }
  if (body.notes    !== undefined) { sets.push('notes = ?');    values.push(body.notes); }
  if (body.ended_at !== undefined) { sets.push('ended_at = ?'); values.push(body.ended_at); }

  if (sets.length === 0) return error(400, { error: 'No fields to update' });

  values.push(id);

  await env.DB.prepare(`UPDATE sessions SET ${sets.join(', ')} WHERE id = ?`)
    .bind(...values)
    .run();

  const updated = await env.DB.prepare(`SELECT * FROM sessions WHERE id = ?`)
    .bind(id)
    .first<Record<string, unknown>>();

  return json(updated!);
}

// ---------------------------------------------------------------------------
// GET /api/sessions
// ---------------------------------------------------------------------------

export async function listSessions(request: AuthRequest, env: Env): Promise<Response> {
  const rows = await env.DB.prepare(
    `SELECT * FROM sessions WHERE user_id = ? ORDER BY started_at DESC`,
  )
    .bind(request.user!.id)
    .all<Record<string, unknown>>();

  return json(rows.results ?? []);
}
