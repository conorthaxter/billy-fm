CREATE TABLE IF NOT EXISTS off_list_requests (
  id TEXT PRIMARY KEY,
  playlist_id TEXT REFERENCES playlists(id) ON DELETE CASCADE,
  request_text TEXT NOT NULL,
  requester_note TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_off_list_playlist ON off_list_requests(playlist_id);

CREATE TABLE IF NOT EXISTS set_submissions (
  id TEXT PRIMARY KEY,
  playlist_id TEXT REFERENCES playlists(id) ON DELETE CASCADE,
  snapshot_json TEXT NOT NULL,
  submitted_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_submissions_playlist ON set_submissions(playlist_id);

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT DEFAULT '',
  metadata TEXT DEFAULT '{}',
  is_read INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(user_id, is_read);
