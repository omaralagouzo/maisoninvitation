// Generates every raster image the store needs from the live invitation demos:
//
//   tools/shopify-setup/media/   product photos uploaded to Shopify by the setup script
//     <design>-<lang>-card.jpg       phone mockup (grid + variant image), 1200×1500
//     <design>-both-card.jpg         English + Arabic phones (bilingual variant)
//     <design>-<lang>-envelope.jpg   the envelope moment (hover image)
//     <design>-<lang>-details.jpg    details + RSVP screens
//     <design>-<lang>-scroll.jpg     full-length screenshot (for custom hero demos)
//   assets/                        theme images
//     demo-scroll-ivoire-{en,ar}.jpg hero auto-scroll demo (per storefront language)
//     demo-screen-jardin-{en,ar}.jpg bilingual section phones
//     invite-share-<design>.jpg      WhatsApp/iMessage preview for invitations
//     share-default.jpg              storefront share image
//     brand-favicon-32.png, brand-apple-touch-icon.png
//   brand/logo/png/                PNG exports of every logo SVG
//
// Usage: npm run images   (builds the preview first if needed)
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright';
import { DESIGNS } from '../data/catalog.mjs';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const PREVIEW = path.join(ROOT, 'dist/preview');
const MEDIA = path.join(ROOT, 'tools/shopify-setup/media');
const ASSETS = path.join(ROOT, 'assets');
const SCREENS = path.join(ROOT, 'dist/screens');
const LANGS = ['en', 'ar'];
const SEAL = { ivoire: ['#A9824F', '#8C6A3E'], minuit: ['#C9A96A', '#A5864A'], jardin: ['#7D8B6A', '#65724F'], sable: ['#B5654A', '#95503A'] };
const LANG_LABEL = { en: 'English', ar: 'العربية' };

fs.mkdirSync(MEDIA, { recursive: true });
fs.mkdirSync(SCREENS, { recursive: true });

if (!fs.existsSync(path.join(PREVIEW, 'pages/invitation/ivoire-en.html'))) {
  execFileSync('node', [path.join(ROOT, 'tools/preview/build.mjs'), '--only=/pages/invitation'], { stdio: 'inherit' });
}

// ------------------------------------------------------------------ tiny static server
const TYPES = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.jpg': 'image/jpeg', '.png': 'image/png' };
const server = http.createServer((req, res) => {
  const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const file = path.join(PREVIEW, p);
  if (!file.startsWith(PREVIEW) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404);
    return res.end();
  }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, r));
const BASE = `http://127.0.0.1:${server.address().port}`;

const browser = await chromium.launch();
const phoneCtx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const page = await phoneCtx.newPage();
page.on('pageerror', (e) => console.warn('page error:', e.message));

const inviteUrl = (design, lang, query = '?embed=1') => `${BASE}/pages/invitation/${design}-${lang}.html${query}`;
const settle = (ms = 900) => page.waitForTimeout(ms);
const hidePreviewBadge = () => page.addStyleTag({ content: '.pv-badge{display:none!important}' });

// ------------------------------------------------------------------ 1. screens
const screens = {};
for (const d of DESIGNS) {
  for (const lang of LANGS) {
    const key = `${d.handle}-${lang}`;
    const out = (name) => path.join(SCREENS, `${key}-${name}.png`);

    await page.goto(inviteUrl(d.handle, lang), { waitUntil: 'networkidle' });
    await hidePreviewBadge();
    await page.evaluate(() => document.fonts.ready);
    await settle();
    await page.screenshot({ path: out('hero') });

    await page.evaluate(() => document.querySelector('#InvDetails').scrollIntoView({ block: 'start', behavior: 'instant' }));
    await settle(400);
    await page.screenshot({ path: out('details') });

    await page.evaluate(() => {
      const el = document.querySelector('#rsvp');
      if (el) el.scrollIntoView({ block: 'start', behavior: 'instant' });
    });
    await settle(400);
    await page.screenshot({ path: out('rsvp') });

    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
    const height = await page.evaluate(() => Math.min(document.documentElement.scrollHeight, 3600));
    await page.screenshot({ path: out('scroll'), fullPage: true, clip: { x: 0, y: 0, width: 390, height } });

    await page.goto(inviteUrl(d.handle, lang, ''), { waitUntil: 'networkidle' });
    await hidePreviewBadge();
    await page.evaluate(() => document.fonts.ready);
    await settle(700);
    await page.screenshot({ path: out('envelope') });

    screens[key] = { hero: out('hero'), details: out('details'), rsvp: out('rsvp'), scroll: out('scroll'), envelope: out('envelope') };
    console.log('screens', key);
  }
}

