// Seeds a brand-new Shopify store with the Maison Invitation starter catalogue.
//
//   definitions   product metafield definitions maison.* + the "invitation" metaobject definition
//                 (web pages at /pages/invitation/<handle>)
//   products      4 invitation designs (Language variants EN / AR / BI, 7 images each, maison.*
//                 metafields) + 2 add-ons, published to the Online Store
//   collections   smart collections "invitations" (tag invitation) and "add-ons" (tag addon)
//   invitations   8 demo invitations (metaobject entries), English ⇄ Arabic versions linked
//   pages         How it works, FAQ, About, Contact (content comes from the theme's page templates)
//
// All data comes from tools/data/catalog.mjs; product images from tools/shopify-setup/media
// (npm run images). The theme itself is uploaded separately (GitHub integration or
// `shopify theme push`).
//
// Usage:
//   npm run setup:store -- --dry-run            print the plan and every mutation (no network, no credentials)
//   npm run setup:store                         run every step
//   npm run setup:store -- --only=products,pages
//   npm run setup:store -- --skip-images        don't upload product images
//
// Credentials go in .env at the repo root (see .env.example and tools/shopify-setup/README.md).
// Safe to re-run: everything is looked up by handle first, then updated or left alone.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ADDONS, CURRENCY, DEMO_INVITATIONS, DESIGNS, INVITATION_DEFINITION, LANGUAGE_OPTION, PAGES, VARIANTS, productImages } from '../data/catalog.mjs';
import { createAdminClient } from './lib/client.mjs';
import { loadEnvFile, readConfig } from './lib/env.mjs';
import { c, createLogger } from './lib/log.mjs';
import { describeFile, stageImages, stagedUploadVariables } from './lib/uploads.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const MEDIA = path.join(HERE, 'media');
const VENDOR = 'Maison Invitation';
const NS = 'maison';
const STEPS = ['definitions', 'products', 'collections', 'invitations', 'pages'];

// ------------------------------------------------------------------ arguments
const USAGE = `Usage: node tools/shopify-setup/setup.mjs [--dry-run] [--only=${STEPS.join(',')}] [--skip-images]

  --dry-run       print the plan and every GraphQL mutation; no network calls, no credentials needed
  --only=a,b      run only these steps (${STEPS.join(', ')})
  --skip-images   don't upload product images (existing product images are kept)

Credentials: .env at the repo root or environment variables — see tools/shopify-setup/README.md.`;

const flags = { dryRun: false, skipImages: false, only: null };
{
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--dry-run') flags.dryRun = true;
    else if (arg === '--skip-images') flags.skipImages = true;
    else if (arg === '--only' || arg.startsWith('--only=')) {
      const value = arg === '--only' ? argv[++i] || '' : arg.slice('--only='.length);
      flags.only = value.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
      const unknown = flags.only.filter((s) => !STEPS.includes(s));
      if (unknown.length || !flags.only.length) {
        console.error(`Unknown step(s) in --only: ${unknown.join(', ') || '(empty)'}. Steps: ${STEPS.join(', ')}`);
        process.exit(2);
      }
    } else if (arg === '-h' || arg === '--help') {
      console.log(USAGE);
      process.exit(0);
    } else {
      console.error(`Unknown option: ${arg}\n\n${USAGE}`);
      process.exit(2);
    }
  }
}
const DRY = flags.dryRun;
const SELECTED = STEPS.filter((s) => !flags.only || flags.only.includes(s));

// ------------------------------------------------------------------ config
const envFile = path.join(ROOT, '.env');
const envLoaded = loadEnvFile(envFile);
const config = readConfig();
const log = createLogger({ dryRun: DRY });
const api = DRY ? null : createAdminClient({ ...config, onWait: (msg) => log.info(msg) });
const COLLECTION_SOURCES = config.apiVersion === 'unstable' || config.apiVersion >= '2026-07';

// ------------------------------------------------------------------ catalogue → Shopify shapes
const sku = (handle, code) => `${handle.toUpperCase()}-${code === 'both' ? 'BI' : code.toUpperCase()}`;
const demoPath = (handle, lang) => `/pages/${INVITATION_DEFINITION.urlHandle}/${handle}-${lang}`;

/** Product images in the order the theme expects; alts are load-bearing (see snippets/product-card.liquid). */
function designImages(d) {
  const f = productImages(d.handle);
  return [
    { key: 'en', file: f.en, alt: `${d.title} invitation — English` },
    { key: 'ar', file: f.ar, alt: `${d.title} invitation — Arabic` },
    { key: 'both', file: f.both, alt: `${d.title} invitation — English & Arabic` },
    { key: 'envelope', file: f.envelope, alt: `${d.title} envelope — English` },
    { key: 'envelope_ar', file: f.envelope_ar, alt: `${d.title} envelope — Arabic` },
    { key: 'details', file: f.details, alt: `${d.title} details — English` },
    { key: 'details_ar', file: f.details_ar, alt: `${d.title} details — Arabic` },
  ];
}

/** Product metafield definitions read by the theme (product.metafields.maison.*). */
const PRODUCT_METAFIELDS = [
  { key: 'subtitle', name: 'Subtitle', description: 'Short line under the design name on cards and the product page.' },
  { key: 'name_ar', name: 'Arabic name', description: 'The design name in Arabic, shown on Arabic product cards.' },
  { key: 'style', name: 'Style', description: 'Style label for cards and the collection filter, e.g. Classic.' },
  {
    key: 'palette',
    name: 'Palette',
    description: 'Comma-separated hex colours for the swatches, e.g. #F7F3EC,#1F1D1A,#A9824F.',
    validations: [{ name: 'regex', value: '^#[0-9A-Fa-f]{6}(,#[0-9A-Fa-f]{6})*$' }],
  },
  { key: 'demo_url_en', name: 'Live demo (English)', description: 'Path of the English demo invitation, e.g. /pages/invitation/ivoire-en.' },
  { key: 'demo_url_ar', name: 'Live demo (Arabic)', description: 'Path of the Arabic demo invitation, e.g. /pages/invitation/ivoire-ar.' },
];

