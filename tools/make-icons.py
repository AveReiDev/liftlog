#!/usr/bin/env python3
"""
Generates the app icons. Dev tooling, not part of the app: run it once and
commit the PNGs.

    python3 tools/make-icons.py

Design: plate-blue field, a white barbell with bumper-yellow inner plates.
Colours are taken from styles/tokens.css.
"""

import os
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(os.path.dirname(HERE), "icons")

BG = (31, 95, 209, 255)       # --accent
FG = (255, 255, 255, 255)
PR = (242, 178, 0, 255)       # --pr


def draw(size, safe=1.0):
    """safe < 1 shrinks the artwork into the maskable-icon safe zone."""
    s = 4  # supersample, then downscale for smooth edges
    W = size * s
    img = Image.new("RGBA", (W, W), BG)
    d = ImageDraw.Draw(img)
    c = W / 2
    k = W * 0.30 * safe          # half-length of the bar
    bar = W * 0.035 * safe
    d.rounded_rectangle([c - k * 1.25, c - bar, c + k * 1.25, c + bar], radius=bar, fill=FG)
    # plates: outer (white, tall) and inner (yellow, shorter), both sides
    for side in (-1, 1):
        for off, half_h, w, col in ((0.62, 0.17, 0.075, FG), (0.80, 0.12, 0.06, PR)):
            x = c + side * k * off
            ww = W * w * safe / 2
            hh = W * half_h * safe
            d.rounded_rectangle([x - ww, c - hh, x + ww, c + hh], radius=ww * 0.6, fill=col)
        cx = c + side * k * 1.0
        d.rounded_rectangle([cx - W * 0.012 * safe, c - W * 0.05 * safe, cx + W * 0.012 * safe, c + W * 0.05 * safe], radius=W * 0.01, fill=FG)
    return img.resize((size, size), Image.LANCZOS)


def main():
    os.makedirs(OUT, exist_ok=True)
    for size in (180, 192, 512):
        draw(size).save(os.path.join(OUT, f"icon-{size}.png"))
    draw(512, safe=0.78).save(os.path.join(OUT, "icon-maskable-512.png"))
    print("wrote icons to", OUT)


if __name__ == "__main__":
    main()
