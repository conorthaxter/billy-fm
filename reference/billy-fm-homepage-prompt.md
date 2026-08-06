# Claude Code Prompt — BILLY fm Homepage

Read ./billy-fm-build-plan.md and ./billy-fm-continuation-plan.md for project context.

## Task

Build a static marketing homepage for BILLY fm as a single file at `public/homepage/index.html`. This is a standalone HTML page — no React, no build step, just HTML + inline CSS + vanilla JS. The React SPA will be served at `/app/*` and this homepage lives at `/`.

## What BILLY fm Is

A music library and live-gig manager for working musicians. It replaces spreadsheets for storing repertoire (songs, keys, BPM, chords, notes) and gives performers a real-time filtering/queuing interface at gigs. At the end of the night, the setlist is saved as a playlist.

Target users: gigging musicians, wedding bands, bar performers, solo artists.

## Visual Identity (MUST MATCH EXACTLY)

**Font:** IBM Plex Mono from Google Fonts (weights 400, 700). EVERY piece of text is monospace. No exceptions.

**Aesthetic:** Brutalist. Flat. Black borders everywhere (1px or 2px solid #000). No drop shadows. No border-radius (0 everywhere). No gradients except the palette color tiles. Monospace everything.

**Background:** White #ffffff default.

**Musical Key Color Palette (Summer — default):**
```
C   → hsl(0, 80%, 45%)      red
C#  → hsl(22, 85%, 48%)     burnt orange
D   → hsl(45, 90%, 42%)     golden yellow
D#  → hsl(65, 80%, 38%)     yellow-green
E   → hsl(88, 75%, 36%)     green
F   → hsl(160, 70%, 36%)    teal
F#  → hsl(185, 75%, 38%)    cyan-teal
G   → hsl(205, 80%, 44%)    sky blue
G#  → hsl(225, 75%, 46%)    blue
A   → hsl(255, 70%, 50%)    indigo-violet
A#  → hsl(285, 65%, 46%)    purple
B   → hsl(320, 75%, 44%)    magenta-rose
```
Minor keys: same hue as relative major, lightness -8%, saturation -5%.

**CSS Variables:**
```css
--font: 'IBM Plex Mono', monospace;
--border: 1px solid #000;
--bg: #ffffff;
--nav-h: 42px;
```

## Page Structure — 6 Sections

### SECTION 1: HERO (full viewport height)

Background: animate through the 12 summer palette key colors, cycling smoothly (CSS keyframes, ~30s full cycle, infinite loop). Same effect as the app's login screen.

Centered content card (bordered, white/semi-transparent background so text stays readable over the color cycling):
- "billy-fm" — large monospace brand name (~32-40px)
- "music library for live performers" — smaller mono subtext (~16px)
- One-liner: "track your songs. filter by key and vibe. never lose the setlist."
- CTA button: "→ sign in to start" — links to `/app`. Styled: black fill, white text, monospace, no border-radius, padding 12px 24px.

### SECTION 2: "HOW IT WORKS" — Animated Demo (MOST IMPORTANT SECTION)

Build a SIMULATED version of the app's three-panel layout inside this section. Not screenshots — real HTML/CSS elements styled exactly like the app. Populate with fake song data (listed below).

The simulation shows:
- LEFT PANEL (~180px): Filter panel with checkboxes (Same key/relative, BPM ±15, Same era, Same artist, Same genre) and a selected song info area
- CENTER: Song tile grid — color-coded tiles by key
- RIGHT PANEL (~220px): Previously Played, Now Playing, Queue sections

Run a SCRIPTED ANIMATION that loops automatically through these steps (use JS setTimeout chains or requestAnimationFrame). Each step has a pause (~3-4 seconds) and smooth transitions between states.

**Step 1 — "your full library at a glance"**
All tiles visible, unfiltered. Gentle slow pan or subtle scale animation across the grid.
Annotation node near grid: "Every song in your library. Color-coded by key."

**Step 2 — "select a song to filter"**
Animate a cursor pulse/click on "What's Going On" (Ab, blue-ish tile).
Tile gets bold black outline (selected state).
Left panel populates: title, artist, key badge in Ab color.
Annotation node near left panel: "Click a song. The panel shows key, BPM, chords link, your notes."

**Step 3 — "activate a filter"**
Animate checkbox click on "Same key / relative" in left panel.
Non-matching tiles fade to opacity 0.2. Matching tiles (same key Ab or relative Fm) stay bright.
Match count appears: "3 matches"
Annotation node between selected and matched tiles: "Matched songs surface. Faded songs don't fit right now."

**Step 4 — "add to queue"**
Animate dragging one matched tile toward the right panel queue area.
Tile shrinks into a queue row item. Queue counter: "QUEUE (1)".
Annotation node on right panel: "Drag songs into your queue. They play in order."

**Step 5 — "now playing"**
Animate double-click on another tile. It appears in NOW PLAYING section.
Previous now-playing drops to PREVIOUSLY PLAYED.
Annotation node at NOW PLAYING: "Double-click plays it now. Your setlist builds itself."

**Step 6 — "save the set"**
Animate click on "SAVE SET AS PLAYLIST" button.
Brief confirmation: "Thu Mar 20, 2025 — saved (7 songs)"
Annotation node: "End of the night. Your set is saved automatically."

Then loop to step 1.

**Annotation node style:** Small bordered boxes — 1px black border, white bg, monospace font 10-11px. Fade in with a thin connector line to the relevant UI element. Each node has a small dot at the connection point.

**Song tile CSS (match app exactly):**
```css
.sc {
  border: 1px solid transparent;
  padding: 8px 9px 6px;
  cursor: pointer;
  position: relative;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  min-height: 80px;
  font-family: var(--font);
  transition: border-color 0.15s, opacity 0.4s;
}
.sc-title { font-size: 12px; font-weight: 700; line-height: 1.25; margin-bottom: 3px; }
.sc-artist { font-size: 10px; opacity: 0.75; }
.sc-key-lbl { font-size: 9px; font-weight: bold; }
.sc.selected-cell { outline: 3px solid #000; outline-offset: -1px; }
.sc.faded { opacity: 0.2; }
```

### SECTION 3: FEATURES LIST

Two or three column grid of bordered feature cards. Each card: 1px black border, monospace text, ASCII/emoji icon or simple character.

Features:
- **Color-coded by key** — "every song gets a color from its musical key. see your library like a palette."
- **Smart filters** — "filter by key, BPM range, era, artist, genre, or play frequency."
- **Live queue** — "drag songs into a queue. the night runs itself."
- **Setlist tracking** — "every song you play is logged. your set is always saved."
- **Chords on demand** — "one tap opens the chord chart for the current song."
- **Public songbook** — "browse songs added by other performers. add theirs to your library."
- **Spotify import** — "import with key and BPM pre-filled from audio features."
- **Private songs** — "songs only you can see. no marketplace exposure."
- **Transition suggestions** — "link songs that flow well together. the app suggests what's next."

### SECTION 4: PALETTE PREVIEW

Title: "your songs. your palette."
Subtitle: "switch between four seasonal color schemes. every key at a glance."

Show 4 rows of 12 colored squares (one per key), labeled by season:
- Summer (the palette above)
- Spring: soft pastels — shift hues toward lighter, more pastel versions (lightness +15%, saturation -15%)
- Autumn: earthy warm — shift toward warmer hues, darker (lightness -5%, add orange/brown shift)
- Winter: cool muted — shift toward cooler, desaturated (saturation -20%, lightness -5%, blue shift)

Each square labeled with the key name below it (C, C#, D, etc.) in tiny mono text.

### SECTION 5: CTA

Centered:
- "ready to start?"
- "sign in with google — it's free."
- Big bordered button: "→ get started" → links to /app
- Small text: "by conor · tip ♥" where "by conor" links to https://conor.bio and "tip ♥" links to https://venmo.com/conorthaxter

### SECTION 6: FOOTER

Minimal single line: "billy-fm · by conor · 2025"
"by conor" → https://conor.bio
"tip ♥" → https://venmo.com/conorthaxter

## Fake Song Data for Demo

Use these exact songs — the keys determine the tile colors:
```js
const SONGS = [
  { title: "What's Going On", artist: "Marvin Gaye", key: "Ab", bpm: 96 },
  { title: "Superstition", artist: "Stevie Wonder", key: "Eb", bpm: 100 },
  { title: "September", artist: "Earth, Wind & Fire", key: "D", bpm: 126 },
  { title: "Lovely Day", artist: "Bill Withers", key: "E", bpm: 70 },
  { title: "Signed Sealed Delivered", artist: "Stevie Wonder", key: "A", bpm: 110 },
  { title: "Higher Ground", artist: "Stevie Wonder", key: "Eb", bpm: 138 },
  { title: "I Feel Good", artist: "James Brown", key: "D", bpm: 152 },
  { title: "Sir Duke", artist: "Stevie Wonder", key: "B", bpm: 136 },
  { title: "Isn't She Lovely", artist: "Stevie Wonder", key: "E", bpm: 122 },
  { title: "Pick Up the Pieces", artist: "Average White Band", key: "Gm", bpm: 104 },
  { title: "Play That Funky Music", artist: "Wild Cherry", key: "Gm", bpm: 108 },
  { title: "Got to Give It Up", artist: "Marvin Gaye", key: "A", bpm: 120 },
  { title: "Brick House", artist: "Commodores", key: "C#", bpm: 100 },
  { title: "Mercy Mercy Me", artist: "Marvin Gaye", key: "Ab", bpm: 78 },
  { title: "Use Me", artist: "Bill Withers", key: "Em", bpm: 118 },
  { title: "Shining Star", artist: "Earth, Wind & Fire", key: "E", bpm: 130 },
];
```

## Routing Changes Required

Since the homepage now lives at `/`, update the React app's routes to be prefixed with `/app`:
- `/app` → redirect to `/app/songbook` if logged in, `/app/login` if not
- `/app/songbook` → My Songbook (was /dashboard)
- `/app/marketplace` → Public Songbook
- `/app/playlists` → Playlists
- `/app/playlists/:id` → Playlist detail

Update vite.config.js base path if needed so the SPA builds know they're served under `/app`.

Update the Google OAuth callback redirect to land on `/app/songbook` instead of `/`.

## Constraints
- Single index.html file, inline styles OK or a linked homepage.css in the same directory
- Google Fonts: IBM Plex Mono (400, 700) only
- No external dependencies besides Google Fonts
- No border-radius anywhere
- No font besides IBM Plex Mono
- No hamburger menus or hidden navigation
- Animations must work with pure CSS keyframes + vanilla JS setTimeout/requestAnimationFrame
- Must be readable without JS (progressive enhancement — layout and content visible, animations are enhancement)
- Mobile responsive: on screens < 768px, show a simplified version of the demo (step-through tap interaction or just static screenshots of each step instead of the auto-playing animation)