const COLLECTIONS = [
  {
    handle: 'invitations',
    title: 'Wedding invitations',
    tag: 'invitation',
    descriptionHtml: '<p>Handcrafted digital invitations in English and Arabic. Choose a design and a language — we take care of the rest.</p>',
  },
  { handle: 'add-ons', title: 'Add-ons', tag: 'addon' },
];

// A metaobject_reference field without an explicit target points at this same definition, so it
// can only be added once the definition exists (the validation needs the definition's ID).
const isSelfReference = (f) => /metaobject_reference$/.test(f.type) && !(f.validations || []).some((v) => v.name.startsWith('metaobject_definition'));

const DEFINITION_CAPABILITIES = {
  publishable: { enabled: true },
  renderable: { enabled: true, data: { metaTitleKey: INVITATION_DEFINITION.displayNameKey } },
  onlineStore: { enabled: true, data: { urlHandle: INVITATION_DEFINITION.urlHandle } },
};

function fieldDefinitionInput(f, definitionId) {
  const validations = [...(f.validations || [])];
  if (f.choices) validations.push({ name: 'choices', value: JSON.stringify(f.choices) });
  if (isSelfReference(f)) validations.push({ name: 'metaobject_definition_id', value: definitionId });
  return {
    key: f.key,
    name: f.name,
    type: f.type,
    ...(f.required ? { required: true } : {}),
    ...(f.description ? { description: f.description } : {}),
    ...(validations.length ? { validations } : {}),
  };
}

/** Metaobject field values are always strings: booleans "true"/"false", integers "2", dates "YYYY-MM-DD". */
const fieldValue = (v) => (typeof v === 'boolean' ? (v ? 'true' : 'false') : String(v));

// ------------------------------------------------------------------ GraphQL documents
const gql = String.raw;

const Q_SHOP = gql`
  query Shop {
    shop { name myshopifyDomain currencyCode }
  }`;
const Q_SCOPES = gql`
  query Scopes {
    currentAppInstallation { accessScopes { handle } }
  }`;
const Q_PUBLICATIONS = gql`
  query Publications {
    publications(first: 50) { nodes { id name } }
  }`;
const Q_PUBLICATIONS_BY_CATALOG = gql`
  query PublicationsByCatalog {
    publications(first: 50) { nodes { id catalog { title } } }
  }`;
const Q_PUBLISHED = gql`
  query PublishedOn($id: ID!, $publicationId: ID!) {
    node(id: $id) {
      ... on Product { publishedOnPublication(publicationId: $publicationId) }
      ... on Collection { publishedOnPublication(publicationId: $publicationId) }
    }
  }`;
const M_PUBLISH = gql`
  mutation PublishablePublish($id: ID!, $input: [PublicationInput!]!) {
    publishablePublish(id: $id, input: $input) {
      userErrors { field message }
    }
  }`;

const Q_METAFIELD_DEFINITIONS = gql`
  query MaisonMetafieldDefinitions($namespace: String!) {
    metafieldDefinitions(first: 50, ownerType: PRODUCT, namespace: $namespace) {
      nodes { id key type { name } }
    }
  }`;
const M_METAFIELD_DEFINITION_CREATE = gql`
  mutation MetafieldDefinitionCreate($definition: MetafieldDefinitionInput!) {
    metafieldDefinitionCreate(definition: $definition) {
      createdDefinition { id key }
      userErrors { field message code }
    }
  }`;

const DEFINITION_FIELDS = gql`
  id
  type
  fieldDefinitions { key }
  capabilities {
    publishable { enabled }
    renderable { enabled }
    onlineStore { enabled data { urlHandle } }
  }`;
const Q_DEFINITION = gql`
  query InvitationDefinition($type: String!) {
    metaobjectDefinitionByType(type: $type) { ${DEFINITION_FIELDS} }
  }`;
const M_DEFINITION_CREATE = gql`
  mutation MetaobjectDefinitionCreate($definition: MetaobjectDefinitionCreateInput!) {
    metaobjectDefinitionCreate(definition: $definition) {
      metaobjectDefinition { ${DEFINITION_FIELDS} }
      userErrors { field message code }
    }
  }`;
const M_DEFINITION_UPDATE = gql`
  mutation MetaobjectDefinitionUpdate($id: ID!, $definition: MetaobjectDefinitionUpdateInput!) {
    metaobjectDefinitionUpdate(id: $id, definition: $definition) {
      metaobjectDefinition { ${DEFINITION_FIELDS} }
      userErrors { field message code }
    }
  }`;

const Q_METAOBJECTS = gql`
  query Invitations($type: String!) {
    metaobjects(type: $type, first: 250) { nodes { id handle } }
  }`;
const M_METAOBJECT_UPSERT = gql`
  mutation MetaobjectUpsert($handle: MetaobjectHandleInput!, $metaobject: MetaobjectUpsertInput!) {
    metaobjectUpsert(handle: $handle, metaobject: $metaobject) {
      metaobject { id handle }
      userErrors { field message code }
    }
  }`;

const Q_PRODUCT = gql`
  query ProductByHandle($handle: String!) {
    productByIdentifier(identifier: { handle: $handle }) {
      id
      tags
      media(first: 50) { nodes { id alt status } }
      variants(first: 50) { nodes { id sku } }
    }
  }`;
const M_PRODUCT_SET = gql`
  mutation ProductSet($identifier: ProductSetIdentifiers, $input: ProductSetInput!) {
    productSet(identifier: $identifier, input: $input, synchronous: true) {
      product {
        id
        handle
        media(first: 50) { nodes { id alt status } }
        variants(first: 50) { nodes { id sku media(first: 1) { nodes { id } } } }
      }
      userErrors { field message code }
    }
  }`;
const Q_PRODUCT_MEDIA = gql`
  query ProductMedia($id: ID!) {
    product(id: $id) { media(first: 50) { nodes { id alt status } } }
  }`;
