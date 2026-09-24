# Architecture

Technical reference for the theme and tooling. For the *why*, see `DECISION.md`.

## Repository map

```
/                       ← the Shopify theme (Shopify syncs only these folders)
├─ layout/              theme.liquid · invitation.liquid (live invites) · password.liquid
├─ templates/           JSON templates (index, product, collection, cart, page.*, customers/*, metaobject/invitation)
├─ sections/            every page section (header, hero, showcase, main-product, main-invitation, …)
├─ snippets/            shared pieces (brand-logo, icon, product-card, mega-menu, localization-panel, phone-frame, …)
├─ assets/              base.css · global.js · product.js · invitation.css/js · fonts · images
├─ locales/             en.default.json · ar.json  (generated, see tools/i18n)
├─ config/              settings_schema.json · settings_data.json
├─ brand/               logo system (SVG + PNG) and brand guide — not uploaded to Shopify
├─ docs/                decision, setup, operations, this file
└─ tools/
   ├─ data/catalog.mjs  single source of truth: designs, variants, add-ons, demo invitations, pages
   ├─ preview/          offline renderer (LiquidJS + Shopify tags/filters + mock store) → dist/preview
   ├─ images/           Playwright pipeline: demo invitations → product photos, hero demos, share images
   ├─ shopify-setup/    Admin API seeding script + generated product media
   ├─ i18n/             bilingual strings source → locales/*.json
   ├─ brand/            logo + font + ornament generators (Python / fontTools)
   └─ check/            Shopify Theme Check runner
```

## Header (spec §1)

| Item | Implementation |
|---|---|
| Logo | `snippets/brand-logo.liquid`: inline SVG generated from the vector logo, recolourable via CSS |
| **Invitations** | Mega-menu built from a **collection** (`invitations` by default), not hardcoded. Groups designs by *product type* (style) once the collection has more than *N* designs (setting, default 8). Hover opens it on real-mouse devices; click or tap everywhere else |
| **How it works** | Plain link to `/pages/how-it-works` (dedicated page) |
| **Globe** | One panel, two labelled groups, **Language** and **Currency**, using Shopify's native `localization` form. Languages come from Settings → Languages, currencies from Settings → Markets |
| **Log in** | `routes.account_login_url` (becomes "Account" when logged in). Works with new and classic customer accounts |
| Bag | Appears only once the cart has items, so the header matches the spec until it's needed |

Only one dropdown is open at a time (`header-menu` custom element in `assets/global.js`). Esc, outside click and
focus leaving the header all close it. On mobile everything opens on tap, and the drawer and globe panel exclude
each other.

## Two language controls, two jobs (decision required by the brief)

| Control | Where | Controls | Mechanism |
|---|---|---|---|
| **Globe → Language** | Header | The **website's interface language** (menus, buttons, labels, page text) and layout direction | Shopify languages (`/ar/…` URLs) + `locales/ar.json` + Translate & Adapt |
| **English / العربية tabs** | Homepage "Choose your invitation" | Which **example invitations** are shown | Client-side tabs over the same products, using each design's English or Arabic *variant* |

They're labelled differently ("Language" vs "Invitation language") and the globe panel has a one-line note
explaining the difference. When the site is in Arabic, the Arabic tab is selected by default.

## Arabic & right-to-left

**Full Arabic site support ships in v1.** It's cheap because the CSS was built RTL-first:

* **CSS logical properties everywhere** (`margin-inline`, `inset-inline-start`, `text-align: start`, `border-block-end`
  …), so `dir="rtl"` on `<html>` mirrors the whole layout, including dropdown alignment.
* `layout/theme.liquid` sets `dir="rtl"` when the storefront language is Arabic.
* Direction-sensitive icons (arrows, chevrons) carry `icon--flip-rtl`.
* Typography: Arabic text falls back through the font stacks to **Amiri** (headings) and **IBM Plex Sans Arabic**
  (UI), with `unicode-range`, so Arabic fonts download only when Arabic text is on the page. Letter-spacing and
  uppercase are disabled for Arabic, since Arabic is a connected script.
* Prices are wrapped in Unicode left-to-right isolates so "$95.00 USD" never scrambles inside Arabic sentences.
* **Default copy for every section lives in the locale files**, not in section settings. A blank setting means
  "use the translated default", so the Arabic storefront is fully translated with zero manual work.

## Products & data model

| Shopify object | Used for |
|---|---|
| **Product** per design (`Ivoire`, `Minuit`, …) | Variants on option **Language**: English / Arabic / Bilingual. SKUs `IVOIRE-EN/-AR/-BI`, which the theme matches on *SKU suffix* because option names get translated on the Arabic storefront |
| Product **type** | Style group (Classic, Evening, Botanical, Modern), used for mega-menu grouping and the style filter |
| Metafields `maison.*` | `subtitle`, `style` (translatable style label), `name_ar`, `palette` (comma-separated hex), `demo_url_en`, `demo_url_ar` |
| Variant images | English / Arabic / bilingual phone mockups. Card hover uses the image whose alt contains "envelope" + the language |
| Collections | `invitations` (the designs), `add-ons` (offered in wizard step 3) |
| **Line item properties** | The couple's details from the wizard (`Name 1`, `Wedding date`, …). English keys for consistent admin/exports; the cart shows translated labels |
| **Metaobject `invitation`** | Each live invitation. `onlineStore` capability → `/pages/invitation/<handle>`, rendered by `templates/metaobject/invitation.json` with `layout/invitation.liquid` |

### Invitation pages

