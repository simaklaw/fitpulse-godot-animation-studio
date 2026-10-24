#!/usr/bin/env python3
"""Apply the pinned FitPulse character renderer setup and push-up-specific QA.

The shared FitPulse patch handles the renderer's character profile, activewear,
palette, framing, and transparent export. This extension adds only push-up
contact, alignment, elbow-path and loop gates; it does not add a rack or reuse
the pull-up wrist/grip constraints.
"""
from __future__ import annotations

import runpy
from pathlib import Path

SOURCE = Path("pipeline/build_exercise.py")

# Reuse the currently validated FitPulse profile/apparel/render setup. Its
# equipment and wrist-to-bar checks are gated strictly to spec.id == pull_up.
runpy.run_path("../animation-pipeline/scripts/patch_opengym3d_pullup.py", run_name="__main__")

source_text = SOURCE.read_text(encoding="utf-8")
if "def assert_push_up_pose(rig, frame_end):" in source_text:
    raise SystemExit("Push-up QA patch appears to be applied already; refusing duplicate patch")

qa = r'''
def assert_push_up_pose(rig, frame_end):
    """Gate palm/toe support, body line, elbow path, and cyclic continuity."""
    scene = bpy.context.scene
    view_layer = bpy.context.view_layer

    def bone_point(name, endpoint):
        bone = rig.pose.bones.get(name)
        if bone is None:
            raise RuntimeError(f"push-up QA: missing required rig bone {name!r}")
        return rig.matrix_world @ getattr(bone, endpoint)

    def midpoint(a, b):
        return (a + b) * 0.5

    def angle_degrees(a, b):
        if a.length < 1e-7 or b.length < 1e-7:
            raise RuntimeError("push-up QA: degenerate limb/body vector")
        cosine = max(-1.0, min(1.0, a.normalized().dot(b.normalized())))
        return math.degrees(math.acos(cosine))

    def sample(frame):
        scene.frame_set(frame)
        view_layer.update()
        wrists = {
            side: midpoint(bone_point("wrist" + side, "head"),
                           bone_point("wrist" + side, "tail"))
            for side in (".L", ".R")
        }
        toes = {side: bone_point("foot" + side, "tail") for side in (".L", ".R")}
        shoulders = midpoint(bone_point("upperarm01.L", "head"),
                             bone_point("upperarm01.R", "head"))
        hips = midpoint(bone_point("root", "head"),
                        bone_point("root", "tail"))
        ankles = midpoint(bone_point("foot.L", "head"),
                          bone_point("foot.R", "head"))
        knees = midpoint(bone_point("lowerleg01.L", "head"),
                         bone_point("lowerleg01.R", "head"))
        elbows = {
            side: bone_point("lowerarm01" + side, "head")
            for side in (".L", ".R")
        }
        elbows_outer = {
            side: bone_point("upperarm01" + side, "head")
            for side in (".L", ".R")
        }
        hands = {
            side: bone_point("wrist" + side, "tail")
            for side in (".L", ".R")
        }
        return {
            "wrists": wrists, "toes": toes, "shoulders": shoulders,
            "hips": hips, "ankles": ankles, "knees": knees,
            "elbows": elbows, "elbow_bases": elbows_outer, "hands": hands,
        }

    wrist_min = float("inf")
    wrist_max = float("-inf")
    toe_min = float("inf")
    toe_max = float("-inf")
    max_body_angle = 0.0
    max_hip_deviation = 0.0
    max_knee_deviation = 0.0
    elbow_angles = []
    elbow_to_trunk_angles = []
    first = None
    last = None

    for frame in range(1, frame_end + 1):
        pose = sample(frame)
        if first is None:
            first = pose
        last = pose

        for side, point in pose["wrists"].items():
            wrist_min = min(wrist_min, point.z)
            wrist_max = max(wrist_max, point.z)
            if point.z < -0.06 or point.z > 0.22:
                raise RuntimeError(
                    f"push-up hand-floor contact failed at frame {frame} {side}: "
                    f"wrist-centre z={point.z:.3f} m; expected [-0.06, 0.22] m"
                )
        for side, point in pose["toes"].items():
            toe_min = min(toe_min, point.z)
            toe_max = max(toe_max, point.z)
            if point.z < -0.08 or point.z > 0.24:
                raise RuntimeError(
                    f"push-up toe-floor contact failed at frame {frame} {side}: "
                    f"toe z={point.z:.3f} m; expected [-0.08, 0.24] m"
                )

        shoulder, hip, knee, ankle = (
            pose["shoulders"], pose["hips"], pose["knees"], pose["ankles"]
        )
        body_axis = ankle - shoulder
        horizontal_span = math.sqrt(body_axis.x ** 2 + body_axis.y ** 2)
        body_angle = math.degrees(math.atan2(abs(body_axis.z), max(horizontal_span, 1e-7)))
        max_body_angle = max(max_body_angle, body_angle)
        if body_angle > 24.0:
            raise RuntimeError(
                f"push-up body-line angle failed at frame {frame}: "
                f"{body_angle:.1f} degrees > 24 degrees"
            )

        line_sq = body_axis.length_squared
        if line_sq < 1e-8:
            raise RuntimeError(f"push-up body-line has zero length at frame {frame}")
        def deviation(point):
            t = max(0.0, min(1.0, (point - shoulder).dot(body_axis) / line_sq))
            return (point - (shoulder + body_axis * t)).length

        hip_dev = deviation(hip)
        knee_dev = deviation(knee)
        max_hip_deviation = max(max_hip_deviation, hip_dev)
        max_knee_deviation = max(max_knee_deviation, knee_dev)
        if hip_dev > 0.20:
            raise RuntimeError(
                f"push-up trunk line failed at frame {frame}: hip deviation "
                f"{hip_dev:.3f} m > 0.20 m"
            )
        if knee_dev > 0.25:
            raise RuntimeError(
                f"push-up leg line failed at frame {frame}: knee deviation "
                f"{knee_dev:.3f} m > 0.25 m"
            )

        for side in (".L", ".R"):
            shoulder_point = pose["elbow_bases"][side]
            elbow_point = pose["elbows"][side]
            wrist_point = pose["hands"][side]
            upper = elbow_point - shoulder_point
            forearm = wrist_point - elbow_point
            trunk = hip - shoulder
            joint_angle = angle_degrees(upper, forearm)
            arm_to_trunk = angle_degrees(upper, trunk)
            elbow_angles.append(joint_angle)
            elbow_to_trunk_angles.append(arm_to_trunk)
            if joint_angle < 45.0 or joint_angle > 180.0:
                raise RuntimeError(
                    f"push-up elbow flexion failed at frame {frame} {side}: "
                    f"{joint_angle:.1f} degrees outside 45–180 degrees"
                )
            if arm_to_trunk < 12.0 or arm_to_trunk > 88.0:
                raise RuntimeError(
                    f"push-up elbow path failed at frame {frame} {side}: "
                    f"upper-arm/trunk angle={arm_to_trunk:.1f} degrees; "
                    "expected a controlled back-and-out path (12–88 degrees)"
                )

    if first is None or last is None:
        raise RuntimeError("push-up QA: no frames were sampled")

    seam_distances = {}
    seam_points = {
        "left_wrist": ("wrists", ".L"),
        "right_wrist": ("wrists", ".R"),
        "head": ("head", None),
        "left_toe": ("toes", ".L"),
        "right_toe": ("toes", ".R"),
        "shoulders": ("shoulders", None),
        "hips": ("hips", None),
    }
    # Re-sample exact endpoints because the last loop iteration has already
    # evaluated frame_end. The first pose was captured at frame 1.
    scene.frame_set(1)
    view_layer.update()
    start_points = {
        "left_wrist": midpoint(bone_point("wrist.L", "head"), bone_point("wrist.L", "tail")),
        "right_wrist": midpoint(bone_point("wrist.R", "head"), bone_point("wrist.R", "tail")),
        "head": bone_point("head", "tail"),
        "left_toe": bone_point("foot.L", "tail"),
        "right_toe": bone_point("foot.R", "tail"),
        "shoulders": midpoint(bone_point("upperarm01.L", "head"), bone_point("upperarm01.R", "head")),
        "hips": bone_point("root", "head"),
    }
    scene.frame_set(frame_end)
    view_layer.update()
    end_points = {
        "left_wrist": midpoint(bone_point("wrist.L", "head"), bone_point("wrist.L", "tail")),
        "right_wrist": midpoint(bone_point("wrist.R", "head"), bone_point("wrist.R", "tail")),
        "head": bone_point("head", "tail"),
        "left_toe": bone_point("foot.L", "tail"),
        "right_toe": bone_point("foot.R", "tail"),
        "shoulders": midpoint(bone_point("upperarm01.L", "head"), bone_point("upperarm01.R", "head")),
        "hips": bone_point("root", "head"),
    }
    for label in start_points:
        distance = (end_points[label] - start_points[label]).length
        seam_distances[label] = distance
        if distance > 0.14:
            raise RuntimeError(
                f"push-up loop seam failed at {label}: endpoint drift "
                f"{distance:.3f} m > 0.14 m"
            )

    print(
        "PUSHUP_QA PASS "
        f"frames={frame_end} "
        f"wrist_z=[{wrist_min:.3f},{wrist_max:.3f}]m "
        f"toe_z=[{toe_min:.3f},{toe_max:.3f}]m "
        f"body_angle_max={max_body_angle:.1f}deg "
        f"hip_deviation_max={max_hip_deviation:.3f}m "
        f"knee_deviation_max={max_knee_deviation:.3f}m "
        f"elbow_angle=[{min(elbow_angles):.1f},{max(elbow_angles):.1f}]deg "
        f"elbow_trunk=[{min(elbow_to_trunk_angles):.1f},{max(elbow_to_trunk_angles):.1f}]deg "
        f"loop_drift_max={max(seam_distances.values()):.3f}m"
    )


'''
main_marker = "def main():\n"
if source_text.count(main_marker) != 1:
    raise SystemExit("Unexpected upstream main function marker; refusing unsafe push-up QA patch")
source_text = source_text.replace(main_marker, qa + main_marker, 1)

main_insert = '    side = camera_side(primary, spec)\n'
if source_text.count(main_insert) != 1:
    raise SystemExit("Unexpected camera setup marker; refusing unsafe push-up QA insertion")
source_text = source_text.replace(
    main_insert,
    '    if spec.get("id") == "push_up":\n'
    '        assert_push_up_pose(rig, frame_end)\n\n' + main_insert,
    1,
)

alpha_old = '''    # Separate transparent PNG sequence for app compositing. Keep the original
    # studio render intact for human review and MP4 preview.
    if spec.get("id") == "pull_up":'''
alpha_new = '''    # Separate transparent PNG sequence for app compositing. Keep the original
    # studio render intact for human review and MP4 preview.
    if spec.get("id") in ("pull_up", "push_up"):'''
if source_text.count(alpha_old) != 1:
    raise SystemExit("Could not locate the unique transparent-export gate; refusing unsafe push-up patch")
source_text = source_text.replace(alpha_old, alpha_new, 1)

SOURCE.write_text(source_text, encoding="utf-8")
print("Patched upstream renderer: FitPulse character/apparel pipeline plus push-up floor-contact, body-line, elbow-path, loop-seam QA, and transparent PNG export.")