// ------------------------------------------------------------------ 2. compositions
const baseCss = `file://${path.join(ASSETS, 'base.css')}`;
const fontsCss = `
  @font-face { font-family: 'Fraunces'; src: url(file://${ASSETS}/font-fraunces-latin-normal-300-700.woff2); font-weight: 300 700; }
  @font-face { font-family: 'Inter'; src: url(file://${ASSETS}/font-inter-latin-normal-300-700.woff2); font-weight: 300 700; }
  @font-face { font-family: 'IBM Plex Sans Arabic'; src: url(file://${ASSETS}/font-plex-arabic-arabic-normal-500.woff2); font-weight: 500; }
`;
const markSvg = fs.readFileSync(path.join(ROOT, 'brand/logo/mark.svg'), 'utf8').replace(/<\?xml[^>]*>/, '');
const sealSvg = fs.readFileSync(path.join(ROOT, 'brand/logo/seal.svg'), 'utf8');
const logoSvg = fs.readFileSync(path.join(ROOT, 'brand/logo/logo-primary.svg'), 'utf8');

const phone = (src, w, extra = '') =>
  `<div class="phone" style="--phone-w:${w}px;${extra}"><div class="phone__screen"><span class="phone__island"></span><div class="phone__media"><img src="file://${src}"></div><span class="phone__glare"></span></div></div>`;
const seal = (design, size, style) => {
  const [a, b] = SEAL[design];
  return `<div style="position:absolute;${style};width:${size}px;height:${size}px;border-radius:48% 52% 50% 50%/52% 47% 53% 48%;background:radial-gradient(circle at 35% 30%, color-mix(in srgb, ${a} 70%, #fff), ${a} 38%, ${b});box-shadow:0 18px 30px -10px rgba(31,29,26,.45), inset 0 -6px 12px rgba(0,0,0,.18), inset 0 4px 6px rgba(255,255,255,.35);display:grid;place-items:center;color:#F7F3EC">
    <div style="position:absolute;inset:${size * 0.12}px;border-radius:50%;border:1.5px solid rgba(247,243,236,.45)"></div>
    <div style="width:${size * 0.42}px">${markSvg.replace(/stroke="#1F1D1A"/g, 'stroke="#F7F3EC"').replace(/width="\d+" height="\d+"/, 'width="100%" height="auto"')}</div></div>`;
};
const scene = (body, { w = 1200, h = 1500, bg = '#ECE4D6' } = {}) => `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="${baseCss}"><style>${fontsCss}
  :root{--color-ink-rgb:31,29,26}
  body{margin:0;width:${w}px;height:${h}px;background:${bg};position:relative;overflow:hidden;display:block;min-height:0}
  .arch{position:absolute;left:50%;translate:-50% 0;bottom:0;border-radius:9999px 9999px 0 0;background:#F4EEE4}
  .arch::after{content:'';position:absolute;inset:26px;border:2px solid rgba(169,130,79,.32);border-radius:inherit;border-bottom:0}
  .pill{position:absolute;left:50%;translate:-50% 0;padding:14px 30px;border-radius:999px;background:rgba(251,249,245,.92);font:500 26px/1 Inter,'IBM Plex Sans Arabic',sans-serif;letter-spacing:.14em;text-transform:uppercase;color:#1F1D1A;box-shadow:0 10px 30px -14px rgba(31,29,26,.35)}
  .pill[lang=ar]{letter-spacing:0;font-size:30px}
</style></head><body>${body}</body></html>`;

