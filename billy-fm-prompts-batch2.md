# BILLY fm — Prompt Batch (Post-7A)

Feed these to Claude Code in order. Start each with:
> Read ./billy-fm-build-plan.md and ./billy-fm-continuation-plan.md for context.

---

## Prompt A — Drag & Drop Everywhere + Panel Behavior

```
Overhaul drag-and-drop to work across all panels:

1. UNIVERSAL DRAG & DROP: Make songs draggable between ALL panels:
   - Grid tile → Queue (already works, keep it)
   - Grid tile → Now Playing (drop on Now Playing section = play it)
   - Now Playing → Queue (drag the now playing song into queue, clears now playing)
   - Now Playing → Previously Played (drag it there, clears now playing)
   - Queue → Now Playing (drag a queue item to now playing, removes from queue)
   - Queue → reorder within queue (already works, keep it)
   - Previously Played → Queue (drag a past song back into queue)
   - Previously Played → Now Playing (drag to replay it)
   - Previously Played → reorder within Previously Played (drag to reorder history)
   - Dragging anything OUT of Now Playing (to queue, to previously played, or
     just dragging it away) clears Now Playing.

   Use HTML5 drag and drop API. Each panel section should have dragover/drop
   handlers. Visual feedback: show a drop target highlight (border pulse or
   background tint) when dragging over a valid drop zone.

2. CLICK TO UNSELECT: Clicking on the currently selected song (already
   highlighted) should unselect it — clear the selection, close/reset the
   filter panel, remove the highlight from the tile.

3. FILTERED SONG POSITIONING: When a filter is active and the user clicks
   a song, that song should NOT move to the first tile position. It stays
   exactly where it is in the grid. Instead, other matching songs gather
   NEAR the selected song's current position. Non-matching songs fade.
   The selected song's grid position is the anchor — matched songs cluster
   around it, unmatched songs fade in place. No reordering of the selected
   song itself.

4. NOW PLAYING PERSISTS ACROSS TABS: Now Playing state should NOT clear
   when the user switches between My Songbook / Public Songbook / Playlists
   tabs. The Now Playing section in the right panel should always show
   the current song regardless of which page you're on. Store now playing
   state in a React context or top-level state that lives above the router.
```

## Prompt B — Header, Settings, UI Fixes

```
Fix header consistency and UI issues:

1. HEADER — CONSISTENT EVERYWHERE: The header must be identical on every
   page (My Songbook, Public Songbook, Playlists, Playlist Detail). Same
   layout, same elements. Right now it looks different on different tabs.
   Ensure the header is a shared component rendered above the router outlet.
   
   Right side of header should have: Settings (gear), user's name, Logout button.
   These were moved somewhere else — put them back in the top right of the header.

2. ENRICHING BANNER: The "Enriching X/Y..." status bar currently overlays
   and blocks content. Instead of overlapping, make it push content down:
   - Animate it sliding in from the top (below the header) with a smooth
     height transition
   - Content below shifts down smoothly to make room
   - When enrichment completes, the bar collapses with a smooth animation
   - Use CSS transition on max-height or similar approach
   - It should never overlay or block any interactive elements

3. SORT BAR STICKY BACKGROUND: The sort dropdown and shuffle button row
   at the top of the song grid should have a background color (white, or
   matching the page background) so that when you scroll the grid, tiles
   pass behind it, not over it. Add position: sticky, top: 0, z-index,
   and a background color.

4. KEY FILTER IN SORT BAR: Add a key filter row to the sort/controls area.
   Show each of the 12 keys as small colored squares (using the active
   palette colors). Clicking a key square filters the grid to show only
   songs in that key or its relative minor. Multiple keys can be selected
   (toggle on/off). These key filter squares sit in the same sticky bar
   as the sort dropdown.

5. EDITABLE THEME TAGS: In the selected song panel / filter panel, the
   theme tags (love, party, nostalgia, etc.) should be editable. Show
   them as removable tag chips (click X to remove) with an "+ add tag"
   button that lets the user type a new tag. Changes save to
   PATCH /api/library/:songId with the updated tags array.

6. FAVORITABLE PLAYLISTS: Add a favorite/star toggle on each playlist
   card in the playlists page. Favorited playlists sort to the top.
   Add a `is_favorited BOOLEAN DEFAULT 0` column to the playlists table
   (D1 migration). PATCH /api/playlists/:id to toggle it.
```

