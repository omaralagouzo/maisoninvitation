// Mock Shopify store objects for the offline preview, built from tools/data/catalog.mjs.
// Shapes follow Shopify's Liquid objects closely enough for the theme to render
// exactly as it will on a real store.
import fs from 'node:fs';
import path from 'node:path';
import { ADDONS, DEMO_INVITATIONS, DESIGNS, PAGES, VARIANTS, CURRENCY, productImages } from '../data/catalog.mjs';
import { THEME, readJSON, stripJsonComments } from './engine.mjs';

export const MEDIA_DIR = path.join(THEME, 'tools/shopify-setup/media');
const SHOP_DOMAIN = 'maisoninvitation.com';

const AR = {
  types: { Classic: 'كلاسيكي', Evening: 'مسائي', Botanical: 'نباتي', Modern: 'عصري', 'Add-on': 'إضافة' },
  optionName: 'اللغة',
};

const COUNTRIES = [
  ['US', 'United States', 'الولايات المتحدة', 'USD', '$'],
  ['AE', 'United Arab Emirates', 'الإمارات العربية المتحدة', 'AED', 'د.إ'],
  ['SA', 'Saudi Arabia', 'المملكة العربية السعودية', 'SAR', 'ر.س'],
  ['KW', 'Kuwait', 'الكويت', 'KWD', 'د.ك'],
  ['QA', 'Qatar', 'قطر', 'QAR', 'ر.ق'],
  ['BH', 'Bahrain', 'البحرين', 'BHD', 'د.ب'],
  ['OM', 'Oman', 'عُمان', 'OMR', 'ر.ع'],
  ['JO', 'Jordan', 'الأردن', 'JOD', 'د.أ'],
  ['EG', 'Egypt', 'مصر', 'EGP', 'ج.م'],
  ['GB', 'United Kingdom', 'المملكة المتحدة', 'GBP', '£'],
  ['FR', 'France', 'فرنسا', 'EUR', '€'],
  ['CA', 'Canada', 'كندا', 'CAD', '$'],
];

let idSeq = 7000000000;
const nextId = () => ++idSeq;

