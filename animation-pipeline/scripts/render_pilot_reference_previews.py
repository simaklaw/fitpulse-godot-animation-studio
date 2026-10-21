#!/usr/bin/env python3
"""Render pinned pilot SVG references and emit a machine-readable QA report."""
from __future__ import annotations

import hashlib
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


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def main() -> None:
    report = json.loads(MANIFEST.read_text(encoding="utf-8"))
    exercises = report.get("exercises", [])
    if len(exercises) != 5:
        raise RuntimeError(f"Expected 5 pilot exercises, found {len(exercises)}")

    cell_w, cell_h, label_h, margin, gap = 420, 470, 44, 24, 16
    sheet = Image.new(
        "RGB",
        (margin * 2 + cell_w * 3 + gap * 2,
         margin * 2 + len(exercises) * (cell_h + gap) - gap),
        BG,
    )
    draw = ImageDraw.Draw(sheet)
    try:
        title_font = ImageFont.truetype("DejaVuSans.ttf", 18)
        label_font = ImageFont.truetype("DejaVuSans.ttf", 14)
    except OSError:
        title_font = label_font = ImageFont.load_default()

    rendered_count = 0
    validations = []
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
                alpha = opened.getchannel("A")
                if alpha.getextrema() == (255, 255):
                    raise RuntimeError(f"{target}: transparency was lost")
                alpha_bbox = alpha.getbbox()
                if alpha_bbox is None:
                    raise RuntimeError(f"{target}: image is fully transparent")
                alpha_pixels = sum(1 for value in alpha.getdata() if value > 0)
                image = opened.convert("RGBA").copy()

            validations.append({
                "exercise_slug": slug,
                "frame": col + 1,
                "svg": str(source.relative_to(ROOT)),
                "png": str(target.relative_to(ROOT)),
                "width": 512,
                "height": 512,
                "mode": "RGBA",
                "alpha_present": True,
                "alpha_nonempty": True,
                "alpha_bbox": list(alpha_bbox),
                "nontransparent_pixel_count": alpha_pixels,
                "png_sha256": sha256(target),
                "result": "PASS",
            })
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
    qa = {
        "status": "PASS",
        "scope": "file structure, PNG dimensions, alpha channel, non-empty pixels, and deterministic hashes only",
        "exercise_count": len(exercises),
        "expected_frames_per_exercise": 3,
        "rendered_frame_count": rendered_count,
        "all_frames_pass": len(validations) == 15 and all(item["result"] == "PASS" for item in validations),
        "frames": validations,
        "contact_sheet": {
            "path": str(out.relative_to(ROOT)),
            "width": sheet.width,
            "height": sheet.height,
            "sha256": sha256(out),
        },
        "not_checked": [
            "visual quality and exercise-specific pose correctness",
            "smooth interpolation, timing, and loop continuity",
            "distinct male/female character variants",
            "Godot import/runtime and Android device performance",
            "license suitability for redistribution in FitPulse",
        ],
    }
    (ROOT / "pilot-asset-qa-report.json").write_text(json.dumps(qa, indent=2) + "\n", encoding="utf-8")
    print(f"Rendered {rendered_count} transparent PNG previews.")
    print(f"Contact sheet: {out}")
    print(f"QA report: {ROOT / 'pilot-asset-qa-report.json'}")
    print("Static asset checks passed; visual and biomechanical review remains pending.")


if __name__ == "__main__":
    main()
