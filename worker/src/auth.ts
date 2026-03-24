import { IRequest, error, json } from 'itty-router';
import type { Env } from './index';
import { SESSION_COOKIE, parseCookies, type AuthRequest } from './middleware';

const SESSION_TTL_DAYS = 30;

// ---------------------------------------------------------------------------
// HMAC-signed OAuth state (cookie-free CSRF protection)
//
// State format: `<uuid>.<timestamp_ms>.<base64_hmac_sha256>`
// The HMAC covers `<uuid>.<timestamp_ms>` using SESSION_SECRET.
// Expiry: 10 minutes from generation.
// ---------------------------------------------------------------------------

async function createOAuthState(secret: string): Promise<string> {
  const payload = `${crypto.randomUUID()}.${Date.now()}`;
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sigBuf = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  const sig = btoa(String.fromCharCode(...new Uint8Array(sigBuf)));
  return `${payload}.${sig}`;
}

async function verifyOAuthState(state: string, secret: string): Promise<boolean> {
  const lastDot = state.lastIndexOf('.');
  if (lastDot === -1) return false;
  const payload = state.slice(0, lastDot);
  const sig     = state.slice(lastDot + 1);

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify'],
  );
  const sigBuf = Uint8Array.from(atob(sig), c => c.charCodeAt(0));
  const valid  = await crypto.subtle.verify('HMAC', key, sigBuf, new TextEncoder().encode(payload));
  if (!valid) return false;

  // Check timestamp — state expires after 10 minutes
  const ts = parseInt(payload.split('.').at(-1) ?? '0', 10);
  return Date.now() - ts <= 10 * 60 * 1000;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSessionCookie(id: string, clear = false): string {
  if (clear) {
    return `${SESSION_COOKIE}=; HttpOnly; Secure; SameSite=None; Path=/; Max-Age=0`;
  }
  return `${SESSION_COOKIE}=${id}; HttpOnly; Secure; SameSite=None; Path=/; Max-Age=${SESSION_TTL_DAYS * 86400}`;
}

// ---------------------------------------------------------------------------
// GET /auth/google — redirect to Google's OAuth consent screen
// ---------------------------------------------------------------------------

export async function handleGoogleRedirect(
  _request: IRequest,
  env: Env,
): Promise<Response> {
  const state = await createOAuthState(env.SESSION_SECRET);

  const params = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    redirect_uri: env.GOOGLE_REDIRECT_URI,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    access_type: 'online',
    prompt: 'select_account',
  });

  return new Response(null, {
    status: 302,
    headers: { Location: `https://accounts.google.com/o/oauth2/v2/auth?${params}` },
  });
}

// ---------------------------------------------------------------------------
// GET /auth/google/callback — exchange code, upsert user, create session
// ---------------------------------------------------------------------------

