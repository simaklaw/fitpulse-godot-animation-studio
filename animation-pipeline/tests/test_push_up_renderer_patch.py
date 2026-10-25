from __future__ import annotations

import json
import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PATCH = ROOT / "animation-pipeline" / "scripts" / "patch_opengym3d_pushup.py"
SHARED_PATCH = ROOT / "animation-pipeline" / "scripts" / "patch_opengym3d_pullup.py"
WORKFLOW = ROOT / ".github" / "workflows" / "push-up-prototype.yml"
PULLUP_WORKFLOW = ROOT / ".github" / "workflows" / "pull-up-prototype.yml"


class PushUpRendererPatchTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.source = PATCH.read_text(encoding="utf-8")
        cls.shared_source = SHARED_PATCH.read_text(encoding="utf-8")
        cls.workflow_source = WORKFLOW.read_text(encoding="utf-8")
        cls.pullup_workflow_source = PULLUP_WORKFLOW.read_text(encoding="utf-8")

    def test_pole_angle_is_explicit_and_pole_target_remains_animated(self):
        # The MakeHuman rig uses a fixed calibrated roll offset. The pole target's
        # position, not a self-referential plane calculation, tracks the elbow path.
        self.assertIn("pole_angle = -math.pi * 0.5", self.source)
        self.assertIn("arm_ik.pole_angle = pole_angle", self.source)
        self.assertIn(
            'pole.keyframe_insert(data_path="location", frame=frame, group="FitPulse elbow tracking")',
            self.source,
        )
        self.assertIn("elbow_pole_target=animated_per_frame pole_angle=-90deg", self.source)
        self.assertNotIn("calculated_pole_angle", self.source)
        self.assertNotIn("pole_angles[side][frame]", self.source)

    def test_elbow_path_acceptance_range_is_not_relaxed(self):
        self.assertIn(
            "if arm_to_trunk < 25.0 or arm_to_trunk > 75.0:",
            self.source,
        )
        self.assertIn(
            "expected a controlled back-and-out path (25–75 degrees)",
            self.source,
        )

    def test_female_hair_texture_is_recolored_without_changing_alpha(self):
        # The female hairstyle's source albedo contains bright purple streaks.
        # The renderer should color-grade a copied image, retain alpha, and log the
        # result so the emitted GLB can be audited from its build log.
        self.assertIn("def normalize_female_hair_texture(hair_object):", self.shared_source)
        self.assertIn("palette=natural_chestnut", self.shared_source)
        self.assertIn("rgba[:, 0] = np.clip(2.40 * luminance", self.shared_source)
        self.assertIn("rgba[:, 1] = np.clip(0.70 * luminance", self.shared_source)
        self.assertIn("rgba[:, 2] = np.clip(0.20 * luminance", self.shared_source)
        self.assertIn("natural_image.pixels.foreach_set(pixels)", self.shared_source)
        self.assertIn("node.type != \"TEX_IMAGE\"", self.shared_source)
        self.assertIn("flush=True", self.shared_source)
        self.assertIn("original_alpha = rgba[:, 3].copy()", self.shared_source)
        self.assertIn("rgba[:, 3] = original_alpha", self.shared_source)
        self.assertIn("natural_image.save()", self.shared_source)
        self.assertIn("bpy.data.images.load(output_path, check_existing=False)", self.shared_source)
        self.assertIn("node.image = exported_image", self.shared_source)
        self.assertIn("saved_reloaded=true", self.shared_source)
        self.assertIn("HAIR_COLOR_GRADED gender=female palette=natural_chestnut", self.shared_source)


    def test_female_hair_visual_qa_covers_render_and_embedded_gltf(self):
        # A correct in-memory edit is insufficient if glTF serializes stale pixels.
        self.assertIn("natural_image.save()", self.shared_source)
        self.assertIn("bpy.data.images.load(output_path, check_existing=False)", self.shared_source)
        self.assertIn("saved_reloaded=true", self.shared_source)
        self.assertIn("HAIR_COLOR_VISUAL_QA PASS", self.workflow_source)
        self.assertIn("fitpulse_female_hair_chestnut", self.workflow_source)
        self.assertIn("HAIR_GLTF_TEXTURE_QA PASS", self.workflow_source)
        self.assertIn("Female GLB embedded hair texture failed", self.workflow_source)
        self.assertIn('chunk_type == b"BIN\\x00"', self.workflow_source)

    def test_bottom_phase_and_keyframe_match_catalog_timing(self):
        spec = json.loads((ROOT / "animation-pipeline" / "exercises" / "push_up.json").read_text(encoding="utf-8"))
        catalog = json.loads((ROOT / "animation-pipeline" / "catalog" / "exercise_catalog.json").read_text(encoding="utf-8"))
        catalog_exercise = next(item for item in catalog["exercises"] if item["id"] == "push_up")
        spec_bottom = next(item for item in spec["phases"] if item["id"] == "bottom")
        catalog_bottom = next(item for item in catalog_exercise["movement"]["phases"] if item["id"] == "bottom")
        self.assertAlmostEqual(spec_bottom["time"], catalog_bottom["time"], places=4)
        self.assertIn(spec_bottom["time"], [frame["t"] for frame in spec["keyframes"]])

    def test_workflow_disables_checkout_credential_persistence(self):
        self.assertEqual(self.workflow_source.count("uses: actions/checkout@v4"), 3)
        self.assertEqual(self.workflow_source.count("persist-credentials: false"), 3)
        self.assertEqual(self.pullup_workflow_source.count("uses: actions/checkout@v4"), 3)
        self.assertEqual(self.pullup_workflow_source.count("persist-credentials: false"), 3)

    def test_pull_up_workflow_gates_female_hair_color_in_render_and_embedded_gltf(self):
        self.assertIn("HAIR_COLOR_VISUAL_QA PASS", self.pullup_workflow_source)
        self.assertIn("fitpulse_female_hair_chestnut", self.pullup_workflow_source)
        self.assertIn("HAIR_GLTF_TEXTURE_QA PASS", self.pullup_workflow_source)
        self.assertIn("Female GLB embedded hair texture failed", self.pullup_workflow_source)
        self.assertIn('chunk_type == b"BIN\\x00"', self.pullup_workflow_source)
        # The workflow runs in upstream/, so generated outputs must resolve one
        # directory above rather than in upstream/output/.
        self.assertIn('thumbnail_path = Path("../output/female/pull_up.png")', self.pullup_workflow_source)
        self.assertIn('glb_path = Path("../output/female/pull_up.glb")', self.pullup_workflow_source)

    def test_hand_and_toe_contact_gates_remain_present(self):
        self.assertIn("push-up hand-floor contact failed", self.source)
        self.assertIn("push-up toe-floor contact failed", self.source)
        self.assertIn("push-up body-line angle failed", self.source)


if __name__ == "__main__":
    unittest.main()