* **Été** has its own markup (`snippets/invitation-ete.liquid`, rendered by the same section), styles
  (`assets/invitation-ete.css`) and behaviour (`assets/invitation-ete.js`); see *The Été design* below.
* One markup (`sections/main-invitation.liquid`), four skins (`assets/invitation.css`, CSS custom properties per
  design), ornaments in `snippets/invitation-ornament.liquid`.
* All wording follows the **invitation's** language (`invitation.en.*` / `invitation.ar.*` keys exist in both
  locale files), independent of the storefront language.
* Date is a `date` field plus a `HH:MM` text field (not a date-time), so the time never shifts with the shop's
  time zone. Arabic invitations get Arabic-Indic numerals, Arabic month names and an optional automatic
  **Umm al-Qura Hijri date** (`Intl`, client-side).
* Features: envelope opening (`?open=1` skips it, `?embed=1` shows a bare version for iframes), live countdown,
  add-to-calendar (.ics + Google), directions, optional embedded map, programme timeline, note from the couple,
  RSVP (form / Google Sheet / WhatsApp / link / none), background music, share button, bilingual switch,
  `noindex`, and WhatsApp/iMessage preview (`og:` tags with the couple's names).

### The Été design

Built from the "Summer Wedding" Canva design: nine 1366 × 768 slides turned into one scrolling page.

* **Scaling:** everything is sized in *design units* (`--u` in `invitation-ete.css`). Wide screens show the whole
  slide. From about 1025 px down to 465 px a unit stays 0.75 px, so the left and right edges crop away progressively,
  as the design intends; below that the middle 620 units fill the screen. A slide is never taller than the screen
  unless its content needs the room (page two grows rather than letting the words overlap the garden). Text has readable minimum sizes and sections grow when it needs room. Decorations are placed
  with their Canva coordinates (`style="--x:…;--y:…;--w:…"`).
* **Envelope:** the envelope photo is cut into the flap and the pocket along the flap's edge (`clip-path`). On
  tap, `invitation.js` sets `is-opening`: the flap swings up and away, page two shows through the opening, and
  the pocket drops off the bottom of the screen.
* **Trees:** each tree pivots at its trunk and holds a pose for 1/10 s (cut-out / stop-motion feel), paused off
  screen and for reduced motion.
* **Countdown:** whole calendar days from the guest's today to the wedding date, counted up once on first view,
  then refreshed every minute so it rolls over at midnight.
* **Scratch to reveal:** a `<canvas>` of linen over the venue photo (`cover_photo`, or the design's photo),
  under the lace frame. About half scratched away reveals the rest. Keyboard users get a "Reveal the venue" button.
* **Fan:** scroll position → frame number. Built-in frames cut the still image into 16 pleats that fold onto the
  top guard. With the theme setting *Été design → Fan animation frames* set to N, it plays `ete-fan-001.webp` …
  `ete-fan-NNN.webp` from the theme's assets on a canvas instead, one frame per step of scroll. Frames start
  loading when the timeline is about a screen and a half away; the built-in frames play until the first arrives.
* **Also shared:** the Hijri date / date note under the date, Add to calendar and Share in the footer, music,
  the language switch; the countdown follows the section's *Show countdown* setting.
* **RSVP:** the same four delivery methods as the other designs, plus dietary requirements, companions (adult /
  child, name + allergies, capped at *Max guests per reply* − 1) and a song request. Companions are sent as one
  `Companions` field; `Guests` is 1 + companions.

## Homepage phone demo (spec §2 open decision)

**Decision:** ship the **auto-scrolling screenshot** now (smooth, fast, works everywhere, pauses on hover). The
hero section has a setting to switch to a **live interactive embed** (iframe of any invitation with `?embed=1`) or a
static screenshot. Screenshots are generated from the real demo invitations by `npm run images`, so they always
match the product. The Arabic storefront shows the Arabic demo.

## Product wizard

`sections/main-product.liquid` + `assets/product.js`:

1. **Language:** variants as radio cards (`name="id"`), so it works without JavaScript.
2. **Details:** names, date, time, venue, city, RSVP deadline and method, notes, stored as `properties[...]`.
3. **Review:** live summary, add-ons, total, **Add to bag** and Shopify's **dynamic checkout** buttons (hidden while
   add-ons are selected, because those buttons only buy the main item).

Add-ons are added together with the invitation through the Ajax Cart API (`/cart/add.js` with an `items` array).

## Preview & tooling

* **`tools/preview`** renders the real theme files with LiquidJS, the Shopify-specific tags (`form`, `section(s)`,
  `schema`, `style`, `paginate`, …) and filters (`t`, `money`, `image_url`, `asset_url`, …), and a mock store built
  from `tools/data/catalog.mjs`, in English and Arabic. `tools/preview/shim.js` fakes the server bits (cart API,
  language switch, forms) so the static preview is clickable. Preview-only; never uploaded.
* **Theme Check:** `npm run check` must report 0 errors before pushing.

## Performance & accessibility notes

* No jQuery, no frameworks. About 10 KB of JS on content pages, plus `product.js` on product pages.
* Fonts self-hosted and preloaded; Arabic fonts load only when needed; images use Shopify's responsive `srcset`.
* Reveal animations hide only below-the-fold elements and respect `prefers-reduced-motion`.
* Semantic landmarks, skip link, labelled controls, `aria-expanded`/`aria-controls` on every dropdown, a proper
  `tablist` for the showcase, and visible focus styles. Small text uses a darker brass (#876740) for WCAG AA
  contrast on cream.
