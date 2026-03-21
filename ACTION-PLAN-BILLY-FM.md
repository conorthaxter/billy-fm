# ACTION PLAN — billy-fm
*For use by Claude Code inside the `~/Desktop/billy fm` directory*
*Generated: March 20, 2026*

---

## Context

This is billy-fm — the music backend, setlist manager, client set builder, and songbook. React/Vite frontend + Cloudflare Worker (TypeScript, itty-router) + D1 database.

Currently: fully built locally, NEVER deployed. No real D1 database exists (placeholder ID in wrangler.toml). Two known bugs must be fixed before anything else.

**Read BILLY-INTEGRATION-MASTER.md first** for full system context.

---

## Prompt Sequence

Run these prompts in order. Each prompt is one Claude Code session task. Do not skip ahead — the ordering is strict.

---

### PROMPT 1: Cleanup — Delete old files

```
1. Delete "BILLY-INTEGRATION copy 2.md" from this project root. It is superseded by BILLY-INTEGRATION-MASTER.md.
2. Delete worker/migrations/0001_add_playlist_is_favorited.sql — this migration is redundant because worker/schema.sql already includes the is_favorited column. Keeping it causes duplicate-column errors.
```

---

### PROMPT 2: Fix playlist load error (BLOCKER)

```
Read BILLY-INTEGRATION-MASTER.md — this is listed as a blocker bug.

ROOT CAUSE: The local D1 database was likely created from an older version of schema.sql that didn't include the is_favorited column on the playlists table. The listPlaylists query in worker/src/routes/playlists.ts selects p.is_favorited and orders by it — SQLite throws "no such column" → 500 error.

FIX:
1. Check if the column exists in the local D1:
   wrangler d1 execute billy-fm-db --local --command "PRAGMA table_info(playlists);"
   
2. If is_favorited is NOT in the output, add it:
   wrangler d1 execute billy-fm-db --local --command "ALTER TABLE playlists ADD COLUMN is_favorited BOOLEAN DEFAULT 0;"

3. If the local D1 doesn't exist at all (no .wrangler/state directory), recreate it from schema.sql:
   wrangler d1 execute billy-fm-db --local --file=worker/schema.sql

4. Verify the fix: start the worker (cd worker && wrangler dev) and hit GET /api/playlists with a valid auth session. It should return an array, not a 500 error.

Note: the migration file 0001 was already deleted in Prompt 1. The column now exists only in schema.sql (the source of truth).
```

---

### PROMPT 3: Fix Spotify API import

```
Read BILLY-INTEGRATION-MASTER.md — Spotify import is listed as a must-fix before deployment.

ROOT CAUSE: The worker needs SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET as secrets, but no worker/.dev.vars file exists for local development.

FIX:
1. Create worker/.dev.vars with:
   SPOTIFY_CLIENT_ID=<ask me for the value>
   SPOTIFY_CLIENT_SECRET=<ask me for the value>
   
   (Prompt me for the actual values — do not guess.)

2. Make sure worker/.dev.vars is in .gitignore (check worker/.gitignore).

3. Also add SESSION_SECRET to .dev.vars if it's not already there (needed for auth to work locally).

4. After creating the file, restart wrangler dev and test the Spotify import flow.

SECONDARY CONCERN: Spotify deprecated the /v1/audio-features endpoint for newly-created apps. Check worker/src/routes/import.ts for calls to the audio-features endpoint. If the Spotify app credentials were created after November 2024, this endpoint will return 403. If that happens:
- The search and import can still work (track title, artist, album)
- BPM and key data just won't be populated
- Add error handling so the import doesn't fail entirely if audio-features returns 403 — just skip the BPM/key data and continue
```

---

### PROMPT 4: Create D1 database and deploy