const M_VARIANT_APPEND_MEDIA = gql`
  mutation ProductVariantAppendMedia($productId: ID!, $variantMedia: [ProductVariantAppendMediaInput!]!) {
    productVariantAppendMedia(productId: $productId, variantMedia: $variantMedia) {
      userErrors { field message code }
    }
  }`;
const M_METAFIELDS_SET = gql`
  mutation MetafieldsSet($metafields: [MetafieldsSetInput!]!) {
    metafieldsSet(metafields: $metafields) {
      metafields { key }
      userErrors { field message code }
    }
  }`;

const Q_COLLECTION = gql`
  query CollectionByHandle($handle: String!) {
    collectionByIdentifier(identifier: { handle: $handle }) { id handle }
  }`;
// 2026-07+: membership is defined with `sources`/`conditions` (the `input`/`ruleSet` argument is deprecated).
const M_COLLECTION_CREATE = gql`
  mutation CollectionCreate($collection: CollectionCreateInput!) {
    collectionCreate(collection: $collection) {
      collection { id handle }
      userErrors { field message }
    }
  }`;
const M_COLLECTION_CREATE_LEGACY = gql`
  mutation CollectionCreateLegacy($input: CollectionInput!) {
    collectionCreate(input: $input) {
      collection { id handle }
      userErrors { field message }
    }
  }`;

const Q_PAGES = gql`
  query Pages {
    pages(first: 250) { nodes { id handle templateSuffix isPublished } }
  }`;
const M_PAGE_CREATE = gql`
  mutation PageCreate($page: PageCreateInput!) {
    pageCreate(page: $page) {
      page { id handle }
      userErrors { field message code }
    }
  }`;
const M_PAGE_UPDATE = gql`
  mutation PageUpdate($id: ID!, $page: PageUpdateInput!) {
    pageUpdate(id: $id, page: $page) {
      page { id handle }
      userErrors { field message code }
    }
  }`;

