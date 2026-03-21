import { error, json } from 'itty-router';
import type { Env } from '../index';
import type { AuthRequest } from '../middleware';

// ---------------------------------------------------------------------------
// Spotify helpers
// ---------------------------------------------------------------------------

// Pitch Class → key name (major / minor)
const PITCH_MAJOR = ['C','C#','D','Eb','E','F','F#','G','Ab','A','Bb','B'];
const PITCH_MINOR = ['Cm','C#m','Dm','Ebm','Em','Fm','F#m','Gm','Abm','Am','Bbm','Bm'];

function spotifyKey(key: number, mode: number): string | null {
  if (key < 0) return null; // -1 = unknown
  return mode === 1 ? (PITCH_MAJOR[key] ?? null) : (PITCH_MINOR[key] ?? null);
}

async function getSpotifyToken(env: Env): Promise<string> {
  const creds = btoa(`${env.SPOTIFY_CLIENT_ID}:${env.SPOTIFY_CLIENT_SECRET}`);
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { Authorization: `Basic ${creds}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials',
  });
  if (!res.ok) throw new Error('Failed to get Spotify token');
  const data = await res.json<{ access_token: string }>();
  return data.access_token;
}

interface SpotifyTrack {
  id: string;
  name: string;
  artists: { name: string }[];
  duration_ms: number;
  external_urls: { spotify: string };
  album: { name: string; images: { url: string }[] };
}

interface AudioFeatures {
  id: string;
  key: number;
  mode: number;
  tempo: number;
}

// ---------------------------------------------------------------------------
// POST /api/import/spotify/search
// ---------------------------------------------------------------------------

export async function spotifySearch(request: AuthRequest, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const q   = url.searchParams.get('q')?.trim();
  if (!q) return error(400, { error: 'q is required' });

  const token = await getSpotifyToken(env);

  // Search tracks
  const searchRes = await fetch(
    `https://api.spotify.com/v1/search?q=${encodeURIComponent(q)}&type=track&limit=10`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!searchRes.ok) return error(502, { error: 'Spotify search failed' });
  const searchData = await searchRes.json<{ tracks: { items: SpotifyTrack[] } }>();
  const tracks = searchData.tracks?.items ?? [];

  if (!tracks.length) return json({ results: [] });

  // Batch fetch audio features
  const ids = tracks.map(t => t.id).join(',');
  const featRes = await fetch(
    `https://api.spotify.com/v1/audio-features?ids=${ids}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  const featData = featRes.ok
    ? await featRes.json<{ audio_features: (AudioFeatures | null)[] }>()
    : { audio_features: [] };

  const featMap: Record<string, AudioFeatures> = {};
  for (const f of featData.audio_features ?? []) {
    if (f) featMap[f.id] = f;
  }

  const results = tracks.map(t => {
    const feat = featMap[t.id];
    return {
      spotify_id:  t.id,
      title:       t.name,
      artist:      t.artists[0]?.name ?? 'Unknown',
      key:         feat ? spotifyKey(feat.key, feat.mode) : null,
      bpm:         feat ? Math.round(feat.tempo) : null,
      spotify_url: t.external_urls.spotify,
      image_url:   t.album.images[1]?.url ?? t.album.images[0]?.url ?? null,
    };
  });

  return json({ results });
}

// ---------------------------------------------------------------------------
// POST /api/import/spotify/confirm
// ---------------------------------------------------------------------------
// Takes selected tracks from search results and bulk-imports them:
//   1. INSERT OR IGNORE into songs (global pool, always public)
//   2. INSERT OR IGNORE into user_library with is_public = 1

export async function spotifyConfirm(request: AuthRequest, env: Env): Promise<Response> {
  const body = await request.json<{
    tracks?: {
      spotify_id: string;
      title: string;
      artist: string;
      key?: string | null;
      bpm?: number | null;
      spotify_url?: string | null;
    }[];
  }>();

  const tracks = (body.tracks ?? []).filter(t => t.title?.trim() && t.artist?.trim());
  if (!tracks.length) return json({ imported: 0, skipped: 0 });

  const userId = request.user!.id;
  let imported = 0;
  let skipped  = 0;

  for (const t of tracks) {
    const title  = t.title.trim();
    const artist = t.artist.trim();
    const url    = t.spotify_url || chordsUrl(title, artist);

    // Upsert into global songs pool
    const songId = crypto.randomUUID();
    await env.DB.prepare(
      `INSERT OR IGNORE INTO songs
         (id, title, artist, default_key, default_bpm, chords_url, genre, era, tags, added_by)
       VALUES (?, ?, ?, ?, ?, ?, '[]', NULL, '[]', ?)`,
    ).bind(songId, title, artist, t.key ?? null, t.bpm ?? null, url, userId).run();

    // Get canonical song id (may already exist)
    const existing = await env.DB.prepare(
      `SELECT id FROM songs WHERE title = ? AND artist = ?`,
    ).bind(title, artist).first<{ id: string }>();

    const canonicalId = existing?.id ?? songId;

    // Add to user library with is_public = 1 (Spotify imports are public)
    const libResult = await env.DB.prepare(
      `INSERT OR IGNORE INTO user_library
         (user_id, song_id, title, artist, key, bpm, chords_url, genre, era, tags, notes, is_public)
       VALUES (?, ?, ?, ?, ?, ?, ?, '[]', NULL, '[]', NULL, 1)`,
    ).bind(userId, canonicalId, title, artist, t.key ?? null, t.bpm ?? null, url).run();

    if ((libResult.meta as { changes: number }).changes > 0) imported++;
    else skipped++;
  }

  return json({ imported, skipped });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function chordsUrl(title: string, artist: string): string {
  return `https://www.google.com/search?q=${encodeURIComponent(`${title} ${artist} chords site:ultimate-guitar.com`)}`;
}

interface SongInput {
  title: string;
  artist: string;
  key?: string | null;
  bpm?: number | null;
  chords_url?: string | null;
  notes?: string | null;
}

// ---------------------------------------------------------------------------
// POST /api/import/csv
// ---------------------------------------------------------------------------
//
// Accepts { songs: [...] } and bulk-imports them:
//   1. INSERT OR IGNORE into songs (skips exact title+artist dupes)
//   2. SELECT the canonical ID for each song
//   3. INSERT OR IGNORE into user_library (skips if already in library)
//
// Returns { imported: number, skipped: number }
//   imported = songs added to user's library this run
//   skipped  = songs already in user's library (no-op)
//
// D1 batch() limit is 100 statements. We use 3 statements per song, so
// we process in chunks of 30 to stay safe under the limit.
// ---------------------------------------------------------------------------

export async function importCsv(request: AuthRequest, env: Env): Promise<Response> {
  const body = await request.json<{ songs?: SongInput[] }>();
  const songs = (body.songs ?? []).filter(s => s.title?.trim() && s.artist?.trim());

  if (!songs.length) return json({ imported: 0, skipped: 0 });

  const userId = request.user!.id;
  const CHUNK  = 30; // 30 songs × 3 stmt batches = 90 stmts, safely under D1 limit

  let imported = 0;
  let skipped  = 0;

  for (let i = 0; i < songs.length; i += CHUNK) {
    const chunk = songs.slice(i, i + CHUNK);

    // ── Step 1: Upsert songs into global pool ──────────────────────────────
    // INSERT OR IGNORE skips duplicates based on UNIQUE(title, artist).
    await env.DB.batch(
      chunk.map(s => {
        const id  = crypto.randomUUID();
        const url = s.chords_url?.startsWith('http') ? s.chords_url : chordsUrl(s.title, s.artist);
        return env.DB.prepare(
          `INSERT OR IGNORE INTO songs
             (id, title, artist, default_key, default_bpm, chords_url, genre, era, tags, added_by)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        ).bind(id, s.title.trim(), s.artist.trim(), s.key ?? null, s.bpm ?? null, url, '[]', null, '[]', userId);
      }),
    );

    // ── Step 2: Fetch canonical IDs ────────────────────────────────────────
    const idResults = await env.DB.batch(
      chunk.map(s =>
        env.DB.prepare(`SELECT id FROM songs WHERE title = ? AND artist = ?`)
          .bind(s.title.trim(), s.artist.trim()),
      ),
    );

    // ── Step 3: Upsert into user_library ───────────────────────────────────
    // INSERT OR IGNORE skips if (user_id, song_id) already exists.
    const libraryStmts = chunk
      .map((s, idx) => {
        const row = idResults[idx]?.results?.[0] as { id: string } | undefined;
        if (!row?.id) return null;
        const url = s.chords_url?.startsWith('http') ? s.chords_url : chordsUrl(s.title, s.artist);
        return env.DB.prepare(
          `INSERT OR IGNORE INTO user_library
             (user_id, song_id, title, artist, key, bpm, chords_url, genre, era, tags, notes)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        ).bind(
          userId, row.id,
          s.title.trim(), s.artist.trim(),
          s.key ?? null, s.bpm ?? null,
          url, '[]', null, '[]',
          s.notes ?? null,
        );
      })
      .filter((s): s is NonNullable<typeof s> => s !== null);

    if (libraryStmts.length) {
      const libResults = await env.DB.batch(libraryStmts);
      for (const r of libResults) {
        if ((r.meta as { changes: number }).changes > 0) imported++;
        else skipped++;
      }
    }
  }

  return json({ imported, skipped });
}
