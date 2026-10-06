import { execFileSync } from 'node:child_process';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const WORKER_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'worker');
const DB_NAME = 'billy-fm-db';

// target: 'remote' | 'local'
function wrangler(target, args) {
  return execFileSync(
    'npx',
    ['wrangler', 'd1', 'execute', DB_NAME, target === 'remote' ? '--remote' : '--local', '--json', ...args],
    { cwd: WORKER_DIR, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 },
  );
}

export function query(target, sql) {
  const out = JSON.parse(wrangler(target, ['--command', sql]));
  return out[0]?.results ?? [];
}

export function runSqlFile(target, sql) {
  const file = join(mkdtempSync(join(tmpdir(), 'billy-')), 'import.sql');
  writeFileSync(file, sql);
  return wrangler(target, ['--file', file]);
}

export function loadSongs(target) {
  return query(target, 'SELECT id, title, artist, default_key FROM songs ORDER BY title');
}

export function parseTarget(argv) {
  if (argv.includes('--local')) return 'local';
  if (argv.includes('--remote')) return 'remote';
  return null;
}
