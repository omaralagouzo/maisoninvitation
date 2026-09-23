// Shopify-flavoured Liquid engine for the offline preview.
//
// Renders the *real* theme files (layout/, templates/*.json, sections/, snippets/,
// locales/) with LiquidJS plus the Shopify-specific tags and filters the theme uses,
// against mock store data. It is a design preview, not a Shopify emulator: anything
// that needs a live store (checkout, customer accounts, currency conversion) is
// simulated by tools/preview/shim.js.
import fs from 'node:fs';
import path from 'node:path';
import { Liquid, Tokenizer, Drop, Value, evalToken, toPromise } from 'liquidjs';

export const THEME = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');

const read = (p) => fs.readFileSync(path.join(THEME, p), 'utf8');
const readJSON = (p) => JSON.parse(stripJsonComments(read(p)));
const exists = (p) => fs.existsSync(path.join(THEME, p));

// Shopify JSON files may start with a /* ... */ auto-generated comment.
export function stripJsonComments(src) {
  return src.replace(/^﻿?\s*\/\*[\s\S]*?\*\/\s*/, '');
}

export const missingTranslations = new Set();
export const renderWarnings = [];

// ------------------------------------------------------------------ helpers
function dig(obj, dotted) {
  return dotted.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
}

function kwargs(args) {
  // LiquidJS passes `key: value` filter args as [key, value] tuples.
  const pos = [];
  const kw = {};
  for (const a of args) {
    if (Array.isArray(a) && a.length === 2 && typeof a[0] === 'string') kw[a[0]] = a[1];
    else pos.push(a);
  }
  return { pos, kw };
}

const escapeHtml = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

export function handleize(s) {
  return String(s ?? '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/['"]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '');
}

/** URL "drop" returned by image_url so image_tag can still reach the image. */
class ImageUrl extends Drop {
  constructor(src, image, width) {
    super();
    this.src = src;
    this.image = image;
    this.width = width;
  }
  valueOf() {
    return this.src;
  }
  toString() {
    return this.src;
  }
}

function imageSrc(input) {
  if (!input) return '';
  if (input instanceof ImageUrl) return input.src;
  if (typeof input === 'string') return input;
  if (input.src || input.url) return input.src || input.url;
  if (input.preview_image && input.preview_image !== input) return imageSrc(input.preview_image);
  if (input.featured_image && input.featured_image !== input) return imageSrc(input.featured_image);
  return '';
}

// ------------------------------------------------------------------ engine
export function createEngine({ locale = 'en', store }) {
  const translations = loadLocale(locale);
  const fallback = locale === 'en' ? translations : loadLocale('en');

  const engine = new Liquid({
    root: [path.join(THEME, 'snippets')],
    partials: [path.join(THEME, 'snippets')],
    extname: '.liquid',
    dynamicPartials: true,
    strictFilters: false,
    strictVariables: false,
    preserveTimezones: true,
    jsTruthy: false,
    ownPropertyOnly: false,
    cache: true,
    globals: store.globals,
  });

  registerFilters(engine, { translations, fallback, locale, store });
  registerTags(engine, { store });
  return engine;
}

function loadLocale(locale) {
  const file = locale === 'en' ? 'locales/en.default.json' : `locales/${locale}.json`;
  return exists(file) ? readJSON(file) : {};
}

function translate(key, args, { translations, fallback, locale }) {
  const { kw } = kwargs(args);
  let value = dig(translations, key);
  if (value === undefined) value = dig(fallback, key);
  if (value === undefined) {
    missingTranslations.add(`${locale}: ${key}`);
    return `translation missing: ${locale}.${key}`;
  }
  if (typeof value === 'object') {
    const count = Number(kw.count);
    if (!Number.isNaN(count)) {
      const cat = count === 0 && value.zero ? 'zero' : count === 1 ? 'one' : count === 2 && value.two ? 'two' : 'other';
      value = value[cat] ?? value.other;
    } else {
      missingTranslations.add(`${locale}: ${key} (object without count)`);
      return '';
    }
  }
  return String(value).replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) => (kw[k] !== undefined ? String(kw[k]) : ''));
}

