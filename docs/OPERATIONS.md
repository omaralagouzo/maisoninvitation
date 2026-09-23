# Running the studio

How an order becomes a live invitation, how RSVPs reach the couple, and how to add new designs.

---

## 1. From order to invitation (about 15 minutes)

**1. An order arrives.** In **Orders**, the line item shows everything the couple entered in the product wizard:

| Property | Example |
|---|---|
| Name 1 / Name 2 | Leila / Adam |
| Names in Arabic *(bilingual only)* | ليلى و آدم |
| Wedding date / Start time | 2027-04-15 / 19:30 |
| Venue / City | The Orangery / Dubai |
| RSVP by / RSVP method / RSVP WhatsApp | 2027-03-15 / WhatsApp / +971… |
| Notes | hosts, programme, dress code, verse, song… |

The variant tells you the language: **English**, **Arabic** or **Bilingual**. The cart note may hold extra details.

**2. Create the invitation.** **Content → Metaobjects → Invitation → Add entry**
* Tip: open a demo entry (e.g. *Demo — Ivoire (English)*), click **⋯ → Duplicate**, then edit it.
* Set **Design**, **Language** (`en` or `ar`), names, date, **Start time (24h)**, venue, programme
  (one line per item, `7:30 PM | Guest arrival`), dress code, RSVP method, etc.
* Untick **Demo invitation** (demo entries never send RSVPs).
* **Handle** becomes the link, e.g. `leila-and-adam` → `yourdomain.com/pages/invitation/leila-and-adam`.
  Use something that isn't easy to guess if the couple wants privacy, e.g. `leila-adam-7k2`.
  Invitation pages tell search engines not to index them (`noindex`), but Shopify may still list them in the
  store's `sitemap.xml`, which is another reason to use hard-to-guess handles.
* Set status to **Active** and save.

**3. Bilingual orders:** create **two** entries (one `en`, one `ar`) and link them to each other in the
**Other-language version** field. Each page then gets a small **العربية / English** switch.

**4. Preview & approve.** Open the link, check it on your phone, and send it to the couple for approval
(email or WhatsApp). Edit and re-save as many times as needed; the link never changes.

**5. Deliver.** Mark the order **Fulfilled** (no tracking needed) and send the final link. The couple shares it
on WhatsApp, by text or email. Link previews show the envelope and "The wedding of Leila & Adam".

> **Changes later?** Edit the same entry. Guests always see the latest version at the same link.

---

## 2. RSVPs: four ways to receive them

Choose per invitation with the **RSVP method** field:

| Method | How it works | Best for |
|---|---|---|
| `form` | Shopify's contact form. Each reply is **emailed to the store** with the guest's name, attendance, guest count, message and which invitation it's for. Forward or export for the couple. | Simple, zero setup |
| `sheet` | Replies go straight into a **Google Sheet** you share with the couple. Setup below (5 min). This is what the "RSVP guest list" add-on sells. | Live guest list |
| `whatsapp` | Guests fill in name + attendance, then WhatsApp opens with a pre-written reply to the couple's number (**RSVP WhatsApp number**, e.g. `971501234567`). | Gulf / Levant weddings |
| `link` | A button to any link, e.g. a Google Form, Zola or The Knot. Put it in **RSVP link**. | Couples with their own system |
| `none` | Hides the RSVP section. | Save-the-dates |

### Setting up a Google Sheet (method `sheet`)

1. Create a Google Sheet (one per couple, or one shared sheet; the invitation handle is recorded on each row).
2. **Extensions → Apps Script**, paste the contents of [`docs/rsvp-google-sheet.gs`](rsvp-google-sheet.gs), save.
3. **Deploy → New deployment → Web app**. Execute as **Me**, access **Anyone**. Copy the Web app URL.
4. Paste that URL into the invitation's **RSVP link / Google Sheet endpoint** field and set **RSVP method** to
   `sheet`.
5. Share the Sheet with the couple (view only).

---

## 3. Adding a new design (e.g. your Canva designs)

A "design" is one set of styles applied to the same invitation structure, so adding one is mostly CSS.

1. **Styles:** in `assets/invitation.css`, copy one of the `.inv--jardin { … }` blocks, rename it (e.g.
   `.inv--rose`) and set the colours and fonts. Add hero decorations in the matching `.inv--rose …` rules.
2. **Ornaments (optional):** add a `when 'rose'` case in `snippets/invitation-ornament.liquid`
   (SVG line art: crest, divider, corner).
3. **Content type:** in Shopify admin → Custom data → Invitation → **Design** field, add `rose` to the choices.
   (Also add it to `tools/data/catalog.mjs` so the scripts know about it.)
4. **Demo + photos:** add the design to `DESIGNS` and two demo entries to `DEMO_INVITATIONS` in
   `tools/data/catalog.mjs`, then run:
   ```bash
   npm run preview:build   # renders the new demo pages
   npm run images          # screenshots them into product photos in tools/shopify-setup/media/
   npm run setup:store -- --only=products,invitations
   ```
5. Check it in the preview (`npm run preview`) before pushing.

Fonts: invitation fonts are self-hosted in `assets/`. To add one, append it to `FONTS` in
`tools/brand/fetch_fonts.py` and run `python3 tools/brand/fetch_fonts.py`.

---

## 4. Editing wording & translations

* **In Shopify:** Online Store → Themes → Customize. Every text field left **blank** uses the default wording,
  translated into Arabic automatically. Type something to override it, then translate your override with
  Translate & Adapt.
* **In code:** all default wording lives in `tools/i18n/strings.mjs` as `[English, Arabic]` pairs. Edit, then run
  `node tools/i18n/build.mjs` to regenerate `locales/en.default.json` and `locales/ar.json`.

---

## 5. Everyday commands

```bash
npm install              # once
npm run preview          # build + serve the offline preview at http://localhost:4173
npm run check            # Shopify Theme Check (lint)
npm run images           # regenerate product photos / hero demos from the demo invitations
npm run setup:store      # seed a Shopify store (see tools/shopify-setup/README.md)
```
