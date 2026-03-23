# Master Integration Spec — billy-book × billy-fm × conor.bio
*Version 2 — March 23, 2026*
*This document replaces ALL previous integration docs across ALL repos.*
*Claude Code: delete any file named BILLY-INTEGRATION*.md, ACTION-PLAN-*.md, or BILLY-FM-STATUS*.md that is NOT this file.*

---

## System Overview

Three apps. One ecosystem. Billy-fm is designed as a multi-artist product long-term.

| App | What it is | Stack | Status | URL |
|-----|-----------|-------|--------|-----|
| **billy-book** | Private finance, booking & client management | React/Vite frontend + Cloudflare Worker (conor-finance-api) + D1 | Live | Frontend: conor-finance.pages.dev · Worker: conor-finance-api.conorthaxter.workers.dev |
| **billy-book-api** | billy-book's Cloudflare Worker backend | Single-file JS worker + D1 | Live | conor-finance-api.conorthaxter.workers.dev |
| **billy-fm** | Music backend: setlist manager, repertoire source of truth, client set builder, songbook | React/Vite + Cloudflare Worker (TypeScript/itty-router) + D1 | Deployed | Worker: billy-fm-worker.conorthaxter.workers.dev · Frontend: billy-fm.pages.dev |
| **conor.bio** | Public marketing site + wedding client portal | Static HTML/CSS/JS on Cloudflare Pages | Live | conor.bio |

---

## Current State (as of March 23, 2026)

### What's DONE

**billy-book-api (conor-finance-api worker):**
- `/api/clients/by-slug/:slug` endpoint — live, uses `json_extract` with `json_valid` guard
- `BILLY_FM_API_URL` var placeholder in wrangler.jsonc
- API_KEY rotated to new hash value

