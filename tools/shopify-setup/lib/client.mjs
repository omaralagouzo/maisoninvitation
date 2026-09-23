// Minimal Shopify Admin GraphQL client (global fetch, no dependencies).
//
//   * Auth: a static Admin API token, or the client credentials grant for a Dev Dashboard
//     app installed on a store in the same Shopify organization:
//       POST https://{store}/admin/oauth/access_token
//            grant_type=client_credentials&client_id=…&client_secret=…
//       → { access_token, scope, expires_in: 86399 }
//     Tokens last 24 hours; the client refreshes one a minute before it expires.
//   * Retries: GraphQL THROTTLED errors (waits for the leaky bucket using the cost info
//     Shopify returns), HTTP 429 / 5xx and network errors, with exponential backoff.
//   * Everything else (top-level GraphQL errors, 401/403) is thrown as a GraphQLRequestError.
//     Mutation userErrors are NOT thrown — callers read them from the payload.

const MAX_ATTEMPTS = 6;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const backoffMs = (attempt) => Math.min(20_000, 1000 * 2 ** (attempt - 1)) + Math.floor(Math.random() * 250);

export class GraphQLRequestError extends Error {
  constructor(message, { status, errors, codes = [] } = {}) {
    super(message);
    this.name = 'GraphQLRequestError';
    this.status = status;
    this.errors = errors;
    this.codes = codes;
  }
}

/** Human-readable summary of a GraphQL `errors` value (an array of objects, or a plain string on some 4xx). */
function describeErrors(errors) {
  if (!errors) return 'unknown error';
  if (typeof errors === 'string') return errors;
  if (Array.isArray(errors)) {
    return errors
      .map((e) => {
        const code = e.extensions?.code ? ` [${e.extensions.code}]` : '';
        const where = e.path ? ` (at ${e.path.join('.')})` : '';
        return `${e.message}${code}${where}`;
      })
      .join('; ');
  }
  return JSON.stringify(errors);
}

