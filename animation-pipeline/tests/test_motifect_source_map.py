import json
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
MANIFEST = ROOT / "animation-pipeline" / "adapters" / "motifect_source_map.json"


class MotifectSourceMapContractTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.data = json.loads(MANIFEST.read_text(encoding="utf-8"))

    def test_manifest_is_explicitly_non_production(self):
        self.assertEqual(self.data["status"], "candidate_map_only")
        self.assertFalse(self.data["release_policy"]["production_ready"])

    def test_coordinate_and_retarget_decisions_are_not_guessed(self):
        source = self.data["source"]
        self.assertEqual(source["axis_conversion"], "UNRESOLVED")
        self.assertEqual(source["unit_scale"], "UNRESOLVED")
        self.assertEqual(source["rest_pose_correction"], "UNRESOLVED")
        self.assertEqual(source["root_motion_policy"], "UNRESOLVED")

    def test_candidate_map_contains_bilateral_core_limbs(self):
        mapping = self.data["candidate_bone_map"]
        for key in (
            "thigh.L", "thigh.R",
            "shin.L", "shin.R",
            "foot.L", "foot.R",
            "upper_arm.L", "upper_arm.R",
            "forearm.L", "forearm.R",
            "hand.L", "hand.R",
        ):
            self.assertIn(key, mapping)
            self.assertTrue(mapping[key])

    def test_missing_target_equivalents_are_documented(self):
        mismatch = " ".join(self.data["known_skeleton_mismatch"]).lower()
        self.assertIn("no hips bone", mismatch)
        self.assertIn("no leftupleg or rightupleg", mismatch)
        self.assertIn("name-based", mismatch)

    def test_release_gate_requires_visual_and_contact_review(self):
        gates = " ".join(self.data["required_validation_before_render_release"]).lower()
        self.assertIn("rest-pose", gates)
        self.assertIn("contact sheet", gates)
        self.assertIn("hand/implement contact", gates)
        self.assertIn("loop-seam", gates)


if __name__ == "__main__":
    unittest.main()