**billy-book (frontend):**
- WeddingPanel extracted to `src/WeddingPanel.jsx`
- Data model updated: `billyFmSetId`, `offListRequests`, `colorScheme`, `contractSigned`, `signedBy`, `signedAt` all present. `songAllowance` and `sheetId` removed.
- `api.js` has `createClientSet`, `updateClientSet`, `getClientSet`, `deleteClientSet`, `checkClientSetExists` — all pointing at billy-fm-worker
- `saveGig` auto-creates client set if none exists, patches if one does
- `updateClient` syncs metadata to billy-fm on save
- Delete safety dialog with two-stage confirm for linked gigs
- All billy-fm calls are non-blocking (failures logged, don't break gig save)

**billy-fm:**
- Worker + frontend deployed to Cloudflare
- D1 database live with base schema
- `withServiceAuth` + `withAuthOrService` middleware implemented
- `resolveUserId()` helper maps service user → real user for D1 FK constraints
- CORS allows billy-fm.pages.dev, billy-book.pages.dev, localhost origins
- `POST /api/playlists` and `PATCH /api/playlists/:id` work with service auth

**conor.bio:**
- `functions/api/client-data.js` proxy — GET by slug, PUT for contract saves
- `functions/api/gig-data.js` proxy — GET gigs filtered by client
- `functions/api/save-songs.js` moved to correct path (Google Sheets fallback works)
- `harrison-maya.html` — API key removed, fetches routed through proxies
- Dead files deleted (old integration doc, wedding-panel.js)
- robots.txt and sitemap.xml updated

### What's BROKEN / NOT DONE

**billy-book:**
- `createClientSet` payload is incomplete — sends 5 fields, should send ~10 (see §Payload Fix below)
- `BILLY_FM_SERVICE_KEY` hardcoded client-side in `api.js` (tech debt, TODO exists)
- No "Open in Billy FM →" button in gig detail view
- No setlist link auto-inserted in gig notes
- No tech specs section (piano provided, sound provider, sound tech)
- Delete safety doesn't call billy-fm API to verify set exists + get submission count

**billy-fm:**
- Phase 3f schema migrations NOT RUN — no `password`, `off_list_requests`, `is_locked`, `locked_at`, `color_scheme`, `source`, `source_gig_id`, `metadata` columns. No `off_list_requests`, `set_submissions`, `notifications` tables. No `mailing_list_opt_in` on users.
- Spotify import broken (missing `.dev.vars`)
- `ENABLE_CLIENT_SETS` feature flag not implemented
- No client set endpoints (`/api/sets/*`)
- No songbook/repertoire public endpoints
- No notification system
- No mailing list opt-in or Resend cron
- UX issues (see §Billy-FM UX Fixes below)
- Era tags mostly missing/broken
- Genre filtering not working
- Playlist rename not available

**conor.bio:**
- `BILLY_API_KEY` secret not confirmed set in Cloudflare Pages
- `SHEETS_API_KEY` is placeholder — Google Sheets song display broken (fallback system, will be replaced)
- No repertoire modal
- No billy-fm iframe embed in portal
- Phase 4 fully blocked on billy-fm

---

## Billy-FM UX Fixes (Do Before Integration Work)

These are immediate fixes to the current billy-fm app. Do these BEFORE building client set endpoints or other Phase 3 features.

### Layout & Navigation
1. **Remove playlists tab from center nav.** Center nav should only have: My Songbook, Public Songbook. Playlists stay in the left panel where they are now.
2. **Rename "My Library" to "Library"** in the UI.
3. **Move Public Songbook to the right** in the nav layout.
4. **When clicking a playlist, open its contents in the left panel** — do NOT navigate to `/playlists`. Drop the playlist content (the current playlist detail view) into the same left panel. Song selector stays still, everything keeps functioning. Transfer the existing playlist detail layout as directly as possible into that panel.
5. **Move the favorite star to bottom-left of the playlist card/box.**
6. **Add playlist rename option** — editable title on playlists.

### Song Interaction
7. **Clicking a song in a playlist should load it in the left panel** — same options as the main song selector screen (edit, view details, etc.).
8. **Clicking a song should bring it up in "now playing"** (the play state).
9. **Multi-select songs** — both in the main song selector and in playlists. When multiple songs are selected, show a "Link Transitions" button. Linking transitions in order: if songs A, B, C are selected in that order, A gets transition → B, B gets transition → C.

### Search/Cursor Fix
10. **Cursor-follow for arrows breaks double-enter search selection.** Current behavior: pressing Enter on a search result selects it, but if the cursor has moved (via arrow keys), the second Enter selects wherever the cursor is instead of confirming. Fix: add a grace period after the last Enter or arrow key press where cursor position is not tracked for selection purposes. Same grace period applies after arrow key navigation.

### Data Quality
11. **Eras not working** — many songs have no era in the songbook. In public songbook search, era filtering appears completely non-functional. Diagnose and fix.
12. **Genre tags not working** — filtering by genre not returning correct results. Diagnose and fix.

---

## Payload Fix: billy-book → billy-fm createClientSet

billy-book currently sends:
```json
{
  "title": "Harrison & Maya — 2026-06-15",
  "color_scheme": "wedding",
  "off_list_requests": 2,
  "source": "billy-book",
  "source_gig_id": "qi9o2qil"
}
```

billy-fm's `POST /api/playlists` accepts:
```json
{
  "title": "string (required)",
  "playlist_type": "string (defaults to 'set')",
  "notes": "string",
  "is_public": "boolean (defaults to false)",
  "client_name": "string",
  "event_date": "string"
}
```

**After Phase 3f migrations are run**, billy-fm will also accept: `color_scheme`, `source`, `source_gig_id`, `metadata`, `password`, `off_list_requests`, `is_locked`.

**Fix in billy-book** — update `saveGig` in `App.jsx` to send the full payload:
```json
{
  "title": "Harrison & Maya — 2026-06-15",
  "playlist_type": "client_set",
  "client_name": "Harrison & Maya",
  "event_date": "2026-06-15",
  "is_public": false,
  "color_scheme": "wedding",
  "off_list_requests": 2,
  "source": "billy-book",
  "source_gig_id": "qi9o2qil",
  "metadata": {
    "gig_type": "wedding",
    "venue": "Horse Club",
    "portal_slug": "harrison-maya"
  }
}
```

`metadata` will be stored as a JSON string in the `metadata` TEXT column (after migration). Fields that already have dedicated columns (`color_scheme`, `source`, etc.) go as top-level fields. Nested metadata is for supplementary info that doesn't need its own column.

---

## Billy-Book: Tech Specs Section (New Feature)

Add a generic tech specs section to the **gig detail view** (not wedding-specific). Fields:
- **Piano provided** — boolean toggle (Yes/No)
- **Sound provider** — text field (who's providing sound equipment)
- **Sound tech** — text field (name/contact of the sound tech)
- **Tech notes** — free-text field for additional technical details

Store as JSON in the gig's `notes` field (or a new `tech_specs` JSON field if the notes field is already overloaded). These fields appear on ALL gig types, not just weddings.

---

## What Each App Owns

**billy-book** owns:
- Client records, gig records, invoices, expenses, contractors
- Wedding detail editing (WeddingPanel)
- Tech specs per gig
- Triggering client set creation in billy-fm on gig save
- Cross-link to billy-fm sets

**billy-fm** owns:
- Master song/repertoire database (source of truth)
- ALL playlists — both artist setlists and client sets
- Client set builder (password-protected, shareable, embeddable)
- Songbook (read-only public repertoire)
- Play history, sessions, transitions
- Notification system
- Mailing list opt-in (Google OAuth users)

**conor.bio** owns:
- Public marketing pages
- Wedding client portal (per-couple pages with 7 sections)
- Repertoire modal (powered by billy-fm API)
- Embeds billy-fm client sets via iframe in portal song section
- No database — reads from billy-book and billy-fm

---

## Cross-App Authentication

| Connection | Method |
|-----------|--------|
| Conor → billy-book-api | API key (rotated, stored as Cloudflare secret) |
| Conor → billy-fm | Google OAuth session cookie |
| billy-book → billy-fm | Shared `BILLY_FM_SERVICE_KEY` Bearer token |
| conor.bio → billy-book-api | Pages Function proxy (reads `BILLY_API_KEY` from env) |
| conor.bio → billy-fm | iframe embed (client set handles own auth) |
| Client → billy-fm client set | Per-set password, session token |
| Public → billy-fm songbook/repertoire | No auth, read-only |

---

## Environment Variables

### billy-book-api (conor-finance-api) — wrangler.jsonc
```
Secrets: API_KEY, BILLY_FM_SERVICE_KEY (future)
Vars: BILLY_FM_API_URL (currently empty placeholder)
D1: DB binding → conor-finance-api database
```

### billy-fm worker — wrangler.toml
```
Secrets: GOOGLE_CLIENT_SECRET, SESSION_SECRET, SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET, BILLY_FM_SERVICE_KEY, RESEND_API_KEY (future)
Vars: FRONTEND_ORIGIN, GOOGLE_REDIRECT_URI, GOOGLE_CLIENT_ID, BILLY_BOOK_URL (future), ENABLE_CLIENT_SETS (future), ARTIST_EMAIL (future)
D1: DB binding → billy-fm-db
```

### conor.bio — Cloudflare Pages
```
Secrets: BILLY_API_KEY (needs confirmation it's set)
```

---

## Implementation Order (Updated March 23)

```
IMMEDIATE — billy-fm UX fixes (do now, unblocks daily use)
  └── Layout/nav changes (playlists panel, songbook position, rename Library)
  └── Song interaction (click-to-load, now playing, multi-select transitions)
  └── Search/cursor grace period fix
  └── Era and genre filter fixes
  └── Playlist rename

THEN — billy-fm Phase 3f migrations + payload fix
  └── Run schema migrations on production D1
  └── Update billy-fm createPlaylist handler to accept new columns
  └── Fix billy-book createClientSet payload to send full data
  └── Verify end-to-end: save gig in billy-book → set appears in billy-fm with all metadata

THEN — billy-fm Phase 3 features (client sets, songbook, notifications)
  └── ENABLE_CLIENT_SETS feature flag
  └── Client set API endpoints (/api/sets/*)
  └── Client set password auth
  └── Client set shareable page (interactive builder, mobile-first)
  └── Songbook page (read-only, public)
  └── Notification system (bell + dropdown + Resend emails)
  └── Mailing list opt-in + weekly cron

THEN — billy-book remaining items
  └── Tech specs section in gig detail
  └── "Open in Billy FM →" button
  └── Setlist link auto-insert in gig notes
  └── Delete safety API verification

THEN — conor.bio Phase 4
  └── Confirm BILLY_API_KEY secret is set
  └── Repertoire modal on /stream, /primo, /weddings, /events
  └── Portal iframe embed of billy-fm client set
  └── Deprecate save-songs.js
```

---

## Notes for Claude Code (All Apps)

### billy-book-api
- Single-file worker: `src/worker.js` (~340 lines), inline if-statement routing
- Config is `wrangler.jsonc` (NOT wrangler.toml)
- D1 binding: `DB`
- Auth: `checkAuth()` compares Bearer token against `env.API_KEY`

### billy-book (frontend)
- `src/App.jsx` (~600 lines after WeddingPanel extraction)
- `src/WeddingPanel.jsx` — extracted, fully functional
- `src/api.js` — billy-book API + billy-fm stubs, `BILLY_FM_SERVICE_KEY` hardcoded client-side (tech debt)
- Wedding data in `clients.notes` as JSON string — always try/catch parse
- Gig types: wedding, corporate, residency, old_folks_home, one_off, other_nonmusic
- Inline styles, no CSS files. Follow existing patterns.

### billy-fm
- Worker: TypeScript, itty-router AutoRouter, modular routes in `worker/src/routes/`
- Frontend: React 18/Vite, contexts (SettingsContext, PlayStateContext), modular API layer (`src/api/`)
- `resolveUserId(env, userId)` in `playlists.ts` maps `'service'` → first real user. All service-auth routes must use this.
- `withAuthOrService` middleware for routes that accept both Google OAuth and service key
- D1 FK constraints enforced — service-created records must reference real user IDs
- `is_public` on `user_library` controls public songbook/repertoire visibility
- Phase 3f migrations NOT YET RUN — new columns don't exist on production D1 yet
- Spotify `.dev.vars` file missing — must create before Spotify works locally
- ALL local dev should use `wrangler dev --remote` (shared production D1)

### conor.bio
- Pure static HTML/CSS/JS, no build system
- Pages Functions in `functions/` directory
- Fonts: Cormorant Garamond + Outfit
- Colors: --bg: #000, --accent: #1e3a8a, --fg: #fbf3fa
- Deploy: `wrangler pages deploy . --project-name conor-bio-git`
- harrison-maya.html is the portal template (404'd from public, blocked from crawlers)
- vicky-eden.html is gift-only — DO NOT TOUCH
