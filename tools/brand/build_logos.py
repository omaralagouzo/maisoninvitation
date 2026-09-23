"""Rebuild the Maison Invitation logo family as true vector SVGs.

Every letter is converted to outlines (no font dependency), so the files open
identically in Figma, Illustrator, Canva, browsers and print shops.

Geometry was measured from the original Canva export:
  * the envelope-flap mark is exactly cap height, stroke ~9% of its height,
    V-apex sits at ~62% depth;
  * "AISON" is a sturdy bracketed serif -> Fraunces (wght 600, opsz 60, WONK 0);
  * "INVITATION" is a widely tracked sans in brass -> Inter.

Usage:
  python3 tools/brand/build_logos.py [path/to/fonts_dir]
fonts_dir must contain Fraunces.ttf (variable) and Inter.ttf (variable).
"""
import math
import sys
from pathlib import Path

from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "brand" / "logo"
OUT.mkdir(parents=True, exist_ok=True)

INK = "#1F1D1A"
CREAM = "#F7F3EC"
BRASS = "#A9824F"
BLACK = "#000000"
WHITE = "#FFFFFF"

FONT_DIR = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "tools" / "brand" / "fonts"
FONT_SOURCES = {
    "Fraunces.ttf": "https://raw.githubusercontent.com/google/fonts/main/ofl/fraunces/"
                    "Fraunces%5BSOFT%2CWONK%2Copsz%2Cwght%5D.ttf",
    "Inter.ttf": "https://raw.githubusercontent.com/google/fonts/main/ofl/inter/Inter%5Bopsz%2Cwght%5D.ttf",
}
FONT_DIR.mkdir(parents=True, exist_ok=True)
for _name, _url in FONT_SOURCES.items():
    if not (FONT_DIR / _name).exists():
        import urllib.request
        urllib.request.urlretrieve(_url, FONT_DIR / _name)


def load(name, axes):
    return instancer.instantiateVariableFont(TTFont(FONT_DIR / name), axes)


FRAUNCES = load("Fraunces.ttf", {"wght": 600, "opsz": 60, "SOFT": 0, "WONK": 0})
FRAUNCES_REG = load("Fraunces.ttf", {"wght": 420, "opsz": 144, "SOFT": 0, "WONK": 0})
INTER = load("Inter.ttf", {"wght": 360, "opsz": 14})
INTER_MED = load("Inter.ttf", {"wght": 500, "opsz": 14})


class Glyphs:
    """Helper that turns text into positioned outline paths."""

    def __init__(self, font):
        self.font = font
        self.gs = font.getGlyphSet()
        self.cmap = font.getBestCmap()
        self.upm = font["head"].unitsPerEm
        self.cap = self.bounds("H")[3]

    def name(self, ch):
        return self.cmap[ord(ch)]

    def bounds(self, ch):
        bp = BoundsPen(self.gs)
        self.gs[self.name(ch)].draw(bp)
        return bp.bounds or (0, 0, 0, 0)

    def advance(self, ch):
        return self.font["hmtx"][self.name(ch)][0]

    def path(self, ch, x, baseline, scale, rotate_deg=0.0, cx=0.0, cy=0.0):
        """Outline of `ch` with its origin at (x, baseline), scaled, y flipped.

        If rotate_deg is given the glyph is rotated about (cx, cy) after placement.
        """
        pen = SVGPathPen(self.gs, ntos=lambda v: f"{v:.2f}".rstrip("0").rstrip("."))
        a = math.radians(rotate_deg)
        ca, sa = math.cos(a), math.sin(a)
        # glyph space -> placed (flip y) -> rotate about (cx, cy)
        # placed: X = x + s*gx ; Y = baseline - s*gy
        # rotated: X' = cx + ca*(X-cx) - sa*(Y-cy) ; Y' = cy + sa*(X-cx) + ca*(Y-cy)
        s = scale
        # X' = ca*s*gx + sa*s*gy + (cx + ca*(x-cx) - sa*(baseline-cy))
        # Y' = sa*s*gx - ca*s*gy + (cy + sa*(x-cx) + ca*(baseline-cy))
        dx = cx + ca * (x - cx) - sa * (baseline - cy)
        dy = cy + sa * (x - cx) + ca * (baseline - cy)
        tp = TransformPen(pen, (ca * s, sa * s, sa * s, -ca * s, dx, dy))
        self.gs[self.name(ch)].draw(tp)
        return pen.getCommands()

    def tracked_width(self, text, scale, tracking):
        """Width of text laid out with `tracking` (in output units) between glyphs."""
        w = sum(self.advance(c) * scale for c in text)
        return w + tracking * (len(text) - 1)

    def run(self, text, x, baseline, scale, tracking=0.0):
        d = []
        for ch in text:
            if ch != " ":
                d.append(self.path(ch, x, baseline, scale))
            x += self.advance(ch) * scale + tracking
        return " ".join(d)


