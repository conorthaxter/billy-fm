# billy-fm — Master Status Document
*Last updated: 2026-03-18*

---

## What it is

billy-fm is a music library and setlist manager for live performers. It replaces the "spreadsheet + memory" workflow that working musicians use to manage their repertoire. You log your songs, tag them by key, BPM, era, genre, and theme — then at a gig you can instantly filter by what works next, build a queue, track what you've played, and save your setlist.

**Stack:** React + Vite → Cloudflare Pages (frontend) / Cloudflare Workers (API) / Cloudflare D1 SQLite (database)
**Auth:** Google OAuth via Cloudflare Workers + httpOnly session cookies
**Domain:** billy.fm (not yet pointed)

---

## Architecture

```
Frontend (Cloudflare Pages)     Backend (Cloudflare Worker)       Database (D1 / SQLite)
─────────────────────────────   ──────────────────────────────    ─────────────────────
React + Vite SPA                itty-router AutoRouter            users
  /dashboard   → DashboardPage    GET  /api/library               songs  (marketplace)
  /marketplace → MarketplacePage  POST /api/library/:songId        user_library  (snapshots)
  /playlists   → PlaylistsPage    POST /api/library/private        playlists + playlist_songs
  /playlists/:id → (coming)       PATCH /api/library/:songId       sessions
  /login       → LoginPage        DELETE /api/library/:songId      play_history
                                  GET  /api/songs                  song_transitions
                                  POST /api/songs
                                  GET/POST/PATCH/DELETE /api/playlists
                                  PUT /api/playlists/:id/songs
                                  POST /api/sessions
                                  POST /api/history
                                  GET  /api/import/spotify/search
                                  POST /api/import/spotify/confirm
                                  POST /api/import/csv
                                  GET/POST/DELETE /api/.../transitions
```

---

## D1 Schema (live)

```sql
users            — id, email, display_name, google_id, avatar_url
songs            — id, title, artist, default_key, default_bpm, chords_url, genre, era, tags
user_library     — user_id+song_id, title, artist, key, bpm, chords_url, genre, era, tags,
                   notes, is_public (BOOLEAN DEFAULT 0), added_at
playlists        — id, user_id, title, playlist_type, notes, is_public, client_name,
                   event_date, share_slug, tip_enabled, tip_venmo, tip_message, tip_minimum,
                   created_at, updated_at
playlist_songs   — playlist_id, song_id, position, notes, is_played, requested_by
sessions         — id, user_id, title, notes, started_at, ended_at
play_history     — id, user_id, song_id, session_id, played_at
song_transitions — id, user_id, from_song_id, to_song_id, notes, created_at
```

**Migrations run (local + remote):**
- `ALTER TABLE user_library ADD COLUMN is_public BOOLEAN DEFAULT 0`
- `CREATE TABLE song_transitions ...`

---

## Completed Features (full list)

### Core App Shell
- Fixed nav header with brutalist full-height tabs (my songbook | public songbook | playlists)
- Nav tabs absolutely centered in viewport (position: absolute; left: 50%; transform: translateX(-50%))
- On dashboard: right-side controls (search/import/settings/user) live in the left panel user hub
- On other pages: settings + user cluster in nav top-right
- "by conor" + "tip ♥" sticky at bottom of left panel
- Tab title: `billy-fm`
- Login page: animated palette-cycling background (summer colors), bordered card design

### Left Panel (FilterPanel)
- User hub at top: 2-row controls (search / import / settings / username / logout)
- Selected song info with inline edit (title, artist, key, BPM)
- Public/Private toggle per song (🔒 / 🌐)
- Chords URL link (auto-generates Google search as default, user can replace with direct link)
- Notes textarea (auto-saves on blur)
- Match Filters section with AND/OR toggle in header row:
  - Same key / relative key
  - BPM ±15
  - Same theme tags
  - Same era
  - Same artist
  - Same genre
- Play Frequency section (always enabled, no song required):
  - Not played recently (7+ days)
  - Played frequently (3+)
- Quick Stats when no song selected: library size, session count, key distribution chart, top genres
- Song Transitions: link songs, see suggested next song, delete transitions
- Sticky "by conor / tip ♥" footer

### Song Grid (center)
- Color-coded tiles by musical key (4 seasonal palettes: Summer/Spring/Autumn/Winter)
- Sort options: Random, Alphabetical, Artist A–Z, Key, BPM, Era, Theme Proximity, Most/Least Played
- Sticky sort controls header
- Filter animation: when filters active, matched songs group near selected with `match-pop` keyframe animation
- Filter reordering: [selected → matched → unmatched] in DOM order
- Click grid background to deselect song
- Drag tiles from grid directly into queue
- Select = single click, Play Now = double-click
- Enter key = play selected song, ArrowRight = add to queue

