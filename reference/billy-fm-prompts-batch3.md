# BILLY fm — Prompt Batch 3 (Hotkeys, UI Polish, Homepage)

Read ./billy-fm-build-plan.md and ./billy-fm-continuation-plan.md for context.

---

## Prompt 3A — Hotkey System + Keyboard Navigation

```
Build a comprehensive hotkey system and keyboard-navigable song grid:

HOTKEY REMAPPING:
1. SPACEBAR → Open chords link for the currently selected song (new tab).
   Only fires when not focused on an input/textarea.
2. TAB → Add selected song to queue (was right arrow). Prevent default
   tab behavior when a song is selected.
3. DELETE / BACKSPACE → Clear the current song selection (unselect).
   Only when not focused on an input/textarea.
4. ENTER (first press) → Select highlighted song. ENTER (second press
   on already-selected song) → Play it (Now Playing).
5. Keep existing: / or Cmd+K for search, Escape to dismiss.

ARROW KEY GRID NAVIGATION:
6. Make the entire song tile grid navigable with arrow keys (up/down/left/right).
   Create a "grid cursor" that tracks which tile is currently focused.
   Arrow keys move the cursor between tiles based on grid layout (left/right
   move within a row, up/down jump between rows).
   The cursor highlights the focused tile — do NOT use a plain black border.
   Instead, use a subtle glow effect: box-shadow with the tile's own key
   color, slightly expanded and blurred. Something like:
   box-shadow: 0 0 12px 3px currentKeyColor, 0 0 4px 1px currentKeyColor;
   with a slight scale transform (1.02) and transition.
   The cursor is separate from "selected" state — arrow keys move the cursor,
   Enter selects the song at the cursor.

7. CURSOR VISIBILITY: The glow cursor fades away when the mouse is moving
   (user is in mouse mode). It fades back in when the mouse stops moving
   for ~1.5 seconds (user switched to keyboard mode). Use a mousemove
   listener with a debounce timer. CSS transition on opacity for the fade.

HOTKEY GUIDE IN HEADER:
8. Move Settings (gear) and Logout to be right-justified in the header
   (far right). In the space to the right of "billy-fm" logo (left area),
   add a small hotkey reference in muted text (10px, color #999). Show
   the most useful ones inline:
   "SPACE chords · TAB queue · ↑↓←→ navigate · ENTER select/play · DEL clear · / search"
   This text should be subtle — visible but not competing with nav.
```

## Prompt 3B — Key Filter + Sort Bar Improvements

```
Redesign the key filter and sort bar at the top of the song grid:

KEY FILTER BEHAVIOR:
1. Remove black border on selected key filter square. Instead, when a key
   is selected, DESATURATE all other key squares (drop them to grayscale
   or very low saturation). The selected key stays vibrant. This makes the
   active filter obvious without borders.

2. ONE KEY AT A TIME: Only one key can be selected for filtering at a time.
   Clicking a different key switches to it. Clicking the already-selected
   key deselects it (show all songs again).

3. KEY ORDER: Arrange the key squares chromatically: C, C#, D, D#, E, F,
   F#, G, G#, A, A#, B. Not alphabetical.

4. MAJOR/MINOR TOGGLE: Add a small toggle button next to the key filter
   row: "maj / min". Default is major. When toggled to minor, the key
   squares show minor keys (Cm, C#m, Dm...) and filter for minor keys.
   The colors update to match the minor key palette (same hue, darker).

5. CLEAR FILTERS BUTTON: Add a "clear filters" button (small, subtle,
   like "✕ clear" in mono) in the filter section of the left panel.
   Clicking it unchecks all filter checkboxes, deselects any key filter,
   and removes all active filtering. Show it only when at least one
   filter is active.

SORT BAR STICKY BEHAVIOR:
6. The sort bar (dropdown + shuffle + key filters) should have a background
   color matching the current site background (whatever --bg is set to)
   so it acts as a proper sticky header for the panel. Content scrolls
   behind it, not over it.

7. SHUFFLE BUTTON: Move the shuffle button to the RIGHT of the key filter
   squares. It should be visible at ALL times, not just when sort is set
   to Random. However, grey it out and disable it when the current sort
   mode is deterministic (Alphabetical, Artist A-Z, Key, BPM, Era). It
   should be active/clickable when sort is Random, Most Played, Least
   Played, or Theme Proximity (sorts that benefit from re-shuffling).
```

