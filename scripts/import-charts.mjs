// Usage: node scripts/import-charts.mjs --remote|--local [delivery.json] [--apply]
// Default is a dry run: validates, prints count and a sample, writes nothing.
// --apply runs the writes. Re-running overwrites cleanly (idempotent).
import { loadSongs, parseTarget, runSqlFile } from './lib/db.mjs';
import { DEFAULT_DELIVERY, loadDelivery, validateDelivery } from './lib/validate.mjs';

const argv = process.argv.slice(2);
const target = parseTarget(argv);
if (!target) { console.error('Pass --remote or --local.'); process.exit(2); }
const apply = argv.includes('--apply');
const file = argv.find(a => !a.startsWith('--')) ?? DEFAULT_DELIVERY;

const entries = loadDelivery(file);
const failures = validateDelivery(entries, loadSongs(target));
if (failures.length) {
  console.error(`Validator failed (${failures.length}). Nothing written.`);
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}

const q = v => `'${String(v).replace(/'/g, "''")}'`;
const backfills = entries.filter(e => e.db_key_was_null);

console.log(`Target: ${target}`);
console.log(`Charts to write: ${entries.length}`);
console.log(`default_key backfills: ${backfills.length}`);
console.log('Sample:');
for (const e of entries.slice(0, 5)) {
  console.log(`  ${e.id} ${e.title} — ${e.artist} [${e.final_key}]${e.db_key_was_null ? ' (backfill key)' : ''}`);
}

if (!apply) { console.log('Dry run. Pass --apply to write.'); process.exit(0); }

const sql = entries.map(e =>
  `UPDATE songs SET chord_chart = ${q(e.chord_chart)}` +
  (e.db_key_was_null ? `, default_key = ${q(e.final_key)}` : '') +
  ` WHERE id = ${q(e.id)};`
).join('\n');

runSqlFile(target, sql);
console.log(`Applied ${entries.length} updates.`);
