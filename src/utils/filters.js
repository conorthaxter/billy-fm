import { RELATIVE_MAP } from './keyColors';

// Key sort order: each major key followed immediately by its relative minor
const KEY_SORT_ORDER = [
  'A','F#m','Ab','Fm','B','G#m','Bb','Gm',
  'C','Am','C#','A#m','D','Bm','D#','Cm',
  'E','C#m','Eb','F','Dm','F#','D#m','G','Em',
];

function keyOrder(key) {
  const idx = KEY_SORT_ORDER.indexOf(key || '');
  return idx >= 0 ? idx : 999;
}

export function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function tagOverlap(a, b) {
  const ta = new Set([...(a.tags || []), ...(a.genre || [])]);
  const tb = new Set([...(b.tags || []), ...(b.genre || [])]);
  let n = 0; for (const t of ta) if (tb.has(t)) n++;
  return n;
}

function proximitySort(songs) {
  if (songs.length <= 1) return songs;
  const result = [songs[0]];
  const rem = songs.slice(1);
  while (rem.length) {
    const last = result[result.length - 1];
    let bi = 0, bs = -1;
    for (let i = 0; i < rem.length; i++) {
      const sc = tagOverlap(last, rem[i]);
      if (sc > bs) { bs = sc; bi = i; }
    }
    result.push(rem.splice(bi, 1)[0]);
  }
  return result;
}

export function getSorted(songs, sortBy, shuffleOrder, playHistory) {
  const arr = [...songs];
  const countOf = id => (playHistory || []).filter(e => e.songId === id).length;
  switch (sortBy) {
    case 'random':
      return arr.sort((a, b) => shuffleOrder.indexOf(a.song_id) - shuffleOrder.indexOf(b.song_id));
    case 'title':
      return arr.sort((a, b) => a.title.localeCompare(b.title));
    case 'artist':
      return arr.sort((a, b) => a.artist.localeCompare(b.artist) || a.title.localeCompare(b.title));
    case 'key':
      return arr.sort((a, b) => keyOrder(a.key) - keyOrder(b.key) || a.title.localeCompare(b.title));
    case 'bpm':
      return arr.sort((a, b) => (a.bpm || 0) - (b.bpm || 0));
    case 'era':
      return arr.sort((a, b) => (a.era || 'zzz').localeCompare(b.era || 'zzz') || a.title.localeCompare(b.title));
    case 'theme-proximity':
      return proximitySort(arr);
    case 'most-played':
      return arr.sort((a, b) => countOf(b.song_id) - countOf(a.song_id));
    case 'least-played':
      return arr.sort((a, b) => countOf(a.song_id) - countOf(b.song_id));
    default:
      return arr.sort((a, b) => a.title.localeCompare(b.title));
  }
}

/**
 * Returns a Set of song_ids that should be FADED (not matching).
 * Returns null when nothing should be faded (no filters active, no search).
 */
export function computeFadedIds(songs, selectedSong, filters, filterMode, searchQuery, playHistory) {
  const anyActive = Object.values(filters).some(v => v);
  const now7d = Date.now() - 7 * 86400000;

  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    const faded = new Set();
    for (const song of songs) {
      const matches =
        song.title.toLowerCase().includes(q) ||
        song.artist.toLowerCase().includes(q) ||
        (song.genre || []).some(g => g.toLowerCase().includes(q)) ||
        (song.tags || []).some(t => t.toLowerCase().includes(q));
      if (!matches) faded.add(song.song_id);
    }
    return faded;
  }

  if (!anyActive) return null;

  const s = selectedSong;
  const rel = RELATIVE_MAP[s?.key || ''] || null;
  // Song-dependent filters require a selected song; if none, those filters are skipped
  const songDepActive = s && (filters.key || filters.bpm || filters.theme || filters.era || filters.artist || filters.genre);
  // If only play-frequency filters are active and no song selected, we can still filter
  const faded = new Set();
  let matchCount = 0;

  for (const song of songs) {
    if (song.song_id === s?.song_id) continue;

    const checks = [];
    if (filters.key && s)      checks.push(song.key === s.key || (rel && song.key === rel));
    if (filters.bpm && s)      checks.push(s.bpm != null && song.bpm != null && Math.abs(song.bpm - s.bpm) <= 15);
    if (filters.theme && s)    checks.push(s.tags && song.tags && s.tags.some(t => song.tags.includes(t)));
    if (filters.era && s)      checks.push(s.era && song.era && s.era === song.era);
    if (filters.artist && s) {
      const selArtists = (s.artist || '').split(',').map(a => a.trim().toLowerCase()).filter(Boolean);
      const songArtists = (song.artist || '').split(',').map(a => a.trim().toLowerCase()).filter(Boolean);
      checks.push(selArtists.some(a => songArtists.includes(a)));
    }
    if (filters.genre && s)    checks.push(s.genre && song.genre && s.genre.some(g => song.genre.includes(g)));
    // These two work without a selected song
    if (filters.unplayed) {
      const ev = (playHistory || []).filter(e => e.songId === song.song_id);
      const last = ev.length ? Math.max(...ev.map(e => e.timestamp)) : 0;
      checks.push(!last || last < now7d);
    }
    if (filters.frequent) {
      const count = (playHistory || []).filter(e => e.songId === song.song_id).length;
      checks.push(count >= 3);
    }

    const matches = filterMode === 'AND'
      ? (checks.length > 0 && checks.every(v => v))
      : checks.some(v => v);

    if (!matches) faded.add(song.song_id);
    else matchCount++;
  }

  return { faded, matchCount };
}

/**
 * Reorders an array so:
 * 1. Selected song first
 * 2. Matched songs (not faded, not selected)
 * 3. Unmatched (faded) songs
 * Returns sorted unchanged if no selectedSong or no fadedIds.faded.
 */
export function getFilterSorted(sorted, selectedSong, fadedIds) {
  if (!selectedSong || !fadedIds?.faded) return sorted;
  const fadedSet = fadedIds.faded;
  const selectedId = selectedSong.song_id;
  const selected = sorted.filter(s => s.song_id === selectedId);
  const matched  = sorted.filter(s => s.song_id !== selectedId && !fadedSet.has(s.song_id));
  const unmatched = sorted.filter(s => s.song_id !== selectedId && fadedSet.has(s.song_id));
  return [...selected, ...matched, ...unmatched];
}
