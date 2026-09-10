# ACTION PLAN — billy-fm (v4)
*For use by Claude Code inside `~/Desktop/billy-fm`*
*March 26, 2026 — replaces all previous action plans*

**First: delete any old files named BILLY-INTEGRATION*.md, ACTION-PLAN*.md, or BILLY-FM-STATUS*.md in this repo — EXCEPT this file and BILLY-INTEGRATION-MASTER-V4.md.**

---

## Current State

- Worker deployed at billy-fm-worker.conorthaxter.workers.dev
- Frontend at billy-fm.pages.dev
- D1 live with all Phase 3f migrations applied
- ENABLE_CLIENT_SETS = true
- Client set page built but has bugs
- Notifications, songbook, repertoire all working
- CORS missing conor.bio (broke after redeploy)

---

## Prompt Sequence

### PROMPT 1: Delete old docs

```
Delete any files in this project root matching:
- BILLY-INTEGRATION*.md (any variation EXCEPT BILLY-INTEGRATION-MASTER-V4.md)
- ACTION-PLAN*.md (any variation EXCEPT ACTION-PLAN-BILLY-FM-V4.md)
- BILLY-FM-STATUS*.md (any variation)
```

---

### PROMPT 2: Fix CORS — add conor.bio

```
In worker/src/middleware.ts, find the getAllowedOrigins function or CORS allowed origins list.

Add "https://conor.bio" if it's not already there. Also confirm these are all present:
- https://billy-fm.pages.dev
- https://billy-book.pages.dev
- https://conor.bio
- http://localhost:5173
- http://localhost:8787

Redeploy: cd worker && wrangler deploy
```

---

### PROMPT 3: Artist playlist — delete + drag/drop + add songs

```
The artist-facing playlist view (PlaylistsPanel in center panel) needs three improvements:

1. DELETE SONGS FROM PLAYLIST
Each song row in the playlist detail view needs a delete button (trash icon or ×). On click, call DELETE /api/playlists/:id/songs/:songId. Confirm the endpoint exists in playlists.ts — if not, add it. Refresh the song list after deletion.

2. DRAG TO REORDER IN ARTIST PLAYLIST
Songs in the artist playlist detail view should be draggable to reorder. Use @hello-pangea/dnd (already installed). On reorder, call PUT /api/playlists/:id/songs/order with the new positions array. Check if this endpoint exists — if not, add it to playlists.ts.

3. ADD SONGS TO PLAYLIST — TWO MODES
Add an "Add Songs" button to the playlist detail view header. When clicked, show two options:

MODE A — Quick Search:
- A search input appears inline
- Same search logic as the main SearchBar
- Selecting a result adds the song to the END of the playlist via POST /api/playlists/:id/songs
- Dismiss by pressing Escape or clicking away

MODE B — Song Grid Mode:
- A "Browse Library" button activates song grid mode
- In this mode, the center panel shows the full song grid (exactly like the main library view)
- The RIGHT panel changes from Queue to show the current playlist being edited
- Songs can be dragged from the grid into the playlist panel on the right
- Pressing Enter on a selected song adds it to the playlist
- A visible "Exit" or "Done" button at the top returns to normal mode
- When exiting, the center panel returns to its previous state

Build and push: npm run build && git add -A && git commit -m "playlist: delete, drag-reorder, add songs" && git push
```

---

### PROMPT 4: Fix client set page

```
Fix these bugs on the client-facing set page (src/pages/ClientSetPage.jsx):

1. FONT — Remove all monospace font usage. The primary font should be Inter throughout. Check inline styles and any CSS classes for font-family: monospace or similar and replace with Inter, sans-serif.

2. COLOR SCHEMES — The color schemes are defined but not applying correctly. The wedding scheme should be:
   - Background: #faf7f2 (ivory)
   - Text: #1a1a1a (near black)
   - Accent: #b8960c (warm gold)
   - Button background: #b8960c, button text: #fff
   
   Verify that when the set has color_scheme = "wedding", these CSS variables are applied to the page root element. Add a visible check: log the color_scheme value from the API response to the console so we can confirm it's being read.

3. WEDDING TAG FILTER CTA — For sets with color_scheme = "wedding" ONLY, add a prominent filter button in the song bank section above the search bar. Style it in a larger serif/script-adjacent font (Cormorant Garamond or Georgia). Text: "Browse Wedding Songs ♡". When clicked, filters the song bank to only show songs tagged "wedding". When active, show a clear "Show All Songs" option to reset.

4. SPECIAL REQUESTS DISPLAY — After a client submits special requests (the free-text fields), make sure they're stored via POST /api/sets/:slug/requests. Verify this endpoint is wired correctly in sets.ts.

5. LOCK/UNLOCK — The client set page should show a lock state correctly. Check that when is_locked = 1, the page shows a read-only view. The "Finalized on Invalid Date" bug: find where the locked_at date is being displayed and fix the date formatting. Use: new Date(lockedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })

Build and push: npm run build && git add -A && git commit -m "client set: font, color schemes, wedding CTA, date fix" && git push
```