// ------------------------------------------------------------------ images
const imageCache = new Map();
function jpegSize(buf) {
  let i = 2;
  while (i < buf.length) {
    if (buf[i] !== 0xff) return null;
    const marker = buf[i + 1];
    const len = buf.readUInt16BE(i + 2);
    if (marker >= 0xc0 && marker <= 0xc3) return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
    i += 2 + len;
  }
  return null;
}
function pngSize(buf) {
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

export function mockImage(file, alt = '') {
  const key = `${file}|${alt}`;
  if (imageCache.has(key)) return imageCache.get(key);
  const full = path.join(MEDIA_DIR, file);
  if (!fs.existsSync(full)) return null;
  const buf = fs.readFileSync(full);
  const size = file.endsWith('.png') ? pngSize(buf) : jpegSize(buf) || { width: 1200, height: 1500 };
  const img = {
    id: nextId(),
    src: `/images/${file}`,
    url: `/images/${file}`,
    alt,
    width: size.width,
    height: size.height,
    aspect_ratio: +(size.width / size.height).toFixed(4),
    media_type: 'image',
  };
  img.preview_image = img;
  imageCache.set(key, img);
  return img;
}

// ------------------------------------------------------------------ products
function cents(price) {
  return Math.round(parseFloat(price) * 100);
}

function makeProduct({ handle, title, type, style, description, images, variants, metafields, prefix, optionName, tags = [] }) {
  const id = nextId();
  const url = `${prefix}/products/${handle}`;
  const vs = variants.map((v, i) => {
    const vid = nextId();
    return {
      id: vid,
      title: v.title,
      option1: v.title,
      options: [v.title],
      sku: v.sku,
      price: cents(v.price),
      compare_at_price: null,
      available: true,
      requires_shipping: false,
      taxable: true,
      featured_image: v.image || null,
      featured_media: v.image ? { ...v.image, preview_image: v.image } : null,
      image: v.image || null,
      url: `${url}?variant=${vid}`,
      position: i + 1,
      inventory_management: null,
      inventory_policy: 'continue',
      selected: false,
      product_id: id,
      metafields: {},
      name: `${title} - ${v.title}`,
    };
  });
  const prices = vs.map((v) => v.price);
  const imgs = images.filter(Boolean);
  const product = {
    id,
    handle,
    title,
    url,
    type,
    vendor: 'Maison Invitation',
    tags,
    description,
    content: description,
    featured_image: imgs[0] || null,
    featured_media: imgs[0] || null,
    images: imgs,
    media: imgs.map((img, i) => ({ ...img, position: i + 1, preview_image: img })),
    price: Math.min(...prices),
    price_min: Math.min(...prices),
    price_max: Math.max(...prices),
    price_varies: new Set(prices).size > 1,
    compare_at_price: null,
    compare_at_price_min: 0,
    available: true,
    options: [optionName],
    options_with_values: [{ name: optionName, position: 1, values: vs.map((v) => v.title), selected_value: vs[0].title }],
    variants: vs,
    has_only_default_variant: vs.length === 1 && vs[0].title === 'Default Title',
    selected_variant: null,
    selected_or_first_available_variant: vs[0],
    first_available_variant: vs[0],
    requires_selling_plan: false,
    selling_plan_groups: [],
    template_suffix: null,
    gift_card: false,
    published_at: '2026-09-01T10:00:00+04:00',
    created_at: '2026-09-01T10:00:00+04:00',
    metafields,
  };
  return product;
}

function mf(value) {
  return value === undefined || value === null || value === '' ? null : { value, type: 'single_line_text_field' };
}

function buildProducts({ locale, prefix }) {
  const ar = locale === 'ar';
  const products = {};
  for (const d of DESIGNS) {
    const files = productImages(d.handle);
    const imgEn = mockImage(files.en, `${d.title} invitation — English`);
    const imgAr = mockImage(files.ar, `${d.title} invitation — Arabic`);
    const imgBoth = mockImage(files.both, `${d.title} invitation — English & Arabic`);
    const envEn = mockImage(files.envelope, `${d.title} envelope — English`);
    const envAr = mockImage(files.envelope_ar, `${d.title} envelope — Arabic`);
    const detEn = mockImage(files.details, `${d.title} details — English`);
    const detAr = mockImage(files.details_ar, `${d.title} details — Arabic`);
    const variantImages = { en: imgEn, ar: imgAr, both: imgBoth };
    products[d.handle] = makeProduct({
      handle: d.handle,
      title: d.title,
      type: d.type,
      description: ar ? d.description_ar : d.description,
      images: [imgEn, imgAr, imgBoth, envEn, envAr, detEn, detAr],
      prefix,
      optionName: ar ? AR.optionName : 'Language',
      tags: ['invitation', 'wedding', `style:${d.type.toLowerCase()}`],
      variants: VARIANTS.map((v) => ({
        title: ar ? v.ar : v.value,
        price: v.price,
        sku: `${d.handle.toUpperCase()}-${v.code === 'both' ? 'BI' : v.code.toUpperCase()}`,
        image: variantImages[v.code],
      })),
      metafields: {
        maison: {
          subtitle: mf(ar ? d.subtitle_ar : d.subtitle),
          name_ar: mf(d.name_ar),
          style: mf(ar ? AR.types[d.type] : d.type),
          palette: mf(d.palette.join(',')),
          demo_url_en: mf(`${prefix}/pages/invitation/${d.handle}-en`),
          demo_url_ar: mf(`${prefix}/pages/invitation/${d.handle}-ar`),
        },
      },
    });
  }
  for (const a of ADDONS) {
    products[a.handle] = makeProduct({
      handle: a.handle,
      title: ar ? a.title_ar : a.title,
      type: 'Add-on',
      description: ar ? a.description_ar : a.description,
      images: [],
      prefix,
      optionName: 'Title',
      tags: ['addon'],
      variants: [{ title: 'Default Title', price: a.price, sku: a.handle.toUpperCase() }],
      metafields: { maison: {} },
    });
  }
  return products;
}

function makeCollection({ handle, title, description, products, prefix }) {
  return {
    id: nextId(),
    handle,
    title,
    description,
    url: `${prefix}/collections/${handle}`,
    products,
    all_products_count: products.length,
    products_count: products.length,
    image: null,
    featured_image: products[0]?.featured_image || null,
    filters: [],
    sort_by: 'manual',
    default_sort_by: 'manual',
    sort_options: [
      { value: 'manual', name: 'Featured' },
      { value: 'price-ascending', name: 'Price, low to high' },
      { value: 'price-descending', name: 'Price, high to low' },
      { value: 'created-descending', name: 'Date, new to old' },
    ],
    template_suffix: null,
    all_types: [...new Set(products.map((p) => p.type))],
    metafields: {},
  };
}

// ------------------------------------------------------------------ invitations
function buildInvitations({ prefix }) {
  const out = {};
  for (const inv of DEMO_INVITATIONS) {
    const fields = {};
    for (const [k, v] of Object.entries(inv)) {
      if (['handle', 'alternate'].includes(k)) continue;
      fields[k] = { value: v, type: typeof v === 'boolean' ? 'boolean' : 'single_line_text_field' };
    }
    out[inv.handle] = {
      ...fields,
      system: { id: nextId(), handle: inv.handle, type: 'invitation', url: `${prefix}/pages/invitation/${inv.handle}` },
      __alternate: inv.alternate,
    };
  }
  for (const inv of Object.values(out)) {
    const alt = out[inv.__alternate];
    inv.alternate_invitation = alt ? { value: alt } : null;
    inv.cover_photo = null;
    inv.music_url = null;
  }
  return out;
}

// ------------------------------------------------------------------ settings
export function themeSettings(store) {
  const schema = JSON.parse(fs.readFileSync(path.join(THEME, 'config/settings_schema.json'), 'utf8'));
  const data = JSON.parse(stripJsonComments(fs.readFileSync(path.join(THEME, 'config/settings_data.json'), 'utf8')));
  const current = typeof data.current === 'string' ? data.presets[data.current] : data.current;
  const out = {};
  for (const group of schema) {
    for (const def of group.settings || []) {
      if (!def.id) continue;
      let v = current?.[def.id];
      if (v === undefined) v = def.default;
      if (def.type === 'image_picker') v = v ? store.image(v) : null;
      if (def.type === 'checkbox') v = !!v;
      out[def.id] = v ?? null;
    }
  }
  return out;
}

// ------------------------------------------------------------------ store
export function buildStore({ locale = 'en' }) {
  const ar = locale === 'ar';
  const prefix = ar ? '/ar' : '';
  const products = buildProducts({ locale, prefix });
  const designs = DESIGNS.map((d) => products[d.handle]);
  const addons = ADDONS.map((a) => products[a.handle]);
  const collections = {
    invitations: makeCollection({
      handle: 'invitations',
      title: ar ? 'دعوات الزفاف' : 'Wedding invitations',
      description: ar
        ? '<p>دعوات رقمية مصمّمة يدويًا بالعربية والإنجليزية. اختر التصميم واللغة، ونحن نهتم بالباقي.</p>'
        : '<p>Handcrafted digital invitations in English and Arabic. Choose a design and a language — we take care of the rest.</p>',
      products: designs,
      prefix,
    }),
    'add-ons': makeCollection({ handle: 'add-ons', title: ar ? 'إضافات' : 'Add-ons', description: '', products: addons, prefix }),
  };
  collections.all = makeCollection({ handle: 'all', title: ar ? 'جميع المنتجات' : 'All products', description: '', products: [...designs, ...addons], prefix });

  const pages = {};
  for (const p of PAGES) {
    pages[p.handle] = { id: nextId(), handle: p.handle, title: ar ? p.title_ar : p.title, url: `${prefix}/pages/${p.handle}`, content: '', template_suffix: p.templateSuffix };
  }

  const countries = COUNTRIES.map(([iso, en, arName, cur, sym]) => ({
    iso_code: iso,
    name: ar ? arName : en,
    currency: { iso_code: cur, symbol: sym, name: cur },
    available_languages: [],
  }));
  const languages = [
    { iso_code: 'en', endonym_name: 'English', name: 'English', primary: true, root_url: '/' },
    { iso_code: 'ar', endonym_name: 'العربية', name: 'Arabic', primary: false, root_url: '/ar' },
  ];
  const language = languages.find((l) => l.iso_code === locale);

  const store = {
    locale,
    prefix,
    currency: CURRENCY,
    moneyFormat: '${{amount}}',
    moneyWithCurrencyFormat: '${{amount}} USD',
    products,
    collections,
    pages,
    invitations: buildInvitations({ prefix }),
    linklists: {},
    image: (file) => mockImage(String(file).replace(/^.*\//, '')),
    url: (value) =>
      value
        .replace('shopify://collections/', `${prefix}/collections/`)
        .replace('shopify://products/', `${prefix}/products/`)
        .replace('shopify://pages/', `${prefix}/pages/`)
        .replace('shopify://', `${prefix}/`),
  };

  const routes = {
    root_url: ar ? '/ar' : '/',
    account_url: `${prefix}/account`,
    account_login_url: `${prefix}/account/login`,
    account_logout_url: `${prefix}/account/logout`,
    account_register_url: `${prefix}/account/register`,
    account_addresses_url: `${prefix}/account/addresses`,
    account_recover_url: `${prefix}/account/recover`,
    collections_url: `${prefix}/collections`,
    all_products_collection_url: `${prefix}/collections/all`,
    search_url: `${prefix}/search`,
    predictive_search_url: `${prefix}/search/suggest`,
    cart_url: `${prefix}/cart`,
    cart_add_url: `${prefix}/cart/add`,
    cart_change_url: `${prefix}/cart/change`,
    cart_clear_url: `${prefix}/cart/clear`,
    cart_update_url: `${prefix}/cart/update`,
    product_recommendations_url: `${prefix}/recommendations/products`,
  };

  const emptyCart = {
    item_count: 0,
    items: [],
    total_price: 0,
    items_subtotal_price: 0,
    original_total_price: 0,
    total_discount: 0,
    note: '',
    attributes: {},
    currency: { iso_code: CURRENCY },
    requires_shipping: false,
    cart_level_discount_applications: [],
    discount_applications: [],
    empty: true,
  };

  store.globals = {
    __store: store,
    shop: {
      name: 'Maison Invitation',
      email: 'hello@maisoninvitation.com',
      description: ar ? 'دعوات زفاف رقمية بالعربية والإنجليزية.' : 'Digital wedding invitations in English and Arabic.',
      domain: SHOP_DOMAIN,
      url: `https://${SHOP_DOMAIN}`,
      secure_url: `https://${SHOP_DOMAIN}`,
      permanent_domain: 'maison-invitation.myshopify.com',
      currency: CURRENCY,
      money_format: store.moneyFormat,
      money_with_currency_format: store.moneyWithCurrencyFormat,
      enabled_payment_types: ['visa', 'master', 'american_express', 'apple_pay', 'google_pay', 'shopify_pay'],
      customer_accounts_enabled: true,
      customer_accounts_optional: true,
      policies: [
        { title: ar ? 'سياسة الاسترداد' : 'Refund policy', url: `${prefix}/policies/refund-policy` },
        { title: ar ? 'سياسة الخصوصية' : 'Privacy policy', url: `${prefix}/policies/privacy-policy` },
        { title: ar ? 'شروط الخدمة' : 'Terms of service', url: `${prefix}/policies/terms-of-service` },
      ],
      locale,
      brand: {},
      metafields: {},
    },
    routes,
    localization: {
      available_languages: languages,
      language,
      available_countries: countries,
      country: countries[0],
    },
    cart: emptyCart,
    customer: null,
    collections,
    all_products: products,
    pages,
    linklists: {},
    blogs: {},
    articles: {},
    images: {},
    metaobjects: { invitation: store.invitations },
    current_page: 1,
    current_tags: null,
    content_for_header: '',
    powered_by_link: '<a href="https://www.shopify.com" target="_blank" rel="nofollow">Powered by Shopify</a>',
    canonical_url: `https://${SHOP_DOMAIN}${prefix}/`,
    page_description: null,
    page_image: null,
    template: { name: 'index', suffix: null, directory: null },
    request: {
      locale: { iso_code: locale, endonym_name: language.endonym_name, primary: !ar },
      page_type: 'index',
      path: prefix || '/',
      host: SHOP_DOMAIN,
      origin: `https://${SHOP_DOMAIN}`,
      design_mode: false,
      visual_preview_mode: false,
    },
  };
  store.globals.settings = themeSettings(store);
  store.emptyCart = emptyCart;
  return store;
}

/** A cart with one Arabic Ivoire invitation (with details) + express delivery. */
export function sampleCart(store) {
  const ar = store.locale === 'ar';
  const product = store.products.ivoire;
  const variant = product.variants[1];
  const addon = store.products['express-delivery'];
  const props = ar
    ? { 'الاسمان': 'آدم و ليلى', 'تاريخ الزفاف': '2027-04-15', 'المكان': 'فندق قصر الواحة، دبي', 'تأكيد الحضور': 'نموذج إلكتروني' }
    : { Names: 'Adam & Leila', 'Wedding date': '2027-04-15', Venue: 'Al Waha Palace, Dubai', 'RSVP method': 'Online form' };
  const items = [
    {
      id: variant.id,
      key: `${variant.id}:a1`,
      product,
      variant,
      title: `${product.title} - ${variant.title}`,
      product_title: product.title,
      variant_title: variant.title,
      url: variant.url,
      image: variant.featured_image,
      featured_image: variant.featured_image,
      quantity: 1,
      price: variant.price,
      final_price: variant.price,
      line_price: variant.price,
      final_line_price: variant.price,
      original_line_price: variant.price,
      properties: props,
      options_with_values: [{ name: product.options[0], value: variant.title }],
      requires_shipping: false,
      line_level_discount_allocations: [],
      unit_price_measurement: null,
      selling_plan_allocation: null,
      sku: variant.sku,
    },
    {
      id: addon.variants[0].id,
      key: `${addon.variants[0].id}:b2`,
      product: addon,
      variant: addon.variants[0],
      title: addon.title,
      product_title: addon.title,
      variant_title: null,
      url: addon.url,
      image: null,
      featured_image: null,
      quantity: 1,
      price: addon.price,
      final_price: addon.price,
      line_price: addon.price,
      final_line_price: addon.price,
      original_line_price: addon.price,
      properties: {},
      options_with_values: [],
      requires_shipping: false,
      line_level_discount_allocations: [],
      unit_price_measurement: null,
      selling_plan_allocation: null,
      sku: addon.variants[0].sku,
    },
  ];
  const total = items.reduce((a, i) => a + i.final_line_price, 0);
  return { ...store.emptyCart, item_count: 2, items, total_price: total, items_subtotal_price: total, original_total_price: total, empty: false };
}

export function sampleCustomer(store) {
  const ar = store.locale === 'ar';
  const order = {
    id: 1001,
    name: '#1001',
    order_number: 1001,
    created_at: '2026-09-18T14:20:00+04:00',
    customer_url: `${store.prefix}/account/orders/1001`,
    financial_status: 'paid',
    financial_status_label: ar ? 'مدفوع' : 'Paid',
    fulfillment_status: 'unfulfilled',
    fulfillment_status_label: ar ? 'قيد التصميم' : 'In the studio',
    total_price: 13000,
    subtotal_price: 13000,
    total_tax: 0,
    line_items: sampleCart(store).items.map((i) => ({ ...i, fulfillment: null })),
    billing_address: { name: ar ? 'ليلى المنصور' : 'Leila Mansour', address1: 'Al Waha Street', city: 'Dubai', country: ar ? 'الإمارات' : 'United Arab Emirates' },
    tax_lines: [],
    discount_applications: [],
  };
  return {
    id: 1,
    first_name: ar ? 'ليلى' : 'Leila',
    last_name: ar ? 'المنصور' : 'Mansour',
    name: ar ? 'ليلى المنصور' : 'Leila Mansour',
    email: 'leila@example.com',
    orders: [order],
    orders_count: 1,
    addresses: [order.billing_address],
    addresses_count: 1,
    default_address: order.billing_address,
    __order: order,
  };
}
