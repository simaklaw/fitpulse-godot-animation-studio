from __future__ import annotations

import io
import json
import sys
import tempfile
import unittest
import zipfile
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "animation-pipeline" / "scripts"))

from audit_animation_reference_zip import inspect_archive, write_report  # noqa: E402


def animated_webp_bytes(frame_count: int = 4, loop: int = 0) -> bytes:
    frames = []
    for index in range(frame_count):
        image = Image.new("RGBA", (48, 48), (0, 0, 0, 0))
        draw = ImageDraw.Draw(image)
        draw.rounded_rectangle((8 + index, 8, 31 + index, 39), radius=4, fill=(120, 230, 180, 255))
        frames.append(image)
    payload = io.BytesIO()
    frames[0].save(
        payload,
        format="WEBP",
        save_all=True,
        append_images=frames[1:],
        duration=[50] * frame_count,
        loop=loop,
        lossless=True,
    )
    return payload.getvalue()


class AnimationArchiveAuditorTests(unittest.TestCase):
    def make_archive(self, path: Path, include_female: bool = True) -> None:
        metadata = {
            "schema_version": 3,
            "locale": "en",
            "exercises": [{"id": "pull-up", "name": "Pull-Up", "animation": True}],
        }
        with zipfile.ZipFile(path, "w", compression=zipfile.ZIP_DEFLATED) as archive:
            archive.writestr("preview.en.json", json.dumps(metadata))
            archive.writestr("images/animations/pull-up.webp", animated_webp_bytes())
            if include_female:
                archive.writestr("female/images/animations/pull-up.webp", animated_webp_bytes())

    def test_auditor_reports_animated_pair_and_transparency(self):
        with tempfile.TemporaryDirectory() as temp:
            archive = Path(temp) / "preview.zip"
            self.make_archive(archive)
            report = inspect_archive(archive)
            self.assertEqual(report["exercise_count"], 1)
            self.assertEqual(report["clip_count"], 2)
            self.assertEqual(report["infinite_loop_count"], 2)
            self.assertEqual(report["transparent_corner_count"], 2)
            self.assertEqual(report["missing_male_female_pair"], [])
            self.assertEqual(report["metadata_without_animation"], [])
            self.assertEqual(report["frame_count_mismatches_by_profile"], [])

    def test_missing_variant_is_reported_not_hidden(self):
        with tempfile.TemporaryDirectory() as temp:
            archive = Path(temp) / "single-profile.zip"
            self.make_archive(archive, include_female=False)
            report = inspect_archive(archive)
            self.assertEqual(report["missing_male_female_pair"], ["pull-up"])

    def test_report_writes_manifest_and_human_readable_summary(self):
        with tempfile.TemporaryDirectory() as temp:
            archive = Path(temp) / "preview.zip"
            output = Path(temp) / "report"
            self.make_archive(archive)
            report = inspect_archive(archive)
            write_report(report, output)
            self.assertTrue((output / "animation-archive-audit.json").is_file())
            self.assertTrue((output / "REPORT.md").is_file())
            parsed = json.loads((output / "animation-archive-audit.json").read_text(encoding="utf-8"))
            self.assertEqual(parsed["archive_sha256"], report["archive_sha256"])

    def test_unsafe_archive_path_is_rejected(self):
        with tempfile.TemporaryDirectory() as temp:
            archive = Path(temp) / "unsafe.zip"
            with zipfile.ZipFile(archive, "w") as output:
                output.writestr("preview.en.json", json.dumps({"exercises": [{"id": "pull-up"}]}))
                output.writestr("../escaped.webp", animated_webp_bytes())
            with self.assertRaisesRegex(ValueError, "unsafe paths"):
                inspect_archive(archive)


if __name__ == "__main__":
    unittest.main()
