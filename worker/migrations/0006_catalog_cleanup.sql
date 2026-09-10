-- Catalog cleanup: artist/title spelling corrections, duplicate merges, key
-- normalization. Does not touch wedding_rank/wedding_moment except to carry
-- a tier forward across a row merge (see 1c below) — never to reassign one.
-- All statements are idempotent (safe to re-run): UPDATEs match on the old
-- value, so a second run finds no rows and is a no-op; DELETEs are keyed by
-- fixed ids.

-- ---------------------------------------------------------------------------
-- 1a. Artist spelling corrections
-- ---------------------------------------------------------------------------
UPDATE songs SET artist = 'Billy Joel' WHERE artist = 'Billie Joel';
UPDATE songs SET artist = 'Billie Eilish' WHERE artist = 'Billie Elish';
UPDATE songs SET artist = 'Alanis Morissette' WHERE artist = 'Alanis Morisette';
UPDATE songs SET artist = 'Whitney Houston' WHERE artist = 'Whitney Houson';
UPDATE songs SET artist = 'Sophie Ellis-Bextor' WHERE artist = 'Sophie Ellis Baxtor';
UPDATE songs SET artist = 'Tracy Chapman' WHERE artist = 'Tracey Chapman';
UPDATE songs SET artist = 'Harry Nilsson' WHERE artist = 'Harry Nilson';
UPDATE songs SET artist = 'Joni Mitchell' WHERE artist = 'Joni MItchell';
UPDATE songs SET artist = 'Louis Armstrong' WHERE artist = 'Louie Armstrong';
UPDATE songs SET artist = 'Marvin Gaye, Tammi Terrell' WHERE artist = 'Marvin Gaye, Tammi Terelle';
UPDATE songs SET artist = 'Khalid, Normani' WHERE artist = 'Khaled, Normani';
UPDATE songs SET artist = 'Rodgers & Hammerstein' WHERE artist = 'Rogers & Hammerstein';
UPDATE songs SET artist = 'a-ha' WHERE artist = 'A Ha';
UPDATE songs SET artist = 'blink-182' WHERE artist = 'Blink 182';
UPDATE songs SET artist = 'Plain White T''s' WHERE artist = 'Plain White Ts';
UPDATE songs SET artist = '*NSYNC' WHERE artist = 'N Sync';
UPDATE songs SET artist = 'M.I.A.' WHERE artist = 'MIA';
UPDATE songs SET artist = 'SZA' WHERE artist = 'Sza';
UPDATE songs SET artist = 'Conor Thaxter' WHERE artist = 'Conor James';

-- Consolidate duplicate artist spellings to one canonical string.
-- Verified against production: no title collides between the two spellings
-- in either case, so these renames cannot violate UNIQUE(title, artist).
UPDATE songs SET artist = 'Elvis Presley' WHERE artist = 'Elvis';
UPDATE songs SET artist = 'The Beatles' WHERE artist = 'Beatles';

-- ---------------------------------------------------------------------------
-- 1b. Title corrections
-- ---------------------------------------------------------------------------
UPDATE songs SET title = '...Baby One More Time' WHERE title = 'Hit Me Baby, One More Time';
UPDATE songs SET title = 'I Say a Little Prayer' WHERE title = 'Say a Little Prayer';
UPDATE songs SET title = 'Don''t Stop Believin''' WHERE title = 'Don''t Stop Believing';
UPDATE songs SET title = 'Livin'' on a Prayer' WHERE title = 'Living on a Prayer';
UPDATE songs SET title = 'Stayin'' Alive' WHERE title = 'Stayin Alive';
UPDATE songs SET title = 'Cruisin''' WHERE title = 'Cruisin';
UPDATE songs SET title = 'Everybody''s Talkin''' WHERE title = 'Everybody''s Talkin';
UPDATE songs SET title = 'Thinkin Bout You' WHERE title = 'Thinkin Bout U';
UPDATE songs SET title = 'You Oughta Know' WHERE title = 'You Oughtta Know';
UPDATE songs SET title = 'Late Night Talking' WHERE title = 'Late Night Talkin';
UPDATE songs SET title = '(Sittin'' On) The Dock of the Bay' WHERE title = 'Sitting on the Dock of the Bay';
UPDATE songs SET title = 'Good Riddance (Time of Your Life)' WHERE title = 'Time of Your Life';
UPDATE songs SET title = 'Wake Me Up When September Ends' WHERE title = 'Wake me Up When September Ends';
UPDATE songs SET title = 'Bohemian Rhapsody' WHERE title = 'Bohemian Rhapsody - Remastered 2011';

