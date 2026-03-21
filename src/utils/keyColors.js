// ─── Palettes ─────────────────────────────────────────────────────────────────
// Each palette maps every key/mode to [hue, saturation, lightness].
// Minor keys use the same hue as their relative major, lightness -8%, saturation -5%.
// Festival is the default (vibrant, outdoor stage colors).

export const PALETTES = {
  festival: {
    // Major keys
    'C':[0,80,45],'C#':[22,85,48],'Db':[22,85,48],
    'D':[45,90,42],
    'D#':[65,80,38],'Eb':[65,80,38],
    'E':[88,75,36],
    'F':[160,70,36],
    'F#':[185,75,38],'Gb':[185,75,38],
    'G':[205,80,44],
    'G#':[225,75,46],'Ab':[225,75,46],
    'A':[255,70,50],
    'A#':[285,65,46],'Bb':[285,65,46],
    'B':[320,75,44],
    // Relative minor keys (same hue, sat-5, light-8)
    'Am':[0,75,37],
    'A#m':[22,80,40],'Bbm':[22,80,40],
    'Bm':[45,85,34],
    'Cm':[65,75,30],
    'C#m':[88,70,28],'Dbm':[88,70,28],
    'Dm':[160,65,28],
    'D#m':[185,70,30],'Ebm':[185,70,30],
    'Em':[205,75,36],
    'Fm':[225,70,38],
    'F#m':[255,65,42],'Gbm':[255,65,42],
    'Gm':[285,60,38],
    'G#m':[320,70,36],'Abm':[320,70,36],
  },

  session: {
    // Techy digital feel — Ableton clip colors, slightly muted
    'C':[348,55,62],'C#':[15,58,60],'Db':[15,58,60],
    'D':[42,60,58],
    'D#':[68,50,55],'Eb':[68,50,55],
    'E':[140,45,52],
    'F':[168,52,50],
    'F#':[188,58,52],'Gb':[188,58,52],
    'G':[210,60,58],
    'G#':[232,55,62],'Ab':[232,55,62],
    'A':[258,52,64],
    'A#':[282,48,58],'Bb':[282,48,58],
    'B':[318,52,60],
    'Am':[348,50,54],
    'A#m':[15,53,52],'Bbm':[15,53,52],
    'Bm':[42,55,50],
    'Cm':[68,45,47],
    'C#m':[140,40,44],'Dbm':[140,40,44],
    'Dm':[168,47,42],
    'D#m':[188,53,44],'Ebm':[188,53,44],
    'Em':[210,55,50],
    'Fm':[232,50,54],
    'F#m':[258,47,56],'Gbm':[258,47,56],
    'Gm':[282,43,50],
    'G#m':[318,47,52],'Abm':[318,47,52],
  },

  jazzbar: {
    // Rich, deep, sultry — blue velvet and whiskey
    'C':[355,55,32],'C#':[18,60,30],'Db':[18,60,30],
    'D':[38,55,28],
    'D#':[55,45,26],'Eb':[55,45,26],
    'E':[85,40,25],
    'F':[155,45,26],
    'F#':[178,50,28],'Gb':[178,50,28],
    'G':[210,55,32],
    'G#':[230,50,34],'Ab':[230,50,34],
    'A':[260,50,36],
    'A#':[285,45,32],'Bb':[285,45,32],
    'B':[325,50,32],
    'Am':[355,50,24],
    'A#m':[18,55,22],'Bbm':[18,55,22],
    'Bm':[38,50,20],
    'Cm':[55,40,18],
    'C#m':[85,35,17],'Dbm':[85,35,17],
    'Dm':[155,40,18],
    'D#m':[178,45,20],'Ebm':[178,45,20],
    'Em':[210,50,24],
    'Fm':[230,45,26],
    'F#m':[260,45,28],'Gbm':[260,45,28],
    'Gm':[285,40,24],
    'G#m':[325,45,24],'Abm':[325,45,24],
  },

  cafe: {
    // Aged paper, clay, dried herbs — warm desaturated contrast
    'C':[5,28,48],'C#':[22,32,45],'Db':[22,32,45],
    'D':[38,35,42],
    'D#':[55,22,44],'Eb':[55,22,44],
    'E':[82,18,42],
    'F':[142,18,40],
    'F#':[168,22,42],'Gb':[168,22,42],
    'G':[195,25,45],
    'G#':[215,22,48],'Ab':[215,22,48],
    'A':[238,20,48],
    'A#':[268,18,45],'Bb':[268,18,45],
    'B':[308,22,46],
    'Am':[5,23,40],
    'A#m':[22,27,37],'Bbm':[22,27,37],
    'Bm':[38,30,34],
    'Cm':[55,17,36],
    'C#m':[82,13,34],'Dbm':[82,13,34],
    'Dm':[142,13,32],
    'D#m':[168,17,34],'Ebm':[168,17,34],
    'Em':[195,20,37],
    'Fm':[215,17,40],
    'F#m':[238,15,40],'Gbm':[238,15,40],
    'Gm':[268,13,37],
    'G#m':[308,17,38],'Abm':[308,17,38],
  },

  dive: {
    // Dive bar neon signs — moody, slightly desaturated neons with character
    'C':[350,85,58],'C#':[15,80,55],'Db':[15,80,55],
    'D':[52,82,50],
    'D#':[78,75,48],'Eb':[78,75,48],
    'E':[120,80,44],
    'F':[162,78,42],
    'F#':[182,82,46],'Gb':[182,82,46],
    'G':[205,85,52],
    'G#':[232,80,56],'Ab':[232,80,56],
    'A':[262,78,58],
    'A#':[288,75,52],'Bb':[288,75,52],
    'B':[328,82,54],
    'Am':[350,80,50],
    'A#m':[15,75,47],'Bbm':[15,75,47],
    'Bm':[52,77,42],
    'Cm':[78,70,40],
    'C#m':[120,75,36],'Dbm':[120,75,36],
    'Dm':[162,73,34],
    'D#m':[182,77,38],'Ebm':[182,77,38],
    'Em':[205,80,44],
    'Fm':[232,75,48],
    'F#m':[262,73,50],'Gbm':[262,73,50],
    'Gm':[288,70,44],
    'G#m':[328,77,46],'Abm':[328,77,46],
  },
};

