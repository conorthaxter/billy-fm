# BILLY fm — Ship-Ready Action Plan

Read ./billy-fm-build-plan.md and ./billy-fm-continuation-plan.md for context.
**Delete this file from the project once ALL tasks are complete.**

---

## PROMPT 1 — Import Spreadsheet + Create Playlist

The file `reference/BELMONT_VILLAGE_SET.xlsx` contains 1,129 songs that need
to be in the user's library AND the public songbook. 46 of those songs are
marked TRUE in column A — those become a playlist called "Nursing Home".

```
1. Read the file reference/BELMONT_VILLAGE_SET.xlsx (install openpyxl if needed).
   Parse all rows. Column mapping:
   - A: selected (TRUE/FALSE) — used for playlist membership
   - B: title (SONG)
   - C: artist (ARTIST)
   - D: key (KEY) — may be null
   - E: chords URL (CHORDS) — may be null
   - F: notes1 (NOTES) — may be null
   - G: notes2 (NOTES) — may be null

2. Write a one-time migration script (worker/scripts/import-spreadsheet.ts or .js)
   that runs against the local D1 database. For each song row:
   a) INSERT into songs table (marketplace/public songbook):
      id = generated UUID
      title, artist, default_key = column D, chords_url = column E
      If no chords_url, auto-generate UG search URL
      genre, era, tags = empty/null for now (data pass fills these later)
      added_by = Conor's user ID (query users table for his email)
      ON CONFLICT (title, artist) DO NOTHING (skip duplicates)
   b) INSERT into user_library (Conor's personal library):
      Snapshot all fields from the songs row just created
      notes = combine columns F and G if present
      ON CONFLICT DO NOTHING (skip if already in library)
   c) If column A is TRUE, mark this song for the playlist

3. After all songs are imported, create a playlist:
   INSERT into playlists: title = "Nursing Home", user_id = Conor's ID,
   playlist_type = "set", generate share_slug
   INSERT into playlist_songs for each of the 46 TRUE songs,
   with position = order they appeared in the spreadsheet

4. Provide a run command:
   cd worker && npx tsx scripts/import-spreadsheet.ts
   (or use wrangler d1 execute if it's raw SQL)

5. After confirming it works, also run against --remote for production:
   wrangler d1 execute billy-fm-db --remote --file=scripts/import.sql

6. The user's personal library keys MUST remain exactly as they are in
   column D. Do not overwrite these during any data enrichment step.
```

---

## PROMPT 2 — UX Fixes for Ship Readiness

```
Fix these UX issues to prepare for sharing with friends:

1. SAVE BEFORE LEAVING: Before navigating away from My Songbook (or
   closing the tab), if there are songs in the queue or a now-playing
   song that hasn't been saved as a playlist, show a browser confirm
   dialog: "You have an unsaved set. Save as playlist before leaving?"
   Use the beforeunload event for tab close, and a navigation prompt
   (react-router's useBlocker or similar) for in-app navigation.

2. PUBLIC SONGBOOK SPACING: The Public Songbook page tiles should have
   the SAME size and spacing as the My Songbook tiles. Use the same
   grid CSS (grid-template-columns, gap, tile dimensions). Keep all
   existing info and components on the public songbook page. The
   "In library" indicator should just be a small checkmark (✓) in the
   top-right corner of the tile, not a full badge or button.

3. MOST PLAYED / LEAST PLAYED SORT: These sorts are currently showing
   alphabetical order. Fix: a song's play count should ONLY count
   times it was saved in a playlist (not just played in now-playing).
   Query: COUNT of playlist_songs rows where song_id = this song AND
   the playlist was created by this user. This is the "times played
   at gigs" count. Update the sort logic to use this count.

4. REMOVE "THEME PROXIMITY" from the sort dropdown. Delete it entirely.

5. KEYBOARD CURSOR FOLLOWS MOUSE: After the mouse stops moving for
   ~1.5 seconds, the keyboard grid cursor (glow highlight) should snap
   to whichever tile the mouse is hovering over. This was specified
   previously but may have been lost. Implement: on mousemove, update
   a hovered-tile tracker. On the 1.5s debounce timeout, set the
   keyboard cursor position to match the hovered tile. When mouse
   moves again, the glow cursor fades out (mouse mode). When mouse
   stops, it fades back in at the current mouse position.

6. HELP SCREEN HOTKEYS: The ? modal (how-to guide) must list ALL
   hotkeys, including:
   N → select now playing song
   Q → add to queue
   TAB → play next from queue
   SPACE → open chords
   K/B/T/E/A/G → toggle filters
   DEL → clear selection
   ↑↓←→ → navigate grid
   ENTER → select / play
   / → search
   ESC → dismiss
   ⌘+/- → zoom
   Any other hotkeys that exist in the app.

7. SONGBOOK PANEL IN RIGHT SECTION: There's apparently a "Songbook"
   panel appearing in the right sidebar that opens the songbook when
   clicked. This shouldn't be there — the right panel should only
   contain: Previously Played, Now Playing, Current Set (session),
   Queue. Remove any "Songbook" panel/button from the right sidebar.

8. DRAG FROM PLAYLISTS: Songs in the playlist detail view should be
   draggable — user should be able to drag a song from a playlist
   and drop it into the queue or now playing on the main songbook page.

9. DARK VS BLACK COLOR MODES: Dark (#111111 / #0e0b1e) and Black
   (#000000) backgrounds should look noticeably different. Verify the
   CSS variables are actually different values. Dark should be a deep
   midnight/charcoal, Black should be pure OLED black. Check that
   text colors, borders, and panel backgrounds also differ between
   the two modes.

10. FIRST LOGIN — IMPORT DEFAULT SONGBOOK: When a user signs in for
    the first time and their library is empty (0 songs), show a prompt
    WITHIN the library area (not a modal — inline, where the empty
    grid would be): "Import default songbook?" with Yes / No buttons.
    If Yes: copy ALL songs from the public songbook (songs table) into
    the user's user_library using the snapshot-on-add pattern. Show
    progress. If No: show empty state with "Add your first song" prompt.

11. PUBLIC SONGBOOK MULTI-SELECT: In the Public Songbook, users should
    be able to Shift+Click to select multiple songs, then click an
    "Add X to Library" button that imports all selected songs at once.
    Each selected song gets a visible highlight/checkmark. The bulk
    import uses the same snapshot-on-add logic as single imports.

12. PLAY FREQUENCY FILTER DEFINITIONS:
    - "Played recently" = song appears in a saved playlist dated within
      the last 30 days
    - "Not played recently" = song's most recent playlist appearance is
      31+ days ago, OR it has never been in a playlist
    Update the filter logic to use this definition.
```