// ------------------------------------------------------------------ request helpers
const fakeId = (type, key) => `gid://shopify/${type}/dry-run-${key}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const mb = (bytes) => (bytes / 1024 / 1024).toFixed(1);

/** Runs a query. In a dry run nothing exists yet, so every lookup returns null. */
async function query(doc, variables) {
  if (DRY) return null;
  return api.request(doc, variables);
}

/**
 * Runs a mutation and returns { ok, data (the payload), errors, requestError }.
 * userErrors / request errors are logged as failures unless `soft` (the caller handles them).
 * In a dry run the variables are printed and `dry` (object or function) is returned as the payload.
 */
async function mutate(root, doc, variables, { label = '', dry = {}, soft = false } = {}) {
  if (DRY) {
    log.plan(root, label, variables);
    return { ok: true, data: typeof dry === 'function' ? dry() : dry, errors: [] };
  }
  try {
    const data = await api.request(doc, variables);
    const payload = data?.[root] ?? null;
    const errors = payload?.userErrors ?? (payload ? [] : [{ message: 'empty response' }]);
    if (errors.length && !soft) log.fail(`${root} ${label}`.trim(), errors);
    return { ok: payload !== null && errors.length === 0, data: payload, errors };
  } catch (err) {
    if (!soft) log.fail(`${root} ${label}: ${err.message}`);
    return { ok: false, data: null, errors: [{ message: err.message }], requestError: err };
  }
}

/** Runs one unit of work; an unexpected exception is logged as a failure instead of stopping the run. */
async function task(label, fn) {
  try {
    return await fn();
  } catch (err) {
    log.fail(`${label}: ${err.message}`);
    return null;
  }
}

// ------------------------------------------------------------------ Online Store publication
let publicationLookup;
const onlineStorePublication = () => (publicationLookup ??= findOnlineStorePublication());

async function findOnlineStorePublication() {
  if (DRY) return fakeId('Publication', 'online-store');
  let nodes = null;
  try {
    nodes = (await api.request(Q_PUBLICATIONS)).publications.nodes.map((n) => ({ id: n.id, name: n.name }));
  } catch {
    // Publication.name is deprecated; fall back to the catalog title if it's ever removed.
    try {
      nodes = (await api.request(Q_PUBLICATIONS_BY_CATALOG)).publications.nodes.map((n) => ({ id: n.id, name: n.catalog?.title }));
    } catch (err) {
      log.fail(`Could not list sales channels (publications): ${err.message}`);
    }
  }
  const hit = nodes?.find((n) => (n.name || '').trim().toLowerCase() === 'online store');
  if (!hit) {
    if (nodes) log.fail(`No "Online Store" sales channel found (have: ${nodes.map((n) => n.name).join(', ') || 'none'}) — nothing will be published.`);
    log.todo('Publish the products and collections to the Online Store sales channel (Products → select all → Include in sales channels).');
    return null;
  }
  return hit.id;
}

async function publish(id, what, publicationId) {
  if (!publicationId || !id) return;
  const data = await query(Q_PUBLISHED, { id, publicationId });
  if (data?.node?.publishedOnPublication) return log.info(`${what}: already on the Online Store`);
  const res = await mutate('publishablePublish', M_PUBLISH, { id, input: [{ publicationId }] }, { label: what });
  if (res.ok && !DRY) log.info(`${what}: published to the Online Store`);
}

// ------------------------------------------------------------------ step: definitions
async function stepDefinitions() {
  await task('product metafield definitions', productMetafieldDefinitions);
  await task('metaobject definition', invitationDefinition);
}

async function productMetafieldDefinitions() {
  const data = await query(Q_METAFIELD_DEFINITIONS, { namespace: NS });
  const existing = new Map((data?.metafieldDefinitions.nodes ?? []).map((d) => [d.key, d]));
  for (const def of PRODUCT_METAFIELDS) {
    const name = `product.metafields.${NS}.${def.key}`;
    const found = existing.get(def.key);
    if (found) {
      if (found.type.name === 'single_line_text_field') log.unchanged(`${name} already defined`);
      else log.warn(`${name} is already defined as ${found.type.name} (the theme expects single_line_text_field) — left as is`);
      continue;
    }
    const definition = {
      name: def.name,
      namespace: NS,
      key: def.key,
      type: 'single_line_text_field',
      ownerType: 'PRODUCT',
      description: def.description,
      pin: true,
      access: { storefront: 'PUBLIC_READ' },
      ...(def.validations ? { validations: def.validations } : {}),
    };
    const res = await mutate('metafieldDefinitionCreate', M_METAFIELD_DEFINITION_CREATE, { definition }, { label: name });
    if (res.ok) log.created(`created ${name} (${def.name})`);
  }
}

let invitationDefinitionCache;

/** Loads the "invitation" metaobject definition (null if it doesn't exist). */
async function loadInvitationDefinition() {
  if (invitationDefinitionCache !== undefined) return invitationDefinitionCache;
  const data = await query(Q_DEFINITION, { type: INVITATION_DEFINITION.type });
  return (invitationDefinitionCache = data?.metaobjectDefinitionByType ?? null);
}

async function invitationDefinition() {
  const { type, urlHandle } = INVITATION_DEFINITION;
  let def = await loadInvitationDefinition();
  const direct = INVITATION_DEFINITION.fields.filter((f) => !isSelfReference(f));
  const dryDefinition = (fields) => ({
    metaobjectDefinition: { id: fakeId('MetaobjectDefinition', type), type, fieldDefinitions: fields.map((f) => ({ key: f.key })), capabilities: {} },
  });

  if (!def) {
    const definition = {
      type,
      name: INVITATION_DEFINITION.name,
      description: `A live wedding invitation web page at /pages/${urlHandle}/<handle>.`,
      displayNameKey: INVITATION_DEFINITION.displayNameKey,
      access: { storefront: 'PUBLIC_READ' },
      capabilities: DEFINITION_CAPABILITIES,
      fieldDefinitions: direct.map((f) => fieldDefinitionInput(f)),
    };
    let res = await mutate('metaobjectDefinitionCreate', M_DEFINITION_CREATE, { definition }, { label: type, soft: true, dry: () => dryDefinition(direct) });
    if (!res.ok && !res.requestError && /online.?store|url.?handle|template/i.test(JSON.stringify(res.errors))) {
      // Some stores refuse the web-pages capability until a theme supports it: create without it.
      log.warn(`web pages capability rejected (${res.errors.map((e) => e.message).join('; ')}) — creating the definition without it`);
      const { onlineStore, ...capabilities } = DEFINITION_CAPABILITIES;
      res = await mutate('metaobjectDefinitionCreate', M_DEFINITION_CREATE, { definition: { ...definition, capabilities } }, { label: type, soft: true });
      if (res.ok) log.todo(`Content → Metaobjects → Invitation → turn on "Web pages" with URL handle "${urlHandle}" (entries then live at /pages/${urlHandle}/<handle>).`);
    }
    if (!res.ok) return log.fail(`metaobjectDefinitionCreate ${type}`, res.errors);
    def = res.data.metaobjectDefinition;
    const pages = def.capabilities?.onlineStore?.enabled ? `web pages at /pages/${urlHandle}/<handle>` : 'web pages off';
    log.created(`created metaobject definition "${type}" (${direct.length} fields, ${pages})`);
  } else {
    log.unchanged(`metaobject definition "${type}" already exists`);
    const caps = def.capabilities || {};
    const missing = {};
    if (!caps.publishable?.enabled) missing.publishable = DEFINITION_CAPABILITIES.publishable;
    if (!caps.renderable?.enabled) missing.renderable = DEFINITION_CAPABILITIES.renderable;
    if (!caps.onlineStore?.enabled) missing.onlineStore = DEFINITION_CAPABILITIES.onlineStore;
    else if (caps.onlineStore.data?.urlHandle !== urlHandle) {
      log.warn(`its web pages live at /pages/${caps.onlineStore.data?.urlHandle}/… but the demo links (maison.demo_url_*) point to /pages/${urlHandle}/…`);
    }
    if (Object.keys(missing).length) {
      const res = await mutate('metaobjectDefinitionUpdate', M_DEFINITION_UPDATE, { id: def.id, definition: { capabilities: missing } }, { label: `${type}: enable ${Object.keys(missing).join(', ')}`, soft: true });
      if (res.ok) {
        def = res.data.metaobjectDefinition;
        log.updated(`enabled ${Object.keys(missing).join(', ')} on "${type}"`);
      } else {
        // Usually the web pages capability waiting for the theme: warn, the entries can still be created.
        log.warn(`could not enable ${Object.keys(missing).join(', ')} on "${type}": ${res.errors.map((e) => e.message).join('; ')}`);
        log.todo(`Content → Metaobjects → Invitation: enable "Active/draft status" and "Web pages" (URL handle "${urlHandle}").`);
      }
    }
  }

  // Fields the definition doesn't have yet — always includes the self-reference on a fresh store.
  const have = new Set(def.fieldDefinitions.map((f) => f.key));
  const missingFields = INVITATION_DEFINITION.fields.filter((f) => !have.has(f.key));
  if (missingFields.length) {
    const keys = missingFields.map((f) => f.key).join(', ');
    const res = await mutate(
      'metaobjectDefinitionUpdate',
      M_DEFINITION_UPDATE,
      { id: def.id, definition: { fieldDefinitions: missingFields.map((f) => ({ create: fieldDefinitionInput(f, def.id) })) } },
      { label: `${type}: add ${keys}`, dry: () => dryDefinition(INVITATION_DEFINITION.fields) },
    );
    if (res.ok) {
      def = res.data.metaobjectDefinition;
      log.updated(`added field(s) to "${type}": ${keys}`);
    }
  }
  invitationDefinitionCache = def;
}

// ------------------------------------------------------------------ step: products
async function stepProducts() {
  const publicationId = await onlineStorePublication();
  for (const d of DESIGNS) {
    await task(`product ${d.handle}`, () =>
      syncProduct({
        handle: d.handle,
        input: {
          title: d.title,
          descriptionHtml: d.description,
          productType: d.type,
          tags: ['invitation', 'wedding', `style:${d.type.toLowerCase()}`],
          productOptions: [{ name: LANGUAGE_OPTION, position: 1, values: VARIANTS.map((v) => ({ name: v.value })) }],
        },
        variants: VARIANTS.map((v) => ({
          imageKey: v.code,
          input: {
            optionValues: [{ optionName: LANGUAGE_OPTION, name: v.value }],
            price: v.price,
            sku: sku(d.handle, v.code),
          },
        })),
        images: designImages(d),
        metafields: {
          subtitle: d.subtitle,
          name_ar: d.name_ar,
          style: d.type,
          palette: d.palette.join(','),
          demo_url_en: demoPath(d.handle, 'en'),
          demo_url_ar: demoPath(d.handle, 'ar'),
        },
        publicationId,
      }),
    );
  }
  for (const a of ADDONS) {
    await task(`product ${a.handle}`, () =>
      syncProduct({
        handle: a.handle,
        input: {
          title: a.title,
          descriptionHtml: a.description,
          productType: 'Add-on',
          tags: ['addon'],
          // A single "Default Title" variant: Shopify shows it as a product without options.
          productOptions: [{ name: 'Title', position: 1, values: [{ name: 'Default Title' }] }],
        },
        variants: [{ input: { optionValues: [{ optionName: 'Title', name: 'Default Title' }], price: a.price, sku: a.handle.toUpperCase() } }],
        publicationId,
      }),
    );
  }
}

/**
 * Creates or updates one product with productSet (upsert by handle), then sets its maison.*
 * metafields, makes sure each variant shows its image, and publishes it.
 */
async function syncProduct({ handle, input, variants, images = [], metafields = null, publicationId }) {
  const existing = (await query(Q_PRODUCT, { handle }))?.productByIdentifier ?? null;
  const { files, byKey, note } = await resolveImages(handle, images, existing?.media.nodes ?? []);

  const variantIds = new Map((existing?.variants.nodes ?? []).map((v) => [v.sku, v.id]));
  const variantInputs = variants.map((v, i) => ({
    ...(variantIds.has(v.input.sku) ? { id: variantIds.get(v.input.sku) } : {}),
    ...v.input,
    position: i + 1,
    taxable: true,
    inventoryPolicy: 'CONTINUE', // digital service: never "sold out"
    inventoryItem: { tracked: false, requiresShipping: false },
    ...(v.imageKey && byKey[v.imageKey] ? { file: byKey[v.imageKey] } : {}),
  }));

  const productInput = {
    handle,
    ...input,
    vendor: VENDOR,
    status: 'ACTIVE',
    tags: [...new Set([...(existing?.tags ?? []), ...input.tags])], // keep tags added in admin
    variants: variantInputs,
    ...(files.length ? { files } : {}),
  };
  const res = await mutate('productSet', M_PRODUCT_SET, { identifier: { handle }, input: productInput }, {
    label: handle,
    dry: () => ({ product: { id: fakeId('Product', handle), handle, media: { nodes: [] }, variants: { nodes: [] } } }),
  });
  if (!res.ok) return;
  const product = res.data.product;
  log[existing ? 'updated' : 'created'](`${existing ? 'updated' : 'created'} product ${handle} — ${variantInputs.map((v) => v.sku).join(', ')}${note}`);

  if (metafields) {
    const entries = Object.entries(metafields).filter(([, value]) => value !== undefined && value !== null && value !== '');
    const r = await mutate(
      'metafieldsSet',
      M_METAFIELDS_SET,
      { metafields: entries.map(([key, value]) => ({ ownerId: product.id, namespace: NS, key, type: 'single_line_text_field', value: String(value) })) },
      { label: `${handle}: ${NS}.{${entries.map(([k]) => k).join(',')}}` },
    );
    if (r.ok && !DRY) log.info(`${handle}: ${entries.length} ${NS}.* metafields set`);
  }

  if (!DRY) await ensureVariantImages(product, variants, images, byKey);
  await publish(product.id, `product ${handle}`, publicationId);
}

/**
 * Works out productSet `files` for a product: images already on the product (matched by alt
 * text) are referenced by ID, new ones are uploaded through staged uploads. Any other media the
 * merchant added is kept, because productSet removes files that aren't listed.
 */
async function resolveImages(handle, images, media) {
  if (!images.length && !media.length) return { files: [], byKey: {}, note: '' };
  const byAlt = new Map();
  // FAILED media is treated as missing (it gets dropped and uploaded again).
  for (const m of media) if (m.alt && m.status !== 'FAILED' && !byAlt.has(m.alt)) byAlt.set(m.alt, m);

  const missingLocal = images.filter((img) => !byAlt.has(img.alt) && !fs.existsSync(path.join(MEDIA, img.file)));
  for (const img of missingLocal) log.warn(`${handle}: ${path.relative(ROOT, path.join(MEDIA, img.file))} is missing — run \`npm run images\``);
  const toUpload = flags.skipImages ? [] : images.filter((img) => !byAlt.has(img.alt) && !missingLocal.includes(img));

  let staged = new Map();
  if (toUpload.length) {
    const paths = toUpload.map((img) => path.join(MEDIA, img.file));
    const bytes = paths.reduce((sum, p) => sum + describeFile(p).size, 0);
    if (DRY) {
      log.plan('stagedUploadsCreate', `${handle}: ${toUpload.length} image(s), ${mb(bytes)} MB, then a multipart POST of each file`, stagedUploadVariables(paths));
      staged = new Map(toUpload.map((img) => [img.file, `<staged:${img.file}>`]));
    } else {
      try {
        staged = await stageImages(api, paths);
      } catch (err) {
        log.fail(`${handle}: image upload failed — ${err.message}`);
      }
    }
  }

  const files = [];
  const byKey = {};
  let reused = 0;
  for (const img of images) {
    const found = byAlt.get(img.alt);
    let file = null;
    if (found) {
      file = { id: found.id, alt: img.alt };
      reused++;
    } else if (staged.has(img.file)) {
      file = { originalSource: staged.get(img.file), alt: img.alt, filename: img.file, contentType: 'IMAGE' };
    }
    if (file) {
      files.push(file);
      byKey[img.key] = file;
    }
  }
  const ours = new Set(images.map((img) => img.alt));
  for (const m of media) if (!ours.has(m.alt)) files.push({ id: m.id });

  const parts = [];
  if (staged.size) parts.push(`${staged.size} image(s) uploaded`);
  if (reused) parts.push(`${reused} kept`);
  if (flags.skipImages && images.length && !reused) parts.push('images skipped');
  return { files, byKey, note: parts.length ? ` (${parts.join(', ')})` : '' };
}

