-- USERS
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  google_id TEXT UNIQUE,
  avatar_url TEXT,
  is_performer BOOLEAN DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- GLOBAL SONG POOL (marketplace)
CREATE TABLE IF NOT EXISTS songs (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  artist TEXT NOT NULL,
  default_key TEXT,
  default_bpm INTEGER,
  chords_url TEXT,
  genre TEXT,
  era TEXT,
  tags TEXT,
  added_by TEXT REFERENCES users(id),
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(title, artist)
);

-- USER'S PERSONAL LIBRARY (snapshot-on-add)
-- All marketplace fields are copied at add time; user edits are independent
CREATE TABLE IF NOT EXISTS user_library (
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  song_id TEXT REFERENCES songs(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  artist TEXT NOT NULL,
  key TEXT,
  bpm INTEGER,
  chords_url TEXT,
  genre TEXT,
  era TEXT,
  tags TEXT,
  notes TEXT,
  is_public BOOLEAN DEFAULT 0,
  added_at TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, song_id)
);

-- PLAYLISTS
CREATE TABLE IF NOT EXISTS playlists (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  notes TEXT,
  is_public BOOLEAN DEFAULT 0,
  playlist_type TEXT DEFAULT 'set',
  event_date TEXT,
  client_name TEXT,
  share_slug TEXT UNIQUE,
  -- Tip / request-queue settings (used by audience request queue feature)
  tip_enabled BOOLEAN DEFAULT 0,
  tip_venmo TEXT,
  tip_message TEXT,
  tip_minimum REAL,
  is_favorited BOOLEAN DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- PLAYLIST SONGS (ordered)
CREATE TABLE IF NOT EXISTS playlist_songs (
  playlist_id TEXT REFERENCES playlists(id) ON DELETE CASCADE,
  song_id TEXT REFERENCES songs(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  notes TEXT,
  is_played BOOLEAN DEFAULT 0,
  requested_by TEXT,
  PRIMARY KEY (playlist_id, song_id)
);

-- SESSIONS (live performance tracking)
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  notes TEXT,
  started_at TEXT DEFAULT (datetime('now')),
  ended_at TEXT
);

-- PLAY HISTORY
CREATE TABLE IF NOT EXISTS play_history (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  song_id TEXT REFERENCES songs(id) ON DELETE CASCADE,
  session_id TEXT REFERENCES sessions(id),
  played_at TEXT DEFAULT (datetime('now'))
);

-- AUDIENCE REQUESTS
CREATE TABLE IF NOT EXISTS audience_requests (
  id TEXT PRIMARY KEY,
  playlist_id TEXT REFERENCES playlists(id) ON DELETE CASCADE,
  song_id TEXT,
  song_title TEXT,
  artist_name TEXT,
  requester_name TEXT,
  status TEXT DEFAULT 'pending',
  created_at TEXT DEFAULT (datetime('now'))
);

-- AUTH SESSIONS (cookie-based login sessions — separate from live performance sessions)
CREATE TABLE IF NOT EXISTS auth_sessions (
  id TEXT PRIMARY KEY,             -- random UUID used as the session cookie value
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL
);

-- SONG TRANSITIONS (performer-defined links between songs)
CREATE TABLE IF NOT EXISTS song_transitions (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  from_song_id TEXT NOT NULL,
  to_song_id TEXT NOT NULL,
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(user_id, from_song_id, to_song_id)
);

-- INDEXES
CREATE INDEX IF NOT EXISTS idx_user_library_user ON user_library(user_id);
CREATE INDEX IF NOT EXISTS idx_songs_title_artist ON songs(title, artist);
CREATE INDEX IF NOT EXISTS idx_playlists_user ON playlists(user_id);
CREATE INDEX IF NOT EXISTS idx_playlists_slug ON playlists(share_slug);
CREATE INDEX IF NOT EXISTS idx_playlist_songs_playlist ON playlist_songs(playlist_id);
CREATE INDEX IF NOT EXISTS idx_play_history_user ON play_history(user_id);
CREATE INDEX IF NOT EXISTS idx_audience_requests_playlist ON audience_requests(playlist_id);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_user ON auth_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_transitions_from ON song_transitions(user_id, from_song_id);
CREATE INDEX IF NOT EXISTS idx_transitions_to   ON song_transitions(user_id, to_song_id);
