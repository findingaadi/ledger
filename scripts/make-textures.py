"""Generates the tileable texture overlays in assets/textures (pure Python, no dependencies).

Each image is black or white with varying transparency, so it can be laid over
any base colour: leather grain over a book cover, wood grain over the shelf.
Run: python3 scripts/make-textures.py
"""
import math, random, struct, zlib


def write_png(path, width, height, pixels):
    """pixels: rows of (r, g, b, a) tuples."""
    raw = b"".join(b"\x00" + bytes(v for px in row for v in px) for row in pixels)
    chunk = lambda kind, data: struct.pack(">I", len(data)) + kind + data + struct.pack(">I", zlib.crc32(kind + data))
    with open(path, "wb") as f:
        f.write(b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0))
                + chunk(b"IDAT", zlib.compress(raw, 9)) + chunk(b"IEND", b""))


def noise(width, height, cells_x, cells_y, seed):
    """Smooth value noise in 0..1 that wraps at the image edges, so the image tiles."""
    rnd = random.Random(seed)
    grid = [[rnd.random() for _ in range(cells_x)] for _ in range(cells_y)]
    smooth = lambda t: t * t * (3 - 2 * t)

    def at(x, y):
        gx, gy = (x % width) / width * cells_x, (y % height) / height * cells_y
        x0, y0 = int(gx), int(gy)
        tx, ty = smooth(gx - x0), smooth(gy - y0)
        x1, y1 = (x0 + 1) % cells_x, (y0 + 1) % cells_y
        top = grid[y0][x0] + (grid[y0][x1] - grid[y0][x0]) * tx
        bottom = grid[y1][x0] + (grid[y1][x1] - grid[y1][x0]) * tx
        return top + (bottom - top) * ty
    return at


def shade(value):
    """value in -1..1: negative darkens (black), positive lightens (white)."""
    value = max(-1.0, min(1.0, value))
    return (0, 0, 0, int(-value * 255)) if value < 0 else (255, 255, 255, int(value * 255))


def leather(size=256):
    rnd = random.Random(7)
    layers = [(noise(size, size, c, c, 10 + c), w) for c, w in ((44, 0.25), (88, 0.45), (128, 0.30))]
    patches = noise(size, size, 5, 5, 99)       # broad areas rubbed pale with handling
    # A few fine scratches: each is a short straight line that lightens what it crosses.
    scratched = {}
    for _ in range(26):
        x, y, angle, length = rnd.random() * size, rnd.random() * size, rnd.random() * math.pi, 14 + rnd.random() * 46
        for step in range(int(length)):
            px, py = int(x + math.cos(angle) * step) % size, int(y + math.sin(angle) * step) % size
            scratched[(px, py)] = 0.10 + rnd.random() * 0.10
    rows = []
    for y in range(size):
        row = []
        for x in range(size):
            n = sum(layer(x, y) * weight for layer, weight in layers)   # pebbled grain
            pores = (rnd.random() - 0.5) * 0.08                         # fine speckle
            worn = max(0.0, patches(x, y) - 0.5) * 0.55
            row.append(shade((n - 0.5) * 1.1 + pores - 0.06 + worn + scratched.get((x, y), 0)))
        rows.append(row)
    return rows


def wood(width=256, height=512):
    """Grain running top to bottom."""
    warp = noise(width, height, 4, 6, 1)
    wide = noise(width, height, 10, 2, 2)      # broad light and dark bands
    fine = noise(width, height, 80, 3, 3)      # thin streaks
    fibre = noise(width, height, 128, 24, 4)   # short fibres
    rows = []
    for y in range(height):
        row = []
        for x in range(width):
            wx = x + (warp(x, y) - 0.5) * 9    # the grain wanders slightly
            ring = 0.5 + 0.5 * math.sin((wide(wx, y) * 2.5 + wx / width * 8) * math.pi)
            g = 0.22 * ring + 0.53 * fine(wx, y) + 0.25 * fibre(wx, y)
            row.append(shade((0.5 - g) * 1.15 - 0.07))
        rows.append(row)
    return rows


if __name__ == "__main__":
    write_png("assets/textures/leather.png", 256, 256, leather())
    grain = wood()
    write_png("assets/textures/wood-v.png", 256, 512, grain)
    write_png("assets/textures/wood-h.png", 512, 256, [list(col) for col in zip(*grain)])  # same grain, sideways
    print("textures written")
