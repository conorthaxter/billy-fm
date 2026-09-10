ALTER TABLE songs ADD COLUMN wedding_rank INTEGER DEFAULT NULL;
ALTER TABLE songs ADD COLUMN wedding_moment TEXT DEFAULT NULL;
CREATE INDEX IF NOT EXISTS idx_songs_wedding_rank ON songs(wedding_rank);
