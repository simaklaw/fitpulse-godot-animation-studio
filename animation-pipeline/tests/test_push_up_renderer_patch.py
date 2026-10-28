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

    def test_pole_angle_and_wrist_endpoint_preserve_anatomical_arm_plane(self):
        # The MakeHuman rig requires a calibrated -90-degree roll; QA verifies the branch.
        self.assertIn("pole_angle = -math.pi * 0.5", self.source)
        self.assertIn("arm_ik.pole_angle = pole_angle", self.source)
        self.assertIn(
            'pole.keyframe_insert(data_path="location", frame=frame, group="FitPulse elbow tracking")',
            self.source,
        )
        self.assertIn("elbow_pole_target=animated_per_frame pole_angle=-90deg", self.source)
        self.assertIn('forearm = rig.pose.bones.get("lowerarm02" + side)', self.source)
        self.assertIn("arm_ik.chain_count = 4", self.source)
        self.assertIn("wrist_joint_contact=on", self.source)
        self.assertIn('keep_hand.name = "FitPulsePushUpStablePalm" + side', self.source)
        self.assertNotIn("calculated_pole_angle", self.source)
        self.assertNotIn("pole_angles[side][frame]", self.source)

    def test_pushup_elbow_direction_is_signed_not_mirrored(self):
        self.assertIn("trunk * math.cos(flare)", self.source)
        self.assertNotIn("min(arm_to_trunk, 180.0 - arm_to_trunk)", self.source)
        self.assertIn("elbow is", self.source)
        self.assertIn('pose["wrists"][side].z - 0.05', self.source)
        self.assertIn("signed_outward = arm_horizontal.normalized().dot(lateral_axis) * side_sign", self.source)
        self.assertIn("push-up elbow handedness failed", self.source)
        self.assertIn("pole_angle = -math.pi * 0.5", self.source)

    def test_pullup_uses_wrist_joint_and_animated_elbow_poles(self):
        self.assertIn('forearm = rig.pose.bones.get("lowerarm02" + side)', self.shared_source)
        self.assertIn('pole_target = pole', self.shared_source)
        self.assertIn("arm_ik.pole_angle = -math.pi * 0.5", self.shared_source)
        self.assertIn("pole_angle=-90deg", self.shared_source)
        self.assertIn('pole.keyframe_insert(data_path="location", frame=frame, group="FitPulse pull-up elbow tracking")', self.shared_source)
        self.assertIn('keep_hand.name = "FitPulsePullUpStablePalm" + side', self.shared_source)
        self.assertIn("hand_end_effector=wrist.head", self.shared_source)
        self.assertIn("max hand-base-to-bar distance", self.shared_source)
        self.assertIn("def assert_pull_up_finger_contact(rig, frame_end):", self.shared_source)
        self.assertIn('f"finger{finger_number}-3" + side', self.shared_source)
        self.assertIn("tolerance = 0.045", self.shared_source)
        self.assertIn("required_tips = 3", self.shared_source)
        self.assertIn("required_frame_ratio = 0.90", self.shared_source)
        self.assertIn("below_center_margin = max(0.005, bar_radius * 0.20)", self.shared_source)
        self.assertIn("under_bar = tip.z <= center.z - below_center_margin", self.shared_source)
        self.assertIn("if gap <= tolerance and under_bar:", self.shared_source)
        self.assertIn("FITPULSE_PULLUP_FINGER_CURL = {1: 58, 2: 75, 3: 58}", self.shared_source)
        self.assertIn("FITPULSE_PULLUP_THUMB_CURL = {1: 18, 2: 30, 3: 25}", self.shared_source)
        self.assertIn("FITPULSE_PULLUP_FINGER_BASE_POSES = None", self.shared_source)
        self.assertIn("FITPULSE_PULLUP_FINGER_BASE_POSES = {}", self.shared_source)
        self.assertIn("finger_bone.matrix_basis.copy()", self.shared_source)
        self.assertIn("finger_bone.matrix_basis = base_pose.copy()", self.shared_source)
        self.assertIn("FITPULSE_PULLUP_FINGER_BASE_POSES restored frame={frame}", self.shared_source)
        self.assertIn("def apply_pull_up_grip_every_frame(rig, prop_objs, frame_end):", self.shared_source)
        self.assertIn("apply_pull_up_grip_every_frame(rig, prop_objs, frame_end)", self.shared_source)
        self.assertIn("grip_bake_helper = r'''def apply_pull_up_grip_every_frame", self.shared_source)
        self.assertIn("text = text.replace(main_marker, grip_bake_helper + main_marker, 1)", self.shared_source)
        self.assertIn("PULLUP_GRIP_BAKED frames={frame_end}", self.shared_source)
        self.assertIn('point.interpolation = "LINEAR"', self.shared_source)
        self.assertIn("Source mocap animates the fingers at each exercise keyframe.", self.shared_source)
        self.assertIn("curls = FITPULSE_PULLUP_THUMB_CURL if f == 1 else FITPULSE_PULLUP_FINGER_CURL", self.shared_source)
        self.assertIn("hand_rotation = (rig.matrix_world @ wrist.matrix).to_quaternion().copy()", self.shared_source)
        self.assertIn("hand_rotations[side] = hand_rotation", self.shared_source)
        self.assertNotIn("grip_rotation = Quaternion(bar_axis, math.pi)", self.shared_source)
        self.assertNotIn("PULLUP_HAND_CONTACT_CALIBRATION", self.shared_source)
        self.assertIn("FITPULSE_PULLUP_GRIP_SIGNS[side] = (finger_sign, thumb_sign)", self.shared_source)
        self.assertIn("def _fitpulse_choose_pullup_curl_sign(rig, side, held_object, axis):", self.shared_source)
        self.assertIn("_fitpulse_choose_pullup_curl_sign(rig, side, held_object, axis)", self.shared_source)
        self.assertIn("positive={candidates[0][0]}/4 negative={candidates[1][0]}/4", self.shared_source)
        self.assertIn("tip_bone = rig.pose.bones.get(f\"finger{finger_number}-3\" + side)", self.shared_source)
        self.assertIn("_fitpulse_reset_pullup_fingers(rig, side)", self.shared_source)
        baseline_capture = self.shared_source.index(
            "FITPULSE_PULLUP_FINGER_BASE_POSES[key] = finger_bone.matrix_basis.copy()"
        )
        first_candidate_call = self.shared_source.index(
            "finger_sign = _fitpulse_choose_pullup_curl_sign(rig, side, held_object, axis)"
        )
        self.assertLess(
            baseline_capture,
            first_candidate_call,
            "capture all source finger poses before candidate curl calibration",
        )
        anim_block = self.shared_source.split("anim_new = ", 1)[1].split(
            "if text.count(anim_old", 1
        )[0]
        self.assertLess(
            anim_block.index("add_pull_up_ik(rig, hand_targets, frame_end)"),
            anim_block.index("apply_pull_up_grip_every_frame(rig, prop_objs, frame_end)"),
            "bake finger curl after wrist IK so the final contact remains stable",
        )
        self.assertNotIn("-finger_sign if finger_sign is not None else None", self.shared_source)
        self.assertNotIn("-thumb_sign if thumb_sign is not None else None", self.shared_source)
        self.assertIn("assert_pull_up_finger_contact(rig, frame_end)", self.shared_source)
        self.assertIn("pull-up finger-wrap failed", self.shared_source)
        self.assertIn("PULLUP_ARM_QA PASS", self.shared_source)
        self.assertIn("anatomical_direction = Vector((outward_sign * 0.48, 0.877, 0.0))", self.shared_source)
        self.assertNotIn("elbow_projection = shoulder + axis", self.shared_source)
        self.assertIn("pull-up elbow symmetry failed", self.shared_source)
        self.assertIn("pull-up elbow handedness failed", self.shared_source)
        self.assertIn("bend_alignment < 0.20", self.shared_source)
        self.assertIn("minimum_elbow_angle = 25.0", self.shared_source)
        self.assertIn("FitPulsePullUpStablePalm", self.shared_source)

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

    def test_elbow_angle_uses_wrist_joint_and_signed_bend_plane(self):
        # Fingertip endpoints include hand length and wrist flexion; use the
        # actual hand base for elbow geometry and reject reverse elbow folding.
        self.assertIn('"wrist_joints": wrist_joints', self.source)
        self.assertIn('wrist_joint_point = pose["wrist_joints"][side]', self.source)
        self.assertIn('forearm = wrist_joint_point - elbow_point', self.source)
        self.assertIn("preferred_bend = trunk_axis + lateral_axis * side_sign", self.source)
        self.assertIn("bend_alignment < 0.20", self.source)
        self.assertIn("push-up elbow bend direction failed", self.source)
        self.assertNotIn('wrist_point = pose["hands"][side]', self.source)

    def test_palm_plane_and_fingertip_contact_are_checked(self):
        self.assertIn("push-up fingertip-floor contact failed", self.source)
        self.assertIn("push-up palm-plane alignment failed", self.source)
        self.assertIn("math.sin(math.radians(30.0))", self.source)
        self.assertIn('"hand_tips": hand_tips', self.source)

    def test_hand_and_toe_contact_gates_remain_present(self):
        self.assertIn("push-up hand-floor contact failed", self.source)
        self.assertIn("push-up toe-floor contact failed", self.source)
        self.assertIn("push-up body-line angle failed", self.source)



    def test_skin_palette_uses_warm_muscle_tones_without_green_skin_tint(self):
        self.assertIn('"PRIMARY_COLOR = (0.95, 0.16, 0.03, 1.0)"', self.shared_source)
        self.assertIn('"PRIMARY_COLOR = (0.72, 0.39, 0.29, 1.0)"', self.shared_source)
        self.assertIn('"SECONDARY_COLOR = (0.43, 0.25, 0.21, 1.0)"', self.shared_source)
        self.assertIn("Teal remains on the separate tank-top material", self.shared_source)

    def test_pullup_corrects_inverted_overhand_palm_around_forearm_axis(self):
        self.assertIn("desired_palm_normal = Vector((0.0, -1.0, 0.0))", self.shared_source)
        self.assertIn("hand_width = pinky_base - thumb_base", self.shared_source)
        self.assertIn("Quaternion(forearm_axis.normalized(), math.pi) @ hand_rotation", self.shared_source)
        self.assertIn("PULLUP_PALM_ORIENTATION", self.shared_source)
        self.assertIn("correction_axis=forearm", self.shared_source)
        self.assertNotIn("Quaternion(bar_axis, math.pi)", self.shared_source)

    def test_pushup_legs_use_a_floor_side_knee_pole_and_stricter_body_line(self):
        self.assertIn("leg_pole_targets = {side: {} for side in sides}", self.source)
        self.assertIn('leg_pole.keyframe_insert(data_path="location", frame=frame, group="FitPulse knee tracking")', self.source)
        self.assertIn("leg_ik.pole_target = leg_pole", self.source)
        self.assertIn("leg_ik.pole_angle = -math.pi * 0.5", self.source)
        self.assertIn("leg_ik.chain_count = 5", self.source)
        self.assertIn('bpy.data.objects.new("FitPulsePushUpKneePole" + side, None)', self.source)
        self.assertIn("if body_angle > 21.0:", self.source)
        self.assertIn("if hip_dev > 0.15:", self.source)
        self.assertIn("if knee_dev > 0.12:", self.source)
        self.assertNotIn("if knee_dev > 0.25:", self.source)


    def test_pullup_inverts_cached_digit_curl_when_palm_is_corrected(self):
        self.assertIn('cached_signs = globals().get("FITPULSE_PULLUP_GRIP_SIGNS")', self.shared_source)
        self.assertIn("finger_sign = -finger_sign", self.shared_source)
        self.assertIn("thumb_sign = -thumb_sign", self.shared_source)
        self.assertIn("FITPULSE_PULLUP_GRIP_ANGLE_BONUS = {\".L\": 0.0, \".R\": 0.0}", self.shared_source)
        self.assertIn("angle_bonuses[side] = 8.0", self.shared_source)
        self.assertIn("PULLUP_GRIP_CURL_BOOST", self.shared_source)
        self.assertIn("PULLUP_GRIP_SIGN_FLIPPED", self.shared_source)

    def test_pushup_body_angle_gate_is_tightened_without_rejecting_mild_source_tilt(self):
        self.assertIn("if body_angle > 21.0:", self.source)
        self.assertNotIn("if body_angle > 24.0:", self.source)

if __name__ == "__main__":
    unittest.main()
