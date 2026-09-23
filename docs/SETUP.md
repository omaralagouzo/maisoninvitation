# Launch checklist

Everything below needs your Shopify account, so none of it could be done in advance. Allow about **2–3 hours**
for the first pass. The steps are in order.

> **Before you start:** open the design preview (https://claude.ai/artifact/NQ2EMj8jW1EGEwUk4g5NHf) to see the finished site. Nothing below changes
> the design; it connects the design to a live store.

---

## 1. Create the store (15 min)

1. Sign up at **shopify.com** and pick the **Basic** plan (enough to start; upgrade any time).
2. Store name: **Maison Invitation**. Your admin address will look like `maison-invitation.myshopify.com`.
3. **Settings → General:** set the store currency (e.g. AED or USD; this is your base currency), time zone
   and unit system.
4. Leave the store **password-protected** for now. Visitors see the "Opening soon" page from this theme,
   which also collects early emails.

## 2. Install the theme from GitHub (10 min)

1. **Online Store → Themes → Add theme → Connect from GitHub.**
2. Authorise GitHub, choose **omaralagouzo/maisoninvitation** and the branch you want live
   (merge `claude/gifted-ptolemy-2whbwp` into `main` first, then connect `main`).
3. When it appears in the theme library, click **Publish**.

From now on every push to that branch updates the store, and edits you make in the theme editor are committed back.

<details><summary>Alternative: Shopify CLI</summary>

```bash
npm install -g @shopify/cli
shopify theme push --store maison-invitation.myshopify.com --unpublished
```
</details>

## 3. Create products, invitations and pages (10 min, automated)

This script creates the five designs with English/Arabic/Bilingual variants and all photos, the two add-ons, the
collections, the "Invitation" content type, all ten demo invitations and the four content pages.

1. Follow **`tools/shopify-setup/README.md`** to create an app in the Shopify **Dev Dashboard** and copy its
   client ID and secret into a `.env` file. (Since 2026, Shopify no longer lets you create "custom apps" inside the
   admin, so this is the supported route.)
2. Run:
   ```bash
   npm install
   npm run setup:store -- --dry-run   # shows what it will create; no changes made
   npm run setup:store                # does it
   ```
3. Check **Products**, **Content → Metaobjects → Invitation**, and **Online Store → Pages**.

<details><summary>Doing it by hand instead</summary>

* **Settings → Custom data → Metaobjects → Add definition** named `Invitation` (type `invitation`) with the fields
  listed in `tools/data/catalog.mjs` → `INVITATION_DEFINITION`. Turn on **Web pages** (URL handle `invitation`)
  and **Active/draft status**.
* **Products:** one per design, with a `Language` option (English / Arabic / Bilingual), SKUs `IVOIRE-EN`,
  `IVOIRE-AR`, `IVOIRE-BI`, etc. Untick "This is a physical product". Upload the images from
  `tools/shopify-setup/media/` and keep the alt texts described in that folder's README.
* **Collections:** `invitations` (tag = invitation) and `add-ons` (tag = addon).
* **Pages:** How it works, Questions, About the Maison, Contact, each with the matching template
  (`page.how-it-works`, `page.faq`, `page.about`, `page.contact`).
</details>

## 4. Set your real prices and wording (20 min)

* The prices are placeholders: **$95** single language, **$135** bilingual, **$35** express delivery,
  **$25** RSVP guest list. Change them in **Products**.
* Review the delivery promise ("3–5 business days", "48 hours with express"). It appears in the FAQ, the product
  page and the add-on. Edit it in **Online Store → Themes → Customize** by filling in the section's text, or in
  `tools/i18n/strings.mjs` if you're editing code.
* Add your two Canva designs as new designs when ready; see `docs/OPERATIONS.md → Adding a new design`.

## 5. Languages: English + Arabic (15 min)

1. **Settings → Languages → Add language → Arabic → Publish.**
   The theme already contains every interface string in Arabic, and the whole layout mirrors right-to-left.
2. Install the free **Translate & Adapt** app to translate *your own* content: product descriptions, product
   titles if you want them in Arabic, variant names (العربية / الإنجليزية / ثنائية اللغة), page titles, and the
   `maison.subtitle` / `maison.style` metafields. The setup script's catalogue has the Arabic copy for all of these in
   `tools/data/catalog.mjs`.

## 6. Currencies (10 min)

1. **Settings → Markets.** Add the markets you sell to. Provisional list: 🇦🇪 UAE (AED), 🇸🇦 Saudi Arabia (SAR),
   🇰🇼 Kuwait (KWD), 🇶🇦 Qatar (QAR), 🇧🇭 Bahrain (BHD), 🇴🇲 Oman (OMR), 🇯🇴 Jordan (JOD), 🇪🇬 Egypt (EGP),
   🇬🇧 UK (GBP), EU (EUR), 🇺🇸 US (USD), 🇨🇦 Canada (CAD).
2. Turn on **local currencies** for each market. The globe menu in the header lists them automatically.

## 7. Payments, policies, checkout (20 min)

* **Settings → Payments:** activate Shopify Payments if it's available in your country; otherwise use a supported
  provider (e.g. Stripe, Checkout.com, Tap). Turn on Apple Pay / Google Pay / Shop Pay.
* **Settings → Policies:** generate Refund, Privacy and Terms, and adjust them for a custom digital service
  (e.g. "refundable until we start designing"). They appear in the footer automatically.
* **Settings → Shipping and delivery:** products are digital (not physical), so no shipping rates are needed.
* **Settings → Checkout:** ask for phone number (optional) so you can reach couples on WhatsApp.

## 8. Customer accounts (5 min)

**Settings → Customer accounts:** the new (passwordless) accounts are recommended. "Log in" in the header goes to
Shopify's login automatically. The theme also includes styled pages for the classic account type.

## 9. Search filters (5 min)

Install **Search & Discovery** (free) → Filters → add **Language** (variant option), **Product type** (style) and
**Price**. The collection page shows them automatically; until then it uses a built-in instant style filter.

## 10. Analytics & marketing (15 min)

* Shopify Analytics works out of the box.
* **Google & YouTube** app → connect GA4 (and Google Merchant Center if you want).
* **Facebook & Instagram** app → Meta Pixel, Conversions API, Instagram shopping.
* **Shopify Email / Forms** for the newsletter. Footer and "Opening soon" signups arrive as customers tagged
  `newsletter` / `prelaunch`.

## 11. Theme settings (10 min)

**Online Store → Themes → Customize → Theme settings:**
* **Social & contact:** Instagram, TikTok, WhatsApp number (enables WhatsApp links in the footer and contact page),
  public email.
* **Brand:** a social sharing image is included; replace it any time.
* **Invitations:** show or hide the "Made with Maison Invitation" credit and the envelope animation.

## 12. Domain & launch

1. **Settings → Domains → Buy or connect** `maisoninvitation.com` (or similar).
2. Place a test order with a 100% discount code to walk through checkout, emails and order details.
3. **Online Store → Preferences → Password protection → turn off.** You're live.

---

### After launch: fulfilling your first order

See **`docs/OPERATIONS.md`**. It covers turning an order into a live invitation in about 15 minutes, sending the
link, and collecting RSVPs.
