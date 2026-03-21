# Master Integration Spec — billy-book × billy-fm × conor.bio
*Last updated: March 20, 2026*
*This document replaces all previous BILLY-INTEGRATION.md copies across repos.*

---

## System Overview

Three apps. One ecosystem. Billy-fm is designed as a multi-artist product long-term.

| App | What it is | Stack | Status | URL |
|-----|-----------|-------|--------|-----|
| **billy-book** | Private finance, booking & client management | React/Vite + Cloudflare Worker + D1 | Live | conor-finance.pages.dev (worker: conor-finance-api.conorthaxter.workers.dev) |
| **billy-fm** | Music backend: setlist manager, repertoire source of truth, client set builder, songbook | React/Vite + Cloudflare Worker + D1 | Built, local only — needs deployment | TBD (billy-fm-worker.conorthaxter.workers.dev) |
| **conor.bio** | Public marketing site + wedding client portal | Static HTML/CSS/JS on Cloudflare Pages | Live | conor.bio |

### Known Bugs & Broken Features (as of March 20, 2026)

⚠️ **Claude Code: read this before proposing any work. Do not build on top of broken features without fixing them first.**

| App | Issue | Severity | Notes |
|-----|-------|----------|-------|
| **billy-fm** | Playlists page throws an error on load | Blocker | Must be fixed before any playlist/client set work. Diagnose and fix first. |
| **billy-fm** | Spotify API import is non-functional | Must fix | Needs to be working before deployment. Diagnose and fix. |
| **billy-fm** | Era metadata is unreliable | Low | Most songs don't have accurate era data. Don't rely on era for filtering until cleaned up. |
| **billy-fm** | BPM data is inconsistent | Low | Some songs have BPM, many don't. Don't treat BPM as a reliable filter. |

**Before starting any phase of integration work on billy-fm, the playlist load error must be diagnosed and fixed.** Everything in Phases 3 and 4 depends on playlists working correctly.

### What each app owns

**billy-book** owns:
- Client records (name, email, phone)
- Gig records (date, rate, type, deposit, balance, payment status)
- Wedding details (stored as JSON in `clients.notes`)
- Invoice generation
- Contractor tracking
- Expense management

