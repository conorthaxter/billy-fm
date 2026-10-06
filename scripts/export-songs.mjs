// Usage: node scripts/export-songs.mjs --remote|--local [--csv] [--out path]
// Dumps songs as id, title, artist, default_key.
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { loadSongs, parseTarget } from './lib/db.mjs';

const argv = process.argv.slice(2);
const target = parseTarget(argv);
if (!target) { console.error('Pass --remote or --local.'); process.exit(2); }

const csv = argv.includes('--csv');
const outIdx = argv.indexOf('--out');
const out = outIdx > -1 ? argv[outIdx + 1] : `scripts/out/songs-export.${csv ? 'csv' : 'json'}`;

const songs = loadSongs(target);
const esc = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
const body = csv
  ? ['id,title,artist,default_key', ...songs.map(s => [s.id, s.title, s.artist, s.default_key].map(esc).join(','))].join('\n') + '\n'
  : JSON.stringify(songs, null, 2) + '\n';

mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, body);
console.log(`Wrote ${songs.length} songs to ${out}`);