## Prompt C — Playlists Detail + Transitions Privacy

```
Fix playlists and transition privacy:

1. PLAYLIST DETAIL PAGE: The playlist detail page (/playlists/:id or
   /app/playlists/:id) should show:
   - Playlist title (editable inline)
   - Playlist notes (editable textarea)
   - Full song list in order, each showing: position number, title, artist,
     key badge (colored), BPM
   - If a song in the playlist is followed by one of its linked transitions
     (from the song_transitions table), show a small "→ transition" indicator
     between those two songs. Detection: for each consecutive pair (song A,
     song B), check if there's a song_transitions row where from_song_id = A
     and to_song_id = B (for this user). If yes, show the indicator.
   - Drag to reorder songs within the playlist
   - Click a song to select it (shows details, does NOT play)
   - "Play this playlist" button that loads all songs into queue
   - Delete playlist button with confirmation
   - Share toggle (public/private)

2. TRANSITIONS ARE PRIVATE: Linked transitions (song_transitions table)
   should NEVER appear in the Public Songbook or be visible to other users.
   They are strictly user-to-user (personal). The GET /api/songs endpoints
   (marketplace) should never include transition data. Only
   GET /api/library/:songId/transitions returns them, and it's auth-gated
   to the current user.
```

## Prompt D — Homepage + Login + Typography Fixes

```
Fix homepage, login page, and typography:

1. TYPOGRAPHY RULE: All body text across the entire site (homepage, login,
   app) uses Inter (Google Fonts), NOT monospace. The ONLY monospace text
   anywhere is the "billy-fm" brand name / logo. Update:
   - Homepage: all body text, descriptions, feature cards → Inter
   - Login page: all text → Inter, except "billy-fm" logo stays monospace
   - App: body text, filter labels, song metadata, panel text → Inter
     Only the "BILLY fm" nav title stays monospace
   Import Inter from Google Fonts alongside IBM Plex Mono.
   Set --font: 'Inter', system-ui, sans-serif as the default.
   Set --font-mono: 'IBM Plex Mono', monospace for the logo only.

2. LOGIN PAGE: The body text is too light / hard to read. Make it darker
   (#333 or #444 instead of whatever light gray it is now). Also fix
   the subtext wrapping — it should be centered and not awkwardly broken
   across lines.

3. HOMEPAGE HERO — SIMPLIFY: Remove the current animated color-cycling
   hero. Replace with a clean white hero that says:
   - "billy-fm" (large, monospace — the only monospace on the page)
   - Body text (Inter): "Organize and track your live sets by key, era,
     tempo, and more. Build and save sets. Share and collect song ideas."
   - Sign in button below
   - Also add a sign-in link in the homepage header (top right)

4. HOMEPAGE DEMO ANIMATION — FIX THESE ISSUES:
   - The demo must visually look EXACTLY like the actual app. Same panel
     widths, same tile sizes, same font sizes, same border styles. Right
     now it doesn't match. Compare with the actual app and fix discrepancies.
   - "Select song" step: the left panel should actually populate with the
     song's info (title, artist, key badge) when a song is "selected".
     Right now nothing appears in the panel.
   - "Same key" filter step: only songs that are actually in the same key
     or relative minor should stay visible. Right now it's showing songs
     in different keys. Use the real RELATIVE_MAP logic.
   - Right panel (Now Playing / Queue / Session) should match the actual
     app's layout, not a simplified version.
   - ANNOTATION STYLE: Change the floating annotations to small brutalist
     popup windows — like a bordered modal card layered ON TOP of the
     animation. Black border, white background, Inter font, drop shadow
     (2px 2px 0px #000 for brutalist shadow). These should grab attention.
   - Consider simplifying the animation to fewer steps but making each
     step visually perfect. Prioritize visual accuracy over feature coverage.
   - Add an expandable "How to use" section below the demo that explains
     features in more detail (collapsed by default, click to expand).

5. PALETTE SECTION — REDESIGN LAYOUT: Left-justify the palette names
   and color swatches on the left side. On the right side, show 2-3 rows
   of demo song tiles (using the fake song data). When the user hovers
   over a palette name/row on the left, the demo tiles on the right
   update to show that palette's colors. This makes the palette selection
   feel interactive and tangible.

6. DONATION VISIBILITY: Under the "Ready to start?" CTA section, add a
   clear donation link: "Support the development of this app" with a link
   to https://venmo.com/conorthaxter. Make it visually distinct — not
   hidden in tiny footer text.

7. PROGRESS LOG: Create a file `public/homepage/changelog.md` (or render
   it inline on the homepage). This is a work log that tracks changes at
   a readable pace. Add a "What's new" or "Development log" section on
   the homepage that pulls from this file. For now, seed it with a few
   entries summarizing what's been built. This section should auto-update
   when the file is edited (at build/deploy time, just read the markdown
   and render it as HTML).
```