SERIF = Glyphs(FRAUNCES)
SERIF_REG = Glyphs(FRAUNCES_REG)
SANS = Glyphs(INTER)
SANS_MED = Glyphs(INTER_MED)

# ---------------------------------------------------------------- the mark
# Measured in a box 128.8 x 100 (cap height = 100). Centerline points.
MARK_W, MARK_H, MARK_STROKE = 128.8, 100.0, 9.0
MARK_PTS = [(64.4, 61.9), (4.5, 5.0), (4.5, 95.0), (124.3, 95.0), (124.3, 5.0)]


def mark_path(x=0.0, y=0.0, s=1.0):
    pts = [(x + px * s, y + py * s) for px, py in MARK_PTS]
    return "M" + " L".join(f"{px:.2f} {py:.2f}" for px, py in pts) + " Z"


def mark_el(x, y, s, color, stroke=MARK_STROKE):
    return (f'<path d="{mark_path(x, y, s)}" fill="none" stroke="{color}" '
            f'stroke-width="{stroke * s:.2f}" stroke-linejoin="round" stroke-linecap="round"/>')


# ---------------------------------------------------------------- wordmark
# Visual gaps between letters measured on the original (as fraction of cap height)
GAPS = {"A": 0.115, "I": 0.177, "S": 0.15, "O": 0.16}
MARK_GAP = 0.27


def wordmark(x, top, cap, color, mark_color=None):
    """Mark + AISON. Returns (svg, width). `top` is the cap-top y; `cap` the cap height."""
    mark_color = mark_color or color
    s_mark = cap / MARK_H
    parts = [mark_el(x, top, s_mark, mark_color)]
    scale = cap / SERIF.cap
    baseline = top + cap
    cx = x + MARK_W * s_mark + MARK_GAP * cap
    letters = "AISON"
    d = []
    for i, ch in enumerate(letters):
        x0, _, x1, _ = SERIF.bounds(ch)
        # place so the glyph's left ink edge lands on cx
        gx = cx - x0 * scale
        d.append(SERIF.path(ch, gx, baseline, scale))
        cx += (x1 - x0) * scale
        if i < len(letters) - 1:
            cx += GAPS[ch] * cap
    parts.append(f'<path d="{" ".join(d)}" fill="{color}"/>')
    return "\n  ".join(parts), cx - x


def tracked_caps(glyphs, text, cx, baseline, cap, tracking_em, color, align="center"):
    """Uppercase label with letter-spacing (tracking_em relative to font size)."""
    scale = cap / glyphs.cap
    font_size = glyphs.upm * scale
    tracking = tracking_em * font_size
    # Ink-width (exclude trailing tracking) for centering
    width = glyphs.tracked_width(text, scale, tracking)
    first_lsb = glyphs.bounds(text[0])[0] * scale
    last = text[-1]
    last_rsb = (glyphs.advance(last) - glyphs.bounds(last)[2]) * scale
    ink = width - first_lsb - last_rsb
    if align == "center":
        x = cx - ink / 2 - first_lsb
    elif align == "left":
        x = cx - first_lsb
    else:
        x = cx - ink - first_lsb
    return f'<path d="{glyphs.run(text, x, baseline, scale, tracking)}" fill="{color}"/>', ink