**billy-fm** owns:
- Master song/repertoire database (source of truth — NOT Google Sheets)
- User library (per-artist snapshot of songs with custom keys, BPM, notes)
- Playlists and setlists (artist's own sets)
- Client sets (interactive, password-protected set builders sent to clients)
- Songbook (read-only browsable repertoire, shareable link)
- Play history and session tracking
- Song transitions
- Audience request queue
- Color scheme system for client-facing pages

**conor.bio** owns:
- Public-facing marketing pages (weddings, events, stream, primo, artist bio)
- Wedding client portal (per-couple pages at /clients/[slug].html)
- Repertoire modal (embedded read-only browser powered by billy-fm)
- No database — reads from billy-book (client/gig data) and billy-fm (music data)

---

## Data Flow — Full Picture

```
billy-book (admin)
  └── Conor creates a client + gig (any type)
  └── On save → POST to billy-fm to auto-create a client set
        └── billy-fm returns set ID → billy-book stores it in gig record
        └── Gig metadata (date, venue, type, client name) attached to set
  └── billy-book gig detail view links to billy-fm client set
  └── Setlist link auto-inserted into gig notes

billy-fm (music backend + client-facing product)
  └── Artist manages their library, playlists, sessions
  └── Client sets: password-protected interactive builder
        └── Client sees artist's song bank (filtered by tags/context)
        └── Client adds songs, reorders, makes notes, marks priority
        └── Client can make off-list requests (free-text, capped by artist)
        └── Color scheme auto-assigned by gig type, artist can override
        └── Shareable link + embeddable iframe version
  └── Songbook: read-only browsable repertoire (separate from client set)
        └── Public shareable link, no password
        └── No song metadata/chords — just title, artist, tags
  └── Client set links back to billy-book gig record
  └── Client sets appear in artist's "Client Sets" section of playlists dashboard

conor.bio (public site)
  └── Repertoire modal on /weddings, /events pages
        └── Read-only browse/filter from billy-fm public API
        └── Wedding page auto-opens with "wedding hits" tag filter
  └── Repertoire modal on /stream, /primo replaces existing song lists
        └── Same component, different default filter per page
  └── Wedding portal (/clients/[slug].html)
        └── Loads couple data from billy-book API (via server-side proxy)
        └── Embeds billy-fm client set (iframe) for song selection
        └── Post-wedding: gift section unlocks
```

---

## Phase 1 — Security Fixes (Do First)

### Problem
The billy-book API key (`MeatGalaxy369!`) is exposed in:
- billy-book's frontend `api.js` (hardcoded)
- The wedding portal's `CONFIG` block in each client HTML file

This is the #1 priority. Fix before adding any new integrations.

### Solution: Cloudflare Pages Function proxy for conor.bio

Create a Pages Function at `conor.bio/functions/api/client-data.js` that:
1. Receives requests from the portal frontend
2. Reads `BILLY_API_KEY` from environment (set via `wrangler pages secret put`)
3. Forwards the request to billy-book's worker with the key attached
4. Returns the response to the browser

```
Browser (portal page)
  → GET /api/client-data?slug=vicky-eden
  → Pages Function reads BILLY_API_KEY from env
  → Proxies to conor-finance-api.conorthaxter.workers.dev/api/clients/by-slug/vicky-eden
  → Returns client data to browser
```

### What changes in portal HTML files
- Remove `API_KEY` from CONFIG blocks
- Change fetch URLs from direct billy-book API to `/api/client-data?slug=...`
- `CLIENT_ID` and `SHEET_ID` can remain until billy-fm replaces sheets

### ⚠️ DO NOT touch the Vicky & Eden portal page or any live portal functionality during this phase. The existing Google Sheets song selection flow must remain functional as a fallback.

### Environment variables to set

**conor.bio Pages secrets:**
```
BILLY_API_KEY — the billy-book API key, moved out of HTML source
```

### Deliverables
- [ ] `/functions/api/client-data.js` Pages Function
- [ ] `/api/clients/by-slug/[slug]` endpoint in billy-book's worker (if not already present)
- [ ] Portal HTML files updated to use proxy instead of direct API calls
- [ ] Verify Vicky & Eden portal still works end-to-end

---

## Phase 2 — Billy FM Stabilization & Deployment

### Architecture: One deploy, feature flags

There is ONE deployed version of billy-fm. Client set features are gated behind a feature flag (`ENABLE_CLIENT_SETS`). This avoids maintaining two versions and ensures all data (playlists, library, metadata) lives in one D1 database whether you're working locally or using the deployed app.

```
Deploy full codebase (including client set code)
  └── ENABLE_CLIENT_SETS = false in production vars
  └── Client set routes return 404, UI hides client set sections
  └── Everything else works: library, playlists, sessions, import, songbook

Local dev runs against the SAME production D1 database
  └── wrangler dev --remote (uses live D1, not local SQLite)
  └── All data is shared — songs, playlists, metadata persist everywhere
  └── Client sets can be tested locally even while flagged off in production

When client sets are ready:
  └── Update ENABLE_CLIENT_SETS = true in wrangler.toml production vars
  └── wrangler deploy (or just wrangler secret put if using secrets)
  └── No data migration, no second deploy, no sync issues
```

**Critical: always use `wrangler dev --remote` during local development so you're working against the real D1 database. Never use local SQLite — it creates data drift.**

### 2a. Fix existing bugs (before deployment)

Billy-fm needs to be solid before it goes live. Fix these locally (pointed at the production D1 once it's created):

1. **Fix playlist load error** — playlists page throws an error on load. This blocks all client set and integration work. Diagnose and fix first.
2. **Fix Spotify API import** — currently non-functional. Diagnose why (auth issue? endpoint change? CORS?) and get it working.
3. **General cleanup** — address any other small issues, UI bugs, rough edges.

### 2b. Deploy billy-fm to Cloudflare

1. Create D1 database: `wrangler d1 create billy-fm-db`
2. Update `wrangler.toml` with real database ID
3. Run schema migration: `wrangler d1 execute billy-fm-db --file=schema.sql`
4. Set secrets:
   ```
   wrangler secret put GOOGLE_CLIENT_SECRET
   wrangler secret put SESSION_SECRET
   wrangler secret put SPOTIFY_CLIENT_ID
   wrangler secret put SPOTIFY_CLIENT_SECRET
   wrangler secret put BILLY_FM_SERVICE_KEY
   ```
5. Set feature flag in production vars (`wrangler.toml`):
   ```toml
   [env.production.vars]
   ENABLE_CLIENT_SETS = "false"
   ```
6. Update remaining production vars in `wrangler.toml`:
   - `FRONTEND_ORIGIN` → deployed Pages URL
   - `GOOGLE_REDIRECT_URI` → production callback URL
7. Deploy worker: `wrangler deploy`
8. Deploy frontend to Cloudflare Pages
9. Verify: library, playlists, sessions, Spotify import all work on the deployed version
10. Start using `wrangler dev --remote` for all local development going forward

### 2c. Set up shared service key

Both billy-book and billy-fm workers need the same `BILLY_FM_SERVICE_KEY` secret.

```
# In billy-fm worker directory:
wrangler secret put BILLY_FM_SERVICE_KEY

# In billy-book worker directory:
wrangler secret put BILLY_FM_SERVICE_KEY
```

### 2c. Add service key auth to billy-fm worker

Billy-fm currently only has Google OAuth (`withAuth` middleware). Add a second auth path for server-to-server calls:

```
New middleware: withServiceAuth
- Checks Authorization: Bearer <BILLY_FM_SERVICE_KEY>
- If valid, attaches a synthetic "service" user to the request
- Used only for billy-book → billy-fm API calls
- Does NOT replace Google OAuth for artist-facing routes
```

Routes that need `withServiceAuth` as an alternative to `withAuth`:
- `POST /api/playlists` (for auto-creating client sets from billy-book)
- `PATCH /api/playlists/:id` (for updating metadata when gig details change)
- `GET /api/songs` (for public repertoire/songbook — may also be fully public)

### Deliverables
- [ ] billy-fm worker deployed to Cloudflare
- [ ] billy-fm frontend deployed to Cloudflare Pages
- [ ] D1 database created and migrated
- [ ] Google OAuth callback updated for production URL
- [ ] `BILLY_FM_SERVICE_KEY` set in both workers
- [ ] `withServiceAuth` middleware added to billy-fm
- [ ] Health check passes: `GET /api/health` returns `{ ok: true }`

---

## Phase 3 — billy-book ↔ billy-fm Connection

### 3a. billy-book: Wedding detail editor (React)

The existing `wedding-panel.js` is standalone dead code. Build a native React wedding detail editor inside billy-book's `App.jsx`.

**Wedding data model** (stored as JSON in `clients.notes`):
```json
{
  "isWedding": true,
  "partner1": "Harrison",
  "partner2": "Maya",
  "weddingDate": "2026-06-15",
  "venue": "Horse Club",
  "package": "Ceremony Magic",
  "offListRequests": 2,
  "portalSlug": "harrison-maya",
  "billyFmSetId": "",
  "personalNote": "",
  "audioUrl1": "",
  "audioUrl2": "",
  "contractSigned": false,
  "signedBy": "",
  "signedAt": "",
  "colorScheme": "wedding"
}
```

New fields vs. old spec:
- `billyFmSetId` — cross-link to billy-fm client set (returned from auto-create)
- `offListRequests` — number of free-text special request fields (for songs NOT in the songbook)
- `colorScheme` — auto-set to "wedding" for wedding gigs
- Removed: `songAllowance` — there is NO limit on songs from the songbook. The only cap is on off-list special requests.

### 3b. billy-book: Auto-create client set on gig save

When ANY gig is saved in billy-book (not just weddings), POST to billy-fm to create a client set. This applies to all gig types: wedding, corporate, residency, one-off, etc.

```
POST https://billy-fm-worker.conorthaxter.workers.dev/api/playlists
Authorization: Bearer <BILLY_FM_SERVICE_KEY>
Content-Type: application/json

{
  "title": "Harrison & Maya — 2026-06-15",
  "playlist_type": "client_set",
  "client_name": "Harrison & Maya",
  "event_date": "2026-06-15",
  "is_public": false,
  "metadata": {
    "source": "billy-book",
    "gig_id": "qi9o2qil",
    "gig_type": "wedding",
    "venue": "Horse Club",
    "portal_slug": "harrison-maya",
    "off_list_requests": 2,
    "color_scheme": "wedding",
    "password": "<generated-or-custom>"
  }
}
```

Billy-fm returns the created playlist with its `id`. Billy-book stores this as `billyFmSetId` in the gig/client notes.

**Title generation by gig type:**
- Wedding: "[Partner1] & [Partner2] — [Date]"
- Corporate/other: "[Client Name] — [Date]"
- Residency: "[Venue] — [Date]"

**Color scheme auto-assignment:**
- `wedding` → elegant (dark bg, soft accent, serif headers)
- `corporate` → utilitarian (clean, neutral)
- `residency` → standard (matches billy-fm default)
- `birthday` → celebratory (warmer colors)
- Artist can override in either billy-book or billy-fm

### 3c. billy-book: Setlist link in gig notes

When a client set is created, automatically insert a link to the billy-fm set into the gig's notes field. Format:
```
🎵 Client Set: https://billy-fm.[domain]/set/[share_slug]
```

### 3d. billy-book: Cross-link UI

In the gig detail view, if `billyFmSetId` exists, show a button/link: "Open in Billy FM →" that opens the client set in billy-fm's admin view.

### 3e. billy-fm: Cross-link back to billy-book

In the client set detail view, if the set was created from billy-book (has `metadata.source === "billy-book"` and `metadata.gig_id`), show gig metadata:
- Date, venue, client name, gig type
- Link: "Open in Billy Book →" (deep link to billy-book gig view)

### 3e-1. Data sync rules: billy-book → billy-fm

**billy-book is the source of truth for gig/client data. billy-fm receives updates.**

When gig metadata changes in billy-book (date, client name, venue, gig type, off-list request count):
- billy-book sends a PATCH to billy-fm to update the linked client set
- billy-fm updates the set's metadata accordingly
- This is a one-way push — billy-fm never writes back to billy-book for gig data

**Off-list request count** can be edited in EITHER billy-book or billy-fm:
- If changed in billy-book, it pushes to billy-fm
- If changed in billy-fm, it stays local to billy-fm (billy-book is not updated)
- This is acceptable — the artist is the only person editing in both places

### 3e-2. Delete safety: billy-book gig with linked client set

When deleting a gig in billy-book that has a `billyFmSetId`:
1. Check locally: if `billyFmSetId` exists, show a warning dialog
2. Call billy-fm API to verify the set still exists and check if it has client submissions
3. Warning shows: "This gig has a linked client set in Billy FM. [X submissions received]. What would you like to do?"
4. Options: "Delete gig only (keep set in Billy FM)" / "Delete both" / "Cancel"
5. If the billy-fm API call fails, block the delete and show an error — never risk orphaning or accidentally deleting data

### 3f. billy-fm: Database changes for client sets

The existing `playlists` table already has `client_name`, `event_date`, and `share_slug`. Add:

```sql
ALTER TABLE playlists ADD COLUMN password TEXT DEFAULT NULL;
ALTER TABLE playlists ADD COLUMN off_list_requests INTEGER DEFAULT 0;
ALTER TABLE playlists ADD COLUMN is_locked INTEGER DEFAULT 0;
ALTER TABLE playlists ADD COLUMN locked_at TEXT DEFAULT NULL;
ALTER TABLE playlists ADD COLUMN color_scheme TEXT DEFAULT 'standard';
ALTER TABLE playlists ADD COLUMN source TEXT DEFAULT NULL;
ALTER TABLE playlists ADD COLUMN source_gig_id TEXT DEFAULT NULL;
ALTER TABLE playlists ADD COLUMN metadata TEXT DEFAULT '{}';
```

Also add a table for off-list requests:

```sql
CREATE TABLE IF NOT EXISTS off_list_requests (
  id TEXT PRIMARY KEY,
  playlist_id TEXT REFERENCES playlists(id) ON DELETE CASCADE,
  request_text TEXT NOT NULL,
  requester_note TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_off_list_playlist ON off_list_requests(playlist_id);
```

Add a table for client set submissions (timestamped snapshots):

```sql
CREATE TABLE IF NOT EXISTS set_submissions (
  id TEXT PRIMARY KEY,
  playlist_id TEXT REFERENCES playlists(id) ON DELETE CASCADE,
  snapshot_json TEXT NOT NULL,
  submitted_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_submissions_playlist ON set_submissions(playlist_id);
```

Add a table for in-app notifications:

```sql
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
```

### 3g. billy-fm: New API endpoints for client sets

```
# Client set access (password-protected, public-facing)
POST   /api/sets/[share_slug]/verify     — Verify password, return session token
GET    /api/sets/[share_slug]            — Get set + songs (requires valid session)
POST   /api/sets/[share_slug]/songs      — Add song to client set
DELETE /api/sets/[share_slug]/songs/[id]  — Remove song from client set
PUT    /api/sets/[share_slug]/order       — Reorder songs (drag and drop)
PATCH  /api/sets/[share_slug]/songs/[id]  — Update note, priority, division
POST   /api/sets/[share_slug]/requests    — Submit off-list request (free-text)
POST   /api/sets/[share_slug]/submit      — Client submits set (locks it, saves snapshot, triggers notification)
GET    /api/sets/[share_slug]/snapshot    — Download PDF snapshot of submitted set

# Artist-side set management (requires withAuth)
PATCH  /api/playlists/[id]/lock          — Lock or unlock a client set { "locked": true/false }
GET    /api/playlists/[id]/submissions   — Get submission history with snapshots

# Notifications (requires withAuth)
GET    /api/notifications                — Get notifications (supports ?unread=true)
PATCH  /api/notifications/[id]           — Mark as read
PATCH  /api/notifications/read-all       — Mark all as read

# Songbook (fully public, no auth)
GET    /api/songbook/[user_id]           — Get artist's public library (no metadata/chords)
       ?tags=wedding&search=...          — Supports pre-filtering via URL params

# Repertoire for conor.bio modal (public, filterable)
GET    /api/repertoire/[user_id]         — Get public songs with tag filtering
       ?tags=wedding,ballad&search=...
```

### 3h. billy-fm: Client set password auth

Simple password check — not full OAuth. Flow:
1. Client opens `https://billy-fm.[domain]/set/[share_slug]`
2. Page shows password prompt
3. Client enters password → `POST /api/sets/[slug]/verify` with `{ password }`
4. If correct, returns a short-lived token (stored in cookie or localStorage)
5. Subsequent requests include the token
6. Password is set per-set: auto-generated on create, artist can customize in billy-fm or billy-book

### 3i. billy-fm: Client set UI (the shareable page)

When a client opens their set link and enters the password, they see:

**Header:**
- Artist's display name + small "billy fm" tag/badge
- "Set for [Client Name] · [Event Date]"
- Color scheme applied based on gig type (wedding, corporate, birthday, residency)

**Song bank (left/top panel):**
- Browse artist's full songbook — NO limit on how many songs a client can add
- Songs displayed WITHOUT key, BPM, chords, or internal metadata
- Songs show: title, artist, tags (for browsing/filtering)
- Search and filter by genre, mood, tags

**Client's set (right/bottom panel):**
- Songs the client has added from the bank
- Drag and drop to reorder (but no numbered ordering — just spatial arrangement)
- Per-song notes field
- Per-song priority flag
- **Client-created divisions** — client can add section dividers and label them whatever they want (e.g., "Ceremony", "Cocktail Hour", "Dinner", "Party", or anything custom)
- Songs can be dragged between divisions

**Special requests section:**
- Shows exactly `off_list_requests` number of free-text input fields
- If `off_list_requests` is 0, this entire section is hidden
- Label: "Special Requests — songs not in the songbook"

**Submit flow:**
- Client clicks "Submit Set" button
- Confirmation screen shows a summary of their selections organized by division
- On confirm: set locks on the client's end (read-only), a timestamped JSON snapshot is saved to `set_submissions`, and a PDF of the summary is generated and available for download
- Artist receives both an in-app notification (badge + dropdown) and an email via Resend
- If the artist unlocks the set later, the client's previous selections remain selected — they can deselect or add more, then re-submit

**Lock states (from the client's perspective):**
- Unlocked: full editing, submit button visible
- Locked (client submitted): read-only, shows "Submitted on [date]" with PDF download link
- Locked (artist locked): read-only, shows "Your set has been finalized"
- Unlocked after lock (artist re-opened): editing restored, previous selections preserved

**Design requirements:**
- Equal priority mobile and desktop — clients will open these on phones
- Must work well on both without compromise
- Touch-friendly drag and drop on mobile

### 3j. billy-fm: Songbook UI (the browse-only page)

Separate from client sets. A shareable public link to the artist's full repertoire.

- URL: `https://billy-fm.[domain]/songbook/[user_slug_or_id]`
- Supports URL params for pre-filtering: `?tags=wedding&search=love`
- Artist can configure a default filter per songbook link (e.g., a "wedding songbook" link that opens pre-filtered to wedding-tagged songs)
- No password required
- Read-only: browse and filter only, no building or selecting
- Shows: title, artist, tags
- Does NOT show: key, BPM, chords, internal notes, play history
- Filterable by genre, era, tags, search text
- Equal priority mobile and desktop design

### 3k. billy-fm: Settings additions

Add to user settings:
- **Display name** — this is the name shown on client sets and songbook ("From [Display Name]")
- Editable in billy-fm settings page

### 3l. billy-fm: Mailing list opt-in + weekly digest email

**Goal:** Capture emails from billy-fm users who opt in, and send a weekly digest email to the artist (you) with new signups so you can add them to Substack manually. Substack has no public API, so this is the cleanest path.

**How it works:**

1. Add `mailing_list_opt_in` column to `users` table:
   ```sql
   ALTER TABLE users ADD COLUMN mailing_list_opt_in INTEGER DEFAULT 0;
   ALTER TABLE users ADD COLUMN opted_in_at TEXT DEFAULT NULL;
   ```

2. After Google OAuth login, show a checkbox: "Stay in the loop — join [Artist Display Name]'s mailing list"
   - If checked, set `mailing_list_opt_in = 1` and `opted_in_at = now`
   - If unchecked, leave as 0
   - Only shown to new users on first login (don't nag returning users)
   - Can also be toggled later in a user's profile/settings if billy-fm ever has a user-facing settings page

3. **Weekly Cron Trigger** (Cloudflare Worker scheduled event):
   - Runs once per week (e.g., Monday 9am PT)
   - Queries: `SELECT email, display_name, opted_in_at FROM users WHERE mailing_list_opt_in = 1 AND opted_in_at > [last_run_date]`
   - If new opt-ins exist, sends an email via **Resend** API to the artist's email
   - Subject: `URGENT: ADD EMAILS TO SUBSTACK LIST`
   - Body: simple list of new emails with names and opt-in dates
   - If no new opt-ins, no email sent (don't spam yourself)

4. **Resend setup:**
   - Free tier: 3,000 emails/month, 100/day — more than enough for a weekly digest
   - Use Resend's onboarding domain for sending (no custom domain email setup required)
   - One secret needed: `RESEND_API_KEY`
   - Simple POST to `https://api.resend.com/emails`

5. Add to `wrangler.toml`:
   ```toml
   [triggers]
   crons = ["0 16 * * 1"]  # Every Monday at 4pm UTC (9am PT)
   ```

**Only applies to Google OAuth users.** Client set visitors (password-only access) are not prompted and not captured.

### 3m. billy-fm: Notification system

**In-app notifications (badge + dropdown):**
- Unread count badge on a bell icon in the billy-fm header
- Dropdown shows recent notifications with timestamps
- Click to mark as read, "Mark all as read" option
- Full notifications page is a future build — dropdown is enough for first deploy

**Notification triggers:**
- Client submits a set → in-app notification + Resend email to artist
- Client makes changes to a previously submitted set (if unlocked) → in-app notification + Resend email
- Weekly mailing list digest (if new opt-ins) → Resend email only (no in-app)

**Email notifications via Resend:**
- Same Resend account and API key as the mailing list digest
- Sent from Resend's onboarding domain (e.g., `onboarding@resend.dev`)
- Client set submission email subject: "[Client Name] submitted their set for [Event Date]"
- Body: summary of selections, divisions, special requests, link to view in billy-fm

### Deliverables
- [ ] React wedding detail editor in billy-book
- [ ] Auto-create client set on gig save (any gig type) in billy-book
- [ ] billy-fm set ID stored in billy-book gig record
- [ ] Cross-link UI in both directions
- [ ] Data sync: billy-book gig edits push to billy-fm client set
- [ ] Delete safety: warning dialog with billy-fm API check before deleting linked gigs
- [ ] Setlist link auto-inserted in gig notes
- [ ] Database migrations (client set fields, lock state, submissions, notifications, off-list requests, mailing list)
- [ ] Client set password auth flow
- [ ] Client set shareable page (interactive builder with drag-and-drop, client-created divisions, per-song notes/priority)
- [ ] Client set submit flow (locks set, saves JSON snapshot, generates PDF, triggers notifications)
- [ ] Client set lock/unlock from artist dashboard (first deploy)
- [ ] Songbook shareable page (read-only browser with URL param pre-filtering + artist-configurable default filters)
- [ ] `/api/sets/`, `/api/songbook/`, `/api/repertoire/`, `/api/notifications/` endpoints
- [ ] Color scheme system (wedding, corporate, birthday, residency, standard)
- [ ] Display name in settings
- [ ] Client sets section in playlists dashboard
- [ ] In-app notification system (badge + dropdown)
- [ ] Resend integration for client set submission emails + mailing list digest
- [ ] Mailing list opt-in checkbox on Google OAuth login
- [ ] Weekly Cron Trigger for mailing list digest
- [ ] `RESEND_API_KEY` secret set in billy-fm worker
- [ ] Mobile-first responsive design for all client-facing pages

---

## Phase 4 — conor.bio Integration

### 4a. Wedding Portal — Preserved in Full

The wedding portal at `conor.bio/clients/[slug].html` is a **complete, wedding-specific client experience**. It is NOT replaced by billy-fm. It lives alongside billy-fm client sets — the portal is for weddings, billy-fm client sets are for all other gig types.

**The portal has 7 sections. All are preserved:**

1. **Wax Seal Gate** — full-screen entrance, tap to open. Animated cracking seal, "from conor thaxter" branding. Sets the tone.

2. **Welcome** — hero section with couple names, wedding date, venue pill badges, and a personal note from Conor. Data loaded from billy-book API.

3. **Song Selections (Step 1)** — NOW POWERED BY BILLY-FM. The current Google Sheets implementation is replaced with a billy-fm client set iframe embedded inline:
   ```html
   <iframe
     src="https://billy-fm.[domain]/set/[share_slug]"
     style="width:100%;border:none;min-height:600px;"
     title="Song Selection">
   </iframe>
   ```
   - The iframe shows the full client set builder (browse songbook, add songs, create divisions, special requests, drag-and-drop)
   - When the client submits their selections inside the iframe, the iframe transitions to a locked "Selections sent ✓" state
   - The portal page itself does NOT need to know about the submission — the iframe handles everything
   - The iframe's color scheme is set to "wedding" (elegant, matching portal aesthetic)
   - No password prompt inside the iframe when accessed from the portal — the portal URL IS the access key (the iframe src includes a token or the set is configured to allow access from the portal origin without a separate password)

4. **Contract (Step 2)** — e-signature flow. Contract text populated from billy-book. Client types their name to sign, timestamp saved back to billy-book's `clients.notes` JSON. Download contract as PDF button.

5. **Invoice & Payment (Step 3)** — invoice card populated from billy-book gig data (rate, deposit, balance, payment status). Venmo and Zelle payment links.

6. **Contact (Always Here)** — Conor's phone, email, web links. Static content.

7. **Post-Wedding Gift** — locked until the day after the wedding (date-gated). Opens a modal with:
   - Two audio player cards (custom recordings uploaded to Cloudflare R2)
   - Download button for recordings
   - Review prompt (link to The Knot review page)
   - Note/rating form (textarea + 5-star rating, sends back to billy-book)

**Portal data sources:**
- Welcome, Contract, Invoice, Gift: all from **billy-book** API (via server-side Pages Function proxy)
- Songs: from **billy-fm** (via iframe)
- Contact: static HTML

**What changes vs. current implementation:**
- Song section: Google Sheets → billy-fm iframe (this is the ONLY section that changes)
- API calls: direct with exposed key → via Pages Function proxy (Phase 1 fix)
- Everything else: unchanged

**What does NOT change:**
- The wax seal gate
- The sticky nav header
- The section structure and flow (Welcome → Songs → Contract → Invoice → Contact → Gift)
- The contract e-signature flow
- The invoice display and payment links
- The gift modal with audio players
- The review prompt and note form
- The overall aesthetic (dark bg, blue accent, Cormorant Garamond + Outfit)

### 4a-1. Portal iframe auth: no double-password

When the billy-fm client set is embedded in the portal, the client should NOT have to enter a password inside the iframe — they already accessed the portal via its URL (which is the access key). Options:

- The portal's Pages Function generates a short-lived token and passes it to the iframe via query param: `?token=xxx`
- OR the client set is configured to allow password-free access when the referrer is `conor.bio`
- The standalone billy-fm client set link (outside the portal) still requires a password

This prevents the awkward UX of: open portal → see Songs section → hit a password wall inside the iframe.

### 4b. Repertoire modal (replaces existing song lists)

Build a reusable modal component (vanilla JS, matching conor.bio's existing HTML/CSS/JS architecture) that:
- Fetches from billy-fm's public `/api/repertoire/[user_id]` endpoint
- Shows songs in a browsable, filterable list
- Supports tag filtering (genre, era, mood, custom tags like "wedding")
- Searchable by title/artist
- Read-only — no selection, no building
- Styled to match conor.bio's aesthetic (dark bg, blue accent, Cormorant Garamond + Outfit)

**Where it appears:**
- `/weddings` and `/events` — opens as a modal via a "Browse My Repertoire" button
  - Wedding page auto-applies "wedding" tag filter on open
  - Events page opens unfiltered
- `/stream` and `/primo` — replaces the existing hardcoded song lists
  - Same modal, opened inline or via button
  - Stream page may have a different default filter than primo

### 4c. Deprecation: save-songs.js

The Google Sheets Pages Function at `/functions/api/save-songs.js` remains as a fallback until billy-fm client sets are confirmed working end-to-end. Once verified:
- Remove `save-songs.js`
- Remove `GOOGLE_SERVICE_KEY` from Pages environment
- Remove `SHEET_ID` references from portal CONFIG blocks

### 4d. Dynamic portal routing (future improvement)

Instead of one HTML file per couple, create a Cloudflare Pages Function at `/functions/clients/[slug].js` that:
1. Receives the slug from the URL
2. Fetches couple data from billy-book via the proxy
3. Fetches the billy-fm set share_slug
4. Returns a populated HTML page with the iframe embedded

This eliminates manual HTML file creation per client. Not required for initial launch but should be planned.

### Deliverables
- [ ] Portal song section replaced with billy-fm iframe embed
- [ ] Portal iframe auth: token-based or origin-based bypass so clients don't see a password wall
- [ ] Iframe shows "Selections sent ✓" locked state after client submits
- [ ] All other portal sections (gate, welcome, contract, invoice, contact, gift) unchanged
- [ ] Repertoire modal component for conor.bio
- [ ] Modal integrated on /weddings, /events, /stream, /primo
- [ ] Tag-based filtering with per-page defaults
- [ ] save-songs.js marked deprecated (kept as fallback)
- [ ] Dynamic routing spec'd for future phase

---

## Tagging Strategy

Billy-fm's tag system is critical for powering the repertoire modal, client set filtering, and songbook. Tags need to be thorough and consistent.

### Required tag categories

- **Genre**: pop, rock, r&b, jazz, soul, folk, country, indie, classical, musical-theater, etc.
- **Era**: 50s, 60s, 70s, 80s, 90s, 2000s, 2010s, 2020s
- **Mood/Vibe**: romantic, upbeat, mellow, dance, chill, emotional, fun
- **Event type**: wedding, corporate, birthday, holiday, cocktail-hour, ceremony, reception, dinner
- **Custom**: first-dance, processional, recessional, sing-along, crowd-pleaser

### Tagging work required

All songs in the billy-fm library need to be tagged with relevant event types, especially:
- Every wedding-appropriate song tagged with `wedding`
- Ceremony vs. reception vs. cocktail-hour distinctions
- This is a manual curation task but can be batch-assisted

---

## Cross-App Authentication Summary

| Connection | Method | Details |
|-----------|--------|---------|
| Conor → billy-book | Hardcoded API key | `MeatGalaxy369!` (move server-side in Phase 1) |
| Conor → billy-fm | Google OAuth | Session cookie, existing implementation |
| billy-book → billy-fm | Shared service key | `BILLY_FM_SERVICE_KEY` in both workers, `Authorization: Bearer` header |
| Portal → billy-book | Server-side proxy | Pages Function reads `BILLY_API_KEY` from env |
| Portal → billy-fm | iframe embed | Client set handles its own password auth |
| conor.bio modal → billy-fm | Public API | No auth, read-only repertoire endpoint |
| Client → billy-fm set | Password | Per-set password, short-lived session token |
| Songbook viewer → billy-fm | Public | No auth, read-only |

---

## Environment Variables — Complete List

### billy-book Worker secrets
```
API_KEY              — existing admin key
BILLY_FM_SERVICE_KEY — shared secret for billy-book → billy-fm calls
BILLY_FM_API_URL     — base URL of billy-fm worker (e.g., https://billy-fm-worker.conorthaxter.workers.dev)
```

### billy-fm Worker secrets
```
BILLY_FM_SERVICE_KEY   — same value, validates incoming billy-book calls
GOOGLE_CLIENT_ID       — existing Google OAuth
GOOGLE_CLIENT_SECRET   — existing Google OAuth
SESSION_SECRET         — for cookie signing
SPOTIFY_CLIENT_ID      — for Spotify import feature
SPOTIFY_CLIENT_SECRET  — for Spotify import feature
RESEND_API_KEY         — for client set notifications + weekly mailing list digest
```

### billy-fm Worker vars (wrangler.toml)
```
FRONTEND_ORIGIN        — deployed Pages URL
GOOGLE_REDIRECT_URI    — production OAuth callback
GOOGLE_CLIENT_ID       — can be in vars (not secret)
BILLY_BOOK_URL         — base URL of billy-book worker (for cross-linking)
ENABLE_CLIENT_SETS     — "false" in production until ready, "true" to enable
ARTIST_EMAIL           — artist's email for notifications (e.g., your Gmail)
```

### conor.bio Pages secrets
```
BILLY_API_KEY         — billy-book API key (moved from HTML source)
BILLY_FM_URL          — base URL of billy-fm worker
```

---

## Implementation Order Summary

```
Phase 1: Security Fixes
  └── 1. Create Pages Function proxy for portal → billy-book
  └── 2. Add /api/clients/by-slug/[slug] to billy-book worker
  └── 3. Update portal HTML to use proxy
  └── 4. Verify Vicky & Eden portal still works
  └── ⚠️ DO NOT touch Vicky & Eden page content

Phase 2: Billy FM Stabilization & Deployment
  └── ONE codebase, ONE deploy, feature flags gate unreleased features
  └── All local dev uses `wrangler dev --remote` (shared production D1)
  └── 2a. Fix locally first:
        └── 1. Fix playlist load error (blocker)
        └── 2. Fix Spotify API import
        └── 3. General bug fixes and polish
  └── 2b. Deploy:
        └── 1. Create D1 database + run migrations
        └── 2. Deploy worker + frontend to Cloudflare
        └── 3. Set ENABLE_CLIENT_SETS = false in production
        └── 4. Verify everything works deployed
        └── 5. Switch to wrangler dev --remote for all local work
  └── 2c. Set BILLY_FM_SERVICE_KEY in both workers
  └── 2d. Add withServiceAuth middleware

Phase 3: billy-book ↔ billy-fm Connection
  └── 1. React wedding detail editor in billy-book
  └── 2. Auto-create client set on any gig save
  └── 3. Cross-link storage and UI both directions
  └── 4. Data sync: billy-book edits push to billy-fm
  └── 5. Delete safety: warning + API check before deleting linked gigs
  └── 6. Client set schema migrations (lock state, submissions, notifications, off-list, mailing list)
  └── 7. Client set password auth
  └── 8. Client set shareable page (drag-and-drop builder, client-created divisions, notes, priority)
  └── 9. Client set submit flow (lock, snapshot, PDF, notification)
  └── 10. Client set lock/unlock from artist dashboard (first deploy)
  └── 11. Songbook page (read-only browser, URL param filtering, artist-configurable defaults)
  └── 12. Off-list special requests (free-text fields, capped count, hidden if 0)
  └── 13. Color scheme system
  └── 14. Display name in settings
  └── 15. Client sets dashboard section
  └── 16. In-app notification system (badge + dropdown)
  └── 17. Resend integration (client set submission emails + mailing list digest)
  └── 18. Mailing list opt-in on Google OAuth login
  └── 19. Weekly Cron Trigger for mailing list digest

Phase 4: conor.bio Integration (same tech as Phase 3, parallel where possible)
  └── 1. Repertoire modal component
  └── 2. Replace song lists on /stream, /primo
  └── 3. Add modal to /weddings, /events
  └── 4. Replace Google Sheets in portal with billy-fm iframe
  └── 5. Deprecate save-songs.js (keep as fallback until confirmed)
  └── 6. Plan dynamic portal routing (future)
```

---

## Notes for Claude Code

### billy-book
- Worker is a single file with all API routes, no router library
- Frontend is `App.jsx` — ~730 lines, self-contained React app
- Wedding data lives in `clients.notes` as a JSON string — always parse with try/catch
- `wedding-panel.js` is dead code — do not reference it, build React-native instead
- The existing hardcoded API key in `api.js` must NOT be removed until the Pages Function proxy is confirmed working
- Gig types: wedding, corporate, residency, old_folks_home, one_off, other_nonmusic

### billy-fm
- Worker uses itty-router (AutoRouter) with TypeScript
- Frontend is React/Vite with context providers (SettingsContext, PlayStateContext)
- API client layer is modular: `src/api/client.js` base, then `songs.js`, `playlists.js`, etc.
- Google OAuth is fully implemented — do NOT touch the auth flow
- Schema already has `playlists`, `playlist_songs`, `share_slug`, `client_name`, `event_date`
- New fields needed: password, off_list_requests, is_locked, locked_at, color_scheme, source, source_gig_id, metadata
- New tables needed: off_list_requests, set_submissions, notifications
- New columns on users: mailing_list_opt_in, opted_in_at
- There is NO song allowance / song limit — clients can pick unlimited songs from the songbook. The only cap is on off-list special requests (free-text fields).
- The `user_library` table uses a snapshot-on-add pattern — songs copied from marketplace to user's library with independent edits
- `is_public` flag on `user_library` entries controls what appears in public repertoire/songbook
- Client-facing pages (client set builder, songbook) must be equally good on mobile and desktop
- billy-book → billy-fm is a Conor-only integration for now. Other artists use billy-fm directly without billy-book.
- **BUG: Playlists page errors on load — diagnose and fix before any playlist/client set work**
- **BUG: Spotify API import is broken — must be fixed before deployment**
- **DATA QUALITY: Era tags are mostly missing/wrong, BPM data is spotty — do not rely on these as filters until data is cleaned up**

### conor.bio
- Pure HTML/CSS/JS — no build system, no framework
- Each portal page has a `CONFIG` block at the top with `CLIENT_ID`, `API_KEY`, `PORTAL_SLUG`, `SHEET_ID`
- Fonts: Cormorant Garamond (serif headers) + Outfit (body)
- Colors: dark bg (#000), blue accent (#1e3a8a), light text (#fbf3fa)
- The repertoire modal must be vanilla JS to match the existing architecture
- `save-songs.js` is a Cloudflare Pages Function that writes to Google Sheets — keep as fallback
- DO NOT modify the Vicky & Eden portal page until after Phase 1 is verified working

### Across all apps
- All three are on the same Cloudflare account
- D1 is the database for both billy-book and billy-fm
- CORS must be configured correctly for cross-origin calls between workers
- The portal slug in conor.bio, the share_slug in billy-fm, and the portalSlug in billy-book must always be kept in sync
- billy-fm is designed for multi-artist use long-term — never hardcode Conor-specific assumptions into the billy-fm codebase
