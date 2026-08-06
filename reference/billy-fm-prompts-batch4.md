# BILLY fm — Prompt Batch 4 (Header Rebuild, Hotkeys, Polish)

Read ./billy-fm-build-plan.md and ./billy-fm-continuation-plan.md for context.

---

## Prompt 4A — Header Rebuild From Scratch

```
The header is broken and needs to be rebuilt from scratch. Delete the
current header component/markup and rebuild with this exact layout:

HEADER STRUCTURE (42px tall, fixed top, full width, border-bottom: 1px solid #000):

┌─────────────┬──────────────────────────────────────────────┬─────────────────┐
│  billy-fm   │  hotkey marquee   [NAV CENTERED]             │ ? ⚙ Name Logout │
│  (centered  │                                              │  (right-aligned)│
│  in cell)   │                                              │                 │
└─────────────┴──────────────────────────────────────────────┴─────────────────┘
       ↑                        ↑                                    ↑
  Right border          Hotkeys scroll left,               Settings, Help (?),
  of right panel        nav tabs centered                  user name, logout
  extends into          in remaining space
  header, creating
  a cell for logo

DETAILED SPEC:

1. LEFT CELL: The right panel's right border (1px solid #000) extends
   upward into the header, creating a bordered cell on the far left.
   "billy-fm" sits centered (horizontally and vertically) within this
   cell. The cell width matches the left panel width or is a fixed
   ~120-140px. This is the ONLY monospace text in the header.
   Font: IBM Plex Mono, bold.

2. CENTER AREA: This is the space between the logo cell and the right
   controls. It contains two things:

   a) HOTKEY MARQUEE: A scrolling marquee of system hotkeys in dark gray
      monospace text (color: #888, font-size: 10px, IBM Plex Mono).
      Scrolls horizontally from right to left, CSS animation, infinite loop.
      Content: "SPACE chords · Q queue · TAB next in queue · ↑↓←→ navigate ·
      ENTER select/play · DEL clear · / search · N now playing · K key ·
      B bpm · T tags · E era · A artist · G genre · ⌘+/- zoom"
      The marquee should be subtle — not distracting, just discoverable.
      Use CSS animation with translateX, overflow: hidden on the container.

   b) NAV TABS: Centered within this middle area (not centered to the
      marquee, centered to the full middle space). Three tabs:
      MY SONGBOOK | PUBLIC SONGBOOK | PLAYLISTS
      Style: Inter font, clean minimal tabs (not buttons). Active tab
      is bold or underlined. Tabs are vertically centered in the header.

   The marquee scrolls BEHIND the nav tabs if they overlap — nav tabs
   have higher z-index and a background matching the header bg.

3. RIGHT SECTION: Right-aligned in the header:
   - "?" button (How To — opens instruction manual modal, see Prompt 4D)
   - Settings gear icon
   - User display name (Inter, small)
   - Logout button (small, subtle)

4. MAKE IT CONSISTENT: This exact header renders on EVERY page — songbook,
   public songbook, playlists, playlist detail. It's a single shared
   component above the router outlet. No variations.
```

## Prompt 4B — Hotkey System Fixes

```
Fix and update the hotkey system:

REMAPPED HOTKEYS:
1. Q → Add selected song to queue (was TAB)
2. TAB → Move the NEXT song in the queue to Now Playing. The queue
   "ripples" — song #1 becomes Now Playing, the previous Now Playing
   moves to Previously Played, all queue items shift up one position.
   If queue is empty, TAB does nothing.
3. SPACEBAR → Open chords link for selected song in new tab
4. N → Select the Now Playing song in the grid selector (highlight it,
   open filter panel for it). Also: clicking in the Now Playing area's
   negative space (not on a button) does the same thing.
5. DELETE/BACKSPACE → Clear current song selection
6. ENTER → Select song at cursor (first press) / Play selected song
   (second press on already-selected)
7. / or Cmd+K → Open search
8. ESC → Dismiss search, modals, selection
9. Arrow keys → Navigate grid (with glow cursor)

FILTER HOTKEYS (toggle the corresponding filter checkbox):
10. K → Toggle "Same key / relative" filter
11. B → Toggle "BPM ±15" filter
12. T → Toggle "Same theme tags" filter
13. E → Toggle "Same era" filter
14. A → Toggle "Same artist" filter
15. G → Toggle "Same genre" filter

All letter hotkeys only fire when NOT focused on input/textarea/select.

FIX: SPACEBAR AFTER FILTER TOGGLE:
16. Currently spacebar doesn't open chords if you just toggled a filter
    with a hotkey. The issue is that the filter checkbox is receiving
    focus after the hotkey toggles it. Fix: after programmatically
    toggling a filter checkbox via hotkey, immediately blur it
    (document.activeElement.blur() or explicitly refocus the grid area).
    Filter checkboxes should never retain focus after a hotkey toggle.

SMOOTH GRID SCROLL ON ARROW NAVIGATION:
17. When arrow keys move the grid cursor to a tile that's partially or
    fully off-screen, smooth-scroll the grid container to bring that tile
    into view. Use element.scrollIntoView({ behavior: 'smooth', block: 'nearest' }).
```

## Prompt 4C — Sort Bar Sticky Fix + UI Polish

