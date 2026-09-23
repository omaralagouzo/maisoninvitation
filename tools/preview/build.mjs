// Builds a static, clickable preview of the theme into dist/preview/.
//
//   node tools/preview/build.mjs            # build everything
//   node tools/preview/build.mjs --only=/   # build matching routes only (substring match)
//
// Every page is rendered from the real theme files via tools/preview/engine.mjs,
// in English and Arabic (/ar/…), then links are rewritten to relative .html files
// so the preview works from any static host or straight from disk.
import fs from 'node:fs';
import path from 'node:path';
import { createEngine, renderTemplate, THEME, missingTranslations, renderWarnings, exists } from './engine.mjs';
import { buildStore, sampleCart, sampleCustomer, MEDIA_DIR } from './mock.mjs';
import { DESIGNS, DEMO_INVITATIONS } from '../data/catalog.mjs';

const OUT = path.join(THEME, 'dist/preview');
const only = (process.argv.find((a) => a.startsWith('--only=')) || '').slice(7);

// ------------------------------------------------------------------ routes
function routesFor(store) {
  const ar = store.locale === 'ar';
  const p = store.prefix;
  const r = [];
  const add = (url, template, pageType, vars = {}) => r.push({ url, template, pageType, vars });

  add(p || '/', 'index', 'index', { page_title: 'Maison Invitation' });
  add(`${p}/collections/invitations`, 'collection', 'collection', { collection: store.collections.invitations, page_title: store.collections.invitations.title });
  add(`${p}/collections/all`, 'collection', 'collection', { collection: store.collections.all, page_title: store.collections.all.title });
  for (const d of DESIGNS) {
    const product = store.products[d.handle];
    add(`${p}/products/${d.handle}`, 'product', 'product', { product, page_title: product.title, page_description: product.metafields.maison.subtitle?.value });
  }
  for (const [handle, page] of Object.entries(store.pages)) {
    add(`${p}/pages/${handle}`, `page.${page.template_suffix}`, 'page', { page, page_title: page.title });
  }
  add(`${p}/cart`, 'cart', 'cart', { cart: sampleCart(store), page_title: ar ? 'حقيبتك' : 'Your bag' });
  const results = Object.values(store.products).filter((x) => x.type !== 'Add-on');
  add(`${p}/search`, 'search', 'search', {
    search: { performed: true, terms: ar ? 'زفاف' : 'wedding', results, results_count: results.length, types: ['product'] },
    page_title: ar ? 'بحث' : 'Search',
  });
  add(`${p}/404`, '404', '404', { page_title: ar ? 'الصفحة غير موجودة' : 'Page not found' });
  add(`${p}/password`, 'password', 'password', { page_title: 'Maison Invitation' });
  add(`${p}/account/login`, 'customers/login', 'customers/login', { page_title: ar ? 'تسجيل الدخول' : 'Log in' });
  add(`${p}/account/register`, 'customers/register', 'customers/register', { page_title: ar ? 'إنشاء حساب' : 'Create account' });
  const customer = sampleCustomer(store);
  add(`${p}/account`, 'customers/account', 'customers/account', { customer, page_title: ar ? 'حسابك' : 'Account' });
  add(`${p}/account/orders/1001`, 'customers/order', 'customers/order', { customer, order: customer.__order, page_title: 'Order #1001' });
  add(`${p}/account/addresses`, 'customers/addresses', 'customers/addresses', { customer, page_title: ar ? 'العناوين' : 'Addresses' });

  if (!ar) {
    for (const inv of DEMO_INVITATIONS) {
      const metaobject = store.invitations[inv.handle];
      add(`/pages/invitation/${inv.handle}`, 'metaobject/invitation', 'metaobject', { metaobject, page_title: inv.title });
    }
  }
  return r;
}

