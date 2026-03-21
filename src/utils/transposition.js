// Musical key names in chromatic order (using preferred enharmonic spellings)
const CHROMATIC = ['C','C#','D','Eb','E','F','F#','G','Ab','A','Bb','B'];

const INTERVAL_NAMES = [
  'unison', 'minor 2nd', 'major 2nd', 'minor 3rd', 'major 3rd', 'perfect 4th',
  'tritone', 'perfect 5th', 'minor 6th', 'major 6th', 'minor 7th', 'major 7th',
];

// Enharmonic equivalents
const ENHARMONICS = {
  'Db':'C#','D#':'Eb','E#':'F','Fb':'E',
  'G#':'Ab','A#':'Bb','B#':'C','Cb':'B',
};

/** Get 0-based chromatic position for a key name (strips minor 'm' suffix) */
function keyToSemitone(key) {
  if (!key) return -1;
  const base = key.replace(/m$/, '');
  let idx = CHROMATIC.indexOf(base);
  if (idx >= 0) return idx;
  const enh = ENHARMONICS[base];
  if (enh) return CHROMATIC.indexOf(enh);
  return -1;
}

/**
 * getInterval(fromKey, toKey)
 * Returns the interval going UP from fromKey to toKey within one octave.
 * e.g. getInterval('C', 'Eb') → { semitones: 3, direction: 'up', name: 'minor 3rd' }
 */
export function getInterval(fromKey, toKey) {
  const from = keyToSemitone(fromKey);
  const to   = keyToSemitone(toKey);
  if (from < 0 || to < 0) return null;
  const semitones = ((to - from) + 12) % 12;
  return {
    semitones,
    direction: semitones <= 6 ? 'up' : 'down',
    name: INTERVAL_NAMES[semitones] || `${semitones} semitones`,
  };
}

/**
 * getCapo(chartKey, targetKey)
 * Returns the capo fret (0–11) needed to play a chart written in chartKey
 * so that it sounds in targetKey.
 * e.g. chart is in G, you want to play in A → capo 2 (play G shapes, sounds A).
 */
export function getCapo(chartKey, targetKey) {
  const chart  = keyToSemitone(chartKey);
  const target = keyToSemitone(targetKey);
  if (chart < 0 || target < 0) return null;
  return ((target - chart) + 12) % 12;
}

/**
 * formatInterval(interval, fromKey, toKey)
 * Human-readable string for a key change.
 * e.g. "up a major 3rd (+4)" or "same key"
 */
export function formatInterval(fromKey, toKey) {
  const iv = getInterval(fromKey, toKey);
  if (!iv) return '';
  if (iv.semitones === 0) return 'same key';
  return `${iv.direction} a ${iv.name} (+${iv.semitones})`;
}

// All standard keys for the key picker
export const ALL_KEYS = [
  'C','C#','D','Eb','E','F','F#','G','Ab','A','Bb','B',
  'Am','C#m','Dm','Ebm','Em','Fm','F#m','Gm','Abm','Bm','Bbm','Cm',
];