```
FIX THE STICKY SORT BAR (this has failed twice, be thorough):

The sort controls bar (sort dropdown, shuffle button, key filters) must
stick to the top of the song grid when scrolling. position: sticky keeps
breaking. Here's the nuclear fix:

1. Find the scroll container for the song grid. It's likely a div with
   overflow-y: auto or overflow-y: scroll.
2. The sort controls bar MUST be a direct child of that scroll container.
   Not nested deeper. If it's inside a wrapper, move it out.
3. Set on the sort bar:
   position: sticky;
   top: 0;
   z-index: 10;
   background: var(--bg, #fff);
   border-bottom: 1px solid #eee;
4. CHECK EVERY ANCESTOR between the sort bar and the scroll container.
   Remove overflow: hidden, overflow: auto, overflow: scroll from ANY
   ancestor that is NOT the intended scroll container. position: sticky
   SILENTLY FAILS if any ancestor has overflow set.
5. If you find that the layout uses overflow on a wrapper div for layout
   purposes, restructure: put the sort bar OUTSIDE that overflow container,
   and let only the tile grid scroll.
6. FALLBACK: If sticky truly cannot work with the current DOM structure,
   use position: fixed with top calculated as (header height), and add
   padding-top to the grid content equal to the sort bar height so
   nothing hides underneath. This is the guaranteed fix.
7. Give the sort bar the same background as the current page bg mode
   (use the CSS variable for background). It must be opaque — no
   transparency — so scrolling tiles disappear behind it cleanly.

ADDITIONAL SORT BAR ITEMS:
8. Shuffle button position: to the RIGHT of the key filter squares.
   Visible at all times. Greyed out and disabled when sort mode is
   Alphabetical, Artist A-Z, Key, or BPM (deterministic sorts).
   Active when sort is Random, Most Played, Least Played, Theme Proximity.

9. Maj/Minor toggle button next to key filter: make it BIGGER — at least
   the same height as the key squares, with clear "MAJ" / "MIN" text.
   Currently too small to notice/click.

D1 ERROR FIX:
10. Error: "D1_ERROR: no such column: p.is_favorited at offset 52: SQLITE_ERROR"
    The is_favorited column was never added to the database. Run a D1
    migration to add it:
    ALTER TABLE playlists ADD COLUMN is_favorited BOOLEAN DEFAULT 0;
    Add this to schema.sql as well. Then fix the query that references
    p.is_favorited to handle the case where the column might not exist
    (or just ensure the migration runs).
```

## Prompt 4D — How-To Modal + Homepage Fixes

```
Add instruction manual and fix homepage issues:

HOW-TO MODAL:
1. Add a "?" button in the header (left of settings gear). Clicking it
   opens a modal/overlay with an instruction manual. Content:

   Title: "how to use billy-fm"

   Sections:
   - GETTING STARTED: "Your songbook is your personal library. Add songs
     from the Public Songbook or import from a spreadsheet/Spotify."
   - PLAYING A SET: "Click a song to select it. Double-click or press
     Enter twice to play it. Songs you play are tracked automatically."
   - FILTERING: "Select a song, then use filters to find songs with the
     same key, BPM, era, or genre. Use key squares at the top to filter
     by specific keys."
   - QUEUE: "Press Q to add the selected song to your queue. Press TAB
     to play the next song in queue."
   - HOTKEYS: Show a clean table/grid of all hotkeys:
     SPACE → open chords | Q → add to queue | TAB → next in queue
     ↑↓←→ → navigate | ENTER → select/play | DEL → clear selection
     N → select now playing | / → search | ESC → dismiss
     K/B/T/E/A/G → toggle filters | ⌘+/- → zoom
   - SAVING SETS: "Your played songs are tracked per session. Click
     'Save Set as Playlist' to save your setlist."
   - COLOR MODES: "Choose a tile palette in Settings. Five vibes:
     Festival, Session, Jazz Bar, Café, Dive."

   Style: Same brutalist modal as other dialogs — black border, white bg,
   Inter font body text, monospace for hotkey labels. Scrollable if
   content is long. Close with X button or ESC.

HOMEPAGE FIXES:
2. SELECTED SONG PANEL IN DEMO: The demo animation's left panel MUST
   populate when a song is "selected" in the animation. Build the logic:
   when the animation step selects a song (e.g. "What's Going On"),
   inject that song's title, artist, and a colored key badge into the
   left panel area of the demo simulation. Currently nothing shows up.
   This is a DOM manipulation in the animation JS — find the left panel
   element in the demo and set its innerHTML.

3. SLOW DOWN DEMO ANIMATION: Increase the duration each step is visible.
   Annotation text boxes should stay on screen for at least 5-6 seconds
   (currently disappearing too fast to read). The overall animation can
   be longer — quality of each step matters more than speed.

4. HERO FLOATING TILES: Reduce to ~2 tiles visible at a time max. They
   should appear in very different positions (never overlap, never cluster).
   Fade in should be fast (~0.3s), fade out also fast (~0.3s). Stay
   visible for ~2s. Make tiles the same width as they appear in the demo
   section below. Use songs from the fake data or good R&B/pop titles.

5. FOOTER: Center all footer content. Copyright year should be 2026.

6. SIGN IN BUTTON: Remove the arrow character. Change text to
   "sign in for free with Google". Make the button background animate
   through the summer palette key colors (same keyframe animation as
   the login page background but applied to just the button).

7. PALETTE DEMO: Add one more row of demo song tiles (so 3 rows total
   or whatever fills the space best).

8. DONATION: Remove tip link from the body. Keep it in footer only.
   "by CONOR" links to https://conor.bio.
```

---

## Prompt Order
1. **4A** — Header rebuild (everything depends on this)
2. **4C** — Sort bar sticky + D1 migration fix (unblocks the grid)
3. **4B** — Hotkey system (needs the header and grid working)
4. **4D** — How-to modal + homepage (independent, do last)

For each prompt, start with:
> Read ./billy-fm-build-plan.md and ./billy-fm-continuation-plan.md for context.
> Then execute Prompt [X] from ./billy-fm-prompts-batch4.md
