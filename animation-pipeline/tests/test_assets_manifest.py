from __future__ import annotations

import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "animation-pipeline" / "scripts"))

from validate_assets_manifest import validate  # noqa: E402


class AssetsManifestTests(unittest.TestCase):
    def test_manifest_passes_schema_and_path_gates(self):
        errors = validate(
            ROOT / "animation-pipeline/catalog/assets_manifest.json",
            ROOT / "animation-pipeline/catalog/assets_manifest.schema.json",
        )
        self.assertEqual(errors, [], msg="; ".join(errors))

    def test_four_scn_entries_present(self):
        import json

        data = json.loads(
            (ROOT / "animation-pipeline/catalog/assets_manifest.json").read_text(encoding="utf-8")
        )
        scn = [a for a in data["assets"] if a["kind"] == "godot_import_cache"]
        self.assertEqual(len(scn), 4)
        mapped = {a["maps_to_exercise"] for a in scn}
        self.assertEqual(
            mapped,
            {
                "bodyweight_squat",
                "push_up",
                "standing_oblique_twists",
                "hanging_leg_raises",
            },
        )
