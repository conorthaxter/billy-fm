import { IRequest, error } from 'itty-router';
import type { Env } from './index';

export const SESSION_COOKIE = 'billy_session';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface User {
  id: string;
  email: string;
  display_name: string;
  avatar_url: string | null;
  is_performer: number; // D1 returns 0/1 for BOOLEAN
}

// Extends IRequest so route handlers can type-safely access request.user
export type AuthRequest = IRequest & { user?: User };

// ---------------------------------------------------------------------------
// Cookie parsing
// ---------------------------------------------------------------------------

export function parseCookies(header: string | null): Record<string, string> {
  if (!header) return {};
  return Object.fromEntries(
    header.split(';').map((c) => {
      const [k, ...v] = c.trim().split('=');
      return [k ?? '', decodeURIComponent(v.join('='))];
    }),
  );
}

// ---------------------------------------------------------------------------
// CORS middleware
// itty-router's cors() receives origin in a closure, so it can't read env.
// These custom handlers receive (request, env) and are registered as
// router `before` / `finally` handlers — both receive (request, ...extras).
// ---------------------------------------------------------------------------

function getAllowedOrigins(env: Env): string[] {
  return [
    env.FRONTEND_ORIGIN,
    'http://localhost:5173',
    'http://localhost:4173',
  ].filter(Boolean);
}

const CORS_HEADERS = {
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
} as const;

/** before handler: short-circuits OPTIONS preflight requests */
export function corsPreflight(request: IRequest, env: Env): Response | undefined {
  if (request.method !== 'OPTIONS') return undefined;

  const origin = request.headers.get('Origin') ?? '';
  const headers = new Headers(CORS_HEADERS);

  if (getAllowedOrigins(env).includes(origin)) {
    headers.set('Access-Control-Allow-Origin', origin);
    headers.set('Access-Control-Allow-Credentials', 'true');
  }

  return new Response(null, { status: 204, headers });
}

/** finally handler: injects CORS headers into every non-OPTIONS response */
export function corsify(
  response: Response,
  request: IRequest,
  env: Env,
): Response {
  const origin = request.headers.get('Origin') ?? '';
  if (!getAllowedOrigins(env).includes(origin)) return response;

  const headers = new Headers(response.headers);
  headers.set('Access-Control-Allow-Origin', origin);
  headers.set('Access-Control-Allow-Credentials', 'true');

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

// ---------------------------------------------------------------------------
// Auth middleware — attach user to request or return 401
// ---------------------------------------------------------------------------

export async function withAuth(
  request: AuthRequest,
  env: Env,
): Promise<Response | undefined> {
  const cookies = parseCookies(request.headers.get('Cookie'));
  const sessionId = cookies[SESSION_COOKIE];

  if (!sessionId) return error(401, { error: 'Unauthorized' });

  const user = await env.DB.prepare(
    `SELECT u.id, u.email, u.display_name, u.avatar_url, u.is_performer
     FROM auth_sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.id = ? AND s.expires_at > datetime('now')`,
  )
    .bind(sessionId)
    .first<User>();

  if (!user) return error(401, { error: 'Session expired or invalid' });

  request.user = user;
  // returning undefined lets the route handler proceed
}