// ------------------------------------------------------------------ url → file
function fileFor(url) {
  const clean = url.replace(/[?#].*$/, '').replace(/\/$/, '');
  if (clean === '' || clean === '/') return 'index.html';
  if (clean === '/ar') return 'ar/index.html';
  return `${clean.replace(/^\//, '')}.html`;
}

function resolveInternal(url, known) {
  const m = url.match(/^([^?#]*)(\?[^#]*)?(#.*)?$/);
  let p = m[1] || '/';
  const q = m[2] || '';
  const h = m[3] || '';
  if (p.startsWith('/assets/') || p.startsWith('/images/')) return { file: p.slice(1), q, h };
  if (p.length > 1) p = p.replace(/\/$/, '');
  if (known.has(p)) return { file: fileFor(p), q, h };
  const ar = p === '/ar' || p.startsWith('/ar/');
  const pre = ar ? '/ar' : '';
  const rest = ar ? p.slice(3) || '/' : p;
  const map = [
    [/^\/cart/, `${pre}/cart`],
    [/^\/search/, `${pre}/search`],
    [/^\/collections(\/|$)/, `${pre}/collections/invitations`],
    [/^\/account\/logout/, `${pre}/account/login`],
    [/^\/account\/recover/, `${pre}/account/login`],
    [/^\/account/, `${pre}/account`],
    [/^\/pages\/invitation\/(.+)$/, (mm) => `/pages/invitation/${mm[1]}`],
  ];
  for (const [re, target] of map) {
    const mm = rest.match(re);
    if (mm) {
      const t = typeof target === 'function' ? target(mm) : target;
      if (known.has(t)) return { file: fileFor(t), q, h };
    }
  }
  return { file: 'preview-note.html', q: `?from=${encodeURIComponent(p)}`, h: '' };
}

function relative(fromFile, toFile) {
  let rel = path.posix.relative(path.posix.dirname(fromFile), toFile);
  if (!rel.startsWith('.')) rel = `./${rel}`;
  return rel;
}

function rewrite(html, fromFile, known) {
  const fix = (url) => {
    if (!url.startsWith('/') || url.startsWith('//')) return url;
    const { file, q, h } = resolveInternal(url, known);
    return relative(fromFile, file) + q + h;
  };
  html = html.replace(/(\s(?:href|src|action|poster|data-[\w-]+)=")(\/[^"]*)"/g, (_, a, u) => `${a}${fix(u)}"`);
  html = html.replace(/(\ssrcset=")([^"]*)"/g, (_, a, set) =>
    `${a}${set.split(',').map((part) => part.trim().replace(/^(\S+)/, (u) => fix(u))).join(', ')}"`,
  );
  html = html.replace(/url\((['"]?)(\/[^)'"]+)\1\)/g, (_, qt, u) => `url(${qt}${fix(u)}${qt})`);
  // JSON / JS string literals holding root-relative URLs (routes, variant URLs, images)
  html = html.replace(/"(\\?\/(?:ar(?:\\?\/)?)?(?:cart|products|collections|pages|search|account|assets|images)?[^"\s<>]*)"/g, (full, u) => {
    const unescaped = u.replace(/\\\//g, '/');
    if (!/^\/(ar(\/|$)|cart|products|collections|pages|search|account|assets|images|$)/.test(unescaped)) return full;
    if (unescaped.includes(' ')) return full;
    return JSON.stringify(fix(unescaped));
  });
  return html;
}

// ------------------------------------------------------------------ build
async function main() {
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });

  const pages = [];
  const stores = { en: buildStore({ locale: 'en' }), ar: buildStore({ locale: 'ar' }) };
  const allRoutes = [...routesFor(stores.en).map((r) => ({ ...r, locale: 'en' })), ...routesFor(stores.ar).map((r) => ({ ...r, locale: 'ar' }))];
  const known = new Set(allRoutes.map((r) => r.url));
  known.add('/preview-note');

  for (const route of allRoutes) {
    if (only && !route.url.includes(only)) continue;
    const store = stores[route.locale];
    if (!exists(`templates/${route.template}.json`) && !exists(`templates/${route.template}.liquid`)) {
      console.warn(`skip ${route.url} (templates/${route.template} missing)`);
      continue;
    }
    const engine = createEngine({ locale: route.locale, store });
    const [dir, name] = route.template.includes('/') ? route.template.split('/') : [null, route.template];
    const [tname, suffix] = name.split('.');
    const vars = {
      ...route.vars,
      template: { name: tname, suffix: suffix || null, directory: dir },
      canonical_url: `https://maisoninvitation.com${route.url}`,
      request: { ...store.globals.request, page_type: route.pageType, path: route.url },
      content_for_header: '',
    };
    let html;
    try {
      html = await renderTemplate(engine, { template: route.template, vars });
    } catch (e) {
      console.error(`FAILED ${route.url}:`, e.message);
      renderWarnings.push(`${route.url}: ${e.message}`);
      continue;
    }
    const file = fileFor(route.url);
    const altUrl = route.locale === 'ar' ? route.url.replace(/^\/ar/, '') || '/' : `/ar${route.url === '/' ? '' : route.url}`;
    const preview = {
      locale: route.locale,
      alt: known.has(altUrl) ? relative(file, fileFor(altUrl)) : null,
      home: relative(file, 'index.html'),
      index: relative(file, 'preview-index.html'),
      cart: relative(file, fileFor(`${route.locale === 'ar' ? '/ar' : ''}/cart`)),
      account: relative(file, fileFor(`${route.locale === 'ar' ? '/ar' : ''}/account`)),
      search: relative(file, fileFor(`${route.locale === 'ar' ? '/ar' : ''}/search`)),
    };
    const shim = `<script>window.__PREVIEW__=${JSON.stringify(preview)}</script><script src="${relative(file, 'preview-shim.js')}" defer></script>`;
    html = html.replace('</head>', `${shim}</head>`);
    html = rewrite(html, file, known);
    fs.mkdirSync(path.dirname(path.join(OUT, file)), { recursive: true });
    fs.writeFileSync(path.join(OUT, file), html);
    pages.push({ url: route.url, file, template: route.template, locale: route.locale, title: route.vars.page_title });
  }

  // assets + images
  fs.cpSync(path.join(THEME, 'assets'), path.join(OUT, 'assets'), { recursive: true });
  if (fs.existsSync(MEDIA_DIR)) {
    fs.cpSync(MEDIA_DIR, path.join(OUT, 'images'), { recursive: true, filter: (src) => !src.endsWith('-scroll.png') });
  }
  // brand kit (brand/index.html + logos), served next to the preview
  fs.cpSync(path.join(THEME, 'brand'), path.join(OUT, 'brand'), { recursive: true, filter: (src) => !src.endsWith('.md') });
  fs.copyFileSync(path.join(THEME, 'tools/preview/shim.js'), path.join(OUT, 'preview-shim.js'));
  writeIndex(pages);
  writeNote();
  // `serve` would otherwise redirect *.html → clean URLs and drop query strings (?embed=1).
  fs.writeFileSync(path.join(OUT, 'serve.json'), JSON.stringify({ cleanUrls: false, trailingSlash: false }, null, 2));

  const tr = [...missingTranslations];
  if (tr.length) console.warn(`\nMissing translations (${tr.length}):\n  ` + tr.slice(0, 60).join('\n  '));
  if (renderWarnings.length) console.warn(`\nRender warnings:\n  ` + renderWarnings.join('\n  '));
  console.log(`\nPreview: ${pages.length} pages → ${path.relative(THEME, OUT)}`);
}

function writeIndex(pages) {
  const groups = {};
  for (const p of pages) (groups[p.locale] ||= []).push(p);
  const list = (arr) => arr.map((p) => `<li><a href="${p.file}">${p.title || p.url}</a> <code>${p.url}</code></li>`).join('');
  fs.writeFileSync(
    path.join(OUT, 'preview-index.html'),
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Maison preview — all pages</title>
<style>body{font:15px/1.6 system-ui,sans-serif;background:#F7F3EC;color:#1F1D1A;margin:0;padding:32px 16px}main{max-width:880px;margin:auto}h1{font-weight:500}h2{margin-top:32px;font-weight:500;border-bottom:1px solid #0002;padding-bottom:6px}li{margin:4px 0}a{color:#1F1D1A}code{color:#876740;font-size:12px}</style></head>
<body><main><h1>Maison Invitation — preview pages</h1><p>Rendered from the real Shopify theme files with sample data. Checkout, login and currency conversion run on Shopify once the store is live.</p>
<h2>Brand kit</h2><ul><li><a href="brand/index.html">Logo system, colours &amp; typography</a> <code>/brand</code></li></ul>
<h2>English</h2><ul>${list((groups.en || []).filter((p) => !p.url.includes('/pages/invitation/')))}</ul>
<h2>Live invitation demos</h2><ul>${list((groups.en || []).filter((p) => p.url.includes('/pages/invitation/')))}</ul>
<h2>العربية (Arabic storefront)</h2><ul dir="rtl">${list(groups.ar || [])}</ul></main></body></html>`,
  );
}

function writeNote() {
  fs.writeFileSync(
    path.join(OUT, 'preview-note.html'),
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Handled by Shopify</title>
<style>body{font:16px/1.6 system-ui,sans-serif;background:#F7F3EC;color:#1F1D1A;display:grid;place-items:center;min-height:100vh;margin:0;padding:24px;text-align:center}a{color:#876740}</style></head>
<body><main><h1 style="font-weight:500">This page is generated by Shopify</h1><p>Policies, checkout and similar pages are created automatically once the store is live.</p><p><a href="javascript:history.back()">← Back</a> · <a href="index.html">Home</a></p></main></body></html>`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