def svg(w, h, body, bg=None, title="Maison Invitation"):
    rect = f'<rect width="100%" height="100%" fill="{bg}"/>\n  ' if bg else ""
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w:.1f} {h:.1f}" '
            f'width="{w:.0f}" height="{h:.0f}" role="img" aria-label="{title}">\n'
            f'  <title>{title}</title>\n  {rect}{body}\n</svg>\n')


def write(name, content):
    (OUT / name).write_text(content)
    print("wrote", (OUT / name).relative_to(ROOT))


# ---------------------------------------------------------------- lockups
CAP = 100.0


def primary(color=INK, accent=BRASS, bg=None, pad=None, name="logo-primary.svg"):
    """Reference lockup: mark+AISON, INVITATION centered underneath."""
    pad = pad if pad is not None else 0.35 * CAP
    body_wm, wm_w = wordmark(pad, pad, CAP, color)
    sub_cap = 0.22 * CAP
    sub_base = pad + CAP + 0.75 * CAP + sub_cap
    # INVITATION spans ~3.0x cap height in the original
    target = 3.0 * CAP
    scale = sub_cap / SANS.cap
    adv_w = SANS.tracked_width("INVITATION", scale, 0) - (SANS.bounds("I")[0] * scale) - (
        (SANS.advance("N") - SANS.bounds("N")[2]) * scale)
    tracking = (target - adv_w) / 9
    font_size = SANS.upm * scale
    sub, _ = tracked_caps(SANS, "INVITATION", pad + wm_w / 2, sub_base, sub_cap,
                          tracking / font_size, accent)
    w = wm_w + 2 * pad
    h = sub_base + pad
    write(name, svg(w, h, body_wm + "\n  " + sub, bg))
    return w, h


def wordmark_only(color=INK, name="logo-wordmark.svg", mark_color=None, pad=0.0):
    body, w = wordmark(pad, pad, CAP, color, mark_color)
    write(name, svg(w + 2 * pad, CAP + 2 * pad, body))


def mark_only(color=INK, name="mark.svg", pad=6.0, stroke=MARK_STROKE, seal=None):
    w, h = MARK_W + 2 * pad, MARK_H + 2 * pad
    body = mark_el(pad, pad, 1.0, color, stroke)
    if seal:
        ax, ay = MARK_PTS[0]
        body += f'\n  <circle cx="{pad + ax:.2f}" cy="{pad + ay + 2:.2f}" r="12.5" fill="{seal}"/>'
    write(name, svg(w, h, body))


def square(bg=CREAM, color=INK, accent=BRASS, name="logo-square.svg", size=1000.0):
    """Square social/profile version like the original Canva square export."""
    cap = 0.094 * size  # matches the reference square proportions
    body_wm, wm_w = wordmark(0, 0, cap, color)
    sub_cap = 0.22 * cap
    scale = sub_cap / SANS.cap
    adv_w = SANS.tracked_width("INVITATION", scale, 0) - SANS.bounds("I")[0] * scale - (
        SANS.advance("N") - SANS.bounds("N")[2]) * scale
    tracking = (3.0 * cap - adv_w) / 9
    sub_base = cap + 0.75 * cap + sub_cap
    sub, _ = tracked_caps(SANS, "INVITATION", wm_w / 2, sub_base, sub_cap,
                          tracking / (SANS.upm * scale), accent)
    total_h = sub_base
    ox = (size - wm_w) / 2
    oy = (size - total_h) / 2
    body = f'<g transform="translate({ox:.2f} {oy:.2f})">\n  {body_wm}\n  {sub}\n  </g>'
    write(name, svg(size, size, body, bg))