const comp = await browser.newPage({ viewport: { width: 1200, height: 1500 }, deviceScaleFactor: 1 });
// Compositions are loaded from a file:// URL (not setContent) so they may reference local files.
const TMP = path.join(SCREENS, '_compose.html');
async function render(html, out, { w = 1200, h = 1500, type = 'jpeg' } = {}) {
  await comp.setViewportSize({ width: w, height: h });
  fs.writeFileSync(TMP, html);
  await comp.goto(`file://${TMP}`, { waitUntil: 'load' });
  await comp.evaluate(() => document.fonts.ready);
  await comp.waitForTimeout(150);
  await comp.screenshot({ path: out, type, ...(type === 'jpeg' ? { quality: 86 } : {}) });
}

for (const d of DESIGNS) {
  for (const lang of LANGS) {
    const s = screens[`${d.handle}-${lang}`];
    await render(
      scene(`<div class="arch" style="width:900px;height:1290px"></div>
        <div style="position:absolute;left:50%;top:118px;translate:-50% 0">${phone(s.hero, 540)}</div>
        ${seal(d.handle, 150, 'right:150px;top:980px;rotate:-10deg')}
        <div class="pill" lang="${lang}" style="bottom:48px">${LANG_LABEL[lang]}</div>`),
      path.join(MEDIA, `${d.handle}-${lang}-card.jpg`),
    );
    await render(
      scene(`<div class="arch" style="width:900px;height:1290px;background:#EFE7DA"></div>
        <div style="position:absolute;left:50%;top:118px;translate:-50% 0">${phone(s.envelope, 540)}</div>
        <div class="pill" lang="${lang}" style="bottom:48px">${LANG_LABEL[lang]}</div>`),
      path.join(MEDIA, `${d.handle}-${lang}-envelope.jpg`),
    );
    await render(
      scene(`<div class="arch" style="width:980px;height:1260px"></div>
        <div style="position:absolute;left:120px;top:200px;rotate:-5deg">${phone(s.details, 470)}</div>
        <div style="position:absolute;right:120px;top:150px;rotate:4deg">${phone(s.rsvp, 470)}</div>`),
      path.join(MEDIA, `${d.handle}-${lang}-details.jpg`),
    );
    fs.copyFileSync(s.scroll, path.join(MEDIA, `${d.handle}-${lang}-scroll.png`));
  }
  const en = screens[`${d.handle}-en`];
  const ar = screens[`${d.handle}-ar`];
  await render(
    scene(`<div class="arch" style="width:980px;height:1290px"></div>
      <div style="position:absolute;left:110px;top:190px;rotate:-6deg">${phone(en.hero, 470)}</div>
      <div style="position:absolute;right:110px;top:140px;rotate:5deg">${phone(ar.hero, 470)}</div>
      ${seal(d.handle, 140, 'left:50%;margin-left:-70px;top:1150px')}
      <div class="pill" style="bottom:48px">English <span style="opacity:.4;margin:0 10px">+</span> <span lang="ar" style="letter-spacing:0;font-family:'IBM Plex Sans Arabic'">العربية</span></div>`),
    path.join(MEDIA, `${d.handle}-both-card.jpg`),
  );
  console.log('composed', d.handle);
}

// ------------------------------------------------------------------ 3. theme assets
const toJpeg = async (png, out, w, h) =>
  render(`<!doctype html><body style="margin:0"><img src="file://${png}" style="display:block;width:${w}px;height:${h}px"></body>`, out, { w, h });

{
  // hero auto-scroll demo: 780px wide (2× of 390)
  for (const lang of LANGS) {
    const s = screens[`ivoire-${lang}`];
    const png = fs.readFileSync(s.scroll);
    const meta = { w: png.readUInt32BE(16), h: png.readUInt32BE(20) };
    await toJpeg(s.scroll, path.join(ASSETS, `demo-scroll-ivoire-${lang}.jpg`), meta.w, meta.h);
  }
  await toJpeg(screens['jardin-en'].hero, path.join(ASSETS, 'demo-screen-jardin-en.jpg'), 780, 1688);
  await toJpeg(screens['jardin-ar'].hero, path.join(ASSETS, 'demo-screen-jardin-ar.jpg'), 780, 1688);
}