## Prompt E — Color Palette Tuning

```
Adjust the tile color palettes. The background color modes are SEPARATE
from tile palettes — tile palette changes should NEVER affect the
background color. Fix Dive mode which is currently changing the background.

Updated palettes (major keys — minor keys still use same hue, lightness -8%, saturation -5%):

SESSION (more techy, think Ableton clip colors but slightly muted, digital feel):
C: hsl(348, 55%, 62%), C#: hsl(15, 58%, 60%), D: hsl(42, 60%, 58%),
D#: hsl(68, 50%, 55%), E: hsl(140, 45%, 52%), F: hsl(168, 52%, 50%),
F#: hsl(188, 58%, 52%), G: hsl(210, 60%, 58%), G#: hsl(232, 55%, 62%),
A: hsl(258, 52%, 64%), A#: hsl(282, 48%, 58%), B: hsl(318, 52%, 60%)

CAFÉ (warmer, more contrast, but desaturated — think aged paper, clay, dried herbs):
C: hsl(5, 28%, 48%), C#: hsl(22, 32%, 45%), D: hsl(38, 35%, 42%),
D#: hsl(55, 22%, 44%), E: hsl(82, 18%, 42%), F: hsl(142, 18%, 40%),
F#: hsl(168, 22%, 42%), G: hsl(195, 25%, 45%), G#: hsl(215, 22%, 48%),
A: hsl(238, 20%, 48%), A#: hsl(268, 18%, 45%), B: hsl(308, 22%, 46%)

DIVE (cool neons, not Microsoft Paint — think actual dive bar neon signs,
moody, slightly desaturated neons with character):
C: hsl(350, 85%, 58%), C#: hsl(15, 80%, 55%), D: hsl(52, 82%, 50%),
D#: hsl(78, 75%, 48%), E: hsl(120, 80%, 44%), F: hsl(162, 78%, 42%),
F#: hsl(182, 82%, 46%), G: hsl(205, 85%, 52%), G#: hsl(232, 80%, 56%),
A: hsl(262, 78%, 58%), A#: hsl(288, 75%, 52%), B: hsl(328, 82%, 54%)

IMPORTANT: Dive mode must NOT change the background color. Tile palette
and background are independent settings. If someone has Dive tiles on
a white background, that's their choice. Fix the code so palette selection
only affects the KEY_HSL color map used for tiles, never the --bg variable
or body background.

Keep Festival and Jazz Bar palettes as they are (unchanged).
```

---

## Prompt Order
1. **Prompt B** first — header/UI consistency affects everything else
2. **Prompt A** — drag & drop + panel behavior
3. **Prompt C** — playlists + transitions
4. **Prompt D** — homepage + login + typography
5. **Prompt E** — color tuning (quick, do last)