---

### PROMPT 5: Artist backend — client set management

```
The artist-facing playlist view needs to handle client sets specifically.

1. UNLOCK CLIENT SETS
In the playlist detail view, if the playlist has playlist_type = 'client_set':
- Show a lock/unlock toggle button (e.g. "🔒 Locked" / "🔓 Unlocked")
- On click: PATCH /api/playlists/:id/lock with { locked: true/false }
- Update UI immediately after response
- When locked: show "Client cannot edit" indicator
- When unlocked: show "Client can edit" indicator

2. SPECIAL REQUESTS SECTION
In the playlist detail view, if playlist_type = 'client_set':
- Below the song list, show a "Special Requests" section
- Fetch from GET /api/playlists/:id — check if off_list_requests data is included
- If not, add a separate fetch to GET /api/sets/:slug/requests (using share_slug)
- Display each request as a card with the request text and any note
- Show "No special requests yet" if empty

3. METADATA DISPLAY
In the playlist detail view, if playlist_type = 'client_set':
- Show a small info section with: client_name, event_date, color_scheme, source_gig_id
- Parse the metadata JSON field and show: gig_type, venue, portal_slug
- This gives the artist full context without switching to billy-book

Build and push: npm run build && git add -A && git commit -m "artist: client set lock/unlock, special requests, metadata" && git push
```

---

### PROMPT 6: Spotify import modal fix + chord charts

```
Two fixes:

1. SPOTIFY IMPORT MODAL FORMATTING
The import search results modal is broken — no song titles showing, checkbox weirdly placed, album art misaligned.

Find the ImportDialog component (likely src/components/ImportDialog.jsx). The search results list should look like the main search bar results:
- Each result: album art thumbnail (40x40px) on left, song title bold, artist name muted below, checkbox on the far right
- Clean row layout, full width, subtle dividers between results
- Same hover state as main search results

2. CHORD CHART LINK — AUTO GOOGLE SEARCH
When a song is added to the library (imported OR manually created), the chord_url field should auto-populate with a Google search URL if it's empty:
https://www.google.com/search?q=[song+title]+[artist+name]+chords

Generate this URL from the song title and artist name. URL-encode both. Store it as the default chord_url. The user can always overwrite it with a specific URL later.

Apply this auto-generation in two places:
- On Spotify import: after the song data is assembled, if chord_url is empty, generate the Google search URL
- On manual song creation: same logic in the song creation handler

Build and push: npm run build && git add -A && git commit -m "import: fix modal UI, auto chord URL" && git push
```

---

### PROMPT 7: Mailing list prompt redesign

```
Redesign the MailingListPrompt component (src/components/MailingListPrompt.jsx):

1. LAYOUT — Full centered modal, not a small popup:
   - Full-screen backdrop with blur: backdrop-filter: blur(8px), background: rgba(0,0,0,0.7)
   - Modal card centered on screen: max-width 480px, padding 40px, border-radius 12px
   - Dark background matching app theme
   - Appears above everything (z-index: 9999)

2. COPY — Change text to:
   Heading: "Stay in the loop"
   Body: "Receive updates from the developer of billy-fm."
   Checkbox label: "Yes, add me to the list"
   Button: "Continue"

3. BEHAVIOR — Keep existing logic:
   - Only shows for new users (mailing_list_opt_in is null)
   - localStorage key prevents re-showing
   - Checked + Continue → PATCH /auth/me with { mailing_list_opt_in: true }
   - Unchecked + Continue → dismiss, set localStorage key, don't patch

Build and push: npm run build && git add -A && git commit -m "mailing list: full modal redesign" && git push
```

---

## Tests

- [ ] conor.bio repertoire modal loads songs (CORS fix confirmed)
- [ ] Artist can delete songs from playlist
- [ ] Artist can drag to reorder playlist songs
- [ ] "Add Songs" quick search works — song appended to playlist
- [ ] "Browse Library" song grid mode works — right panel shows playlist
- [ ] Client set page uses Inter font throughout
- [ ] Wedding color scheme (ivory/gold) applies correctly
- [ ] "Browse Wedding Songs ♡" button appears on wedding sets
- [ ] Wedding tag filter works and resets
- [ ] Lock/unlock toggle visible in artist playlist view for client sets
- [ ] Special requests visible in artist playlist view
- [ ] Metadata (venue, gig type, portal slug) visible in artist playlist view
- [ ] "Finalized on [date]" shows correct date format
- [ ] Spotify import modal shows title, artist, album art, checkbox correctly
- [ ] Imported songs auto-get chord chart Google search URL
- [ ] Mailing list prompt is full centered modal with blur backdrop
