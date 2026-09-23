// Runs Shopify Theme Check (the official theme linter) with the recommended config
// and prints a readable report. Exit code 1 when there are errors.
// Usage: npm run check
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { themeCheckRun } = require('@shopify/theme-check-node');

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const { offenses } = await themeCheckRun(ROOT, path.join(ROOT, '.theme-check.yml'), () => {});
const sev = ['error', 'warning', 'info'];
const rel = (uri) => path.relative(ROOT, decodeURIComponent(uri.replace('file://', '')));
const sorted = offenses.sort((a, b) => a.severity - b.severity || rel(a.uri).localeCompare(rel(b.uri)));
for (const o of sorted) {
  console.log(`${sev[o.severity].padEnd(7)} ${rel(o.uri)}:${o.start.line + 1}  [${o.check}] ${o.message}`);
}
const errors = offenses.filter((o) => o.severity === 0).length;
console.log(`\n${offenses.length} offenses (${errors} errors)`);
process.exit(errors ? 1 : 0);
