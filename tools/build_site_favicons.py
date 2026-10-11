"""Browser-tab and home-screen icons from the official LOTBI logo character.

SITE-AVATAR-LOGO-ALIGN-01 (one character everywhere). The root icons below were
generated on 2026-09-19 from an older drawing of the character (head-and-chest
crop, no red ear, not waving); the official mark (assets/brand/lotbi-mark-512.png,
the header lockup's character) came three days later. Every page except Home
falls back to /favicon.ico, and iOS fetches /apple-touch-icon.png on its own, so
these still showed the old drawing.

    python tools/build_site_favicons.py [out_dir]

writes favicon.ico (16/32/48/64/128/256), favicon-16x16.png, favicon-32x32.png,
apple-touch-icon.png (180, white background: iOS fills transparency with black),
icon-192.png and icon-512.png, all from the mark. Account (lotbi-web) and Admin
use the same files.
"""
from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
MARK = ROOT / "assets/brand/lotbi-mark-512.png"


def square(size: int) -> Image.Image:
    mark = Image.open(MARK).convert("RGBA")
    return mark if size == mark.width else mark.resize((size, size), Image.LANCZOS)


def apple_touch(size: int = 180, padding: float = 0.08) -> Image.Image:
    inner = round(size * (1 - 2 * padding))
    tile = Image.new("RGBA", (size, size), (255, 255, 255, 255))
    mark = square(inner)
    offset = (size - inner) // 2
    tile.alpha_composite(mark, (offset, offset))
    return tile.convert("RGB")


def build(out: Path) -> list[str]:
    out.mkdir(parents=True, exist_ok=True)
    written = []
    ico_sizes = [16, 32, 48, 64, 128, 256]
    square(256).save(out / "favicon.ico", format="ICO", sizes=[(s, s) for s in ico_sizes])
    written.append("favicon.ico")
    for size, name in ((16, "favicon-16x16.png"), (32, "favicon-32x32.png"), (192, "icon-192.png"), (512, "icon-512.png")):
        square(size).save(out / name, optimize=True)
        written.append(name)
    apple_touch().save(out / "apple-touch-icon.png", optimize=True)
    written.append("apple-touch-icon.png")
    return written


if __name__ == "__main__":
    target = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT
    print("\n".join(build(target)))