/**
 * productSet links variant files itself; this double-checks and, for any variant still without
 * an image, waits for media processing and attaches it with productVariantAppendMedia.
 */
async function ensureVariantImages(product, variants, images, byKey) {
  const lacking = variants
    .filter((v) => v.imageKey && byKey[v.imageKey])
    .map((v) => ({ node: product.variants.nodes.find((n) => n.sku === v.input.sku), alt: images.find((img) => img.key === v.imageKey).alt }))
    .filter(({ node }) => node && node.media.nodes.length === 0);
  if (!lacking.length) return;

  // Media is processed asynchronously; variants can only reference READY media.
  let nodes = product.media.nodes;
  for (let waited = 0; waited <= 90_000; waited += 3000) {
    const pending = lacking.filter(({ alt }) => !['READY', 'FAILED'].includes(nodes.find((m) => m.alt === alt)?.status));
    if (!pending.length) break;
    await sleep(3000);
    nodes = (await query(Q_PRODUCT_MEDIA, { id: product.id })).product.media.nodes;
  }
  const variantMedia = [];
  for (const { node, alt } of lacking) {
    const m = nodes.find((n) => n.alt === alt);
    if (m?.status === 'READY') variantMedia.push({ variantId: node.id, mediaIds: [m.id] });
    else log.warn(`${product.handle}: image "${alt}" is ${m?.status || 'missing'} — attach it to variant ${node.sku} in admin`);
  }
  if (!variantMedia.length) return;
  const res = await mutate('productVariantAppendMedia', M_VARIANT_APPEND_MEDIA, { productId: product.id, variantMedia }, { label: product.handle });
  if (res.ok) log.info(`${product.handle}: linked ${variantMedia.length} variant image(s)`);
}

