// Base URL: empty string in dev (Vite proxy forwards /api and /auth to :8787)
const BASE = import.meta.env.VITE_API_URL ?? '';

/**
 * Core fetch wrapper. All API helpers go through here.
 * - Attaches credentials (session cookie)
 * - Sets Content-Type: application/json on bodies
 * - Throws an Error with { status, body } on non-2xx
 */
export async function apiFetch(path, { body, ...opts } = {}) {
  const headers = { ...(opts.headers ?? {}) };

  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(`${BASE}${path}`, {
    ...opts,
    credentials: 'include',
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    let message = `HTTP ${response.status}`;
    try {
      const data = await response.json();
      message = data.error ?? message;
    } catch {
      // ignore parse errors — keep the HTTP status message
    }
    const err = new Error(message);
    err.status = response.status;
    throw err;
  }

  // 204 No Content
  if (response.status === 204) return null;

  return response.json();
}

export const get    = (path, opts)        => apiFetch(path, { method: 'GET',    ...opts });
export const post   = (path, body, opts)  => apiFetch(path, { method: 'POST',   body, ...opts });
export const patch  = (path, body, opts)  => apiFetch(path, { method: 'PATCH',  body, ...opts });
export const put    = (path, body, opts)  => apiFetch(path, { method: 'PUT',    body, ...opts });
export const del    = (path, opts)        => apiFetch(path, { method: 'DELETE', ...opts });
