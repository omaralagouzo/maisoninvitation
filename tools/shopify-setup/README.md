# Store setup

`npm run setup:store` seeds a new Shopify store with the Maison Invitation starter catalogue from
[`tools/data/catalog.mjs`](../data/catalog.mjs), using the Admin GraphQL API (version `2026-07` by default).
It does **not** upload the theme. Use the Shopify GitHub integration or `shopify theme push` for that.

| Step | What it creates |
| --- | --- |
| `definitions` | Product metafield definitions `maison.subtitle`, `name_ar`, `style`, `palette`, `demo_url_en`, `demo_url_ar` (pinned, storefront-readable). Also the `invitation` metaobject definition, with status, SEO and **web pages at `/pages/invitation/<handle>`** turned on. |
| `products` | 4 designs (Ivoire, Minuit, Jardin, Sable). Each has **Language** variants English / Arabic / Bilingual with SKUs `<HANDLE>-EN`, `-AR` and `-BI`, and 7 images from `media/`, each variant showing its own card image. It also creates 2 add-ons (`express-delivery`, `rsvp-guest-list`). Nothing requires shipping, inventory isn't tracked, and everything is taxable and published to the Online Store. |
| `collections` | Smart collections `invitations` ("Wedding invitations", products tagged `invitation`) and `add-ons` (products tagged `addon`), both published. |
| `invitations` | 8 demo invitations (`ivoire-en`, `ivoire-ar`, …), active, with each English page linked to its Arabic page and back through `alternate_invitation`. |
| `pages` | `how-it-works`, `faq`, `about` and `contact`, each published with its `page.<handle>` template and an empty body (the templates hold the content). |

## 1. Get API credentials

Since January 2026 you can't create a new custom app in the Shopify admin. Create one in the Dev Dashboard instead:

1. Go to [dev.shopify.com/dashboard](https://dev.shopify.com/dashboard/) and choose **Apps → Create app → Start from Dev Dashboard**. Name it, e.g. "Maison setup".
2. Open **Versions**. Keep the default app URL (`https://shopify.dev/apps/default-app-home`) and add these scopes:
   ```
   write_products,read_publications,write_publications,write_metaobject_definitions,write_metaobjects,write_online_store_pages,write_files
   ```
   Then choose **Release**.
3. Open **Home → Install app**, pick the store, then choose **Install**.
4. Open **Settings** and copy the **Client ID** and **Client secret** into `.env`. Start from [`.env.example`](../../.env.example):
   ```sh
   cp .env.example .env   # set SHOPIFY_STORE, SHOPIFY_CLIENT_ID, SHOPIFY_CLIENT_SECRET
   ```

On each run the script exchanges the client ID and secret for a 24-hour token using the
[client credentials grant](https://shopify.dev/docs/apps/build/authentication-authorization/client-credentials-grant).
This only works if **the app and the store are in the same Shopify organization**. Otherwise Shopify returns
`shop_not_permitted`. If you already have an Admin API token, set `SHOPIFY_ADMIN_TOKEN` instead.

| Scope | Used for |
| --- | --- |
| `write_products` | Products, variants, collections, product metafields and their definitions |
| `read_publications`, `write_publications` | Finding the Online Store channel and publishing to it |
| `write_metaobject_definitions`, `write_metaobjects` | The `invitation` definition and the demo entries |
| `write_online_store_pages` (or `write_content`) | Pages |
| `write_files` | Staged image uploads (recommended) |

If you add a scope later, release a new app version and approve it on the store. When scopes are missing, the script
names them when it connects.

## 2. Run

Recommended order: push and publish the theme first, so the page templates and the invitation template already exist.

```sh
npm run images                          # only if tools/shopify-setup/media/ is empty
npm run setup:store -- --dry-run        # plan + every mutation's variables; no network, no credentials
npm run setup:store                     # do it
```

| Flag | Effect |
| --- | --- |
| `--dry-run` | Prints the plan and each GraphQL mutation with its variables. Nothing is sent. |
| `--only=definitions,products,collections,invitations,pages` | Runs a subset. `invitations` needs the definition to exist already. |
| `--skip-images` | Doesn't upload images. Images already on a product are kept. |

Each line of output starts with ✓ (created or updated), • (already there), ! (warning) or ✗ (failed). When Shopify
returns `userErrors`, the script prints them and moves on. Throttled requests are retried with backoff. The
exit code is non-zero if anything failed.

**Re-running is safe.** Everything is looked up by handle first:

- **Products** are upserted with `productSet`, so title, description, prices, type and variants go back to what `catalog.mjs` says. Tags are merged. Images are matched by alt text and reused, not uploaded again. Other media you added is kept.
- **Metafield and metaobject definitions, collections and pages** that already exist are left alone. The exceptions: missing definition fields and capabilities are added, and pages get their template and published status fixed.
- **Demo invitations** are reset to the catalogue values.

If Shopify rejects a page template or the invitation web pages because the theme isn't published yet, the script
creates the page or definition without it, warns you, and adds a follow-up. Run it again once the theme is live to fix this.

## Theme conventions the script relies on

- **Variant SKUs end in `-EN`, `-AR` or `-BI`.** Sections match variants by this suffix.
- **Image alt texts:** `<Title> invitation — English`, `<Title> invitation — Arabic` and `<Title> invitation — English & Arabic` for the variant cards, plus `<Title> envelope — English/Arabic` and `<Title> details — English/Arabic`. On hover, the product card looks for an image whose alt contains `envelope` and the language name.
- **`maison.demo_url_*` are plain text paths** (`/pages/invitation/ivoire-en`) rather than `url` metafields, because Shopify's `url` type rejects relative URLs.

## Still manual

- **Theme:** connect the GitHub repo or run `shopify theme push`, then publish the theme.
- **Arabic storefront:** add Arabic under **Settings → Languages**. Then translate products, collections, pages and the `maison.subtitle` / `maison.style` metafields with Translate & Adapt. The Arabic copy is in `catalog.mjs` (`*_ar`).
- **Store settings:** payments, taxes, markets and currencies (catalogue prices are USD amounts), policies, domain, the sender email for contact and RSVP form notifications, and removing the storefront password.
- **Navigation menus** aren't needed. The header and footer are built from the collections and pages.
- **Real customer invitations:** create them under **Content → Metaobjects → Invitation**.