// ------------------------------------------------------------------ step: collections
async function stepCollections() {
  const publicationId = await onlineStorePublication();
  for (const col of COLLECTIONS) await task(`collection ${col.handle}`, () => syncCollection(col, publicationId));
}

async function syncCollection(col, publicationId) {
  let id = (await query(Q_COLLECTION, { handle: col.handle }))?.collectionByIdentifier?.id;
  if (id) {
    log.unchanged(`collection ${col.handle} already exists (its conditions are left as they are)`);
  } else {
    const base = { title: col.title, handle: col.handle, sortOrder: 'MANUAL', ...(col.descriptionHtml ? { descriptionHtml: col.descriptionHtml } : {}) };
    const dry = { collection: { id: fakeId('Collection', col.handle), handle: col.handle } };
    let res = null;
    if (COLLECTION_SOURCES) {
      const collection = {
        ...base,
        sources: [
          {
            source: {
              title: `Tagged ${col.tag}`,
              inclusion: { matchType: 'ALL', conditions: [{ productTag: { relation: 'TAGGED_WITH', values: [col.tag], matchType: 'ANY' } }] },
            },
          },
        ],
      };
      res = await mutate('collectionCreate', M_COLLECTION_CREATE, { collection }, { label: `${col.handle} (sources: tag ${col.tag})`, soft: true, dry });
      if (!res.ok) {
        // The sources model is new in 2026-07; fall back to the (deprecated, still supported) ruleSet.
        log.info(`collection sources not accepted (${res.errors.map((e) => e.message).join('; ')}) — using the legacy ruleSet`);
        res = null;
      }
    }
    if (!res) {
      const input = { ...base, ruleSet: { appliedDisjunctively: false, rules: [{ column: 'TAG', relation: 'EQUALS', condition: col.tag }] } };
      res = await mutate('collectionCreate', M_COLLECTION_CREATE_LEGACY, { input }, { label: `${col.handle} (ruleSet: tag = ${col.tag})`, dry });
      if (!res.ok) return;
    }
    id = res.data.collection.id;
    log.created(`created smart collection ${col.handle} "${col.title}" (products tagged ${col.tag})`);
  }
  await publish(id, `collection ${col.handle}`, publicationId);
}