```
Read BILLY-INTEGRATION-MASTER.md Phase 2b.

This is the first deployment of billy-fm. Follow these steps in order:

1. Create the D1 database:
   cd worker
   wrangler d1 create billy-fm-db

2. Copy the database_id from the output and update worker/wrangler.toml — replace the placeholder "placeholder-replace-after-wrangler-d1-create" with the real ID.

3. Apply the schema to the REMOTE database:
   wrangler d1 execute billy-fm-db --remote --file=schema.sql

4. Update production vars in wrangler.toml [env.production.vars]:
   - FRONTEND_ORIGIN = the Pages URL (will be set after frontend deploys — use a placeholder for now like "https://billy-fm.pages.dev")
   - GOOGLE_REDIRECT_URI = "https://billy-fm-worker.conorthaxter.workers.dev/auth/google/callback"

5. Set secrets:
   wrangler secret put GOOGLE_CLIENT_SECRET
   wrangler secret put SESSION_SECRET
   wrangler secret put SPOTIFY_CLIENT_ID
   wrangler secret put SPOTIFY_CLIENT_SECRET

   (Prompt me for each value.)

6. Deploy the worker:
   wrangler deploy

7. Verify: curl https://billy-fm-worker.conorthaxter.workers.dev/api/health should return {"ok":true}

8. Deploy the frontend to Cloudflare Pages:
   cd .. (back to project root)
   npm run build
   wrangler pages deploy dist --project-name=billy-fm

9. Note the Pages URL from the output. Go back and update FRONTEND_ORIGIN in wrangler.toml with the real URL, then redeploy the worker:
   cd worker
   wrangler deploy

10. Update Google Cloud Console: add the production callback URL to the OAuth consent screen's authorized redirect URIs:
    https://billy-fm-worker.conorthaxter.workers.dev/auth/google/callback

IMPORTANT: From this point forward, all local development should use:
   cd worker && wrangler dev --remote
This connects to the REAL D1 database so all data stays in sync.
```

---

### PROMPT 5: Add withServiceAuth middleware

```
Read BILLY-INTEGRATION-MASTER.md Phase 2c.

billy-book needs to make server-to-server calls to billy-fm. Add a second auth path for this.

1. Add BILLY_FM_SERVICE_KEY to the Env interface in worker/src/index.ts

2. In worker/src/middleware.ts, add a withServiceAuth middleware function:
   - Check for Authorization: Bearer <token> header
   - Compare token against env.BILLY_FM_SERVICE_KEY
   - If valid, attach a synthetic service user to the request (e.g., { id: 'service', email: 'service@billy-fm', display_name: 'Billy Book Service', is_performer: 0 })
   - If invalid, return 401
   - This is separate from withAuth (Google OAuth) — it's an alternative, not a replacement

3. Create a withAuthOrService middleware that tries withAuth first, falls back to withServiceAuth. Apply this to:
   - POST /api/playlists (so billy-book can auto-create client sets)
   - PATCH /api/playlists/:id (so billy-book can sync metadata)
   - GET /api/songs (so public endpoints work)

4. Set the secret:
   wrangler secret put BILLY_FM_SERVICE_KEY
   (Prompt me for the value — it must match what's set in the conor-finance-api worker)

5. Redeploy: wrangler deploy
```

---

### PROMPT 6: Schema migrations for client sets, notifications, mailing list

```
Read BILLY-INTEGRATION-MASTER.md Phase 3f.

Create and apply schema migrations. Run these against the REMOTE database (the live D1):

1. Create worker/migrations/0002_client_set_fields.sql:

ALTER TABLE playlists ADD COLUMN password TEXT DEFAULT NULL;
ALTER TABLE playlists ADD COLUMN off_list_requests INTEGER DEFAULT 0;
ALTER TABLE playlists ADD COLUMN is_locked INTEGER DEFAULT 0;
ALTER TABLE playlists ADD COLUMN locked_at TEXT DEFAULT NULL;
ALTER TABLE playlists ADD COLUMN color_scheme TEXT DEFAULT 'standard';
ALTER TABLE playlists ADD COLUMN source TEXT DEFAULT NULL;
ALTER TABLE playlists ADD COLUMN source_gig_id TEXT DEFAULT NULL;
ALTER TABLE playlists ADD COLUMN metadata TEXT DEFAULT '{}';

2. Create worker/migrations/0003_new_tables.sql:

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

3. Create worker/migrations/0004_users_mailing_list.sql:

ALTER TABLE users ADD COLUMN mailing_list_opt_in INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN opted_in_at TEXT DEFAULT NULL;

4. Apply all migrations to the remote database:
   cd worker
   wrangler d1 execute billy-fm-db --remote --file=migrations/0002_client_set_fields.sql
   wrangler d1 execute billy-fm-db --remote --file=migrations/0003_new_tables.sql
   wrangler d1 execute billy-fm-db --remote --file=migrations/0004_users_mailing_list.sql

5. Also update worker/schema.sql to include all new columns and tables so fresh installs get the complete schema. Add the new columns to the playlists CREATE TABLE, and add the three new CREATE TABLE statements.

6. Verify: wrangler d1 execute billy-fm-db --remote --command "PRAGMA table_info(playlists);" — should show all new columns.
```

---

### PROMPT 7: Add ENABLE_CLIENT_SETS feature flag

