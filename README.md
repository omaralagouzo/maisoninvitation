# Maison Invitation

Digital wedding invitations in English and Arabic, sold on **Shopify** with a **custom-coded theme** (this repo).

> **It starts here.** Couples choose a design and language, share their details on the product page, check out
> with Shopify, and receive a handcrafted invitation website: sealed envelope, countdown, programme, map,
> add-to-calendar and RSVP, shared with one link.

## What's in this repo

| | |
|---|---|
| **The storefront** | A complete Shopify Online Store 2.0 theme at the repo root: homepage (hero "It starts here" with a live phone demo, English/Arabic invitation showcase, how it works, features, FAQ), collection, **3-step product wizard**, cart, content pages, accounts, 404, "Opening soon" password page. Fully bilingual, with a real right-to-left Arabic layout. |
| **The product** | Live invitation pages hosted on Shopify (metaobjects → `/pages/invitation/<couple>`), in **5 designs** (Ivoire, Minuit, Jardin, Sable, and **Été**, built from the "Summer Wedding" Canva design) × English / Arabic. |
| **The brand** | The logo rebuilt as true vector files plus enhanced versions (wax seal, app icon, stacked monogram, arched badge). See `brand/`. |
| **The tooling** | Offline preview renderer, product-photo generator, Shopify store seeding script, Theme Check. |

## Start here

1. **See it:** open the private design preview, **https://claude.ai/artifact/NQ2EMj8jW1EGEwUk4g5NHf**
   (the "All pages" button lists every page, the Arabic storefront and the brand kit), or run it locally:
   ```bash
   npm install
   npm run preview        # → http://localhost:4173
   ```
2. **Why Shopify + custom code:** [`docs/DECISION.md`](docs/DECISION.md)
3. **Launch it:** [`docs/SETUP.md`](docs/SETUP.md), the step-by-step checklist for everything that needs your
   Shopify account
4. **Run the studio:** [`docs/OPERATIONS.md`](docs/OPERATIONS.md) covers turning an order into an invitation, RSVPs,
   and adding new designs
5. **How it's built:** [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
6. **Brand kit:** [`brand/README.md`](brand/README.md) · `brand/index.html`

## Commands

```bash
npm run preview         # build + serve the offline preview (English + Arabic)
npm run preview:build   # build only → dist/preview
npm run check           # Shopify Theme Check (currently 0 offenses)
npm run images          # regenerate product photos & demo screenshots from the live demo invitations
npm run setup:store     # create products, collections, invitations & pages in your store (see tools/shopify-setup)
node tools/i18n/build.mjs          # regenerate locales/*.json from tools/i18n/strings.mjs
python3 tools/brand/build_logos.py # regenerate logo SVGs + theme logo snippet
```

## Placeholders to review before launch

* **Prices:** $95 single language, $135 bilingual, $35 express delivery, $25 RSVP guest list.
* **Timing promise:** "3–5 business days", "48 hours with express".
* **Demo couples, venues and stories** in the demo invitations are fictional samples.
* **About page** copy (a general husband-and-wife studio story; make it yours) and a photo.
* **Contact email** (`hello@maisoninvitation.com` is the preview placeholder; the store email is used once live).
* The four starter designs stand in for your Canva designs until you add them (see OPERATIONS → Adding a new design).
  **Été** is the first Canva design added. Its demo keeps the Canva placeholder text ("Amazing Wedding Venue",
  "City, Country"), dummy map links and the venue photo from the design; see OPERATIONS → The Été design.