// ------------------------------------------------------------------ step: invitations
async function stepInvitations() {
  const { type, urlHandle } = INVITATION_DEFINITION;
  const def = DRY
    ? { fieldDefinitions: INVITATION_DEFINITION.fields.map((f) => ({ key: f.key })) }
    : await loadInvitationDefinition();
  if (!def) return log.fail(`metaobject definition "${type}" doesn't exist yet — run the definitions step first (--only=definitions,invitations)`);

  const keys = new Set(def.fieldDefinitions.map((f) => f.key));
  const existing = new Map(((await query(Q_METAOBJECTS, { type }))?.metaobjects.nodes ?? []).map((m) => [m.handle, m.id]));
  const ids = new Map();
  const ignored = new Set();

  // Pass 1: every entry with its own fields, published (ACTIVE).
  for (const inv of DEMO_INVITATIONS) {
    await task(`invitation ${inv.handle}`, async () => {
      const fields = [];
      for (const [key, value] of Object.entries(inv)) {
        if (key === 'handle' || key === 'alternate' || key === 'alternate_invitation') continue;
        if (!keys.has(key)) {
          ignored.add(key);
          continue;
        }
        if (value === undefined || value === null || value === '') continue;
        fields.push({ key, value: fieldValue(value) });
      }
      const res = await mutate(
        'metaobjectUpsert',
        M_METAOBJECT_UPSERT,
        { handle: { type, handle: inv.handle }, metaobject: { fields, capabilities: { publishable: { status: 'ACTIVE' } } } },
        { label: inv.handle, dry: { metaobject: { id: fakeId('Metaobject', inv.handle), handle: inv.handle } } },
      );
      if (!res.ok) return;
      ids.set(inv.handle, res.data.metaobject.id);
      const verb = existing.has(inv.handle) ? 'updated' : 'created';
      log[verb](`${verb} invitation ${inv.handle} → /pages/${urlHandle}/${inv.handle}`);
    });
  }
  if (ignored.size) log.warn(`catalog keys not on the definition were skipped: ${[...ignored].join(', ')}`);

  // Pass 2: link the English and Arabic versions (needs both IDs).
  if (!keys.has('alternate_invitation')) return log.warn('the definition has no alternate_invitation field — EN ⇄ AR links skipped');
  for (const inv of DEMO_INVITATIONS.filter((i) => i.alternate)) {
    const other = ids.get(inv.alternate) ?? existing.get(inv.alternate);
    if (!ids.has(inv.handle) || !other) {
      log.warn(`not linking ${inv.handle} → ${inv.alternate} (one of them wasn't saved)`);
      continue;
    }
    const res = await mutate(
      'metaobjectUpsert',
      M_METAOBJECT_UPSERT,
      { handle: { type, handle: inv.handle }, metaobject: { fields: [{ key: 'alternate_invitation', value: other }] } },
      { label: `${inv.handle} → ${inv.alternate}` },
    );
    if (res.ok && !DRY) log.info(`linked ${inv.handle} → ${inv.alternate}`);
  }
}

// ------------------------------------------------------------------ step: pages
async function stepPages() {
  let existing = [];
  try {
    existing = (await query(Q_PAGES))?.pages.nodes ?? [];
  } catch (err) {
    return log.fail(`could not list pages: ${err.message}`);
  }
  for (const p of PAGES) await task(`page ${p.handle}`, () => syncPage(p, existing.find((n) => n.handle === p.handle)));
}

const templateRejected = (res) => !res.ok && !res.requestError && res.errors.some((e) => /template/i.test(`${(e.field || []).join('.')} ${e.message}`));

function templateLater(p, res) {
  log.warn(`page ${p.handle}: template "${p.templateSuffix}" rejected (${res.errors.map((e) => e.message).join('; ')}) — is the theme published?`);
  log.todo(`Online Store → Pages → ${p.title}: choose the "${p.templateSuffix}" template once the theme is published.`);
}

