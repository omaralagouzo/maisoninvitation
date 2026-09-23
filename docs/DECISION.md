# Platform decision: a custom-coded Shopify theme

**Decision:** Maison Invitation runs on **Shopify**, with a **fully custom theme written in code** (this repository).
We don't use a marketplace theme or a page builder, and we don't run a separate custom-built website.

This gets you both things you asked for. Every pixel is designed and coded here, and the store still uses Shopify's
checkout, payments, analytics, apps, currencies, languages and customer accounts, with nothing to rebuild.

---

## The options we weighed

| | A. Shopify + off-the-shelf theme | **B. Shopify + custom-coded theme (chosen)** | C. Headless (custom site + Shopify API) | D. Fully custom (no Shopify) |
|---|---|---|---|---|
| Design control | Limited to the theme's settings | **Total** | Total | Total |
| Checkout, payments, taxes | ✅ Shopify | ✅ **Shopify** | ✅ Shopify (redirect) | ❌ Build it (Stripe etc.) |
| Shopify analytics & reports | ✅ | ✅ | ⚠️ Partial, needs extra wiring | ❌ |
| App Store plugins (reviews, email, upsells…) | ✅ | ✅ | ⚠️ Many apps don't work headless | ❌ |
| Multi-currency, Arabic, RTL | ✅ | ✅ | ⚠️ Rebuild yourself | ❌ Rebuild yourself |
| Edit text/images without code | ✅ Theme editor | ✅ **Theme editor** | ❌ Needs a developer or CMS | ❌ |
| Hosting, security, uptime | Shopify | **Shopify** | You (Vercel/Oxygen) | You |
| Monthly cost | Shopify plan | **Shopify plan** | Plan + hosting | Hosting + payment fees + your time |
| Time to launch | Days | **Now (this repo)** | Weeks | Months |

**Why B.** It's the only option with full design control *and* everything Shopify does natively. Headless (C) looks
flexible, but it breaks many apps and theme-editor features, and you'd own the hosting. Fully custom (D) means
rebuilding payments, taxes, accounts and analytics, which is a big waste for a two-person studio.

## How "coded here, running on Shopify" works

```
this GitHub repo  ──(Shopify GitHub integration: auto-sync on every push)──▶  Shopify store theme
      │                                                                          │
      └─ edit code, preview locally, commit                                      └─ you edit text/images in the
                                                                                    Theme Editor; Shopify commits
                                                                                    those changes back to the repo
```

* The repo root **is** the theme (`layout/`, `sections/`, `snippets/`, `templates/`, `locales/`, `assets/`, `config/`).
  Shopify ignores everything else (`docs/`, `tools/`, `brand/`).
* Connect it once: **Online Store → Themes → Add theme → Connect from GitHub**, then pick this repo and branch.
* Every section is editable in the Shopify theme editor. Leave text fields blank to use the built-in wording, which
  also comes translated into Arabic.

## What we get from Shopify

* **Checkout & payments:** cards, Apple Pay, Google Pay, Shop Pay; fraud checks; taxes; order emails.
* **Analytics:** sessions, conversion, top products and traffic sources in Shopify Analytics. Add Google Analytics 4
  and Meta Pixel through Shopify's free apps (Google & YouTube, Facebook & Instagram), with no code.
* **Currencies:** Shopify Markets converts prices, and the theme's globe menu switches currency.
* **Languages:** add Arabic in Settings → Languages. The theme ships complete Arabic translations and a full
  right-to-left layout.
* **Customer accounts, discounts, gift cards, email marketing** (Shopify Email), **Search & Discovery** filters.
* **The live invitations themselves** are hosted on Shopify too, as metaobject pages at
  `/pages/invitation/<couple>`. There's no second website to host or pay for.

## What stays custom (and why that's fine)

* **The invitation web pages** are designed in this theme (4 starter designs × English/Arabic). Customers don't
  build them in a self-serve editor. You create each couple's invitation from their order details, which fits
  "we craft it by hand". A self-serve editor could come later as a Shopify app if demand grows.
* **RSVPs** reach the couple one of four ways: Shopify's contact form (emails you), a Google Sheet (script provided),
  WhatsApp, or any link. See `docs/OPERATIONS.md`.

## Costs to expect

* A Shopify plan (Basic is enough to start). Check current pricing at shopify.com/pricing.
* A domain (e.g. maisoninvitation.com), roughly $15–20/year.
* No theme purchase, no hosting bill, no page-builder subscription.
