import { ChordProParser, ChordProFormatter, Chord, ChordLyricsPair, Tag, Comment } from 'chordsheetjs';

// ChordPro parsing, display-time transposition, and the structured line model
// the chart view and editor operate on. chordsheetjs is the single source of
// truth for parsing, transposing and serializing.

export function parseChart(text) {
  return new ChordProParser().parse(text);
}

// Returns { ok: true } or { ok: false, error }. Used before accepting pasted ChordPro.
export function validateChart(text) {
  if (!text || !text.trim()) return { ok: false, error: 'Nothing to import.' };
  let song;
  try {
    song = parseChart(text);
  } catch (err) {
    return { ok: false, error: `Could not parse ChordPro: ${err.message}` };
  }
  const hasChord = song.lines.some(l => l.items.some(i => i instanceof ChordLyricsPair && i.chords));
  if (!hasChord) return { ok: false, error: 'No chords found in that text.' };
  return { ok: true };
}

export function transposeChord(chordStr, semitones) {
  if (!semitones) return chordStr;
  const chord = Chord.parse(chordStr);
  return chord ? chord.transpose(semitones).toString() : chordStr;
}

// ─── Chord model: root + modifiers + optional bass ─────────────────────────

export function decomposeChord(str) {
  const chord = Chord.parse((str || '').trim());
  if (!chord || !chord.root) return null;
  return {
    root: chord.root.note.toString(),
    mods: chord.suffix || '',
    bass: chord.bass ? chord.bass.toString() : '',
  };
}

export function composeChord({ root, mods = '', bass = '' }) {
  return `${root}${mods}${bass ? '/' + bass : ''}`;
}

export function isValidChord(str) {
  return !!decomposeChord(str);
}

// ─── Line model ────────────────────────────────────────────────────────────
// { idx, kind: 'blank' | 'meta' | 'comment' | 'lyrics', ... }
// lyrics lines: { lyrics: string, chords: [{ pos, chord, orig, disp }] }
//   pos   — character offset into lyrics
//   chord — current (displayed-key) chord
//   orig  — chord as stored (original key), absent for chords added in the editor
//   disp  — chord as first displayed, used to tell edited from untouched chords

function lineToModel(line, idx) {
  const items = line.items;
  if (!items.length) return { idx, kind: 'blank' };

  if (items.every(i => i instanceof ChordLyricsPair)) {
    let lyrics = '';
    const chords = [];
    for (const pair of items) {
      if (pair.chords) chords.push({ pos: lyrics.length, chord: pair.chords });
      lyrics += pair.lyrics || '';
    }
    if (!lyrics && !chords.length) return { idx, kind: 'blank' };
    return { idx, kind: 'lyrics', lyrics, chords };
  }

  const first = items[0];
  if (first instanceof Comment) return { idx, kind: 'comment', text: first.content };
  if (first instanceof Tag) return { idx, kind: 'meta', name: first.name, value: first.value };
  return { idx, kind: 'blank' };
}

export function songToModel(song) {
  return song.lines.map(lineToModel);
}

// Builds the model shown on screen: the stored chart transposed by `offset`.
export function buildDisplayModel(text, offset = 0) {
  const stored = parseChart(text);
  const shown = offset ? stored.transpose(offset) : stored;
  const storedLines = songToModel(stored);
  return songToModel(shown).map((line, i) => {
    if (line.kind !== 'lyrics') return line;
    return {
      ...line,
      chords: line.chords.map((c, k) => ({
        ...c,
        orig: storedLines[i].chords[k]?.chord,
        disp: c.chord,
      })),
    };
  });
}

// Writes the (possibly edited) model back to ChordPro in the stored/original key.
// Untouched chords keep their stored spelling; edited or new chords are
// transposed back by -offset.
export function serializeModel(text, model, offset = 0) {
  const song = parseChart(text);
  for (const line of model) {
    if (line.kind !== 'lyrics') continue;
    const chords = [...line.chords]
      .map(c => ({
        pos: c.pos,
        chord: c.orig !== undefined && c.chord === c.disp ? c.orig : transposeChord(c.chord, -offset),
      }))
      .sort((a, b) => a.pos - b.pos);

    const pairs = [];
    const firstPos = chords.length ? chords[0].pos : line.lyrics.length;
    if (firstPos > 0) pairs.push(new ChordLyricsPair('', line.lyrics.slice(0, firstPos)));
    chords.forEach((c, i) => {
      const end = i + 1 < chords.length ? chords[i + 1].pos : line.lyrics.length;
      pairs.push(new ChordLyricsPair(c.chord, line.lyrics.slice(c.pos, end)));
    });
    song.lines[line.idx].items = pairs;
  }
  return new ChordProFormatter().format(song);
}

// Splits a lyrics line into word-sized groups so lines wrap between words.
// Each group is { start, text, chord } where chord is the entry anchored at `start` (if any).
export function groupLine(line) {
  const { lyrics, chords } = line;
  const cuts = new Set([0, lyrics.length]);
  for (const c of chords) cuts.add(c.pos);
  // break after every run of spaces
  for (let i = 1; i < lyrics.length; i++) {
    if (lyrics[i - 1] === ' ' && lyrics[i] !== ' ') cuts.add(i);
  }
  const points = [...cuts].sort((a, b) => a - b);
  const groups = [];
  for (let i = 0; i < points.length; i++) {
    const start = points[i];
    const end = points[i + 1] ?? lyrics.length;
    const here = chords.filter(c => c.pos === start);
    if (start === lyrics.length && !here.length) continue;
    groups.push({ start, text: lyrics.slice(start, end), chords: here });
  }
  return groups;
}
