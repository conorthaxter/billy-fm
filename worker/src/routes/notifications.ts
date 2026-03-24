import { error, json } from 'itty-router';
import type { Env } from '../index';
import type { AuthRequest } from '../middleware';

// ---------------------------------------------------------------------------
// GET /api/notifications
// Supports ?unread=true to return only unread notifications
// ---------------------------------------------------------------------------

export async function listNotifications(request: AuthRequest, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const unreadOnly = url.searchParams.get('unread') === 'true';

  const query = unreadOnly
    ? `SELECT * FROM notifications WHERE user_id = ? AND is_read = 0 ORDER BY created_at DESC LIMIT 50`
    : `SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50`;

  const rows = await env.DB.prepare(query)
    .bind(request.user!.id)
    .all<Record<string, unknown>>();

  return json(rows.results ?? []);
}

// ---------------------------------------------------------------------------
// PATCH /api/notifications/:id — mark single notification as read
// ---------------------------------------------------------------------------

export async function markNotificationRead(request: AuthRequest, env: Env): Promise<Response> {
  const { id } = request.params as { id: string };

  const row = await env.DB.prepare(
    `SELECT id FROM notifications WHERE id = ? AND user_id = ?`,
  )
    .bind(id, request.user!.id)
    .first<{ id: string }>();

  if (!row) return error(404, { error: 'Notification not found' });

  await env.DB.prepare(
    `UPDATE notifications SET is_read = 1 WHERE id = ?`,
  )
    .bind(id)
    .run();

  return json({ ok: true });
}

// ---------------------------------------------------------------------------
// PATCH /api/notifications/read-all — mark all as read for current user
// ---------------------------------------------------------------------------

export async function markAllNotificationsRead(request: AuthRequest, env: Env): Promise<Response> {
  await env.DB.prepare(
    `UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0`,
  )
    .bind(request.user!.id)
    .run();

  return json({ ok: true });
}