export const KEY_HSL = PALETTES.festival; // backwards compat

export const RELATIVE_MAP = {
  'C':'Am','Am':'C','G':'Em','Em':'G','D':'Bm','Bm':'D','A':'F#m','F#m':'A',
  'E':'C#m','C#m':'E','B':'Abm','Abm':'B','F#':'Ebm','Ebm':'F#','Ab':'Fm',
  'Fm':'Ab','Eb':'Cm','Cm':'Eb','Bb':'Gm','Gm':'Bb','F':'Dm','Dm':'F',
  'Db':'Bbm','Bbm':'Db','C#':'Bbm',
};

export function normKey(key) {
  if (!key) return '';
  const k = key.trim();
  const ref = PALETTES.festival;
  if (ref[k]) return k;
  const c = k[0].toUpperCase() + k.slice(1);
  if (ref[c]) return c;
  const ns = k.replace(/\s/g, '');
  if (ref[ns]) return ns;
  const nsc = ns[0].toUpperCase() + ns.slice(1);
  if (ref[nsc]) return nsc;
  return k;
}

export function keyColor(key, palette = 'festival') {
  const k = normKey(key);
  const map = PALETTES[palette] ?? PALETTES.festival;
  const hsl = map[k];
  if (!hsl) return ['#888', '#fff'];
  const [h, s, l] = hsl;
  return [`hsl(${h},${s}%,${l}%)`, l < 55 ? '#fff' : '#000'];
}

// All 12 major keys for preview strips (legacy order)
export const MAJOR_KEYS_PREVIEW = ['C','D','E','F','G','A','B','C#','Eb','F#','Ab','Bb'];

// Chromatic order for key filter row
// Using flats where flats are more common (Eb, Bb, Ab) and sharps where sharps are (C#, F#)
export const CHROMATIC_KEYS       = ['C','C#','D','Eb','E','F','F#','G','Ab','A','Bb','B'];
export const CHROMATIC_MINOR_KEYS = ['Cm','C#m','Dm','Ebm','Em','Fm','F#m','Gm','Abm','Am','Bbm','Bm'];

// Enharmonic equivalents — used for key filter matching
export const ENHARMONIC_MAP = {
  'C#':'Db','Db':'C#',
  'D#':'Eb','Eb':'D#',
  'F#':'Gb','Gb':'F#',
  'G#':'Ab','Ab':'G#',
  'A#':'Bb','Bb':'A#',
  'C#m':'Dbm','Dbm':'C#m',
  'D#m':'Ebm','Ebm':'D#m',
  'F#m':'Gbm','Gbm':'F#m',
  'G#m':'Abm','Abm':'G#m',
  'A#m':'Bbm','Bbm':'A#m',
};
