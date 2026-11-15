"""Draws the app icon, Android adaptive icon layers, splash image and favicon.

A leather-bound ledger titled "Adi Money Tracker" on dark walnut, matching the
books on the shelf. Needs rsvg-convert (brew install librsvg).
Run: python3 scripts/make-icons.py
"""
import os, subprocess, tempfile

OUT = "assets/images"
GOLD = "#ecd084"
LEATHER = "#6b1f1f"

DEFS = f"""
<defs>
  <linearGradient id="wood" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#6b4424"/><stop offset="1" stop-color="#3f2611"/>
  </linearGradient>
  <filter id="woodgrain" x="0" y="0" width="100%" height="100%">
    <feTurbulence type="fractalNoise" baseFrequency="0.004 0.09" numOctaves="3" seed="4"/>
    <feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -1.3 0.9"/>
  </filter>
  <filter id="leathergrain" x="0" y="0" width="100%" height="100%">
    <feTurbulence type="fractalNoise" baseFrequency="0.22" numOctaves="2" seed="9"/>
    <feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -0.9 0.62"/>
  </filter>
  <linearGradient id="sheen" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#fff" stop-opacity="0.16"/>
    <stop offset="0.5" stop-color="#fff" stop-opacity="0"/>
    <stop offset="1" stop-color="#000" stop-opacity="0.3"/>
  </linearGradient>
  <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
    <feDropShadow dx="14" dy="18" stdDeviation="18" flood-color="#000" flood-opacity="0.6"/>
  </filter>
</defs>"""


def wood(size):
    return f'<rect width="{size}" height="{size}" fill="url(#wood)"/><rect width="{size}" height="{size}" filter="url(#woodgrain)" opacity="0.55"/>'


def book(x, y, w, h, mono=False):
    """A ledger standing upright: page block, leather cover, spine, gold tooling and title."""
    s = w / 430  # everything below is drawn for a 430-wide book and scaled
    gold = "#000" if mono else GOLD
    t = lambda size, text, dy, weight="bold", spacing=0, style="normal": (
        f'<text x="{x + w * 0.56}" y="{y + dy * s}" font-family="Georgia" font-size="{size * s}" font-weight="{weight}" '
        f'font-style="{style}" letter-spacing="{spacing * s}" text-anchor="middle" fill="{gold}">{text}</text>')
    frame_x, frame_w = x + 62 * s, w - 92 * s
    parts = []
    if mono:
        # Monochrome: a solid silhouette with the title and frame cut out.
        parts.append(f'<g><rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{14 * s}" fill="#fff"/>')
    else:
        parts += [
            f'<g filter="url(#shadow)">',
            f'<rect x="{x + w - 30 * s}" y="{y + 12 * s}" width="{34 * s}" height="{h - 22 * s}" rx="{8 * s}" fill="#efe3c4" stroke="#bfae86" stroke-width="{3 * s}"/>',
            f'<rect x="{x}" y="{y}" width="{w - 14 * s}" height="{h}" rx="{14 * s}" fill="{LEATHER}"/>',
            f'<rect x="{x}" y="{y}" width="{w - 14 * s}" height="{h}" rx="{14 * s}" filter="url(#leathergrain)"/>',
            f'<rect x="{x}" y="{y}" width="{w - 14 * s}" height="{h}" rx="{14 * s}" fill="url(#sheen)"/>',
            f'<rect x="{x}" y="{y}" width="{40 * s}" height="{h}" rx="{10 * s}" fill="#000" opacity="0.32"/>',
        ]
        for by in (0.07, 0.1, 0.9, 0.93):
            parts.append(f'<rect x="{x}" y="{y + h * by}" width="{40 * s}" height="{6 * s}" fill="{GOLD}" opacity="0.85"/>')
    parts += [
        f'<rect x="{frame_x}" y="{y + 30 * s}" width="{frame_w}" height="{h - 60 * s}" fill="none" stroke="{gold}" stroke-width="{7 * s}"/>',
        f'<rect x="{frame_x + 16 * s}" y="{y + 46 * s}" width="{frame_w - 32 * s}" height="{h - 92 * s}" fill="none" stroke="{gold}" stroke-width="{3 * s}"/>',
        t(112, "Adi", 250, spacing=2),
        f'<line x1="{x + w * 0.56 - 90 * s}" y1="{y + 292 * s}" x2="{x + w * 0.56 + 90 * s}" y2="{y + 292 * s}" stroke="{gold}" stroke-width="{4 * s}"/>',
        t(60, "Money", 372),
        t(60, "Tracker", 440),
        f'<g transform="translate({x + w * 0.56} {y + 520 * s}) rotate(45)"><rect x="{-15 * s}" y="{-15 * s}" width="{30 * s}" height="{30 * s}" fill="{gold}"/></g>',
        '</g>',
    ]
    return "".join(parts)


def svg(size, body, background=None):
    bg = background or ""
    return f'<svg xmlns="http://www.w3.org/2000/svg" width="{size}" height="{size}" viewBox="0 0 {size} {size}">{DEFS}{bg}{body}</svg>'


def render(name, markup, size):
    with tempfile.NamedTemporaryFile("w", suffix=".svg", delete=False) as f:
        f.write(markup)
    subprocess.run(["rsvg-convert", "-w", str(size), "-h", str(size), "-o", os.path.join(OUT, name), f.name], check=True)
    os.unlink(f.name)


if __name__ == "__main__":
    # Full icon: book on wood, filling most of the square.
    full = svg(1024, book(272, 132, 480, 760), wood(1024))
    render("icon.png", full, 1024)
    render("favicon.png", full, 48)
    # Android adaptive icon: the launcher crops to a circle or squircle, so keep the book inside the middle 60%.
    render("android-icon-background.png", svg(1024, "", wood(1024)), 1024)
    render("android-icon-foreground.png", svg(1024, book(346, 230, 340, 538)), 1024)
    render("android-icon-monochrome.png", svg(1024, book(346, 230, 340, 538, mono=True)), 1024)
    # Splash: the book alone, drawn over a dark wood colour set in app.json.
    render("splash-icon.png", svg(1024, book(272, 132, 480, 760)), 1024)
    print("icons written")
