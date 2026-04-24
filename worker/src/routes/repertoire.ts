import { json } from 'itty-router';
import type { IRequest } from 'itty-router';
import type { Env } from '../index';
import { getSongbook } from './songbook';

// ---------------------------------------------------------------------------
// GET /api/repertoire/:userId
// Same data as /api/songbook/:userId but returns a bare array of songs
// (no wrapper object) for backwards-compatibility with conor.bio repertoire-modal.js.
// ---------------------------------------------------------------------------

export async function getRepertoire(request: IRequest, env: Env): Promise<Response> {
  const inner = await getSongbook(request, env);
  if (!inner.ok) return inner;
  const body = await inner.json<{ songs: unknown[] }>();
  return json(body.songs ?? []);
}
