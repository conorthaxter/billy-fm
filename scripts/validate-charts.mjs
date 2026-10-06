// Usage: node scripts/validate-charts.mjs --remote|--local [delivery.json]
// Read-only. Exit code 1 if any entry fails.
import { loadSongs, parseTarget } from './lib/db.mjs';
import { DEFAULT_DELIVERY, loadDelivery, validateDelivery } from './lib/validate.mjs';

const argv = process.argv.slice(2);
const target = parseTarget(argv);
if (!target) { console.error('Pass --remote or --local.'); process.exit(2); }
const file = argv.find(a => !a.startsWith('--')) ?? DEFAULT_DELIVERY;

const entries = loadDelivery(file);
const failures = validateDelivery(entries, loadSongs(target));

if (failures.length) {
  console.error(`${failures.length} failure(s) in ${entries.length} entries:`);
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log(`Clean: ${entries.length} entries valid against ${target} DB.`);