export async function handleGoogleCallback(
  request: IRequest,
  env: Env,
): Promise<Response> {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');

  if (!code) return error(400, { error: 'Missing authorization code' });

  // Verify CSRF state (HMAC-signed, no cookie required)
  if (!state || !(await verifyOAuthState(state, env.SESSION_SECRET))) {
    return error(400, { error: 'Invalid OAuth state' });
  }

  // Exchange authorization code for tokens
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      redirect_uri: env.GOOGLE_REDIRECT_URI,
      grant_type: 'authorization_code',
    }),
  });

  if (!tokenRes.ok) {
    console.error('Token exchange failed:', await tokenRes.text());
    return error(502, { error: 'Token exchange failed' });
  }

  const { access_token } = (await tokenRes.json()) as { access_token: string };

  // Fetch Google profile
  const profileRes = await fetch(
    'https://www.googleapis.com/oauth2/v3/userinfo',
    { headers: { Authorization: `Bearer ${access_token}` } },
  );

  if (!profileRes.ok) {
    return error(502, { error: 'Failed to fetch Google profile' });
  }

  const profile = (await profileRes.json()) as {
    sub: string;
    email: string;
    name: string;
    picture?: string;
  };

  // Upsert user — insert on first login, do NOT overwrite display_name on subsequent logins
  // so users can customise it via PATCH /auth/me without it being reset by Google each login.
  await env.DB.prepare(
    `INSERT INTO users (id, email, display_name, google_id, avatar_url)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(google_id) DO UPDATE SET
       email      = excluded.email,
       avatar_url = excluded.avatar_url,
       updated_at = datetime('now')`,
  )
    .bind(
      crypto.randomUUID(),
      profile.email,
      profile.name,
      profile.sub,
      profile.picture ?? null,
    )
    .run();

  // Fetch the canonical user id (the upsert may have kept an existing id)
  const user = await env.DB.prepare(
    'SELECT id FROM users WHERE google_id = ?',
  )
    .bind(profile.sub)
    .first<{ id: string }>();

  if (!user) return error(500, { error: 'User record missing after upsert' });

  // Create auth session
  const sessionId = crypto.randomUUID();
  const expiresAt = new Date(
    Date.now() + SESSION_TTL_DAYS * 86_400_000,
  ).toISOString();

  await env.DB.prepare(
    'INSERT INTO auth_sessions (id, user_id, expires_at) VALUES (?, ?, ?)',
  )
    .bind(sessionId, user.id, expiresAt)
    .run();

  // Redirect to frontend, set session cookie, clear the CSRF state cookie
  const redirectTo = (env.FRONTEND_ORIGIN || 'http://localhost:5173') + '/app';
  const headers = new Headers({ Location: redirectTo });
  headers.append('Set-Cookie', makeSessionCookie(sessionId));

  return new Response(null, { status: 302, headers });
}

// ---------------------------------------------------------------------------
// POST /auth/logout — delete session from D1, clear cookie
// ---------------------------------------------------------------------------

export async function handleLogout(
  request: IRequest,
  env: Env,
): Promise<Response> {
  const cookies = parseCookies(request.headers.get('Cookie'));
  const sessionId = cookies[SESSION_COOKIE];

  if (sessionId) {
    await env.DB.prepare('DELETE FROM auth_sessions WHERE id = ?')
      .bind(sessionId)
      .run();
  }

  return new Response(null, {
    status: 200,
    headers: { 'Set-Cookie': makeSessionCookie('', true) },
  });
}

// ---------------------------------------------------------------------------
// GET /auth/me — returns current user (withAuth middleware runs first)
// ---------------------------------------------------------------------------

export function handleMe(request: AuthRequest): Response {
  if (!request.user) return error(401, { error: 'Unauthorized' });
  return json(request.user);
}

// ---------------------------------------------------------------------------
// PATCH /auth/me — update display_name and/or mailing_list_opt_in
// ---------------------------------------------------------------------------

export async function handlePatchMe(request: AuthRequest, env: Env): Promise<Response> {
  const user = request.user!;

  const body = await request.json<{
    display_name?: string;
    mailing_list_opt_in?: boolean;
  }>();

  const sets: string[]    = [];
  const values: unknown[] = [];

  if (body.display_name !== undefined) {
    const trimmed = body.display_name.trim();
    if (!trimmed) return error(400, { error: 'display_name cannot be empty' });
    sets.push('display_name = ?');
    values.push(trimmed);
  }

  if (body.mailing_list_opt_in !== undefined) {
    sets.push('mailing_list_opt_in = ?');
    values.push(body.mailing_list_opt_in ? 1 : 0);
    if (body.mailing_list_opt_in) {
      sets.push(`opted_in_at = datetime('now')`);
    }
  }

  if (sets.length === 0) return error(400, { error: 'No fields to update' });

  sets.push(`updated_at = datetime('now')`);
  values.push(user.id);

  await env.DB.prepare(
    `UPDATE users SET ${sets.join(', ')} WHERE id = ?`,
  )
    .bind(...values)
    .run();

  const updated = await env.DB.prepare(
    `SELECT id, email, display_name, avatar_url, is_performer, mailing_list_opt_in
     FROM users WHERE id = ?`,
  )
    .bind(user.id)
    .first<Record<string, unknown>>();

  return json(updated!);
}
