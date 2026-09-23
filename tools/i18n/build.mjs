// Generates locales/en.default.json and locales/ar.json from tools/i18n/strings.mjs.
// Usage: node tools/i18n/build.mjs
import fs from 'node:fs';
import path from 'node:path';
import strings from './strings.mjs';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');

function pick(node, idx, trail = []) {
  if (Array.isArray(node)) {
    if (node.length !== 2) throw new Error(`Expected [en, ar] at ${trail.join('.')}`);
    return node[idx];
  }
  const out = {};
  for (const [k, v] of Object.entries(node)) {
    if (k === 'ar_extra') {
      if (idx === 1) Object.assign(out, v);
      continue;
    }
    out[k] = pick(v, idx, [...trail, k]);
  }
  return out;
}

// Note: no comment header — Shopify locale files must be plain JSON.
const header = () => '';

fs.writeFileSync(path.join(ROOT, 'locales/en.default.json'), header('English') + JSON.stringify(pick(strings, 0), null, 2) + '\n');
fs.writeFileSync(path.join(ROOT, 'locales/ar.json'), header('Arabic') + JSON.stringify(pick(strings, 1), null, 2) + '\n');
console.log('locales written');
