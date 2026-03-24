import { error, json } from 'itty-router';
import type { IRequest } from 'itty-router';
import type { Env } from '../index';

// ---------------------------------------------------------------------------
// Shared helper — fetch public library for a user with optional filtering
// ---------------------------------------------------------------------------

function parseJsonField(value: string | null | undefined): string[] {
  if (!value) return [];
  try { return JSON.parse(value as string); } catch { return []; }
}

async function getPublicLibrary(
  env: Env,
  userId: string,
  searchQuery: string,
  tagsFilter: string[],
): Promise<Response> {
  // Verify user exists + get display name for the page header
  const user = await env.DB.prepare(
    `SELECT id, display_name FROM users WHERE id = ?`,
  )
    .bind(userId)
    .first<{ id: string; display_name: string }>();

  if (!user) return error(404, { error: 'User not found' });

  const rows = await env.DB.prepare(
    `SELECT ul.song_id, ul.title, ul.artist, ul.tags, ul.genre
     FROM user_library ul
     WHERE ul.user_id = ? AND ul.is_public = 1
     ORDER BY ul.title ASC`,
  )
    .bind(userId)
    .all<{ song_id: string; title: string; artist: string; tags: string | null; genre: string | null }>();

  let results = (rows.results ?? []).map((row) => ({
    song_id: row.song_id,
    title: row.title,
    artist: row.artist,
    tags: parseJsonField(row.tags),
    genre: parseJsonField(row.genre),
  }));

  // Filter by ?search=
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    results = results.filter(
      (s) => s.title.toLowerCase().includes(q) || s.artist.toLowerCase().includes(q),
    );
  }

  // Filter by ?tags= (comma-separated, song must match at least one)
  if (tagsFilter.length > 0) {
    results = results.filter(
      (s) => tagsFilter.some((t) => s.tags.includes(t)),
    );
  }

  return json({ artist: { id: user.id, display_name: user.display_name }, songs: results });
}

// ---------------------------------------------------------------------------
// GET /api/songbook/:userId
// ---------------------------------------------------------------------------

export async function getSongbook(request: IRequest, env: Env): Promise<Response> {
  const { userId } = request.params as { userId: string };
  const url = new URL(request.url);
  const searchQuery = url.searchParams.get('search') ?? '';
  const tagsParam = url.searchParams.get('tags') ?? '';
  const tagsFilter = tagsParam ? tagsParam.split(',').map((t) => t.trim()).filter(Boolean) : [];

  return getPublicLibrary(env, userId, searchQuery, tagsFilter);
}