def stacked(color=INK, accent=BRASS, bg=None, name="logo-stacked.svg"):
    """Enhanced: monogram mark above a single line of tracked caps."""
    s = 1.2
    mw, mh = MARK_W * s, MARK_H * s
    line_cap = 22.0
    name_txt = "MAISON"
    scale = line_cap / SERIF_REG.cap
    width_m = SERIF_REG.tracked_width(name_txt, scale, 0.32 * SERIF_REG.upm * scale)
    width_i = SANS.tracked_width("INVITATION", 0.62 * line_cap / SANS.cap, 0.5 * SANS.upm * 0.62 * line_cap / SANS.cap)
    W = max(mw, width_m, width_i) + 120
    cx = W / 2
    top = 50.0
    parts = [mark_el(cx - mw / 2, top, s, color)]
    y = top + mh + 48
    rule_w = 36
    parts.append(f'<path d="M{cx - rule_w/2:.2f} {y:.2f} H{cx + rule_w/2:.2f}" stroke="{accent}" stroke-width="1.6"/>')
    y += 26 + line_cap
    p, _ = tracked_caps(SERIF_REG, name_txt, cx, y, line_cap, 0.32, color)
    parts.append(p)
    y += 22 + 0.62 * line_cap
    p, _ = tracked_caps(SANS, "INVITATION", cx, y, 0.62 * line_cap, 0.5, accent)
    parts.append(p)
    H = y + 50
    write(name, svg(W, H, "\n  ".join(parts), bg))


def text_on_circle(glyphs, text, cx, cy, r, cap, tracking_em, color, start_deg=-90.0, top=True):
    """Place each glyph upright-tangent along a circle, centered on start_deg."""
    scale = cap / glyphs.cap
    font_size = glyphs.upm * scale
    tracking = tracking_em * font_size
    total = glyphs.tracked_width(text, scale, tracking)
    circumference = 2 * math.pi * r
    span_deg = total / circumference * 360
    ang = start_deg - span_deg / 2 if top else start_deg + span_deg / 2
    d = []
    for ch in text:
        adv = glyphs.advance(ch) * scale
        mid_deg = ang + (adv / 2) / circumference * 360 * (1 if top else -1)
        m = math.radians(mid_deg)
        # glyph center point on circle; baseline sits on the circle (top) or cap line (bottom)
        px = cx + r * math.cos(m)
        py = cy + r * math.sin(m)
        rot = mid_deg + 90 if top else mid_deg - 90
        if ch != " ":
            # place glyph so its horizontal center is at px and baseline at py, then rotate
            gx = px - adv / 2
            base = py if top else py + cap
            d.append(glyphs.path(ch, gx, base, scale, rot, px, py))
        ang += (adv + tracking) / circumference * 360 * (1 if top else -1)
    return f'<path d="{" ".join(d)}" fill="{color}"/>'


def seal(name="seal.svg", wax=BRASS, ink=CREAM, bg=None):
    """Enhanced: wax-seal monogram with circular lettering."""
    size = 600.0
    c = size / 2
    # slightly irregular wax edge
    pts = []
    n = 180
    for i in range(n):
        a = 2 * math.pi * i / n
        rr = 262 + 3.2 * math.sin(7 * a) + 2.2 * math.sin(13 * a + 1.3) + 1.4 * math.sin(23 * a + 0.4)
        pts.append((c + rr * math.cos(a), c + rr * math.sin(a)))
    wax_d = "M" + " L".join(f"{x:.1f} {y:.1f}" for x, y in pts) + " Z"
    parts = [f'<path d="{wax_d}" fill="{wax}"/>',
             f'<circle cx="{c}" cy="{c}" r="228" fill="none" stroke="{ink}" stroke-opacity=".55" stroke-width="2"/>',
             f'<circle cx="{c}" cy="{c}" r="150" fill="none" stroke="{ink}" stroke-opacity=".55" stroke-width="2"/>']
    s = 1.3
    parts.append(mark_el(c - MARK_W * s / 2, c - MARK_H * s / 2, s, ink))
    parts.append(text_on_circle(SERIF_REG, "MAISON", c, c, 176, 30, 0.42, ink, -90, top=True))
    parts.append(text_on_circle(SANS_MED, "INVITATION", c, c, 176 + 0, 19, 0.55, ink, 90, top=False))
    # small dots at 9 and 3 o'clock
    parts.append(f'<circle cx="{c - 189}" cy="{c}" r="4" fill="{ink}"/>')
    parts.append(f'<circle cx="{c + 189}" cy="{c}" r="4" fill="{ink}"/>')
    write(name, svg(size, size, "\n  ".join(parts), bg))


