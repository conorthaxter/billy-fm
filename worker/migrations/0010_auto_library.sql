-- Every catalogue song is public and in the owner's library.
-- Backfill: songs with no user_library row for the owner.
INSERT OR IGNORE INTO user_library
  (user_id, song_id, title, artist, key, bpm, genre, era, tags, notes, is_public)
SELECT '10ad75af-e184-4935-939c-441fbc07fc58', id, title, artist, default_key, default_bpm, genre, era, tags, NULL, 1
FROM songs;

-- Going forward: any new songs row gets the same library row.
CREATE TRIGGER IF NOT EXISTS songs_auto_library
AFTER INSERT ON songs
BEGIN
  INSERT OR IGNORE INTO user_library
    (user_id, song_id, title, artist, key, bpm, genre, era, tags, notes, is_public)
  VALUES
    ('10ad75af-e184-4935-939c-441fbc07fc58', NEW.id, NEW.title, NEW.artist, NEW.default_key, NEW.default_bpm, NEW.genre, NEW.era, NEW.tags, NULL, 1);
END;
