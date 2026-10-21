#!/usr/bin/env python3
"""Render pilot SVG references as transparent PNGs and a dark comparison sheet."""
from __future__ import annotations

import json
import os
from pathlib import Path

import cairosvg
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(os.environ.get("OUTPUT_DIR", "output/workout-guide-pilot-references"))
MANIFEST = ROOT / "pilot-reference-manifest.json"
BG = (17, 22, 28)
CARD = (27, 34, 42)
ACCENT = (130, 235, 180)


def main() -> None:
    report = json.loads(MANIFEST.read_text(encoding="utf-8"))
    exercises = report.get("exercises", [])
    if len(exercises) != 5:
        raise RuntimeError(f"Expected 5 pilot exercises, found {len(exercises)}")
    cell_w, cell_h, label_h, margin, gap = 420, 470, 44, 24, 16
    sheet = Image.new("RGB", (margin * 2 + cell_w * 3 + gap * 2, margin * 2 + len(exercises) * (cell_h + gap) - gap), BG)
    draw = ImageDraw.Draw(sheet)
    try:
        title_font = ImageFont.truetype("DejaVuSans.ttf", 18)
        label_font = ImageFont.truetype("DejaVuSans.ttf", 14)
    except OSError:
        title_font = label_font = ImageFont.load_default()

    rendered_count = 0
    for row, exercise in enumerate(exercises):
        slug = exercise["slug"]
        frame_dir = ROOT / slug / "frames"
        preview_dir = ROOT / slug / "preview-png"
        preview_dir.mkdir(parents=True, exist_ok=True)
        sources = sorted(frame_dir.glob("frame-*.svg"), key=lambda p: int(p.stem.split("-")[-1]))
        if len(sources) != 3:
            raise RuntimeError(f"{slug}: expected 3 SVGs, found {len(sources)}")
        y = margin + row * (cell_h + gap)
        for col, source in enumerate(sources):
            target = preview_dir / f"{source.stem}.png"
            cairosvg.svg2png(url=str(source), write_to=str(target), output_width=512, output_height=512)
            with Image.open(target) as opened:
                opened.load()
                if opened.size != (512, 512) or opened.mode not in ("RGBA", "LA"):
                    raise RuntimeError(f"{target}: expected 512x512 with alpha, got {opened.size}/{opened.mode}")
                if opened.getchannel("A").getextrema() == (255, 255):
                    raise RuntimeError(f"{target}: transparency was lost")
                image = opened.convert("RGBA").copy()
            rendered_count += 1
            x = margin + col * (cell_w + gap)
            draw.rounded_rectangle((x, y, x + cell_w, y + cell_h), radius=14, fill=CARD)
            if col == 0:
                draw.text((x + 14, y + 12), exercise.get("name", slug), fill=ACCENT, font=title_font)
            draw.text((x + 14, y + 40), f"FRAME {col + 1}", fill=(190, 198, 207), font=label_font)
            image.thumbnail((cell_w - 20, cell_h - label_h - 12), Image.Resampling.LANCZOS)
            composite = Image.new("RGBA", image.size, CARD + (255,))
            composite.alpha_composite(image)
            sheet.paste(composite.convert("RGB"), (x + (cell_w - image.width) // 2, y + label_h))
    out = ROOT / "pilot-contact-sheet-dark.png"
    sheet.save(out)
    print(f"Rendered {rendered_count} transparent PNG previews.")
    print(f"Contact sheet: {out}")
    print("This is a visual reference sheet only; it does not interpolate or validate exercise biomechanics.")


if __name__ == "__main__":
    main()