-- ---------------------------------------------------------------------------
-- 1c. Structural cleanup — duplicate merges
-- ---------------------------------------------------------------------------

-- Merge "Thousand Miles" (a7a5709c) into canonical "A Thousand Miles" (d31a0bf1).
-- Every user_library row on the duplicate belongs to a user who already has
-- the canonical song too, so those personal-library rows are dropped rather
-- than repointed (repointing would collide with user_library's
-- (user_id, song_id) primary key). Wedding tags are identical on both rows
-- (300 / party), so nothing is lost.
DELETE FROM user_library WHERE song_id = 'a7a5709c-1b21-4774-8ba0-5e9f0ac97681';
DELETE FROM songs WHERE id = 'a7a5709c-1b21-4774-8ba0-5e9f0ac97681';

-- Merge "On The Street Where You Live": keep Lerner & Loewe (11dca812),
-- drop My Fair Lady Cast (eb30ca4f), key = D on the survivor.
--
-- The duplicate carries wedding_rank=300/wedding_moment='dinner' while the
-- survivor has neither — carry the tier forward onto the survivor so the
-- merge doesn't silently drop it from the wedding set list.
UPDATE songs
   SET wedding_rank = 300, wedding_moment = 'dinner'
 WHERE id = '11dca812-0e77-4d1b-b6cd-82de899db3fa' AND wedding_rank IS NULL;

UPDATE songs SET default_key = 'D' WHERE id = '11dca812-0e77-4d1b-b6cd-82de899db3fa';

-- Two of the three users with the duplicate in their library already also
-- have the canonical row — drop the duplicate copy for them.
DELETE FROM user_library
 WHERE song_id = 'eb30ca4f-f74d-44e7-9f60-2731443e5141'
   AND user_id IN ('daf2c585-45a3-4ff3-9c9f-2141b38f39c1', 'dfba6567-31e0-43ef-bfc2-39554157aa5c');

-- The remaining user only has the duplicate — repoint to the canonical song
-- and correct their snapshotted artist/key so their public songbook reflects
-- the fix instead of continuing to show "My Fair Lady Cast".
UPDATE user_library
   SET song_id = '11dca812-0e77-4d1b-b6cd-82de899db3fa', artist = 'Lerner & Loewe', key = 'D'
 WHERE song_id = 'eb30ca4f-f74d-44e7-9f60-2731443e5141';

-- One playlist references the duplicate; repoint it (no collision — the
-- canonical song isn't already on that playlist).
UPDATE playlist_songs
   SET song_id = '11dca812-0e77-4d1b-b6cd-82de899db3fa'
 WHERE song_id = 'eb30ca4f-f74d-44e7-9f60-2731443e5141';

DELETE FROM songs WHERE id = 'eb30ca4f-f74d-44e7-9f60-2731443e5141';

-- ---------------------------------------------------------------------------
-- 1c. Key normalization
-- ---------------------------------------------------------------------------
UPDATE songs SET default_key = 'C'   WHERE default_key = 'Cmaj';
UPDATE songs SET default_key = 'F'   WHERE default_key = 'FM';
UPDATE songs SET default_key = 'Ebm' WHERE default_key = 'Ebmin';
UPDATE songs SET default_key = NULL  WHERE default_key = 'x';

-- ---------------------------------------------------------------------------
-- 1c. Explicit unique index on (title, artist)
-- Note: production already enforces this via the table-level
-- UNIQUE(title, artist) constraint from the original schema (visible as
-- sqlite_autoindex_songs_2). This adds a second, explicitly-named index per
-- spec; it's redundant with the existing constraint but harmless.
-- ---------------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS idx_songs_title_artist_unique ON songs(title, artist);
