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

export function getSorted(songs, sortBy, shuffleOrder) {
  const arr = [...songs];
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
    case 'most-played':
      return arr.sort((a, b) => (b.playlist_count || 0) - (a.playlist_count || 0));
    case 'least-played':
      return arr.sort((a, b) => (a.playlist_count || 0) - (b.playlist_count || 0));
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
  // 30-day threshold as a lexicographically comparable SQLite datetime string
  const thirtyDaysAgoStr = new Date(Date.now() - 30 * 86400000).toISOString().replace('T', ' ').slice(0, 19);

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
  // If only play-frequency filters are active and no song selected, we can still filter
  const faded = new Set();
  let matchCount = 0;

  for (const song of songs) {
    if (song.song_id === s?.song_id) continue;

    const checks = [];
    if (filters.key && s)      checks.push(song.key === s.key || (rel && song.key === rel));
    if (filters.bpm && s)      checks.push(s.bpm != null && song.bpm != null && Math.abs(song.bpm - s.bpm) <= 15);
    if (filters.theme && s)    checks.push(s.tags?.length > 0 && song.tags?.length > 0 && s.tags.some(t => song.tags.includes(t)));
    if (filters.era && s)      checks.push(s.era && song.era && s.era === song.era);
    if (filters.artist && s) {
      const selArtists = (s.artist || '').split(',').map(a => a.trim().toLowerCase()).filter(Boolean);
      const songArtists = (song.artist || '').split(',').map(a => a.trim().toLowerCase()).filter(Boolean);
      checks.push(selArtists.some(a => songArtists.includes(a)));
    }
    if (filters.genre && s)    checks.push(s.genre?.length > 0 && song.genre?.length > 0 && s.genre.some(g => song.genre.includes(g)));
    // These two work without a selected song; use DB playlist data (30-day window)
    if (filters.unplayed) {
      // "Not played recently" = never in a playlist OR last playlist > 30 days ago
      checks.push(!song.last_playlist_at || song.last_playlist_at < thirtyDaysAgoStr);
    }
    if (filters.frequent) {
      // "Played recently" = in a saved playlist within the last 30 days
      checks.push(!!(song.last_playlist_at && song.last_playlist_at >= thirtyDaysAgoStr));
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