```
Read BILLY-INTEGRATION-MASTER.md Phase 2 — feature flag architecture.

1. Add ENABLE_CLIENT_SETS to the Env interface in worker/src/index.ts (type: string)

2. Add to wrangler.toml vars:
   [vars]
   ENABLE_CLIENT_SETS = "true"    # true locally for development
   
   [env.production.vars]
   ENABLE_CLIENT_SETS = "false"   # false in production until ready

3. Create a helper function in middleware.ts:
   export function clientSetsEnabled(env: Env): boolean {
     return env.ENABLE_CLIENT_SETS === 'true';
   }

4. All /api/sets/* routes (built in future prompts) should check this flag and return 404 with { error: 'Client sets not yet available' } if disabled.

5. The admin playlist routes (/api/playlists/*) should NOT be gated — those always work.

6. Redeploy: cd worker && wrangler deploy
```

---

### PROMPT 8: Build client set API routes (worker)

```
Read BILLY-INTEGRATION-MASTER.md Phase 3g, 3h.

Create worker/src/routes/sets.ts with all client set endpoints. These are PUBLIC-FACING routes (clients access them, not just the artist).

Gate all routes behind ENABLE_CLIENT_SETS (return 404 if disabled).

Endpoints:

POST /api/sets/:slug/verify
- Body: { password: string }
- Look up playlist by share_slug where playlist_type = 'client_set'
- Compare password (plain text comparison is fine for now)
- If match: generate a random token, store it (in-memory map or short-lived D1 row), set it as a cookie, return { ok: true }
- If no match: return 401

GET /api/sets/:slug
- Requires valid set session (check cookie token)
- Return playlist metadata + songs + off-list requests + submission history
- Songs should include: title, artist, tags (NO key, BPM, chords, internal notes)
- Include is_locked status

POST /api/sets/:slug/songs
- Requires valid set session
- If set is locked, return 403
- Body: { song_id: string }
- Add song to playlist_songs

DELETE /api/sets/:slug/songs/:songId
- Requires valid set session
- If set is locked, return 403
- Remove song from playlist_songs

PUT /api/sets/:slug/order
- Requires valid set session
- If set is locked, return 403
- Body: { songs: [{ song_id, position, division?, notes?, priority? }] }
- Full replace of playlist_songs positions and metadata

PATCH /api/sets/:slug/songs/:songId
- Requires valid set session
- If set is locked, return 403
- Body: { notes?, priority?, division? }
- Update individual song metadata

POST /api/sets/:slug/requests
- Requires valid set session
- If set is locked, return 403
- Check count of existing off-list requests against playlist.off_list_requests limit
- Body: { request_text: string }
- Insert into off_list_requests table

POST /api/sets/:slug/submit
- Requires valid set session
- If already locked, return 400
- Save a snapshot to set_submissions (JSON of all songs + divisions + off-list requests)
- Set is_locked = 1, locked_at = now on the playlist
- Create a notification for the playlist owner (user_id)
- Return { ok: true, submission_id }

GET /api/sets/:slug/snapshot/:submissionId
- Requires valid set session
- Return the snapshot JSON (PDF generation is a frontend concern — return the data)

Register all routes in worker/src/index.ts. Import from ./routes/sets.

Also add:

PATCH /api/playlists/:id/lock (requires withAuth — artist only)
- Body: { locked: boolean }
- If unlocking: set is_locked = 0, locked_at = null
- If locking: set is_locked = 1, locked_at = now

GET /api/playlists/:id/submissions (requires withAuth — artist only)
- Return all set_submissions for this playlist
```

---

### PROMPT 9: Build songbook and repertoire API routes (worker)

```
Read BILLY-INTEGRATION-MASTER.md Phase 3g, 3j.

Create two new route files:

1. worker/src/routes/songbook.ts

GET /api/songbook/:userId
- Fully public, no auth required
- Return all songs from user_library where is_public = 1 for this user
- Only return: title, artist, tags (parsed from JSON), genre (parsed from JSON)
- Do NOT return: key, bpm, chords_url, notes, era, or any internal metadata
- Support query params: ?tags=wedding,ballad&search=love song
- Tags filter: match if any requested tag appears in the song's tags JSON array
- Search: match against title or artist (case-insensitive LIKE)

2. worker/src/routes/repertoire.ts

GET /api/repertoire/:userId
- Same as songbook but intended for the conor.bio modal
- Same data, same filtering
- Can be the same handler — just a separate route for clarity

Register both in worker/src/index.ts. These routes do NOT check ENABLE_CLIENT_SETS — they are always available.

Redeploy: cd worker && wrangler deploy
```

