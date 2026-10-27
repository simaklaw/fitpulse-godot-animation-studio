from __future__ import annotations

import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
WORKFLOWS = {
    "pull-up": ROOT / ".github" / "workflows" / "publish-pull-up-app-media.yml",
    "push-up": ROOT / ".github" / "workflows" / "publish-push-up-app-media.yml",
}


class MediaPublicationWorkflowTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.sources = {name: path.read_text(encoding="utf-8") for name, path in WORKFLOWS.items()}

    def test_publishers_only_consume_successful_main_branch_builds(self):
        for exercise, source in self.sources.items():
            with self.subTest(exercise=exercise):
                self.assertIn("workflow_run:", source)
                self.assertIn("types:", source)
                self.assertIn("- completed", source)
                self.assertIn("branches:", source)
                self.assertIn("- main", source)
                self.assertIn("github.event.workflow_run.conclusion == 'success'", source)
                self.assertIn("github.event.workflow_run.head_branch == 'main'", source)

    def test_publishers_download_both_gender_artifacts_from_triggering_run(self):
        expected = {
            "pull-up": ("fitpulse-pull-up-male", "fitpulse-pull-up-female"),
            "push-up": ("fitpulse-push-up-male", "fitpulse-push-up-female"),
        }
        for exercise, source in self.sources.items():
            with self.subTest(exercise=exercise):
                for artifact in expected[exercise]:
                    self.assertIn(f"name: {artifact}", source)
                self.assertGreaterEqual(source.count("run-id: ${{ github.event.workflow_run.id }}"), 2)
                self.assertGreaterEqual(source.count("github-token: ${{ secrets.GITHUB_TOKEN }}"), 2)

    def test_export_is_gated_on_video_metadata_and_loop_continuity(self):
        expected = {
            "pull-up": ("nb_frames=72", "pull_up.mp4", "PULLUP_ARM_QA PASS frames=72"),
            "push-up": ("nb_frames=97", "push_up.mp4", "PUSHUP_QA PASS frames=97"),
        }
        for exercise, source in self.sources.items():
            frames, output_name, pose_gate = expected[exercise]
            with self.subTest(exercise=exercise):
                self.assertIn("width=720", source)
                self.assertIn("height=720", source)
                self.assertIn("r_frame_rate=30/1", source)
                self.assertIn(frames, source)
                self.assertIn(output_name, source)
                self.assertIn(pose_gate, source)
                if exercise == "pull-up":
                    self.assertIn("GRIP_CONTACT pull_up: left=72/72 right=72/72", source)
                self.assertIn("MP4_LOOP_SEAM_PASS", source)
                self.assertIn("mean_absolute_rgb_difference", source)
                self.assertIn("limit = 3.0", source)
                self.assertIn("loopSeamMaxMeanAbsoluteRgbDifference", source)

    def test_payload_contains_hash_manifest_and_gender_specific_outputs(self):
        for exercise, source in self.sources.items():
            slug = exercise
            with self.subTest(exercise=exercise):
                self.assertIn(f"assets/fitpulse/{slug}/male", source)
                self.assertIn(f"assets/fitpulse/{slug}/female", source)
                self.assertIn("manifest.json", source)
                self.assertIn("sha256", source)
                self.assertIn("videoSha256", source)
                self.assertIn("posterSha256", source)

    def test_cc_by_attributions_are_preserved_in_published_manifest(self):
        for exercise, source in self.sources.items():
            with self.subTest(exercise=exercise):
                self.assertIn("Elvaerwyn", source)
                self.assertIn("Punkduck", source)
                self.assertIn("CC-BY", source)
                self.assertIn("attribution", source)
        self.assertIn("CC0 1.0 Universal", self.sources["push-up"])


if __name__ == "__main__":
    unittest.main()
