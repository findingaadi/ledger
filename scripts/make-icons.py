"""Draws the app icon, Android adaptive icon layers, splash image and favicon.

Money raining down on dark walnut, with the app's name, खर्चा (Kharcha),
written in gold Devanagari along the bottom. Needs rsvg-convert
(brew install librsvg) and a Devanagari font (macOS ships several).
Run: python3 scripts/make-icons.py
"""
import os, random, subprocess, tempfile

OUT = "assets/images"
NAME = "खर्चा"
FONT = "ITF Devanagari Marathi"
GOLD = "#f2d27a"

DEFS = """
<defs>
  <radialGradient id="bg" cx="0.5" cy="0.35" r="0.8">
    <stop offset="0" stop-color="#5c3a1d"/><stop offset="1" stop-color="#1f1208"/>
  </radialGradient>
  <filter id="grain" x="0" y="0" width="100%" height="100%">
    <feTurbulence type="fractalNoise" baseFrequency="0.004 0.09" numOctaves="3" seed="4"/>
    <feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -1.3 0.9"/>
  </filter>
  <linearGradient id="note" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#d7ecc0"/><stop offset="1" stop-color="#9cc47e"/>
  </linearGradient>
  <radialGradient id="coin" cx="0.35" cy="0.3" r="0.8">
    <stop offset="0" stop-color="#fff0b0"/><stop offset="0.55" stop-color="#e9b93c"/><stop offset="1" stop-color="#9a6b12"/>
  </radialGradient>
  <linearGradient id="gold" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#fff0b8"/><stop offset="0.5" stop-color="#f2c75c"/><stop offset="1" stop-color="#b9862a"/>
  </linearGradient>
  <filter id="shadow" x="-30%" y="-30%" width="160%" height="160%">
    <feDropShadow dx="6" dy="10" stdDeviation="8" flood-color="#000" flood-opacity="0.55"/>
  </filter>
</defs>"""


def background(size):
    return f'<rect width="{size}" height="{size}" fill="url(#bg)"/><rect width="{size}" height="{size}" filter="url(#grain)" opacity="0.35"/>'


def note(x, y, scale, angle, mono):
    w, h = 190 * scale, 100 * scale
    fill, ink = ("#fff", "#000") if mono else ("url(#note)", "#3f6b2c")
    streak = "" if mono else (f'<line x1="{-w * 0.3}" y1="{-h * 0.9}" x2="{-w * 0.3}" y2="{-h * 1.9}" stroke="#fff" stroke-opacity="0.18" stroke-width="{4 * scale}" stroke-linecap="round"/>'
                              f'<line x1="{w * 0.25}" y1="{-h * 0.8}" x2="{w * 0.25}" y2="{-h * 1.6}" stroke="#fff" stroke-opacity="0.12" stroke-width="{4 * scale}" stroke-linecap="round"/>')
    return (f'<g transform="translate({x} {y}) rotate({angle})" {"" if mono else "filter=\"url(#shadow)\""}>{streak}'
            f'<rect x="{-w / 2}" y="{-h / 2}" width="{w}" height="{h}" rx="{8 * scale}" fill="{fill}" stroke="{ink}" stroke-width="{4 * scale}"/>'
            f'<rect x="{-w / 2 + 12 * scale}" y="{-h / 2 + 12 * scale}" width="{w - 24 * scale}" height="{h - 24 * scale}" rx="{5 * scale}" fill="none" stroke="{ink}" stroke-width="{2 * scale}" opacity="{1 if mono else 0.6}"/>'
            f'<ellipse cx="0" cy="0" rx="{30 * scale}" ry="{30 * scale}" fill="none" stroke="{ink}" stroke-width="{3 * scale}"/>'
            f'<text x="0" y="{13 * scale}" font-family="Georgia" font-weight="bold" font-size="{38 * scale}" text-anchor="middle" fill="{ink}">£</text></g>')


def coin(x, y, scale, angle, mono):
    r = 48 * scale
    fill, ink = ("#fff", "#000") if mono else ("url(#coin)", "#7a5208")
    streak = "" if mono else f'<line x1="0" y1="{-r * 1.3}" x2="0" y2="{-r * 2.6}" stroke="#fff" stroke-opacity="0.16" stroke-width="{4 * scale}" stroke-linecap="round"/>'
    return (f'<g transform="translate({x} {y}) rotate({angle}) scale(1 {0.82 if not mono else 1})" {"" if mono else "filter=\"url(#shadow)\""}>{streak}'
            f'<circle r="{r}" fill="{fill}" stroke="{ink}" stroke-width="{4 * scale}"/>'
            f'<circle r="{r * 0.72}" fill="none" stroke="{ink}" stroke-width="{2.5 * scale}" opacity="{1 if mono else 0.7}"/>'
            f'<text x="0" y="{16 * scale}" font-family="Georgia" font-weight="bold" font-size="{46 * scale}" text-anchor="middle" fill="{ink}">£</text></g>')


def rain(mono=False):
    """Notes and coins tumbling down the top two-thirds, placed the same way every run."""
    rnd = random.Random(11)
    items = []
    spots = [(170, 150), (430, 110), (720, 150), (900, 300), (110, 380), (330, 330), (600, 300), (790, 470),
             (250, 560), (520, 520), (890, 840), (700, 640), (880, 640), (410, 680)]
    for i, (x, y) in enumerate(spots):
        x += rnd.uniform(-18, 18)
        y += rnd.uniform(-18, 18)
        angle = rnd.uniform(-38, 38)
        scale = rnd.uniform(0.75, 1.05)
        items.append(note(x, y, scale, angle, mono) if i % 2 == 0 else coin(x, y, scale * 0.95, angle, mono))
    return "".join(items)


def title(mono=False, y=905, size=230):
    fill = "#000" if mono else "url(#gold)"
    stroke = "" if mono else 'stroke="#5a3a0c" stroke-width="5" paint-order="stroke"'
    return (f'<text x="512" y="{y}" font-family="{FONT}" font-weight="bold" font-size="{size}" text-anchor="middle" '
            f'fill="{fill}" {stroke} {"" if mono else "filter=\"url(#shadow)\""}>{NAME}</text>')


def art(mono=False):
    return rain(mono) + title(mono)


def svg(size, body):
    return f'<svg xmlns="http://www.w3.org/2000/svg" width="{size}" height="{size}" viewBox="0 0 1024 1024">{DEFS}{body}</svg>'


def render(name, markup, size):
    with tempfile.NamedTemporaryFile("w", suffix=".svg", delete=False) as f:
        f.write(markup)
    subprocess.run(["rsvg-convert", "-w", str(size), "-h", str(size), "-o", os.path.join(OUT, name), f.name], check=True)
    os.unlink(f.name)


def inset(body, scale):
    """Shrink artwork about the centre, for launchers that crop the edges."""
    offset = 512 * (1 - scale)
    return f'<g transform="translate({offset} {offset}) scale({scale})">{body}</g>'


if __name__ == "__main__":
    full = background(1024) + art()
    render("icon.png", svg(1024, full), 1024)
    render("favicon.png", svg(1024, background(1024) + title(size=300, y=650)), 48)
    # Android adaptive icon: the launcher crops to a circle or squircle, so the artwork sits in the middle 62%.
    render("android-icon-background.png", svg(1024, background(1024)), 1024)
    render("android-icon-foreground.png", svg(1024, inset(art(), 0.62)), 1024)
    render("android-icon-monochrome.png", svg(1024, inset(art(mono=True), 0.62)), 1024)
    render("splash-icon.png", svg(1024, art()), 1024)
    print("icons written")
