-- 0011_ceremony_role.sql — split the ceremony moment.
-- wedding_moment stays as is. ceremony_role says where in the ceremony a song fits:
--   prelude      guests arriving, before the walk
--   processional the walk down the aisle (slow, steady)
--   recessional  the walk out (bright, upbeat)
-- Used by billy-reach follow-up 1 ("your ceremony in 3 songs").
-- Apply: npx wrangler d1 execute billy-fm-db --remote --file=./migrations/0011_ceremony_role.sql

ALTER TABLE songs ADD COLUMN ceremony_role TEXT DEFAULT NULL;

-- prelude
UPDATE songs SET ceremony_role = 'prelude' WHERE id IN (
  'f9bbba73-a1ac-401a-a3cf-01a6e8c1bf04', -- A Case of You / Joni Mitchell
  'd7e3b363-4906-4831-9531-05d8c1778b71', -- All I Want / Joni Mitchell
  '2baf9137-dde7-49ca-b548-b35ad196687e'  -- Dream a Little Dream of Me / The Mamas and the Papas
);

-- processional
UPDATE songs SET ceremony_role = 'processional' WHERE id IN (
  '9248a4c0-035b-48bf-93ec-7c0c99dc67b0', -- Can't Help Falling in Love / Elvis Presley
  'eab83080-8da5-4ff5-b6d3-f7d517350274', -- Birds of a Feather / Billie Eilish
  '0bebe3e4-5b0a-480c-a8da-2b76170f042d', -- Songbird / Fleetwood Mac
  'dabc071d-e19e-477e-b18b-076bd4ed76c3', -- God Only Knows / Beach Boys
  'e9fa8ccf-88b0-43ba-b1c4-875d1da8306b', -- Your Song / Elton John
  '34cb5173-e903-43e4-a620-f1b00cb6920a', -- Harvest Moon / Neil Young
  '4b0f5be5-4637-43ca-95eb-c97a0bed0954', -- Into the Mystic / Van Morrison
  'd3b06fd0-b661-4bf3-8863-e98a99284767', -- Growing Old With You / Restless Road
  'a975339f-1110-4db8-bd08-3e93b028390d', -- The Way You Look Tonight / Frank Sinatra
  '48212c26-1c24-4990-9b65-fc363f3abc00', -- Yellow / Coldplay
  '72206510-b793-49e4-bc9f-a09b8db49353'  -- In My Life / The Beatles
);

-- recessional
UPDATE songs SET ceremony_role = 'recessional' WHERE id IN (
  '3675c9aa-800c-4cd2-8eff-fe8539a8cb2c', -- I Say a Little Prayer / Aretha Franklin
  '9dc071e3-f354-4cba-81e5-1dc82363d976', -- Beyond / Leon Bridges
  '2d1775f1-15f7-4509-b93d-caf46e5dbba0', -- Real Love Baby / Father John Misty
  '8b49dad0-c53a-4d22-a703-8eaa7e5fcdb1', -- Moondance / Van Morrison
  'dbf8dac7-f9f9-4ced-ad09-d9acf0710dd6', -- Sway / Michael Buble
  '5679bffe-317b-4b45-9197-596cbfd1b91e'  -- What a Wonderful World / Louis Armstrong
);
