import { readFileSync } from 'node:fs';
import { ChordProParser } from 'chordsheetjs';

export const DEFAULT_DELIVERY = 'Billy FM Chord Charts.json';

export function loadDelivery(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

// Title/artist are compared ignoring case and surrounding whitespace.
const norm = v => String(v ?? '').trim().toLowerCase();

// Returns an array of failure strings. Empty array = clean.
export function validateDelivery(entries, songs) {
  const byId = new Map(songs.map(s => [s.id, s]));
  const seen = new Set();
  const failures = [];

  for (const e of entries) {
    const label = `${e.id} "${e.title}" — ${e.artist}`;
    if (!e.id || typeof e.chord_chart !== 'string' || !e.chord_chart.trim()) {
      failures.push(`${label}: missing id or chord_chart`);
      continue;
    }
    if (seen.has(e.id)) failures.push(`${label}: duplicate id in delivery file`);
    seen.add(e.id);

    try {
      new ChordProParser().parse(e.chord_chart);
    } catch (err) {
      failures.push(`${label}: chordsheetjs parse failed: ${err.message}`);
    }

    const row = byId.get(e.id);
    if (!row) { failures.push(`${label}: id not found in songs`); continue; }
    if (norm(row.title) !== norm(e.title) || norm(row.artist) !== norm(e.artist)) {
      failures.push(`${label}: DB has "${row.title}" — ${row.artist}`);
    }
    if (e.db_key_was_null && !e.final_key) failures.push(`${label}: db_key_was_null but final_key is empty`);
  }
  return failures;
}