def arched(name="logo-arched.svg", color=INK, accent=BRASS, bg=CREAM):
    """Enhanced: arch-framed badge (profile pictures, stickers, packaging)."""
    W, H = 600.0, 760.0
    cx = W / 2
    inset = 60
    r = (W - 2 * inset) / 2
    top = inset + r
    arch = (f"M{inset} {H - inset} V{top} A{r} {r} 0 0 1 {W - inset} {top} V{H - inset} Z")
    inset2 = inset + 14
    r2 = r - 14
    arch2 = (f"M{inset2} {H - inset2} V{top} A{r2} {r2} 0 0 1 {W - inset2} {top} V{H - inset2} Z")
    parts = [f'<path d="{arch}" fill="none" stroke="{accent}" stroke-width="2.5"/>',
             f'<path d="{arch2}" fill="none" stroke="{accent}" stroke-width="1" stroke-opacity=".7"/>']
    s = 1.55
    parts.append(mark_el(cx - MARK_W * s / 2, 250, s, color))
    y = 250 + MARK_H * s + 70 + 30
    p, _ = tracked_caps(SERIF_REG, "MAISON", cx, y, 30, 0.34, color)
    parts.append(p)
    y += 44
    p, _ = tracked_caps(SANS, "INVITATION", cx, y, 17, 0.52, accent)
    parts.append(p)
    # star/diamond ornament near the base
    y += 62
    parts.append(f'<path d="M{cx} {y - 7} L{cx + 7} {y} L{cx} {y + 7} L{cx - 7} {y} Z" fill="{accent}"/>')
    write(name, svg(W, H, "\n  ".join(parts), bg))


def app_icon(name="app-icon.svg", bg=INK, color=CREAM, dot=BRASS, radius=0.22):
    size = 512.0
    s = 2.4
    mw, mh = MARK_W * s, MARK_H * s
    parts = [f'<rect width="{size}" height="{size}" rx="{size * radius:.0f}" fill="{bg}"/>',
             mark_el((size - mw) / 2, (size - mh) / 2, s, color)]
    ax, ay = MARK_PTS[0]
    parts.append(f'<circle cx="{(size - mw) / 2 + ax * s:.2f}" cy="{(size - mh) / 2 + (ay + 2) * s:.2f}" r="{12.5 * s:.1f}" fill="{dot}"/>')
    write(name, svg(size, size, "\n  ".join(parts)))


def favicon():
    """Adaptive favicon: ink mark on light UI, cream on dark UI; brass seal dot."""
    pad = 10
    w, h = MARK_W + 2 * pad, MARK_W + 2 * pad
    oy = (h - MARK_H) / 2
    ax, ay = MARK_PTS[0]
    body = (
        '<style>path{stroke:#1F1D1A}@media (prefers-color-scheme:dark){path{stroke:#F7F3EC}}</style>\n  '
        + mark_el(pad, oy, 1.0, INK, 11).replace(f'stroke="{INK}" ', "")
        + f'\n  <circle cx="{pad + ax:.2f}" cy="{oy + ay + 2:.2f}" r="13" fill="{BRASS}"/>'
    )
    write("favicon.svg", svg(w, h, body))


