// Configuration for the store setup script: a tiny .env reader (no dotenv dependency)
// and helpers that turn environment variables into a validated config.
//
// Variables (real environment variables always win over the .env file):
//   SHOPIFY_STORE          maison-invitation  |  maison-invitation.myshopify.com  (SHOPIFY_SHOP also accepted)
//   SHOPIFY_ADMIN_TOKEN    an Admin API access token you already have            ─┐ one of
//   SHOPIFY_CLIENT_ID      Dev Dashboard app credentials, exchanged for a token  ─┘ these
//   SHOPIFY_CLIENT_SECRET
//   SHOPIFY_API_VERSION    optional, defaults to DEFAULT_API_VERSION
import fs from 'node:fs';

/** Latest stable Admin API version at the time of writing (2026-10 is still a release candidate). */
export const DEFAULT_API_VERSION = '2026-07';

/**
 * Parses KEY=value lines. Supports blank lines, # comments, `export KEY=…`,
 * single/double-quoted values (double quotes understand \n) and trailing
 * ` # comments` after unquoted values.
 */
export function parseEnv(text) {
  const vars = {};
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const m = line.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!m) continue;
    let value = m[2];
    const quote = value[0];
    if (quote === '"' || quote === "'") {
      const end = value.lastIndexOf(quote);
      value = end > 0 ? value.slice(1, end) : value.slice(1);
      if (quote === '"') value = value.replace(/\\n/g, '\n').replace(/\\"/g, '"');
    } else {
      value = value.replace(/\s+#.*$/, '').trim();
    }
    vars[m[1]] = value;
  }
  return vars;
}

/** Loads a .env file into process.env without overriding variables that are already set. */
export function loadEnvFile(file) {
  if (!fs.existsSync(file)) return false;
  for (const [key, value] of Object.entries(parseEnv(fs.readFileSync(file, 'utf8')))) {
    if (process.env[key] === undefined) process.env[key] = value;
  }
  return true;
}

/**
 * Normalises whatever the user pasted into "<name>.myshopify.com":
 *   maison-invitation · maison-invitation.myshopify.com · https://maison-invitation.myshopify.com/admin
 *   https://admin.shopify.com/store/maison-invitation
 */
export function normalizeStore(value) {
  if (!value) return '';
  const s = value.trim().toLowerCase();
  const admin = s.match(/admin\.shopify\.com\/store\/([a-z0-9-]+)/);
  if (admin) return `${admin[1]}.myshopify.com`;
  const host = s.replace(/^https?:\/\//, '').split(/[/?#]/)[0];
  return host.includes('.') ? host : `${host}.myshopify.com`;
}

/** Reads the setup config from process.env. Returns { store, apiVersion, auth, problems[] }. */
export function readConfig(env = process.env) {
  const problems = [];
  const store = normalizeStore(env.SHOPIFY_STORE || env.SHOPIFY_SHOP || '');
  const apiVersion = (env.SHOPIFY_API_VERSION || DEFAULT_API_VERSION).trim();

  if (!store) problems.push('SHOPIFY_STORE is not set (e.g. maison-invitation.myshopify.com).');
  else if (!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(store)) {
    problems.push(`SHOPIFY_STORE must be the store's .myshopify.com domain, not a custom domain (got "${store}").`);
  }
  if (!/^(\d{4}-(01|04|07|10)|unstable)$/.test(apiVersion)) {
    problems.push(`SHOPIFY_API_VERSION "${apiVersion}" doesn't look like an Admin API version (e.g. ${DEFAULT_API_VERSION}).`);
  }

  let auth = { mode: 'none' };
  if (env.SHOPIFY_ADMIN_TOKEN) auth = { mode: 'token', token: env.SHOPIFY_ADMIN_TOKEN.trim() };
  else if (env.SHOPIFY_CLIENT_ID && env.SHOPIFY_CLIENT_SECRET) {
    auth = { mode: 'client_credentials', clientId: env.SHOPIFY_CLIENT_ID.trim(), clientSecret: env.SHOPIFY_CLIENT_SECRET.trim() };
  } else if (env.SHOPIFY_CLIENT_ID || env.SHOPIFY_CLIENT_SECRET) {
    problems.push('Set both SHOPIFY_CLIENT_ID and SHOPIFY_CLIENT_SECRET (or SHOPIFY_ADMIN_TOKEN).');
  } else {
    problems.push('No credentials: set SHOPIFY_CLIENT_ID + SHOPIFY_CLIENT_SECRET, or SHOPIFY_ADMIN_TOKEN.');
  }

  return { store, apiVersion, auth, problems };
}