---

### PROMPT 10: Build notification API routes (worker)

```
Read BILLY-INTEGRATION-MASTER.md Phase 3m.

Create worker/src/routes/notifications.ts:

GET /api/notifications (requires withAuth)
- Return notifications for the current user
- Support ?unread=true to filter
- Order by created_at DESC
- Limit to 50

PATCH /api/notifications/:id (requires withAuth)
- Body: { is_read: true }
- Mark single notification as read

PATCH /api/notifications/read-all (requires withAuth)
- Mark all notifications for current user as read

Also add to the Env interface:
- RESEND_API_KEY: string
- ARTIST_EMAIL: string

Create a helper function in a new file worker/src/email.ts:
- sendNotificationEmail(env, { to, subject, body }) — sends via Resend API (POST https://api.resend.com/emails)
- Use env.RESEND_API_KEY for auth
- From address: "Billy FM <onboarding@resend.dev>" (Resend's default sender for testing)

The submit endpoint in sets.ts (Prompt 8) should call both:
- Insert into notifications table
- Send email via sendNotificationEmail

Wire this up now: update the POST /api/sets/:slug/submit handler to create a notification AND send an email when a client submits their set.

Set the secrets:
wrangler secret put RESEND_API_KEY
(Prompt me for the value)

Add ARTIST_EMAIL to wrangler.toml vars (the email where notifications should be sent — prompt me for the value).

Redeploy: cd worker && wrangler deploy
```

---

### PROMPT 11: Build client set frontend page

```
Read BILLY-INTEGRATION-MASTER.md Phase 3i.

This is the page clients see when they open their set link. It must be MOBILE-FIRST and work equally well on desktop.

1. Rename src/pages/WeddingBuilderPage.jsx to src/pages/ClientSetPage.jsx
2. Update the route in src/App.jsx from /wedding/:slug to /set/:slug

Build the full client set page:

PASSWORD GATE:
- On load, check for a valid session cookie
- If no session: show a clean password input with the artist's display name and "billy fm" badge in the header
- On submit: POST /api/sets/:slug/verify
- If valid: load the set data

HEADER:
- Artist display name + small "billy fm" text/badge
- "Set for [Client Name] · [Event Date]"
- Color scheme applied via CSS variables based on the set's color_scheme value
- Color schemes: wedding (dark bg, soft serif), corporate (clean neutral), birthday (warm), residency (standard), standard (billy-fm default)

LAYOUT (two-panel on desktop, stacked on mobile):
- LEFT/TOP: Song bank — artist's full songbook
  - Search bar
  - Tag/genre filter pills
  - Song cards showing title + artist + tags
  - "Add to set" button on each song
  - NO key, BPM, chords, or internal metadata shown
  
- RIGHT/BOTTOM: Client's set
  - Songs the client has added
  - Drag and drop to reorder (touch-friendly on mobile)
  - Per-song: notes field, priority toggle, delete button
  - Client-created division labels — client types a label to create a divider (e.g., "Ceremony", "Cocktail Hour")
  - Songs can be dragged between/under divisions
  - No numbered ordering — just spatial arrangement

SPECIAL REQUESTS:
- Below the set, show exactly N free-text input fields (where N = off_list_requests from the set metadata)
- If off_list_requests is 0, hide this section entirely
- Label: "Special requests — songs not in the songbook"

SUBMIT:
- "Submit Set" button
- On click: show summary of selections organized by division
- On confirm: POST /api/sets/:slug/submit
- After submit: page transitions to locked state

LOCK STATES:
- Unlocked: full editing, submit button visible
- Locked (client submitted): read-only, "Submitted on [date]" message, PDF download link (link to /api/sets/:slug/snapshot/:id)
- Locked (artist locked): read-only, "Your set has been finalized" message
- Unlocked after previous lock (artist re-opened): editing restored, previous selections preserved, can re-submit

Create src/api/sets.js with API client methods for all /api/sets/* endpoints.

Use react-beautiful-dnd or @hello-pangea/dnd for drag and drop (check package.json for what's available, install if needed). Must work on touch devices.
```

---

### PROMPT 12: Build songbook frontend page