---

## PROMPT 3 — Data Enrichment Pass

```
Enrich ALL songs in the database with accurate metadata from external
sources. This is a one-time script that runs against D1.

IMPORTANT: DO NOT change the key field in user_library (Conor's personal
keys). Only update the songs table (public songbook) default_key field
where it's currently NULL or missing.

Create worker/scripts/enrich-songs.ts:

1. SPOTIFY SETUP:
   Check if Spotify credentials are configured. Look for SPOTIFY_CLIENT_ID
   and SPOTIFY_CLIENT_SECRET in .dev.vars or wrangler.toml.
   If not present, prompt the user to add them and exit.
   Use Client Credentials flow to get an access token:
   POST https://accounts.spotify.com/api/token
   grant_type=client_credentials

2. FOR EACH SONG IN THE songs TABLE:
   a) Search Spotify: GET https://api.spotify.com/v1/search?q={title}+{artist}&type=track&limit=1
   b) If found, get the track ID, then fetch audio features:
      GET https://api.spotify.com/v1/audio-features/{trackId}
      (Note: this endpoint may be deprecated for newer apps. If it
      returns 403, fall back to the track object's data only.)
   c) Extract and update:
      - BPM: audio_features.tempo (round to integer)
      - KEY: audio_features.key (0-11) + audio_features.mode (0=minor, 1=major)
        Map: 0=C, 1=C#, 2=D, 3=D#, 4=E, 5=F, 6=F#, 7=G, 8=G#, 9=A, 10=A#, 11=B
        If mode=0, append 'm' (e.g. "Am", "F#m")
        ONLY update default_key in songs table if it's currently NULL
      - ERA: derive from the track's album release_date year:
        <1960: "50s", 1960-69: "60s", 1970-79: "70s", etc.
      - GENRE: from the artist object — fetch artist details:
        GET https://api.spotify.com/v1/artists/{artistId}
        Use artist.genres array. Store as JSON string.
        Map Spotify's genre tags to cleaner categories if possible.

3. THEME TAGS FROM LYRICS:
   For theme tags derived from lyrics, use the existing THEME_KW
   classification logic from the frontend (utils/enrichment.js) which
   classifies based on title/artist text. Run this for all songs.
   If you can find a lyrics API (like lyrics.ovh or similar free API),
   fetch actual lyrics and classify based on those for better accuracy.
   Store as JSON array in tags field.

4. RATE LIMITING: Spotify API has rate limits. Add a delay between
   requests (100-200ms). Process in batches of 10-20. Log progress:
   "Enriched 50/1129..."

5. UPDATE songs TABLE (marketplace):
   UPDATE songs SET default_bpm = ?, era = ?, genre = ?, tags = ?
   WHERE id = ? AND (default_bpm IS NULL OR default_bpm = 0)
   (Only fill in missing data, don't overwrite existing values)

   For default_key specifically:
   UPDATE songs SET default_key = ? WHERE id = ? AND default_key IS NULL

6. DO NOT TOUCH user_library. Conor's personal keys, notes, and
   overrides stay exactly as they are.

7. After the script runs, log a summary:
   "Enriched X songs. BPM added to Y. Key added to Z. Era added to W."

Run command: cd worker && npx tsx scripts/enrich-songs.ts
```

