import { IRequest, error, json } from 'itty-router';
import type { Env } from './index';
import { SESSION_COOKIE, parseCookies, type AuthRequest } from './middleware';

const SESSION_TTL_DAYS = 30;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSessionCookie(id: string, clear = false): string {
  if (clear) {
    return `${SESSION_COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`;
  }
  return `${SESSION_COOKIE}=${id}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${SESSION_TTL_DAYS * 86400}`;
}

// ---------------------------------------------------------------------------
// GET /auth/google — redirect to Google's OAuth consent screen
// ---------------------------------------------------------------------------

export function handleGoogleRedirect(
  _request: IRequest,
  env: Env,
): Response {
  const state = crypto.randomUUID();

  const params = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    redirect_uri: env.GOOGLE_REDIRECT_URI,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    access_type: 'online',
    prompt: 'select_account',
  });

  const headers = new Headers({
    Location: `https://accounts.google.com/o/oauth2/v2/auth?${params}`,
    // Short-lived state cookie for CSRF verification in the callback
    'Set-Cookie': `oauth_state=${state}; HttpOnly; Secure; SameSite=Lax; Path=/auth; Max-Age=600`,
  });

  return new Response(null, { status: 302, headers });
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

  // Verify CSRF state
  const cookies = parseCookies(request.headers.get('Cookie'));
  if (!state || cookies['oauth_state'] !== state) {
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

  // Upsert user — insert on first login, update display fields on subsequent logins.
  // The generated UUID is only used on first insert; conflicts keep the existing id.
  await env.DB.prepare(
    `INSERT INTO users (id, email, display_name, google_id, avatar_url)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(google_id) DO UPDATE SET
       email        = excluded.email,
       display_name = excluded.display_name,
       avatar_url   = excluded.avatar_url,
       updated_at   = datetime('now')`,
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
  const redirectTo = env.FRONTEND_ORIGIN || 'http://localhost:5173';
  const headers = new Headers({ Location: redirectTo });
  headers.append('Set-Cookie', makeSessionCookie(sessionId));
  headers.append(
    'Set-Cookie',
    'oauth_state=; HttpOnly; Secure; SameSite=Lax; Path=/auth; Max-Age=0',
  );

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
  // withAuth guarantees request.user is set before this handler runs
  if (!request.user) return error(401, { error: 'Unauthorized' });
  return json(request.user);
}
