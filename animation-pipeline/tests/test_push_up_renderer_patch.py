from __future__ import annotations

import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PATCH = ROOT / "animation-pipeline" / "scripts" / "patch_opengym3d_pushup.py"


class PushUpRendererPatchTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.source = PATCH.read_text(encoding="utf-8")

    def test_pole_angle_uses_intended_elbow_not_original_mocap_elbow(self):
        # The generated Blender patch must calibrate the pole from the target bend
        # plane. Calibrating from elbow_point (the source pose) can cancel the
        # intended flare and caused the recurring 23–24 degree QA failure.
        expected = re.compile(
            r"pole_angles\[side\]\[frame\]\s*=\s*calculated_pole_angle\(\s*"
            r"shoulder_point,\s*desired_elbow,\s*hand_targets\[side\],\s*"
            r"pole_position\s*\)",
            re.MULTILINE,
        )
        self.assertRegex(self.source, expected)
        self.assertNotRegex(
            self.source,
            r"pole_angles\[side\]\[frame\]\s*=\s*calculated_pole_angle\(\s*"
            r"shoulder_point,\s*elbow_point,\s*hand_targets\[side\],\s*"
            r"pole_position\s*\)",
        )

    def test_elbow_path_acceptance_range_is_not_relaxed(self):
        self.assertIn(
            "if arm_to_trunk < 25.0 or arm_to_trunk > 75.0:",
            self.source,
        )
        self.assertIn(
            "expected a controlled back-and-out path (25–75 degrees)",
            self.source,
        )

    def test_hand_and_toe_contact_gates_remain_present(self):
        self.assertIn("push-up hand-floor contact failed", self.source)
        self.assertIn("push-up toe-floor contact failed", self.source)
        self.assertIn("push-up body-line angle failed", self.source)


if __name__ == "__main__":
    unittest.main()