---

## PROMPT 4 — Full Audit & Debug

```
Run a comprehensive audit of the entire app for ship readiness.
Fix every issue you find. This is the final pass before sharing
with 5 friends.

FRONTEND AUDIT:
1. Test every page route — do they all load without errors?
   /app/songbook, /app/marketplace, /app/playlists, /app/playlists/:id
   Check browser console for any JS errors on each page.

2. Test all CRUD operations:
   - Add a song via + button → appears in library and marketplace
   - Edit a song's key, notes, tags → changes persist after reload
   - Delete a song from library → gone from library, still in marketplace
   - Create a playlist → appears in playlists page
   - Add songs to playlist → songs appear in playlist detail
   - Delete a playlist → gone
   - Save current set as playlist → appears in playlists

3. Test all hotkeys — press each one and verify behavior:
   SPACE, Q, TAB, N, DEL, ENTER, /, ESC, ↑↓←→, K, B, T, E, A, G

4. Test drag and drop:
   - Grid → Queue
   - Grid → Now Playing
   - Queue reorder
   - Queue → Now Playing
   - Now Playing → Queue (should clear NP)

5. Test filters:
   - Select a song, check "Same key" → only matching keys visible
   - Key filter squares → correct filtering
   - "Played recently" / "Not played recently" with correct 30-day logic
   - Clear filters button works
   - AND/OR toggle works

6. Test sort modes:
   - Random (shuffle works)
   - Alphabetical
   - Artist A-Z
   - Key (major-minor paired order)
   - BPM
   - Era
   - Most Played / Least Played (based on playlist saves, not NP plays)

7. Test color modes — switch between all 5 palettes + all 4 backgrounds.
   Verify tiles change color, backgrounds change, text remains readable.

8. Test auth flow:
   - Logout → redirected to login
   - Login → redirected to songbook
   - Session persists across page refreshes

9. Test public songbook:
   - Songs appear with correct tile sizing
   - "In library" checkmark shows for songs already in library
   - Click to add to library works
   - Shift+click multi-select works
   - Search and filter work

10. Test playlists:
    - Playlist list shows all playlists with song counts
    - Playlist detail shows songs in order
    - Favorite toggle works
    - Transition indicators show where applicable

11. Test first-login experience (use incognito or a different Google account):
    - Empty library shows "Import default songbook?" prompt
    - Importing works and populates library

12. Test responsive behavior — resize browser to mobile width.
    Does the layout degrade gracefully? Are critical functions accessible?

BACKEND AUDIT:
13. Check all API endpoints return correct data:
    - GET /api/library — returns songs with all fields
    - GET /api/songs — returns marketplace with library_count
    - GET /api/playlists — returns user's playlists
    - POST endpoints create records correctly
    - PATCH endpoints update without overwriting unset fields
    - DELETE endpoints clean up properly

14. Check for N+1 query problems — are list endpoints making
    individual queries per song? They should use JOINs.

15. Check error handling — what happens when:
    - API is unreachable (show graceful error, not white screen)
    - Song not found (404 handled)
    - Unauthorized (redirect to login)

HOMEPAGE AUDIT:
16. Does the homepage load correctly at /?
17. Demo animation plays and accurately represents the app
18. All links work (sign in, by conor, tip)
19. Mobile responsive
20. Footer copyright says 2026

FIX every issue found. Log each fix. When done, print a summary of
all issues found and fixed.
```

---

## Prompt Order
1. **Prompt 1** — Import spreadsheet (get the data in first)
2. **Prompt 3** — Data enrichment (fill in missing metadata — do this
   AFTER import so all 1,129 songs are in the DB to enrich).
   NOTE: Before running, make sure Spotify credentials are in .dev.vars:
   SPOTIFY_CLIENT_ID=5e7a50d60483419ca0b310765dc6d29f
   SPOTIFY_CLIENT_SECRET=<need to get this from Spotify dashboard>
3. **Prompt 2** — UX fixes (all the behavioral improvements)
4. **Prompt 4** — Full audit (final pass, catches everything)

After ALL prompts are complete and the audit passes clean:
**DELETE THIS FILE from the project.**
