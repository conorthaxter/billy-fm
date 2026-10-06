ALTER TABLE songs ADD COLUMN chord_chart TEXT;
ALTER TABLE user_library ADD COLUMN chord_chart TEXT;
ALTER TABLE user_library ADD COLUMN transpose_offset INTEGER NOT NULL DEFAULT 0;
ALTER TABLE songs DROP COLUMN chords_url;
ALTER TABLE user_library DROP COLUMN chords_url;
ALTER TABLE songs DROP COLUMN chord_chart_url;