async function syncPage(p, existing) {
  const template = `page.${p.templateSuffix}`;
  if (existing) {
    if (existing.templateSuffix === p.templateSuffix && existing.isPublished) return log.unchanged(`page ${p.handle} already exists (${template})`);
    const res = await mutate('pageUpdate', M_PAGE_UPDATE, { id: existing.id, page: { templateSuffix: p.templateSuffix, isPublished: true } }, { label: p.handle, soft: true });
    if (res.ok) return log.updated(`updated page ${p.handle} → ${template}, published`);
    if (templateRejected(res)) return templateLater(p, res);
    return log.fail(`pageUpdate ${p.handle}`, res.errors);
  }

  // Empty body on purpose: the page templates in the theme carry the content.
  const page = { title: p.title, handle: p.handle, templateSuffix: p.templateSuffix, isPublished: true };
  let res = await mutate('pageCreate', M_PAGE_CREATE, { page }, { label: p.handle, soft: true, dry: { page: { id: fakeId('Page', p.handle), handle: p.handle } } });
  if (res.requestError && (res.requestError.codes?.includes('undefinedField') || /doesn't exist on type/i.test(res.requestError.message))) {
    log.warn(`pageCreate isn't available in Admin API ${config.apiVersion} (${res.requestError.message})`);
    log.todo(`Online Store → Pages → Add page "${p.title}" (handle ${p.handle}) with the template "${p.templateSuffix}".`);
    return;
  }
  let used = template;
  if (templateRejected(res)) {
    // The theme with page.<suffix>.json may not be published yet: create the page, fix the template later.
    templateLater(p, res);
    const { templateSuffix, ...rest } = page;
    res = await mutate('pageCreate', M_PAGE_CREATE, { page: rest }, { label: `${p.handle} (default template)`, soft: true });
    used = 'default template for now';
  }
  if (!res.ok) return log.fail(`pageCreate ${p.handle}`, res.errors);
  log.created(`created page ${p.handle} → /pages/${p.handle} (${used})`);
}

// ------------------------------------------------------------------ connection checks
/** Scopes each step needs; inner arrays are alternatives. write_* implies read_*. */
function requiredScopes() {
  const need = {
    definitions: [['write_products'], ['write_metaobject_definitions']],
    products: [['write_products'], ['write_publications', 'write_channels'], ...(flags.skipImages ? [] : [['write_files']])],
    collections: [['write_products'], ['write_publications', 'write_channels']],
    invitations: [['write_metaobjects']],
    pages: [['write_online_store_pages', 'write_content']],
  };
  const out = [];
  for (const step of SELECTED) for (const alts of need[step]) if (!out.some((o) => o.join() === alts.join())) out.push(alts);
  return out;
}

async function connect() {
  log.section('Connecting');
  if (config.auth.mode === 'client_credentials') {
    await api.getToken();
    log.ok('access token issued via the client credentials grant (valid 24 h)');
  }
  const { shop } = await api.request(Q_SHOP);
  log.ok(`connected to ${shop.name} (${shop.myshopifyDomain}), Admin API ${config.apiVersion}`);
  if (shop.currencyCode !== CURRENCY) {
    log.warn(`store currency is ${shop.currencyCode}; catalog.mjs prices are ${CURRENCY} amounts and will be used as-is`);
  }

  let granted = api.grantedScopes;
  if (!granted) {
    try {
      granted = (await api.request(Q_SCOPES)).currentAppInstallation.accessScopes.map((s) => s.handle);
    } catch {
      granted = null;
    }
  }
  if (granted) {
    const has = new Set(granted);
    const missing = requiredScopes().filter((alts) => !alts.some((s) => has.has(s)));
    if (missing.length) {
      log.warn(`the app is missing scope(s): ${missing.map((a) => a.join(' or ')).join(', ')}`);
      log.info('Dev Dashboard → your app → Versions: add them, release a new version, then approve it on the store.');
    } else log.info(`scopes OK: ${granted.join(', ')}`);
  }
}

// ------------------------------------------------------------------ plan & main
function imageStats() {
  const files = DESIGNS.flatMap((d) => designImages(d).map((img) => path.join(MEDIA, img.file)));
  const present = files.filter((f) => fs.existsSync(f));
  return { total: files.length, present: present.length, bytes: present.reduce((s, f) => s + fs.statSync(f).size, 0) };
}

function printPlan() {
  const authLabel = {
    token: 'Admin API token (SHOPIFY_ADMIN_TOKEN)',
    client_credentials: 'client credentials grant (SHOPIFY_CLIENT_ID / SHOPIFY_CLIENT_SECRET)',
    none: 'not configured',
  }[config.auth.mode];
  const img = imageStats();
  console.log(c.bold(`Maison Invitation — store setup${DRY ? ' (dry run: nothing is sent to Shopify)' : ''}`));
  console.log(`  store     ${config.store || c.dim('not set')}`);
  console.log(`  API       ${config.apiVersion}`);
  console.log(`  auth      ${authLabel}`);
  console.log(`  .env      ${envLoaded ? path.relative(process.cwd(), envFile) || '.env' : c.dim('none (using the environment)')}`);
  console.log(`  steps     ${SELECTED.join(', ')}`);
  console.log(`  images    ${flags.skipImages ? 'skipped (--skip-images)' : `${img.present}/${img.total} product images in ${path.relative(ROOT, MEDIA)} (${mb(img.bytes)} MB)`}`);
  if (DRY && config.problems.length) for (const p of config.problems) console.log(`  ${c.dim(`note: ${p} (not needed for a dry run)`)}`);

  const plan = {
    definitions: `${PRODUCT_METAFIELDS.length} product metafield definitions (${NS}.*), metaobject definition "${INVITATION_DEFINITION.type}" (${INVITATION_DEFINITION.fields.length} fields)`,
    products: `${DESIGNS.length} designs × ${VARIANTS.length} variants (${VARIANTS.map((v) => v.value).join(' / ')}) with ${designImages(DESIGNS[0]).length} images each, ${ADDONS.length} add-ons`,
    collections: COLLECTIONS.map((col) => `"${col.handle}" (tag ${col.tag})`).join(', ') + (COLLECTION_SOURCES ? ' via collection sources' : ' via ruleSet'),
    invitations: `${DEMO_INVITATIONS.length} demo invitations at /pages/${INVITATION_DEFINITION.urlHandle}/<handle>, English ⇄ Arabic linked`,
    pages: PAGES.map((p) => p.handle).join(', '),
  };
  console.log(`\n${c.bold('Plan')}`);
  for (const step of SELECTED) console.log(`  ${step.padEnd(12)} ${plan[step]}`);
}

const RUN = {
  definitions: ['Definitions', stepDefinitions],
  products: ['Products', stepProducts],
  collections: ['Collections', stepCollections],
  invitations: ['Demo invitations', stepInvitations],
  pages: ['Pages', stepPages],
};

async function main() {
  printPlan();
  if (!DRY) {
    if (config.problems.length) {
      console.error(`\n${c.red('Configuration problem(s):')}`);
      for (const p of config.problems) console.error(`  ${c.red('✗')} ${p}`);
      console.error(`\nPut them in ${path.relative(process.cwd(), envFile) || '.env'} (see .env.example) or the environment, or try --dry-run.`);
      process.exit(2);
    }
    try {
      await connect();
    } catch (err) {
      log.fail(err.message);
      console.error(`\n${c.red('Could not connect to Shopify — nothing was changed.')}`);
      process.exit(1);
    }
  }

  for (const step of SELECTED) {
    const [title, run] = RUN[step];
    log.section(title);
    await task(step, run);
  }

  const n = log.counts;
  console.log(`\n${c.bold('Summary')}`);
  if (DRY) {
    const notes = [n.warnings ? c.yellow(`${n.warnings} warning(s)`) : '', n.failed ? c.red(`${n.failed} problem(s)`) : ''].filter(Boolean);
    console.log(`  ${n.planned} mutations planned; no requests were sent.${notes.length ? ` ${notes.join(', ')}.` : ''}`);
  } else {
    const parts = [`${n.created} created`, `${n.updated} updated`, `${n.unchanged} unchanged`, n.failed ? c.red(`${n.failed} failed`) : '0 failed', `${n.warnings} warning(s)`];
    console.log(`  ${parts.join(' · ')}`);
  }

  const todos = [
    'Upload and publish the theme (GitHub integration or `shopify theme push`): the page and invitation templates live there.',
    ...log.todos,
    'Arabic storefront: Settings → Languages → add Arabic, then translate products, collections and pages with Translate & Adapt (Arabic copy is in tools/data/catalog.mjs).',
    'Payments, taxes, policies, domain and the storefront password are store settings — see tools/shopify-setup/README.md.',
  ];
  console.log(`\n${c.bold('Still to do in Shopify admin')}`);
  for (const t of todos) console.log(`  • ${t}`);

  process.exitCode = n.failed ? 1 : 0;
}

await main();
