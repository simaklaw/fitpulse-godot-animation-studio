#!/usr/bin/env python3
"""Render SVG reference frames against a dark background for reliable visual review.

This creates review previews only; it does not interpolate or approve an animation.
"""
from __future__ import annotations

import os
from pathlib import Path

import cairosvg
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(os.environ.get("OUTPUT_DIR", "output/workout-guide-pull-up-reference"))
FRAMES = ROOT / "frames"
PREVIEWS = ROOT / "preview-png"
BG = (17, 22, 28)
CARD = (27, 34, 42)
ACCENT = (130, 235, 180)


def main() -> None:
    sources = sorted(FRAMES.glob("frame-*.svg"), key=lambda p: int(p.stem.split("-")[-1]))
    if len(sources) != 3:
        raise RuntimeError(f"Expected 3 downloaded SVGs in {FRAMES}, found {len(sources)}")
    PREVIEWS.mkdir(parents=True, exist_ok=True)
    rendered = []
    for source in sources:
        target = PREVIEWS / f"{source.stem}.png"
        cairosvg.svg2png(url=str(source), write_to=str(target), output_width=512, output_height=512)
        with Image.open(target) as image:
            image.load()
            if image.size != (512, 512):
                raise RuntimeError(f"Unexpected PNG size for {target}: {image.size}")
            if image.mode not in ("RGBA", "LA"):
                raise RuntimeError(f"Expected alpha channel in rendered preview {target}; mode={image.mode}")
            alpha = image.getchannel("A")
            if alpha.getextrema() == (255, 255):
                raise RuntimeError(f"Rendered frame {target} is fully opaque; transparency was lost")
            rendered.append(image.convert("RGBA").copy())

    cell_w, cell_h, label_h, margin, gap = 560, 600, 52, 24, 20
    sheet = Image.new("RGB", (margin * 2 + cell_w * 3 + gap * 2, margin * 2 + cell_h), BG)
    draw = ImageDraw.Draw(sheet)
    try:
        font = ImageFont.truetype("DejaVuSans.ttf", 22)
        small = ImageFont.truetype("DejaVuSans.ttf", 15)
    except OSError:
        font, small = ImageFont.load_default(), ImageFont.load_default()

    for index, image in enumerate(rendered, start=1):
        x = margin + (index - 1) * (cell_w + gap)
        y = margin
        draw.rounded_rectangle((x, y, x + cell_w, y + cell_h), radius=20, fill=CARD)
        draw.text((x + 24, y + 16), f"FRAME {index}", fill=ACCENT, font=font)
        image.thumbnail((512, 512), Image.Resampling.LANCZOS)
        # Composite only for review; individual PNGs preserve the original alpha.
        preview_bg = Image.new("RGBA", image.size, CARD + (255,))
        preview_bg.alpha_composite(image)
        sheet.paste(preview_bg.convert("RGB"), (x + (cell_w - image.width) // 2, y + label_h))
        draw.text((x + 24, y + cell_h - 30), "512 × 512 • alpha preserved in PNG", fill=(190, 198, 207), font=small)

    sheet_path = ROOT / "contact-sheet-dark.png"
    sheet.save(sheet_path, quality=95)
    print(f"Rendered {len(rendered)} transparent PNG previews.")
    print(f"Contact sheet: {sheet_path}")
    print("This preview is for visual inspection only; no interpolation or biomechanical validation performed.")


if __name__ == "__main__":
    main()
