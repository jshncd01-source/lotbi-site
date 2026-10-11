"""Browser-tab, home-screen and app icons from the official LOTBI logo character.

SITE-AVATAR-LOGO-ALIGN-01 (one character everywhere). The root icons below were
generated on 2026-09-19 from an older drawing of the character (head-and-chest
crop, no red ear); the official mark (assets/brand/lotbi-mark-512.png, the
header lockup's character) came three days later. Every page except Home
falls back to /favicon.ico, and iOS fetches /apple-touch-icon.png on its own, so
these still showed the old drawing.

Clean alpha. lotbi-mark-512.png is cut out of the white-background master
(assets/lotbi-main-logo.png) by tools/build-brand-assets.py, whose background
flood accepts anything >= 237 -- it leaks into the robot's white rim
highlights and leaves see-through crescents on the helmet, ears, arms and
body. On white that is invisible; on a dark page, dark browser tab strip or
the app's dark mode the character shows black streaks. This tool first
reproduces lotbi-mark-512.png exactly (same crop, pad and resample -- checked
byte for byte), then fills the robot's interior from the master with the
master's own colours: the strict background (>= 249) never leaks, so every
pixel two steps inside it is robot. Same picture, same place, opaque inside.

    python tools/build_site_favicons.py [out_dir] [--app-character app_brand_dir]

writes favicon.ico (16/32/48/64/128/256), favicon-16x16.png, favicon-32x32.png,
apple-touch-icon.png (180, white background: iOS fills transparency with black),
icon-192.png and icon-512.png. Account (lotbi-web) and Admin use the same files.
--app-character writes lotbi-brand-character.png (@1x 86 px high) and @2x/@3x
for the LOTBI app (apps/mobile/src/assets/brand).

Needs Pillow, numpy and scipy (dev tool; tools/ is not deployed).
"""
from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = Path(__file__).resolve().parent.parent
MASTER = ROOT / "assets/lotbi-main-logo.png"
MARK = ROOT / "assets/brand/lotbi-mark-512.png"
FOUR = ndimage.generate_binary_structure(2, 1)


def _border_flood(candidate: np.ndarray) -> np.ndarray:
    labels, _ = ndimage.label(candidate, structure=FOUR)
    edge = np.unique(np.concatenate([labels[0], labels[-1], labels[:, 0], labels[:, -1]]))
    return np.isin(labels, edge[edge > 0])


def _brand_tool_cutout(rgb: np.ndarray) -> np.ndarray:
    """tools/build-brand-assets.py's background removal (tolerance 18 + edge ramp)."""
    bg = _border_flood((rgb >= 255 - 18).all(axis=2))
    out = np.dstack([rgb, np.full(rgb.shape[:2], 255)]).astype(np.int32)
    out[bg] = (255, 255, 255, 0)
    near = np.zeros_like(bg)
    near[1:-1, 1:-1] = bg[:-2, 1:-1] | bg[2:, 1:-1] | bg[1:-1, :-2] | bg[1:-1, 2:]
    ramp = ~bg & near & (rgb >= 255 - 30).all(axis=2)
    ramp[[0, -1], :] = False
    ramp[:, [0, -1]] = False
    factor = np.clip((255 - rgb.sum(axis=2) / 3) / 12 + 0.35, 0.0, 1.0)
    out[..., 3] = np.where(ramp, (255 * factor).astype(np.int32), out[..., 3])
    return out


def _mark_square(rgba: np.ndarray, clean: bool) -> Image.Image:
    img = Image.fromarray(rgba.astype(np.uint8), "RGBA")
    lock = img.crop(img.getbbox())
    mark = lock.crop((0, 0, 490, lock.height))          # the character part of the lockup
    mark = mark.crop(mark.getbbox())
    side = max(mark.size)
    pad = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    pos = ((side - mark.width) // 2, (side - mark.height) // 2)
    if clean:
        pad.alpha_composite(mark, pos)
    else:
        pad.paste(mark, pos, mark)                      # exactly what the brand tool does
    return pad.resize((512, 512), Image.LANCZOS)


def clean_mark() -> Image.Image:
    rgb = np.asarray(Image.open(MASTER).convert("RGB")).astype(np.int32)
    cut = _brand_tool_cutout(rgb)
    official = np.asarray(Image.open(MARK).convert("RGBA"))
    if not np.array_equal(np.asarray(_mark_square(cut, clean=False)), official):
        raise SystemExit("the master no longer reproduces assets/brand/lotbi-mark-512.png -- stop")
    inside = ndimage.binary_erosion(~_border_flood((rgb >= 255 - 6).all(axis=2)), structure=FOUR, iterations=2)
    fill = inside & (cut[..., 3] < 255)
    cut[fill, :3] = rgb[fill]
    cut[fill, 3] = 255
    return _mark_square(cut, clean=True)


def square(mark: Image.Image, size: int) -> Image.Image:
    return mark if size == mark.width else mark.resize((size, size), Image.LANCZOS)


def apple_touch(mark: Image.Image, size: int = 180, padding: float = 0.08) -> Image.Image:
    inner = round(size * (1 - 2 * padding))
    tile = Image.new("RGBA", (size, size), (255, 255, 255, 255))
    offset = (size - inner) // 2
    tile.alpha_composite(square(mark, inner), (offset, offset))
    return tile.convert("RGB")


def build(out: Path, mark: Image.Image) -> list[str]:
    out.mkdir(parents=True, exist_ok=True)
    square(mark, 256).save(out / "favicon.ico", format="ICO", sizes=[(s, s) for s in (16, 32, 48, 64, 128, 256)])
    written = ["favicon.ico"]
    for size, name in ((16, "favicon-16x16.png"), (32, "favicon-32x32.png"), (192, "icon-192.png"), (512, "icon-512.png")):
        square(mark, size).save(out / name, optimize=True)
        written.append(name)
    apple_touch(mark).save(out / "apple-touch-icon.png", optimize=True)
    written.append("apple-touch-icon.png")
    return written


def build_app_character(out: Path, mark: Image.Image) -> list[str]:
    """Tight crop of the character for the app (shown with resizeMode="contain")."""
    out.mkdir(parents=True, exist_ok=True)
    figure = mark.crop(mark.getchannel("A").point(lambda a: 255 if a > 8 else 0).getbbox())
    written = []
    for scale, suffix in ((1, ""), (2, "@2x"), (3, "@3x")):
        height = 86 * scale
        image = figure.resize((round(figure.width * height / figure.height), height), Image.LANCZOS)
        name = f"lotbi-brand-character{suffix}.png"
        image.save(out / name, optimize=True)
        written.append(f"{name} {image.size[0]}x{image.size[1]}")
    return written


if __name__ == "__main__":
    args = sys.argv[1:]
    app_dir = None
    if "--app-character" in args:
        at = args.index("--app-character")
        app_dir = Path(args[at + 1])
        del args[at:at + 2]
    target = Path(args[0]) if args else ROOT
    mark = clean_mark()
    print("\n".join(build(target, mark)))
    if app_dir:
        print("\n".join(build_app_character(app_dir, mark)))