/** Exchanges Dev Dashboard app credentials for an Admin API access token. */
export async function requestClientCredentialsToken({ store, clientId, clientSecret }) {
  let res;
  try {
    res = await fetch(`https://${store}/admin/oauth/access_token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body: new URLSearchParams({ grant_type: 'client_credentials', client_id: clientId, client_secret: clientSecret }),
    });
  } catch (err) {
    throw new Error(`Could not reach https://${store} (${err.cause?.code || err.message}). Check SHOPIFY_STORE.`);
  }
  const text = await res.text();
  let body = null;
  try {
    body = JSON.parse(text);
  } catch {
    /* non-JSON error page */
  }
  if (!res.ok || !body?.access_token) {
    const detail = body?.error_description || body?.error || text.replace(/\s+/g, ' ').slice(0, 200);
    let hint = '';
    if (/shop_not_permitted/i.test(text)) {
      hint = '\n  The client credentials grant only works when the app and the store belong to the same Shopify organization (Dev Dashboard → Dev stores / Stores).';
    } else if (res.status === 400 || res.status === 401 || res.status === 403) {
      hint = '\n  Check SHOPIFY_CLIENT_ID / SHOPIFY_CLIENT_SECRET and that a released version of the app is installed on this store.';
    } else if (res.status === 404) {
      hint = '\n  Check SHOPIFY_STORE — it must be the store\'s .myshopify.com domain.';
    }
    throw new Error(`Access token request failed (HTTP ${res.status}): ${detail}${hint}`);
  }
  return {
    token: body.access_token,
    scopes: String(body.scope || '').split(',').map((s) => s.trim()).filter(Boolean),
    expiresAt: Date.now() + (Number(body.expires_in) || 86_399) * 1000,
  };
}

/**
 * @param {object} o
 * @param {string} o.store       "<name>.myshopify.com"
 * @param {string} o.apiVersion  e.g. "2026-07"
 * @param {object} o.auth        { mode: 'token', token } | { mode: 'client_credentials', clientId, clientSecret }
 * @param {(msg: string) => void} [o.onWait]  called before sleeping for a retry
 */
export function createAdminClient({ store, apiVersion, auth, onWait = () => {} }) {
  const endpoint = `https://${store}/admin/api/${apiVersion}/graphql.json`;
  let access = auth.mode === 'token' ? { token: auth.token, scopes: null, expiresAt: Infinity } : null;

  async function getToken({ refresh = false } = {}) {
    if (!refresh && access && Date.now() < access.expiresAt - 60_000) return access.token;
    if (auth.mode !== 'client_credentials') return access.token;
    access = await requestClientCredentialsToken({ store, clientId: auth.clientId, clientSecret: auth.clientSecret });
    return access.token;
  }

  async function wait(ms, reason) {
    onWait(`${reason} — retrying in ${(ms / 1000).toFixed(1)}s`);
    await sleep(ms);
  }

  /** Runs a query or mutation and returns `data`. */
  async function request(query, variables = {}) {
    let refreshed = false;
    for (let attempt = 1; ; attempt++) {
      const last = attempt >= MAX_ATTEMPTS;
      let res;
      try {
        res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-Shopify-Access-Token': await getToken() },
          body: JSON.stringify({ query, variables }),
        });
      } catch (err) {
        if (last) throw new GraphQLRequestError(`Network error talking to ${store}: ${err.cause?.code || err.message}`);
        await wait(backoffMs(attempt), `network error (${err.cause?.code || err.message})`);
        continue;
      }

      if (res.status === 429 || res.status >= 500) {
        if (last) throw new GraphQLRequestError(`HTTP ${res.status} from Shopify after ${MAX_ATTEMPTS} attempts`, { status: res.status });
        const retryAfter = Number(res.headers.get('retry-after'));
        await wait(retryAfter > 0 ? retryAfter * 1000 : backoffMs(attempt), `HTTP ${res.status}`);
        continue;
      }

      const text = await res.text();
      let body;
      try {
        body = JSON.parse(text);
      } catch {
        throw new GraphQLRequestError(`HTTP ${res.status}: unexpected response: ${text.replace(/\s+/g, ' ').slice(0, 200)}`, { status: res.status });
      }

      if (res.status === 401) {
        // A client-credentials token may have been revoked or expired early: get a fresh one once.
        if (auth.mode === 'client_credentials' && !refreshed) {
          refreshed = true;
          await getToken({ refresh: true });
          continue;
        }
        throw new GraphQLRequestError(`Unauthorized (401): ${describeErrors(body.errors)}. The access token is invalid, expired or the app was uninstalled.`, { status: 401 });
      }
      if (res.status === 403) {
        throw new GraphQLRequestError(`Forbidden (403): ${describeErrors(body.errors)}. The app is probably missing an access scope.`, { status: 403 });
      }
      if (!res.ok) throw new GraphQLRequestError(`HTTP ${res.status}: ${describeErrors(body.errors)}`, { status: res.status });

      if (body.errors?.length) {
        const codes = body.errors.map((e) => e.extensions?.code).filter(Boolean);
        if (codes.includes('THROTTLED') && !last) {
          // Wait just long enough for the bucket to refill to the requested cost.
          const cost = body.extensions?.cost;
          let ms = backoffMs(attempt);
          const t = cost?.throttleStatus;
          if (t && cost.requestedQueryCost && t.restoreRate) {
            const missing = cost.requestedQueryCost - t.currentlyAvailable;
            if (missing > 0) ms = Math.ceil((missing / t.restoreRate) * 1000) + 250;
          }
          await wait(ms, 'throttled by Shopify');
          continue;
        }
        throw new GraphQLRequestError(describeErrors(body.errors), { status: res.status, errors: body.errors, codes });
      }
      return body.data;
    }
  }

  return {
    endpoint,
    request,
    getToken,
    /** Scopes reported by the token exchange (null for a static token until queried). */
    get grantedScopes() {
      return access?.scopes ?? null;
    },
  };
}
