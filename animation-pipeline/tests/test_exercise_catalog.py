from __future__ import annotations

import copy
import json
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "animation-pipeline" / "scripts"))

from validate_exercise_catalog import CatalogValidationError, validate_catalog, validate_legacy_pull_up_spec  # noqa: E402


def load(relative: str):
    return json.loads((ROOT / relative).read_text(encoding="utf-8"))


class ExerciseCatalogTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.catalog = load("animation-pipeline/catalog/exercise_catalog.json")
        cls.schema = load("animation-pipeline/catalog/exercise-catalog.schema.json")

    def test_catalog_passes_schema_and_semantic_gates(self):
        summary = validate_catalog(self.catalog, self.schema, ROOT)
        self.assertGreaterEqual(summary["exercise_count"], 8)
        self.assertGreater(summary["home_capable"], 0)
        self.assertGreater(summary["gym_capable"], 0)

    def test_existing_pull_up_renderer_spec_stays_valid(self):
        count = validate_legacy_pull_up_spec(ROOT / "animation-pipeline/exercises/pull_up.json")
        self.assertGreaterEqual(count, 5)

    def test_duplicate_exercise_id_is_rejected(self):
        broken = copy.deepcopy(self.catalog)
        broken["exercises"][1]["id"] = broken["exercises"][0]["id"]
        with self.assertRaisesRegex(CatalogValidationError, "Duplicate exercise IDs"):
            validate_catalog(broken, self.schema, ROOT)

    def test_non_monotonic_phase_order_is_rejected(self):
        broken = copy.deepcopy(self.catalog)
        broken["exercises"][0]["movement"]["phases"][2]["time"] = 0.1
        with self.assertRaisesRegex(CatalogValidationError, "phase times must be monotonic"):
            validate_catalog(broken, self.schema, ROOT)

    def test_human_approval_needs_review_evidence(self):
        broken = copy.deepcopy(self.catalog)
        broken["exercises"][0]["production_status"] = "human_approved"
        broken["exercises"][0]["human_review_evidence"] = None
        with self.assertRaisesRegex(CatalogValidationError, "human_approved requires human_review_evidence"):
            validate_catalog(broken, self.schema, ROOT)

    def test_remote_media_path_is_rejected(self):
        broken = copy.deepcopy(self.catalog)
        broken["exercises"][0]["media_profiles"]["male"]["poster"] = "https://example.invalid/poster.png"
        with self.assertRaisesRegex(CatalogValidationError, "repository-local"):
            validate_catalog(broken, self.schema, ROOT)

    def test_looping_movement_requires_loop_flag(self):
        broken = copy.deepcopy(self.catalog)
        broken["exercises"][0]["movement"]["loop"] = False
        with self.assertRaisesRegex(CatalogValidationError, "repetition/cycle assets must declare loop=true"):
            validate_catalog(broken, self.schema, ROOT)


if __name__ == "__main__":
    unittest.main()
