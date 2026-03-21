/**
 * Parse a CSV string into an array of rows (each row is an array of strings).
 * Handles quoted fields and escaped quotes ("").
 */
export function parseCSV(text) {
  const rows = [];
  for (const rawLine of text.split(/\r?\n/)) {
    if (!rawLine.trim()) continue;
    const row = []; let field = '', inQ = false;
    for (let i = 0; i < rawLine.length; i++) {
      const ch = rawLine[i];
      if (inQ) {
        if (ch === '"' && rawLine[i + 1] === '"') { field += '"'; i++; }
        else if (ch === '"') inQ = false;
        else field += ch;
      } else {
        if (ch === '"') inQ = true;
        else if (ch === ',') { row.push(field.trim()); field = ''; }
        else field += ch;
      }
    }
    row.push(field.trim());
    rows.push(row);
  }
  return rows;
}

/**
 * Convert parsed CSV rows into song objects ready for import.
 * Mirrors the original app's rowsToSongs, adapted for the API schema.
 *
 * Returned shape per song:
 *   { title, artist, key, bpm, chords_url, notes }
 */
export function rowsToSongs(rows) {
  if (rows.length < 2) return [];

  const hdr = rows[0].map(h => (h || '').trim().toUpperCase().replace(/\s+/g, ' '));

  let songC = -1, artistC = -1, keyC = -1, chordsC = -1;
  const notesC = [];

  hdr.forEach((h, i) => {
    if (songC   < 0 && (h === 'SONG' || h === 'TITLE' || h === 'SONG TITLE' || h === 'NAME')) songC = i;
    if (artistC < 0 && h === 'ARTIST')                   artistC = i;
    if (keyC    < 0 && h === 'KEY')                       keyC    = i;
    if (chordsC < 0 && (h === 'CHORDS' || h === 'CHORD')) chordsC = i;
    if (h.startsWith('NOTES') || h === 'NOTE')            notesC.push(i);
  });

  // Fallback column detection: if headers aren't found, detect checkbox offset
  if (songC < 0) {
    const f0 = (rows[1]?.[0] || '').trim().toUpperCase();
    const off = (f0 === 'TRUE' || f0 === 'FALSE' || f0 === '') ? 1 : 0;
    songC   = off;
    artistC = off + 1;
    keyC    = off + 2;
    chordsC = off + 3;
    if (!notesC.length) { notesC.push(off + 4); notesC.push(off + 5); }
  }

  const songs = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const title = (r[songC] || '').trim();
    if (!title || title.toUpperCase() === 'TRUE' || title.toUpperCase() === 'FALSE') continue;

    const artist    = (r[artistC]  || '').trim();
    const key       = (r[keyC]     || '').trim() || null;
    const rawChords = (r[chordsC]  || '').trim();

    // notes1 / notes2 — combine non-URL text notes
    const isUrl = s => /^https?:\/\//i.test(s);
    const noteTexts = notesC
      .map(c => (r[c] || '').trim())
      .filter(n => n && !isUrl(n));

    // chords_url: prefer the chords column if it's a URL,
    // then fall back to any URL found in the notes columns
    let chordsUrl = null;
    if (isUrl(rawChords)) {
      chordsUrl = rawChords;
    } else {
      for (const c of notesC) {
        const v = (r[c] || '').trim();
        if (isUrl(v)) { chordsUrl = v; break; }
      }
    }

    songs.push({
      title,
      artist,
      key,
      bpm:       null,   // enriched client-side after import
      chords_url: chordsUrl,
      notes:     noteTexts.join('\n') || null,
    });
  }

  return songs;
}

/**
 * Fetch a CSV from a URL and parse it.
 * Google Sheets "pub?output=csv" URLs require a cache-bust param.
 */
export async function fetchAndParseCSV(url) {
  const sep = url.includes('?') ? '&' : '?';
  const resp = await fetch(url + sep + '_=' + Date.now());
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  const text = await resp.text();
  const rows = parseCSV(text);
  const songs = rowsToSongs(rows);
  if (!songs.length) throw new Error('No songs found — check the CSV format');
  return songs;
}