function formatMoney(cents, format, currency) {
  const amount = Number(cents || 0) / 100;
  const two = amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const noDec = amount.toLocaleString('en-US', { maximumFractionDigits: 0 });
  return format
    .replace('{{amount}}', two)
    .replace('{{amount_no_decimals}}', noDec)
    .replace('{{amount_with_comma_separator}}', two.replace('.', ','))
    .replace('{{currency}}', currency);
}

function registerFilters(engine, ctx) {
  const { store } = ctx;
  const f = (name, fn) => engine.registerFilter(name, fn);

  f('t', (key, ...args) => translate(key, args, ctx));
  f('translate', (key, ...args) => translate(key, args, ctx));

  f('asset_url', (name) => `/assets/${name}`);
  f('asset_img_url', (name) => `/assets/${name}`);
  f('shopify_asset_url', (name) => `/assets/${name}`);
  f('file_url', (name) => `/images/${name}`);
  f('file_img_url', (name) => `/images/${name}`);
  f('inline_asset_content', (name) => {
    try {
      return read(`assets/${name}`);
    } catch {
      return '';
    }
  });
  f('stylesheet_tag', (url) => `<link href="${url}" rel="stylesheet" type="text/css" media="all" />`);
  f('script_tag', (url) => `<script src="${url}" type="text/javascript"></script>`);
  f('preload_tag', (url, ...args) => {
    const { kw } = kwargs(args);
    return `<link href="${url}" rel="preload" as="${kw.as || 'style'}"${kw.type ? ` type="${kw.type}"` : ''}${kw.crossorigin ? ' crossorigin' : ''}>`;
  });

  f('image_url', (input, ...args) => {
    const { kw } = kwargs(args);
    const src = imageSrc(input);
    if (!src) return '';
    return new ImageUrl(src, typeof input === 'object' ? (input.preview_image || input) : null, kw.width);
  });
  f('img_url', (input) => imageSrc(input));
  f('image_tag', (input, ...args) => {
    const { kw } = kwargs(args);
    const src = imageSrc(input);
    const image = input instanceof ImageUrl ? input.image : input;
    const w = kw.width ?? image?.width;
    const h = kw.height ?? (image?.width && image?.height && w ? Math.round((w / image.width) * image.height) : image?.height);
    const attrs = [
      `src="${src}"`,
      `alt="${escapeHtml(kw.alt ?? image?.alt ?? '')}"`,
      w ? `width="${w}"` : '',
      h ? `height="${h}"` : '',
      kw.loading ? `loading="${kw.loading}"` : '',
      kw.class ? `class="${kw.class}"` : '',
      kw.sizes ? `sizes="${kw.sizes}"` : '',
      kw.fetchpriority ? `fetchpriority="${kw.fetchpriority}"` : '',
      kw.id ? `id="${kw.id}"` : '',
      kw.style ? `style="${kw.style}"` : '',
      kw.decoding ? `decoding="${kw.decoding}"` : '',
    ].filter(Boolean);
    for (const [k, v] of Object.entries(kw)) {
      if (k.startsWith('data-')) attrs.push(`${k}="${escapeHtml(v)}"`);
    }
    return `<img ${attrs.join(' ')}>`;
  });
  f('placeholder_svg_tag', (name, cls = '') =>
    `<svg class="${cls}" viewBox="0 0 525 525" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><rect width="525" height="525" fill="currentColor" opacity=".08"/><path d="M200 300l50-60 40 45 30-30 60 75H140z" fill="currentColor" opacity=".25"/></svg>`,
  );

  const money = (cents) => formatMoney(cents, store.moneyFormat, store.currency);
  f('money', money);
  f('money_with_currency', (c) => formatMoney(c, store.moneyWithCurrencyFormat, store.currency));
  f('money_without_currency', (c) => formatMoney(c, '{{amount}}', store.currency));
  f('money_without_trailing_zeros', (c) => money(c).replace(/\.00(?!\d)/, ''));

  f('handle', handleize);
  f('handleize', handleize);
  f('link_to', (text, url, title = '') => `<a href="${url}" title="${escapeHtml(title)}">${text}</a>`);
  f('within', (url) => url);
  f('url_escape', (s) => encodeURI(String(s ?? '')));
  f('url_param_escape', (s) => encodeURIComponent(String(s ?? '')));
  f('escape_once', (s) => escapeHtml(String(s ?? '').replace(/&(amp|lt|gt|quot|#39);/g, (m) => ({ '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'" })[m])));
  f('highlight', (s) => s);
  f('default_errors', (errors) => (errors?.messages ? errors.messages.join('<br>') : ''));
  f('format_address', (a) =>
    a ? [a.name, a.company, a.address1, a.address2, [a.city, a.province_code, a.zip].filter(Boolean).join(' '), a.country].filter(Boolean).map(escapeHtml).join('<br>') : '',
  );
  f('payment_type_svg_tag', (type, cls = '') =>
    `<svg class="${cls}" viewBox="0 0 38 24" width="38" height="24" role="img" aria-label="${type}"><rect x=".5" y=".5" width="37" height="23" rx="3" fill="#fff" stroke="rgba(0,0,0,.15)"/><text x="19" y="15" font-size="6.5" text-anchor="middle" font-family="sans-serif" fill="#1F1D1A">${String(type).replace(/_/g, ' ').slice(0, 10)}</text></svg>`,
  );
  f('time_tag', (d, fmt = '%B %-d, %Y') => {
    const out = engine.filters.date ? d : d;
    return `<time datetime="${new Date(d).toISOString()}">${engine.parseAndRenderSync(`{{ d | date: f }}`, { d: out, f: fmt })}</time>`;
  });
  f('structured_data', () => '');
  f('payment_button', () =>
    `<div class="shopify-payment-button"><button type="button" class="shopify-payment-button__button btn btn--block btn--outline" data-preview-buy-now>Buy it now</button><button type="button" class="shopify-payment-button__more-options" style="display:block;margin:10px auto 0;text-decoration:underline">More payment options</button></div>`,
  );
  f('sum', (arr, prop) => (arr || []).reduce((acc, x) => acc + Number(prop ? x?.[prop] : x) || 0, 0));
  f('color_to_rgb', (hex) => {
    const h = String(hex).replace('#', '');
    const n = parseInt(h.length === 3 ? h.replace(/./g, '$&$&') : h, 16);
    return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
  });
  f('color_modify', (hex, prop, value) => {
    const h = String(hex).replace('#', '');
    const n = parseInt(h.length === 3 ? h.replace(/./g, '$&$&') : h, 16);
    if (prop === 'alpha') return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${value})`;
    return hex;
  });
}

// ------------------------------------------------------------------ tags
/** Split tag markup on top-level commas (ignores commas inside quotes). */
function splitArgs(markup) {
  const out = [];
  let cur = '';
  let quote = null;
  for (const ch of markup) {
    if (quote) {
      if (ch === quote) quote = null;
      cur += ch;
    } else if (ch === "'" || ch === '"') {
      quote = ch;
      cur += ch;
    } else if (ch === ',') {
      out.push(cur.trim());
      cur = '';
    } else cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

function rawBlock(name, onContent) {
  return {
    parse(tagToken, remainTokens) {
      this.content = '';
      let tok;
      while ((tok = remainTokens.shift())) {
        if (tok.name === `end${name}`) return;
        this.content += tok.getText();
      }
      throw new Error(`tag ${name} not closed`);
    },
    *render(ctx, emitter) {
      if (onContent) emitter.write(onContent(this.content, ctx));
    },
  };
}

function childBlock(name) {
  return function parse(tagToken, remainTokens) {
    this.tpls = [];
    const stream = this.liquid.parser
      .parseStream(remainTokens)
      .on(`tag:end${name}`, () => stream.stop())
      .on('template', (tpl) => this.tpls.push(tpl))
      .on('end', () => {
        throw new Error(`tag ${tagToken.getText()} not closed`);
      });
    stream.start();
  };
}

const FORM_DEFS = {
  product: { action: '/cart/add', id: (o) => `product-form-${o?.id ?? ''}`, cls: 'shopify-product-form', enctype: true, hidden: (o) => [['product-id', o?.id]] },
  contact: { action: '/contact#contact_form', id: 'contact_form', cls: 'contact-form' },
  customer: { action: '/contact#contact_form', id: 'contact_form', cls: 'contact-form' },
  localization: { action: '/localization', id: 'localization_form', cls: 'shopify-localization-form', enctype: true, hidden: () => [['_method', 'put'], ['return_to', '__RETURN_TO__']] },
  customer_login: { action: '/account/login', id: 'customer_login', cls: '' },
  guest_login: { action: '/account/login', id: 'customer_login_guest', cls: '' },
  create_customer: { action: '/account', id: 'create_customer', cls: '' },
  recover_customer_password: { action: '/account/recover', id: 'recover_customer_password', cls: '' },
  reset_customer_password: { action: '/account/reset', id: 'reset_customer_password', cls: '' },
  activate_customer_password: { action: '/account/activate', id: 'activate_customer_password', cls: '' },
  customer_address: { action: '/account/addresses', id: 'address_form_new', cls: '' },
  storefront_password: { action: '/password', id: 'login_form', cls: 'storefront-password-form' },
  cart: { action: '/cart', id: 'cart_form', cls: 'shopify-cart-form' },
  new_comment: { action: '/blogs/comments', id: 'comment_form', cls: 'comment-form' },
};

function registerTags(engine, { store }) {
  engine.registerTag('schema', rawBlock('schema'));
  engine.registerTag('stylesheet', rawBlock('stylesheet'));
  engine.registerTag('javascript', rawBlock('javascript'));
  engine.registerTag('doc', rawBlock('doc'));
  engine.registerTag('layout', { parse() {}, *render() {} });

  engine.registerTag('style', {
    parse: childBlock('style'),
    *render(ctx, emitter) {
      const html = yield this.liquid.renderer.renderTemplates(this.tpls, ctx);
      emitter.write(`<style data-shopify>${html}</style>`);
    },
  });

  engine.registerTag('form', {
    parse(tagToken, remainTokens) {
      // {% form 'type'[, object][, key: value ...] %}
      const parts = splitArgs(tagToken.args);
      this.typeValue = new Value(parts.shift(), this.liquid);
      this.objValue = null;
      this.attrs = [];
      for (const part of parts) {
        const m = part.match(/^\s*([\w-]+)\s*:\s*([\s\S]+)$/);
        if (m) this.attrs.push([m[1], new Value(m[2], this.liquid)]);
        else this.objValue = new Value(part, this.liquid);
      }
      childBlock('form').call(this, tagToken, remainTokens);
    },
    *render(ctx, emitter) {
      const type = yield this.typeValue.value(ctx);
      const obj = this.objValue ? yield this.objValue.value(ctx) : null;
      const attrs = {};
      for (const [k, v] of this.attrs) attrs[k] = yield v.value(ctx);
      const def = FORM_DEFS[type] || { action: `/${type}`, id: type, cls: '' };
      const id = attrs.id || (typeof def.id === 'function' ? def.id(obj) : def.id);
      const cls = [def.cls, attrs.class].filter(Boolean).join(' ');
      const extra = Object.entries(attrs)
        .filter(([k]) => !['id', 'class', 'return_to'].includes(k))
        .map(([k, v]) => `${k}="${escapeHtml(v)}"`)
        .join(' ');
      const hidden = [['form_type', type], ['utf8', '✓'], ...(def.hidden ? def.hidden(obj) : [])];
      if (attrs.return_to) hidden.push(['return_to', attrs.return_to]);
      const returnTo = ctx.getAll().request?.path || '/';
      let html = `<form method="post" action="${def.action}" id="${id}" accept-charset="UTF-8" class="${cls}"${def.enctype ? ' enctype="multipart/form-data"' : ''}${extra ? ' ' + extra : ''}>`;
      html += hidden.map(([n, v]) => `<input type="hidden" name="${n}" value="${escapeHtml(v === '__RETURN_TO__' ? returnTo : v)}" />`).join('');
      ctx.push({
        form: {
          id,
          'posted_successfully?': false,
          posted_successfully: false,
          errors: null,
          email: '',
          first_name: '',
          last_name: '',
          body: '',
          password_needed: true,
        },
      });
      html += yield this.liquid.renderer.renderTemplates(this.tpls, ctx);
      ctx.pop();
      emitter.write(html + '</form>');
    },
  });

  engine.registerTag('paginate', {
    parse(tagToken, remainTokens) {
      const m = tagToken.args.match(/^\s*(.+?)\s+by\s+(\S+)/);
      if (!m) throw new Error(`bad paginate: ${tagToken.args}`);
      this.expr = m[1];
      this.by = m[2];
      childBlock('paginate').call(this, tagToken, remainTokens);
    },
    *render(ctx, emitter) {
      const items = yield new Value(this.expr, this.liquid).value(ctx);
      const size = Number(yield new Value(this.by, this.liquid).value(ctx)) || 12;
      const total = Array.isArray(items) ? items.length : 0;
      ctx.push({
        paginate: {
          current_page: 1,
          current_offset: 0,
          items: total,
          page_size: size,
          pages: Math.max(1, Math.ceil(total / size)),
          parts: [],
          previous: null,
          next: null,
        },
      });
      emitter.write(yield this.liquid.renderer.renderTemplates(this.tpls, ctx));
      ctx.pop();
    },
  });

  engine.registerTag('section', {
    parse(tagToken) {
      this.nameToken = new Tokenizer(tagToken.args, this.liquid.options.operators).readValue();
    },
    *render(ctx, emitter) {
      const name = yield evalToken(this.nameToken, ctx);
      emitter.write(yield renderSection(this.liquid, ctx.getAll(), { key: name, type: name, settings: {} }, { idPrefix: '', groupClass: '' }));
    },
  });

  engine.registerTag('sections', {
    parse(tagToken) {
      this.nameToken = new Tokenizer(tagToken.args, this.liquid.options.operators).readValue();
    },
    *render(ctx, emitter) {
      const name = yield evalToken(this.nameToken, ctx);
      const group = readJSON(`sections/${name}.json`);
      let html = '';
      for (const key of group.order) {
        const data = group.sections[key];
        if (data.disabled) continue;
        html += yield renderSection(this.liquid, ctx.getAll(), { key, ...data }, { idPrefix: `sections--preview__`, groupClass: `shopify-section-group-${name}` });
      }
      emitter.write(html);
    },
  });
}

// ------------------------------------------------------------------ sections
const schemaCache = new Map();
export function sectionSchema(type) {
  if (!schemaCache.has(type)) {
    const src = read(`sections/${type}.liquid`);
    const m = src.match(/\{%-?\s*schema\s*-?%\}([\s\S]*?)\{%-?\s*endschema\s*-?%\}/);
    schemaCache.set(type, m ? JSON.parse(m[1]) : {});
  }
  return schemaCache.get(type);
}

export function resolveSetting(def, value, store) {
  if (value === undefined || value === null) {
    value = def.default;
  }
  if (value === undefined || value === null || value === '') {
    if (def.type === 'checkbox') return false;
    if (['collection', 'product', 'image_picker', 'url', 'link_list', 'page', 'video_url', 'metaobject', 'blog', 'article'].includes(def.type)) return null;
    if (['product_list', 'collection_list'].includes(def.type)) return [];
    return value ?? null;
  }
  switch (def.type) {
    case 'collection':
      return store.collections[value] || null;
    case 'product':
      return store.products[value] || null;
    case 'product_list':
      return value.map((h) => store.products[h]).filter(Boolean);
    case 'collection_list':
      return value.map((h) => store.collections[h]).filter(Boolean);
    case 'link_list':
      return store.linklists[value] || null;
    case 'page':
      return store.pages[value] || null;
    case 'image_picker':
      return store.image(String(value).replace('shopify://shop_images/', ''));
    case 'url':
      return store.url(String(value));
    default:
      return value;
  }
}

function resolveSettings(defs = [], values = {}, store) {
  const out = {};
  for (const def of defs) {
    if (!def.id) continue;
    out[def.id] = resolveSetting(def, values[def.id], store);
  }
  return out;
}

let blockCounter = 0;
async function renderSection(liquid, vars, data, { idPrefix, groupClass }) {
  const s = liquid.options.globals.__store;
  const schema = sectionSchema(data.type);
  const blocksDefs = Object.fromEntries((schema.blocks || []).map((b) => [b.type, b]));
  const order = data.block_order || Object.keys(data.blocks || {});
  const blocks = order
    .map((bid) => {
      const b = data.blocks[bid];
      if (!b || b.disabled) return null;
      const def = blocksDefs[b.type] || { settings: [] };
      return { id: bid || `b${blockCounter++}`, type: b.type, settings: resolveSettings(def.settings, b.settings, s), shopify_attributes: '' };
    })
    .filter(Boolean);
  const id = `${idPrefix}${data.key}`;
  const section = {
    id,
    settings: resolveSettings(schema.settings, data.settings || {}, s),
    blocks,
    index: 1,
    location: groupClass ? groupClass.replace('shopify-section-group-', '') : 'template',
  };
  const tpl = liquid.parse(read(`sections/${data.type}.liquid`), path.join(THEME, `sections/${data.type}.liquid`));
  let html;
  try {
    html = await liquid.render(tpl, { ...vars, section });
  } catch (e) {
    renderWarnings.push(`section ${data.type}: ${e.message}`);
    console.error(e);
    html = `<!-- section ${data.type} failed: ${escapeHtml(e.message)} -->`;
  }
  const tag = schema.tag || 'div';
  const cls = ['shopify-section', groupClass, schema.class].filter(Boolean).join(' ');
  return `<${tag} id="shopify-section-${id}" class="${cls}">${html}</${tag}>`;
}

// ------------------------------------------------------------------ pages
export async function renderTemplate(engine, { template, vars }) {
  const store = engine.options.globals.__store;
  let layout = 'theme';
  let content = '';
  if (exists(`templates/${template}.json`)) {
    const tpl = readJSON(`templates/${template}.json`);
    if (tpl.layout === false) layout = null;
    else if (tpl.layout) layout = tpl.layout;
    for (const key of tpl.order) {
      const data = tpl.sections[key];
      if (data.disabled) continue;
      content += await renderSection(engine, { ...engine.options.globals, ...vars }, { key, ...data }, { idPrefix: 'template--preview__', groupClass: '' });
    }
    if (tpl.wrapper) {
      const m = tpl.wrapper.match(/^(\w+)(.*)$/);
      content = `<${m[1]}${m[2] ? ' ' + m[2].replace(/^[#.]/, '') : ''}>${content}</${m[1]}>`;
    }
  } else if (exists(`templates/${template}.liquid`)) {
    const src = read(`templates/${template}.liquid`);
    const lm = src.match(/\{%-?\s*layout\s+(none|'[^']+'|"[^"]+")\s*-?%\}/);
    if (lm) layout = lm[1] === 'none' ? null : lm[1].slice(1, -1);
    content = await engine.parseAndRender(src, vars);
  } else {
    throw new Error(`template not found: ${template}`);
  }
  if (!layout) return content;
  return engine.parseAndRender(read(`layout/${layout}.liquid`), { ...vars, content_for_layout: content });
}

export { escapeHtml, formatMoney, readJSON, read, exists, toPromise, evalToken };
