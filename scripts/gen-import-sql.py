#!/usr/bin/env python3
"""Generate SQL to import BELMONT VILLAGE SET.xlsx into billy-fm D1."""

import openpyxl
import uuid
import urllib.parse
import os

XLSX_PATH = os.path.join(os.path.dirname(__file__), '../reference/BELMONT VILLAGE SET.xlsx')
OUT_PATH  = os.path.join(os.path.dirname(__file__), 'import-belmont.sql')

CONOR_ID = '10ad75af-e184-4935-939c-441fbc07fc58'
PLAYLIST_TITLE = 'Nursing Home'
PLAYLIST_ID    = str(uuid.uuid4())
PLAYLIST_SLUG  = 'nursing-home-' + PLAYLIST_ID[:8]

def esc(v):
    """Escape a value for SQL single-quoted string, or NULL."""
    if v is None:
        return 'NULL'
    return "'" + str(v).replace("'", "''") + "'"

def chord_url(title, artist, existing):
    if existing:
        s = str(existing).strip()
        if s:
            return s
    q = urllib.parse.quote(f"{title} {artist} chords")
    return f"https://www.google.com/search?q={q}"

wb = openpyxl.load_workbook(XLSX_PATH)
ws = wb.active

rows = list(ws.iter_rows(values_only=True))
data_rows = rows[1:]  # skip header

songs = []
for row in data_rows:
    selected = row[0]
    title    = row[1]
    artist   = row[2]
    key      = row[3]
    chords   = row[4]
    notes1   = row[5]
    notes2   = row[6]

    if not title or not artist:
        continue

    title  = str(title).strip()
    artist = str(artist).strip()
    key    = str(key).strip() if key else None
    notes_parts = [str(n).strip() for n in [notes1, notes2] if n and str(n).strip()]
    notes  = ' | '.join(notes_parts) if notes_parts else None
    url    = chord_url(title, artist, chords)
    sid    = str(uuid.uuid4())

    songs.append({
        'id':       sid,
        'title':    title,
        'artist':   artist,
        'key':      key,
        'url':      url,
        'notes':    notes,
        'selected': bool(selected),
    })

playlist_songs = [s for s in songs if s['selected']]
print(f"Songs to import: {len(songs)}")
print(f"Nursing Home playlist songs: {len(playlist_songs)}")

lines = []

# 1. Insert into songs table using our pre-generated UUIDs.
#    ON CONFLICT DO NOTHING — if (title, artist) already exists, skip.
for s in songs:
    lines.append(
        f"INSERT OR IGNORE INTO songs (id, title, artist, default_key, chords_url, genre, era, tags, added_by) "
        f"VALUES ({esc(s['id'])}, {esc(s['title'])}, {esc(s['artist'])}, {esc(s['key'])}, "
        f"{esc(s['url'])}, '[]', NULL, '[]', {esc(CONOR_ID)});"
    )

lines.append('')

# 2. Insert into user_library using a SELECT subquery so we always get the
#    actual song ID (whether it was just inserted or already existed).
for s in songs:
    lines.append(
        f"INSERT OR IGNORE INTO user_library (user_id, song_id, title, artist, key, chords_url, genre, era, tags, notes, is_public) "
        f"SELECT {esc(CONOR_ID)}, id, title, artist, default_key, chords_url, genre, era, tags, {esc(s['notes'])}, 0 "
        f"FROM songs WHERE title = {esc(s['title'])} AND artist = {esc(s['artist'])};"
    )

lines.append('')

# 3. Create the Nursing Home playlist.
lines.append(
    f"INSERT OR IGNORE INTO playlists (id, user_id, title, playlist_type, share_slug) "
    f"VALUES ({esc(PLAYLIST_ID)}, {esc(CONOR_ID)}, {esc(PLAYLIST_TITLE)}, 'set', {esc(PLAYLIST_SLUG)});"
)
lines.append('')

# 4. Insert playlist_songs using SELECT subquery for the same reason.
for pos, s in enumerate(playlist_songs):
    lines.append(
        f"INSERT OR IGNORE INTO playlist_songs (playlist_id, song_id, position) "
        f"SELECT {esc(PLAYLIST_ID)}, id, {pos} FROM songs WHERE title = {esc(s['title'])} AND artist = {esc(s['artist'])};"
    )

sql = '\n'.join(lines)
with open(OUT_PATH, 'w') as f:
    f.write(sql)

print(f"\nSQL written to: {OUT_PATH}")
print(f"Playlist ID:   {PLAYLIST_ID}")
print(f"Playlist slug: {PLAYLIST_SLUG}")