## Prompt 3C — Selected Song Panel Polish

```
Polish the selected song / filter panel:

1. PRIVATE/PUBLIC TOGGLE: Move the private/public toggle button to be
   on the same line as the "Edit" button, to its right. These should be
   inline, not stacked.

2. CHORDS BUTTON: Make the chords button in the selected song panel match
   how it appears in Now Playing — full width, taking up an entire row.
   Currently it might be smaller or inline. Make it a prominent, full-width
   button: "SPACE View chords ↗" or "SPACE Find chords on UG ↗" (showing
   the hotkey hint).

3. CLEAR FILTERS BUTTON: (same as above in Prompt 3B #5 — make sure it
   exists in the left panel filter section)
```

## Prompt 3D — Homepage Visual Polish

```
Polish the homepage visual details:

1. FEATURE BOXES HOVER STATE: Each feature card/box on the homepage should
   have a color fill hover effect. On hover, the box fills with a color
   from the Festival/Summer palette (each box gets a different key color).
   The fill should fade in smoothly (CSS transition on background-color,
   ~0.3s). Cycle through the 12 key colors across the boxes.

2. TIP LINK: Remove the tip/donation link from the body of the homepage.
   Keep it only in the footer. The "by CONOR" text should link to
   https://conor.bio.

3. SIGN IN TEXT: Change "sign in with Google — free for performers" to
   "sign in for free with Google". Remove the arrow from the sign-in
   button. Make the button background cycle through keyframe colors
   (same color animation as the login page background), so the button
   itself pulses through the summer palette colors.

4. PALETTE DEMO SECTION: Add another row of demo tiles to the color
   palette demo section (3 rows total if that fits well height-wise,
   or whatever looks best).

5. HERO SECTION — FLOATING SONG TILES: In the hero section, add song
   tiles that pop in and fade out at various positions in the background.
   Use songs from the existing fake data catalog plus good mood R&B/pop
   titles. Each tile appears in its key color, fades in over ~0.5s, stays
   for ~2-3 seconds, then fades out. Multiple tiles visible at once,
   appearing at random positions. They should be slightly transparent
   (opacity 0.3-0.5) so they don't compete with the hero text. Think
   of them as ambient decoration, not content.

6. DEMO ANIMATION PACING: Make the demo animation start faster (shorter
   initial delay before Step 1 begins). But make the text dialogue boxes
   stay on screen LONGER — currently they disappear before you can read
   them. Each annotation should stay visible for at least 4-5 seconds.
   The animation steps can overlap slightly (next step begins while
   previous annotation is still fading out).

7. DONATION SECTION: Under "ready to start?" section, add a clear line:
   "Support the development of this app" with a link to
   https://venmo.com/conorthaxter. Style it as a subtle but visible
   text link, not buried.
```

## Prompt 3E — App Loading Animation + Piano ASCII Art

```
Add a loading/splash screen animation when the app first loads:

1. PIANO ASCII ART: When the app loads (after auth check, before the
   songbook renders), show a brief splash screen with:
   - ASCII art of a piano keyboard (black and white, using box-drawing
     characters or simple ASCII). Something like:
     │░│░││░│░│░││░│░││░│░│░│
     │░│░││░│░│░││░│░││░│░│░│
     │ │ ││ │ │ ││ │ ││ │ │ │
     └─┴─┘└─┴─┴─┘└─┴─┘└─┴─┘
     (but wider and more detailed — make it look good)
   - Below the piano, text in Inter: "have a good set!"
   - The splash fades out after ~1.5-2 seconds, revealing the app.
   - Use CSS animation: fade in the piano + text, hold, then fade out
     the entire splash overlay.
   - The splash only shows on initial app load, not on page navigation.
   - Keep it monochrome (black lines on white, or white lines on dark
     depending on background mode).

2. Make sure the splash doesn't block functionality — if data loads fast,
   still show the splash for the minimum duration so the animation
   completes gracefully.
```

---

## Prompt Order
1. **3B** — Key filter + sort bar (foundation for the grid controls)
2. **3A** — Hotkey system + grid navigation (builds on the grid)
3. **3C** — Selected song panel polish (quick)
4. **3E** — Loading animation (quick, fun)
5. **3D** — Homepage polish (independent, do whenever)