```
Read BILLY-INTEGRATION-MASTER.md Phase 3j.

1. Rename src/pages/PublicRepertoirePage.jsx to src/pages/SongbookPage.jsx
2. Update the route in src/App.jsx from /r/:slug to /songbook/:userId

Build the songbook page:
- Fully public, no password
- Header: artist display name + "billy fm" badge
- Fetches from GET /api/songbook/:userId
- Shows: title, artist, tags
- Does NOT show: key, BPM, chords, internal notes
- Search bar + tag/genre filter pills
- Read-only — no selecting, no building
- Supports URL params for pre-filtering: ?tags=wedding opens pre-filtered
- Mobile-first, works equally well on desktop

This is much simpler than the client set page — no drag-and-drop, no submit, no lock states. Just a clean browsable list.
```

---

### PROMPT 13: Build notification UI (frontend)

```
Read BILLY-INTEGRATION-MASTER.md Phase 3m.

Add a notification system to the billy-fm admin UI:

1. Create src/api/notifications.js with API client methods for /api/notifications endpoints

2. Create src/components/NotificationDropdown.jsx:
   - Bell icon in the app header
   - Unread count badge (red dot with number)
   - Click to open dropdown
   - Shows recent notifications with timestamps
   - Click a notification to mark as read
   - "Mark all as read" button at bottom
   - Notification types: "client_set_submitted" shows "[Client Name] submitted their set for [Event Date]"

3. Integrate into the app header (likely in src/App.jsx or wherever the top nav lives)

4. Poll for new notifications every 60 seconds when the app is open (simple setInterval, not WebSockets)
```

---

### PROMPT 14: Add display name to settings

```
Read BILLY-INTEGRATION-MASTER.md Phase 3k.

1. Find the settings UI (likely in src/components or src/contexts/SettingsContext.jsx)
2. Add a "Display Name" text input field
3. This is the name shown on client sets and songbook ("From [Display Name]")
4. Save it: either PATCH to an existing settings endpoint, or create a new PATCH /auth/me endpoint in the worker that updates users.display_name
5. If creating a new endpoint, add it to worker/src/auth.ts and register in index.ts
6. Redeploy worker if a new endpoint was added
```

---

### PROMPT 15: Add mailing list opt-in + weekly cron

```
Read BILLY-INTEGRATION-MASTER.md Phase 3l.

1. After Google OAuth login (in the callback flow or on first app load for new users), show an opt-in prompt:
   - "Stay in the loop — join [Display Name]'s mailing list"
   - Checkbox, unchecked by default
   - Only shown to new users (users.mailing_list_opt_in IS NULL or first login detected)
   - If checked: PATCH users.mailing_list_opt_in = 1, opted_in_at = now

2. Add a scheduled handler to the worker for the weekly cron:
   In worker/src/index.ts, add:
   
   export default {
     fetch: ...,
     scheduled: async (event, env, ctx) => {
       // Query for new opt-ins since last week
       // If any: send digest email via Resend to ARTIST_EMAIL
       // Subject: "URGENT: ADD EMAILS TO SUBSTACK LIST"
       // Body: list of new emails with names and opt-in dates
     }
   }

3. Add cron trigger to worker/wrangler.toml:
   [triggers]
   crons = ["0 16 * * 1"]  # Every Monday at 4pm UTC (9am PT)

4. Redeploy: cd worker && wrangler deploy
```

---

### PROMPT 16: (FUTURE — do not run until ENABLE_CLIENT_SETS is flipped to true)

```
FUTURE PROMPT — run when client sets are tested and ready for production.

1. Update wrangler.toml [env.production.vars]:
   ENABLE_CLIENT_SETS = "true"

2. Redeploy: cd worker && wrangler deploy

3. Verify: the /api/sets/* endpoints should now return real data instead of 404.
```

---

## Notes for Claude Code

- Worker is TypeScript with itty-router AutoRouter. Follow existing patterns in routes/.
- Frontend is React 18 with Vite. No component library — uses custom components.
- API client layer is modular: src/api/client.js is the base fetch wrapper, then songs.js, playlists.js, etc. Follow this pattern for new API files.
- Contexts: SettingsContext.jsx and PlayStateContext.jsx exist. Follow existing patterns.
- The user_library.is_public flag controls what appears in public songbook/repertoire. Always filter by this for public endpoints.
- D1 doesn't enforce foreign key cascades by default — delete child rows explicitly when deleting parent rows.
- All JSON fields (tags, genre, metadata) are stored as strings. Parse with try/catch.
- After Prompt 4 (deployment), ALL local dev must use `wrangler dev --remote` to share the production D1.
- The playlist_songs table uses (playlist_id, song_id) as composite primary key. The position column determines order.
- Client set division labels are stored per-song in playlist_songs (as a field on the join row), not as separate rows.