### Right Panel
- Previously Played: chronological setlist tracking (oldest first), click to select, double-click to play
- Now Playing: song info, key badge, chords link, notes preview, CLEAR button
- Current Set section: session title, played count, NEW SET / SAVE SET AS PLAYLIST / CLEAR SET
  - New Set: prompts to save first if content exists, then starts fresh
  - Save Set as Playlist: calls POST /api/playlists + PUT /api/playlists/:id/songs (real API)
  - Clear Set: wipes NP + Queue only, keeps session identity
- Queue: drag-to-reorder within queue, drag songs from grid into queue at any position
- Suggested Next: transition suggestions based on now-playing

### Search
- / shortcut opens search bar
- Arrow keys navigate results
- Enter selects song (does NOT play — second Enter via keyboard shortcut plays selected)
- Backspace when empty closes search
- Click anywhere outside search bar/suggestions closes search

### Import
- Add Song tab: title, artist, key, BPM, chords URL, notes, genre checkboxes
  - Public/Private toggle: Public → creates marketplace entry + library copy; Private → user_library only (private_ UUID prefix)
- Spotify tab: search by artist/song, select multiple, import with key/BPM from Spotify audio features
- Spreadsheet tab: Google Sheets CSV URL or file upload, auto-column detection, drag-drop mapping

### Public Songbook (MarketplacePage)
- Infinite scroll via IntersectionObserver (root: mp-main scrollable container)
- Sidebar filters: search, genre checkboxes, era checkboxes, key select
- Sort: alphabetical, most popular, newest, by key, by BPM
- Add songs from marketplace to personal library
- Add New Song dialog

### Playlists Page
- Lists all user playlists from GET /api/playlists
- Cards showing: type badge, title, song count, date, public status
- Delete button per card
- Navigates to /playlists/:id (detail view — coming)

### Settings
- Song Color Scheme: Summer / Spring / Autumn / Winter (paint-square previews)
- Background Color Scheme: White / Cream / Dark (midnight purple) / Black
- Default Sort on Load
- Song Visibility Default (public/private toggle)

### Backend
- All routes protected with withAuth middleware (Google OAuth session cookie)
- POST /api/library/private: creates song only in user_library (no marketplace entry), private_ UUID prefix
- PATCH /api/library/:songId: supports is_public, notes, chords_url, key, bpm, title, artist, etc.
- Spotify routes: Client Credentials token flow, pitch class key mapping, audio features batch fetch

---

## Pending / Next Steps

### Immediate (pre-deploy)
1. **Wrangler env vars**: Add to `wrangler.toml` under `[vars]`:
   ```
   SPOTIFY_CLIENT_ID = "your_id"
   SPOTIFY_CLIENT_SECRET = "your_secret"
   ```
2. **Remote D1 migration**: Run migrations on production DB:
   ```
   wrangler d1 execute billy-fm-db --remote --command "ALTER TABLE user_library ADD COLUMN is_public BOOLEAN DEFAULT 0"
   wrangler d1 execute billy-fm-db --remote --command "CREATE TABLE IF NOT EXISTS song_transitions (...)"
   ```
3. **Homepage**: Create a static marketing page at the root URL (/) that serves as the product landing page. The React app moves to /dashboard. See `billy-fm-homepage-brief.txt` for the design spec.
4. **Playlist detail page**: Wire up /playlists/:id route — show songs, allow reordering, mark as played

### Near-term Features
5. **Key Transposition UI**: "Set My Key" picker in FilterPanel — show capo/transpose info, save via PATCH
6. **Mobile UI**: Left/right panels hidden by default on mobile, toggleable
7. **Venue/event context**: Optional gig metadata per session (venue name, date, type)
8. **Shareable playlist link**: /sets/:slug public view (backend supports share_slug already)
9. **Audience request queue**: playlist_type='request_queue', public-facing request form

### Deployment Checklist
- [ ] Custom domain: billy.fm → Cloudflare Pages
- [ ] Worker route: billy.fm/api/* → Worker (or Pages Functions)
- [ ] Google OAuth: Add billy.fm to authorized redirect URIs in Google Console
- [ ] Set production env vars in Cloudflare dashboard (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, etc.)
- [ ] Run D1 migrations on remote
- [ ] Set SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET
- [ ] Test auth flow end-to-end on production domain

---

## Key Design Decisions (permanent record)

- **Snapshot model**: When a user adds a marketplace song, all fields are copied to user_library. The user's copy is forever independent of marketplace edits.
- **Private songs**: Songs with `private_` prefix UUIDs live only in user_library, never in the songs table. They won't appear in the marketplace.
- **Filter logic**: OR mode = any active filter matches. AND mode = all active filters must match. Unplayed/Frequent filters work without a selected song.
- **Play history is local**: Play events stored in localStorage for privacy. Session saving calls the API for playlist persistence.
- **Key colors**: Each of 12 chromatic notes maps to a color in each seasonal palette. Minor keys use a darker variant of their relative major.
- **Font**: IBM Plex Mono (or system mono fallback) throughout. This is load-bearing to the aesthetic.