// Share preview for invitations without a photo: the design's envelope, sealed with the
// Maison mark (never the demo couple's initials), at link-preview size.
{
  const share = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  for (const d of DESIGNS) {
    await share.goto(inviteUrl(d.handle, 'en', ''), { waitUntil: 'networkidle' });
    await share.addStyleTag({
      content: `.pv-badge,.inv-envelope__hint{display:none!important}
        .inv-envelope__env{animation:none!important;width:430px!important}
        .inv-envelope__seal{width:92px!important;height:92px!important;margin:-46px 0 0 -46px!important}
        .inv-envelope__initials svg{width:44px;height:auto}`,
    });
    await share.evaluate((svg) => {
      document.querySelector('.inv-envelope__initials').innerHTML = svg;
    }, markSvg.replace(/stroke="#1F1D1A"/g, 'stroke="currentColor"'));
    await share.evaluate(() => document.fonts.ready);
    await share.waitForTimeout(300);
    await share.screenshot({ path: path.join(ASSETS, `invite-share-${d.handle}.jpg`), type: 'jpeg', quality: 86 });
  }
  await share.close();
}

await render(
  scene(
    `<div style="position:absolute;left:90px;top:0;bottom:0;display:grid;align-content:center;gap:34px;width:520px">
       <div style="width:420px">${logoSvg.replace(/width="\d+" height="\d+"/, 'width="100%" height="auto"')}</div>
       <p style="margin:0;font:400 30px/1.4 Fraunces,serif;color:#1F1D1A">Digital wedding invitations<br>in English &amp; <span style="font-family:'IBM Plex Sans Arabic'">العربية</span></p>
     </div>
     <div class="arch" style="left:auto;right:40px;translate:none;width:520px;height:600px"></div>
     <div style="position:absolute;right:150px;top:70px">${phone(screens['ivoire-en'].hero, 300)}</div>
     ${seal('ivoire', 110, 'right:90px;top:420px;rotate:-10deg')}`,
    { w: 1200, h: 630, bg: '#F7F3EC' },
  ),
  path.join(ASSETS, 'share-default.jpg'),
  { w: 1200, h: 630 },
);

// ------------------------------------------------------------------ 4. icons & PNG logos
const svgToPng = async (svgFile, out, w, h, bg = 'transparent') => {
  const svg = fs.readFileSync(svgFile, 'utf8');
  await comp.setViewportSize({ width: w, height: h });
  fs.writeFileSync(TMP, `<!doctype html><body style="margin:0;background:${bg}"><div style="width:${w}px;height:${h}px;display:grid;place-items:center">${svg.replace(/width="[\d.]+" height="[\d.]+"/, `width="${w}" height="${h}" preserveAspectRatio="xMidYMid meet"`)}</div></body>`);
  await comp.goto(`file://${TMP}`);
  await comp.screenshot({ path: out, omitBackground: bg === 'transparent' });
};
await svgToPng(path.join(ROOT, 'brand/logo/app-icon.svg'), path.join(ASSETS, 'brand-apple-touch-icon.png'), 180, 180);
await svgToPng(path.join(ROOT, 'brand/logo/favicon.svg'), path.join(ASSETS, 'brand-favicon-32.png'), 32, 32);

const pngDir = path.join(ROOT, 'brand/logo/png');
fs.mkdirSync(pngDir, { recursive: true });
for (const file of fs.readdirSync(path.join(ROOT, 'brand/logo')).filter((f) => f.endsWith('.svg'))) {
  const svg = fs.readFileSync(path.join(ROOT, 'brand/logo', file), 'utf8');
  const [, vw, vh] = svg.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/);
  const scale = 2000 / Math.max(+vw, +vh);
  await svgToPng(path.join(ROOT, 'brand/logo', file), path.join(pngDir, file.replace('.svg', '.png')), Math.round(vw * scale), Math.round(vh * scale));
}
console.log('PNG logos exported');

await browser.close();
server.close();
console.log('done');
