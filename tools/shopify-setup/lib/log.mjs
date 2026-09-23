// Console output for the setup script: section headers, ✓ / • / ! / ✗ lines, run counters,
// a list of manual follow-ups, and a compact pretty-printer for GraphQL variables (--dry-run).

const useColor = process.stdout.isTTY && !process.env.NO_COLOR;
const paint = (code) => (s) => (useColor ? `\x1b[${code}m${s}\x1b[0m` : String(s));
export const c = { bold: paint(1), dim: paint(2), red: paint(31), green: paint(32), yellow: paint(33), cyan: paint(36) };

const WIDTH = 160;
const MAX_STRING = 56;

/** One-line rendering with long strings shortened (keys unquoted, JS-object style). */
function inline(value) {
  if (value === null || value === undefined) return String(value);
  if (typeof value === 'string') return JSON.stringify(value.length > MAX_STRING ? `${value.slice(0, MAX_STRING - 1)}…` : value);
  if (Array.isArray(value)) return `[${value.map(inline).join(', ')}]`;
  if (typeof value === 'object') {
    const entries = Object.entries(value).filter(([, v]) => v !== undefined);
    return entries.length ? `{ ${entries.map(([k, v]) => `${k}: ${inline(v)}`).join(', ')} }` : '{}';
  }
  return String(value);
}

/** Pretty-prints a value, keeping any node that fits on one line on one line. */
export function pretty(value, indent = 0) {
  const one = inline(value);
  if (value === null || typeof value !== 'object' || indent + one.length <= WIDTH) return one;
  const pad = ' '.repeat(indent + 2);
  const end = ' '.repeat(indent);
  if (Array.isArray(value)) return `[\n${value.map((v) => pad + pretty(v, indent + 2)).join(',\n')}\n${end}]`;
  const entries = Object.entries(value).filter(([, v]) => v !== undefined);
  return `{\n${entries.map(([k, v]) => `${pad}${k}: ${pretty(v, indent + 2)}`).join(',\n')}\n${end}}`;
}

/** "field.path: message [CODE]" for a mutation userError. */
export function formatUserError(e) {
  const field = Array.isArray(e.field) && e.field.length ? `${e.field.join('.')}: ` : '';
  const code = e.code ? ` [${e.code}]` : '';
  return `${field}${e.message}${code}`;
}

export function createLogger({ dryRun = false } = {}) {
  const counts = { created: 0, updated: 0, unchanged: 0, failed: 0, warnings: 0, planned: 0 };
  const todos = [];
  return {
    counts,
    todos,
    section(title) {
      console.log(`\n${c.bold(title)}`);
    },
    /** In a dry run the "→ mutation" plan line already says what would happen, so these stay quiet. */
    created(msg) {
      if (dryRun) return;
      counts.created++;
      console.log(`  ${c.green('✓')} ${msg}`);
    },
    updated(msg) {
      if (dryRun) return;
      counts.updated++;
      console.log(`  ${c.green('✓')} ${msg}`);
    },
    unchanged(msg) {
      counts.unchanged++;
      console.log(`  ${c.dim('•')} ${msg}`);
    },
    /** A ✓ line that isn't a store change (connection checks). */
    ok(msg) {
      console.log(`  ${c.green('✓')} ${msg}`);
    },
    info(msg) {
      console.log(`    ${c.dim(msg)}`);
    },
    warn(msg) {
      counts.warnings++;
      console.log(`  ${c.yellow('!')} ${msg}`);
    },
    fail(msg, userErrors = []) {
      counts.failed++;
      console.log(`  ${c.red('✗')} ${msg}`);
      for (const e of userErrors) console.log(`      ${c.red(formatUserError(e))}`);
    },
    /** Dry run: the mutation that would be sent, with a summary of its variables. */
    plan(root, label, variables) {
      counts.planned++;
      console.log(`  ${c.cyan('→')} ${root}${label ? ` ${c.dim(label)}` : ''}`);
      console.log(`      ${pretty(variables, 6)}`);
    },
    /** A follow-up the merchant has to do in Shopify admin (printed at the end). */
    todo(msg) {
      if (!todos.includes(msg)) todos.push(msg);
    },
  };
}
