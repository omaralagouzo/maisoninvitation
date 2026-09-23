"""Generate the line-drawn botanical sprig used by the Jardin invitation design.

Prints an SVG <g> (stroke-only, currentColor + CSS var for the blossoms) that
snippets/invitation-ornament.liquid embeds. Deterministic: same output every run.
Usage: python3 tools/brand/sprig.py
"""
import math


def bezier(p0, p1, p2, t):
    x = (1 - t) ** 2 * p0[0] + 2 * (1 - t) * t * p1[0] + t ** 2 * p2[0]
    y = (1 - t) ** 2 * p0[1] + 2 * (1 - t) * t * p1[1] + t ** 2 * p2[1]
    dx = 2 * (1 - t) * (p1[0] - p0[0]) + 2 * t * (p2[0] - p1[0])
    dy = 2 * (1 - t) * (p1[1] - p0[1]) + 2 * t * (p2[1] - p1[1])
    return x, y, math.degrees(math.atan2(dy, dx))


def leaf(x, y, angle, length, width):
    # almond leaf pointing along `angle`, base at (x, y), with a centre vein
    a = math.radians(angle)
    tip = (x + length * math.cos(a), y + length * math.sin(a))
    nx, ny = -math.sin(a), math.cos(a)
    c1 = (x + 0.45 * length * math.cos(a) + width * nx, y + 0.45 * length * math.sin(a) + width * ny)
    c2 = (x + 0.45 * length * math.cos(a) - width * nx, y + 0.45 * length * math.sin(a) - width * ny)
    f = lambda p: f"{p[0]:.1f} {p[1]:.1f}"
    outline = f"M{f((x, y))} Q{f(c1)} {f(tip)} Q{f(c2)} {f((x, y))} Z"
    vein = f"M{f((x, y))} L{f(((x + tip[0]) / 2 + 0.0, (y + tip[1]) / 2))}"
    return outline, vein


def sprig():
    p0, p1, p2 = (10, 190), (70, 70), (190, 12)
    paths = [f"M{p0[0]} {p0[1]} Q{p1[0]} {p1[1]} {p2[0]} {p2[1]}"]
    veins = []
    n = 9
    for i in range(n):
        t = 0.1 + 0.85 * i / (n - 1)
        x, y, ang = bezier(p0, p1, p2, t)
        side = 1 if i % 2 == 0 else -1
        length = 34 - 16 * t
        width = 9 - 3.5 * t
        o, v = leaf(x, y, ang + side * 48, length, width)
        paths.append(o)
        veins.append(v)
    # terminal leaf
    x, y, ang = bezier(p0, p1, p2, 1.0)
    o, v = leaf(x, y, ang, 20, 6)
    paths.append(o)
    veins.append(v)
    # a small side branch with berries
    bx, by, bang = bezier(p0, p1, p2, 0.42)
    ex, ey = bx + 38 * math.cos(math.radians(bang + 70)), by + 38 * math.sin(math.radians(bang + 70))
    paths.append(f"M{bx:.1f} {by:.1f} Q{bx + 10:.1f} {by + 22:.1f} {ex:.1f} {ey:.1f}")
    berries = [(ex, ey, 4.2), (ex - 9, ey - 4, 3.2), (ex + 3, ey - 10, 3.0)]
    blossoms = []
    for (cx, cy, r) in [(bezier(p0, p1, p2, 0.7)[0] - 22, bezier(p0, p1, p2, 0.7)[1] - 8, 7)]:
        for k in range(5):
            a = math.radians(k * 72 - 90)
            blossoms.append(f'<circle cx="{cx + r * 0.9 * math.cos(a):.1f}" cy="{cy + r * 0.9 * math.sin(a):.1f}" r="{r * 0.62:.1f}"/>')
        blossoms.append(f'<circle cx="{cx:.1f}" cy="{cy:.1f}" r="{r * 0.35:.1f}" fill="currentColor"/>')
    g = ['<g fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round">']
    g += [f'<path d="{d}"/>' for d in paths]
    g.append(f'<path d="{" ".join(veins)}" stroke-width=".8" opacity=".7"/>')
    g.append("</g>")
    g.append('<g fill="var(--inv-blush, #E8CFC4)" stroke="none">')
    g += [f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{r}"/>' for x, y, r in berries]
    g.append("</g>")
    g.append('<g fill="var(--inv-blush, #E8CFC4)" stroke="currentColor" stroke-width=".9">' + "".join(blossoms) + "</g>")
    return "".join(g)


if __name__ == "__main__":
    print(sprig())