def main():
    primary()
    primary(color=CREAM, accent=BRASS, name="logo-primary-reversed.svg")
    primary(color=INK, accent=INK, name="logo-primary-mono-ink.svg")
    primary(color=BLACK, accent=BLACK, name="logo-primary-mono-black.svg")
    primary(color=WHITE, accent=WHITE, name="logo-primary-mono-white.svg")
    primary(color=INK, accent=BRASS, bg=CREAM, name="logo-primary-on-cream.svg")
    primary(color=CREAM, accent=BRASS, bg=INK, name="logo-primary-on-ink.svg")
    wordmark_only()
    wordmark_only(color=CREAM, name="logo-wordmark-cream.svg")
    wordmark_only(color=INK, mark_color=BRASS, name="logo-wordmark-brass-mark.svg")
    square()
    square(bg=INK, color=CREAM, name="logo-square-ink.svg")
    square(bg=CREAM, color=BLACK, accent=BLACK, name="logo-square-mono-black.svg")
    mark_only()
    mark_only(color=BRASS, name="mark-brass.svg")
    mark_only(color=CREAM, name="mark-cream.svg")
    mark_only(color=INK, name="mark-fine.svg", stroke=4.0)
    mark_only(color=INK, name="mark-sealed.svg", seal=BRASS)
    stacked()
    stacked(color=CREAM, accent=BRASS, bg=INK, name="logo-stacked-on-ink.svg")
    seal()
    seal(name="seal-ink.svg", wax=INK, ink=CREAM)
    arched()
    app_icon()
    app_icon(name="app-icon-cream.svg", bg=CREAM, color=INK)
    favicon()


if __name__ == "__main__":
    main()


# ---------------------------------------------------------------- theme snippet
def theme_snippet():
    """Emit snippets/brand-logo.liquid (inline SVG, currentColor) + theme favicon assets.

    Keeps the storefront logo pixel-identical to the brand files and lets CSS
    recolour it (hover states, reversed footer) without extra image requests.
    """
    wm_body, wm_w = wordmark(0, 0, CAP, "currentColor")
    # full lockup (with INVITATION) for footer / password page
    sub_cap = 0.22 * CAP
    scale = sub_cap / SANS.cap
    adv_w = SANS.tracked_width("INVITATION", scale, 0) - SANS.bounds("I")[0] * scale - (
        SANS.advance("N") - SANS.bounds("N")[2]) * scale
    tracking = (3.0 * CAP - adv_w) / 9
    sub_base = CAP + 0.75 * CAP + sub_cap
    sub, _ = tracked_caps(SANS, "INVITATION", wm_w / 2, sub_base, sub_cap,
                          tracking / (SANS.upm * scale), "var(--logo-accent, currentColor)")
    mark_svg = mark_el(4.5, 4.5, 1.0, "currentColor")
    snippet = f"""{{%- comment -%}}
  Maison Invitation logo — generated by tools/brand/build_logos.py. Do not edit by hand.
  Usage:
    {{% render 'brand-logo' %}}                      wordmark (envelope mark + AISON)
    {{% render 'brand-logo', variant: 'full' %}}     wordmark + INVITATION (accent via --logo-accent)
    {{% render 'brand-logo', variant: 'mark' %}}     envelope mark only
  Colour follows `color` (currentColor).
{{%- endcomment -%}}
{{%- case variant -%}}
  {{%- when 'full' -%}}
    <svg class="brand-logo brand-logo--full" viewBox="0 0 {wm_w:.1f} {sub_base:.1f}" aria-hidden="true" focusable="false">{wm_body}{sub}</svg>
  {{%- when 'mark' -%}}
    <svg class="brand-logo brand-logo--mark" viewBox="0 0 {MARK_W + 9:.1f} {MARK_H + 9:.1f}" aria-hidden="true" focusable="false">{mark_svg}</svg>
  {{%- else -%}}
    <svg class="brand-logo brand-logo--wordmark" viewBox="0 0 {wm_w:.1f} {CAP:.1f}" aria-hidden="true" focusable="false">{wm_body}</svg>
{{%- endcase -%}}
"""
    snippets = ROOT / "snippets"
    snippets.mkdir(exist_ok=True)
    (snippets / "brand-logo.liquid").write_text(snippet)
    print("wrote snippets/brand-logo.liquid")
    assets = ROOT / "assets"
    for name in ("favicon.svg", "seal.svg", "mark.svg"):
        src = OUT / name
        (assets / f"brand-{name}").write_text(src.read_text())
        print("wrote", f"assets/brand-{name}")


if __name__ == "__main__":
    theme_snippet()
