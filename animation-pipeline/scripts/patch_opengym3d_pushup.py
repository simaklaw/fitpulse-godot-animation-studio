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
def apply_push_up_contact_ik(rig):
    """Pin palms/toes and animate elbow pole targets along the intended plane."""
    scene = bpy.context.scene
    view_layer = bpy.context.view_layer
    sides = (".L", ".R")
    hand_targets = {}
    hand_orientations = {}
    toe_targets = {}
    pole_targets = {side: {} for side in sides}
    leg_pole_targets = {side: {} for side in sides}
    frame_range = list(range(scene.frame_start, scene.frame_end + 1))
    # The pole target itself follows the desired elbow plane on every frame.
    # The rig's pole-angle response is circular: +90 degrees selects the
    # opposite projected elbow branch. A calibrated -90 degrees gives the intended
    # backward-and-out projection; frame-by-frame QA remains the authority.
    pole_angle = -math.pi * 0.5

    # First pass: sample original mocap poses and construct per-frame pole positions.
    for frame in frame_range:
        scene.frame_set(frame)
        view_layer.update()
        root = rig.pose.bones.get("root")
        if root is None:
            raise RuntimeError("push-up contact IK: missing root bone")
        hip_point = (
            rig.matrix_world @ root.head +
            rig.matrix_world @ root.tail
        ) * 0.5

        for side in sides:
            wrist = rig.pose.bones.get("wrist" + side)
            foot = rig.pose.bones.get("foot" + side)
            upper = rig.pose.bones.get("upperarm01" + side)
            elbow = rig.pose.bones.get("lowerarm01" + side)
            if any(pb is None for pb in (wrist, foot, upper, elbow)):
                raise RuntimeError(f"push-up contact IK: incomplete rig on side {side}")

            # Anchor the wrist joint, not the fingertip end of the hand bone.
            # The hand bone stays outside the IK chain so it cannot be twisted
            # just to satisfy a palm-contact target.
            wrist_point = rig.matrix_world @ wrist.head
            toe_point = rig.matrix_world @ foot.tail
            shoulder_point = rig.matrix_world @ upper.head
            elbow_point = rig.matrix_world @ elbow.head
            if frame == scene.frame_start:
                hand_targets[side] = wrist_point.copy()
                hand_orientations[side] = (rig.matrix_world @ wrist.matrix).to_quaternion().copy()
                toe_targets[side] = Vector((toe_point.x, toe_point.y, 0.02))

            trunk = Vector((
                hip_point.x - shoulder_point.x,
                hip_point.y - shoulder_point.y,
                0.0,
            ))
            if trunk.length < 1e-5:
                raise RuntimeError(f"push-up contact IK: degenerate trunk axis on {side}")
            trunk.normalize()
            lateral = Vector((trunk.y, -trunk.x, 0.0))
            sign = 1.0 if side == ".L" else -1.0

            # The intended upper-arm projection follows a controlled 45-degree
            # path from the torso; the pole target tracks that desired plane per frame.
            flare = math.radians(45.0)
            desired_horizontal = (
                trunk * math.cos(flare) +
                lateral * sign * math.sin(flare)
            ).normalized()
            upper_delta = elbow_point - shoulder_point
            upper_length = upper_delta.length
            if upper_length < 1e-5:
                raise RuntimeError(f"push-up contact IK: degenerate upper arm on {side}")
            vertical_ratio = upper_delta.z / upper_length
            vertical_ratio = max(-0.98, min(-0.15, vertical_ratio))
            horizontal_ratio = math.sqrt(max(1e-6, 1.0 - vertical_ratio * vertical_ratio))
            desired_upper = Vector((
                desired_horizontal.x * horizontal_ratio,
                desired_horizontal.y * horizontal_ratio,
                vertical_ratio,
            )).normalized()
            desired_elbow = shoulder_point + desired_upper * upper_length

            arm_delta = hand_targets[side] - shoulder_point
            if arm_delta.length < 1e-5:
                raise RuntimeError(f"push-up contact IK: degenerate shoulder-to-wrist axis on {side}")
            arm_axis = arm_delta.normalized()
            desired_offset = desired_elbow - shoulder_point
            pole_offset = desired_offset - arm_axis * desired_offset.dot(arm_axis)
            if pole_offset.length < 1e-5:
                pole_offset = lateral - arm_axis * lateral.dot(arm_axis)
            if pole_offset.length < 1e-5:
                raise RuntimeError(f"push-up contact IK: degenerate elbow pole plane on {side}")
            pole_position = shoulder_point + arm_axis * 0.25 + pole_offset.normalized() * 0.35
            pole_targets[side][frame] = pole_position

            # Steer the complete hip-to-toe chain in a controlled floor-side
            # plane instead of inheriting the source clip's bowed knee path.
            thigh = rig.pose.bones.get("upperleg01" + side)
            if thigh is None:
                raise RuntimeError(f"push-up leg IK: missing thigh bone on {side}")
            hip_anchor = rig.matrix_world @ thigh.head
            leg_axis = toe_targets[side] - hip_anchor
            if leg_axis.length < 1e-5:
                raise RuntimeError(f"push-up leg IK: degenerate hip-to-toe axis on {side}")
            leg_axis.normalize()
            floor_direction = Vector((0.0, 0.0, -1.0))
            knee_bend_plane = floor_direction - leg_axis * floor_direction.dot(leg_axis)
            if knee_bend_plane.length < 1e-5:
                lateral_fallback = Vector((1.0, 0.0, 0.0))
                knee_bend_plane = lateral_fallback - leg_axis * lateral_fallback.dot(leg_axis)
            if knee_bend_plane.length < 1e-5:
                raise RuntimeError(f"push-up leg IK: cannot establish knee plane on {side}")
            leg_pole_targets[side][frame] = (
                (hip_anchor + toe_targets[side]) * 0.5
                + knee_bend_plane.normalized() * 0.25
            )

            # The animated pole target tracks this desired elbow plane directly.
            # Keep the IK roll offset fixed; elbow-path QA validates the resulting pose.

    # Pole angle stays fixed at the calibrated MakeHuman rig offset;
    # the target object's animated position carries the desired elbow path.

    hand_objects = {}
    pole_objects = {}
    # Second pass: add targets and IK constraints. The endpoint is the wrist joint;
    # the hand bone stays out of the solve so IK cannot twist it.
    for side in sides:
        hand_target = bpy.data.objects.new("FitPulsePushUpHandTarget" + side, None)
        scene.collection.objects.link(hand_target)
        hand_target.location = hand_targets[side]
        hand_target.empty_display_type = "SPHERE"
        hand_target.empty_display_size = 0.02
        hand_target.hide_render = True
        hand_objects[side] = hand_target

        pole = bpy.data.objects.new("FitPulsePushUpElbowPole" + side, None)
        scene.collection.objects.link(pole)
        pole.empty_display_type = "SPHERE"
        pole.empty_display_size = 0.02
        pole.hide_render = True
        for frame in frame_range:
            scene.frame_set(frame)
            pole.location = pole_targets[side][frame]
            pole.keyframe_insert(data_path="location", frame=frame, group="FitPulse elbow tracking")
        if pole.animation_data and pole.animation_data.action:
            for fcurve in pole.animation_data.action.fcurves:
                for point in fcurve.keyframe_points:
                    point.interpolation = "LINEAR"
                fcurve.update()
        pole_objects[side] = pole

        # End IK at the wrist joint (lowerarm02.tail), not at wrist.tail.
        # This leaves the palm bone out of the solve and prevents a backwards
        # wrist deformation when the shoulder moves through the rep.
        forearm = rig.pose.bones.get("lowerarm02" + side)
        wrist = rig.pose.bones.get("wrist" + side)
        if forearm is None or wrist is None:
            raise RuntimeError(f"push-up contact IK: missing distal forearm/hand on {side}")
        arm_ik = forearm.constraints.new(type="IK")
        arm_ik.name = "FitPulsePushUpArmIK" + side
        arm_ik.target = hand_target
        arm_ik.pole_target = pole
        arm_ik.pole_angle = pole_angle
        arm_ik.chain_count = 4
        arm_ik.iterations = 100
        arm_ik.use_stretch = False
        arm_ik.use_tail = True
        arm_ik.influence = 1.0

        orientation = bpy.data.objects.new("FitPulsePushUpHandOrientation" + side, None)
        scene.collection.objects.link(orientation)
        orientation.location = hand_targets[side]
        orientation.rotation_mode = "QUATERNION"
        orientation.rotation_quaternion = hand_orientations[side]
        orientation.hide_render = True
        keep_hand = wrist.constraints.new(type="COPY_ROTATION")
        keep_hand.name = "FitPulsePushUpStablePalm" + side
        keep_hand.target = orientation
        keep_hand.owner_space = "WORLD"
        keep_hand.target_space = "WORLD"

        toe_target = bpy.data.objects.new("FitPulsePushUpToeTarget" + side, None)
        scene.collection.objects.link(toe_target)
        toe_target.location = toe_targets[side]
        toe_target.empty_display_type = "SPHERE"
        toe_target.empty_display_size = 0.02
        toe_target.hide_render = True

        # A three-bone ankle-only solve cannot correct the bowed thigh/knee
        # path: include the entire leg and track a floor-side knee pole per frame.
        leg_pole = bpy.data.objects.new("FitPulsePushUpKneePole" + side, None)
        scene.collection.objects.link(leg_pole)
        leg_pole.empty_display_type = "SPHERE"
        leg_pole.empty_display_size = 0.025
        leg_pole.hide_render = True
        for frame in frame_range:
            scene.frame_set(frame)
            leg_pole.location = leg_pole_targets[side][frame]
            leg_pole.keyframe_insert(data_path="location", frame=frame, group="FitPulse knee tracking")
        if leg_pole.animation_data and leg_pole.animation_data.action:
            for fcurve in leg_pole.animation_data.action.fcurves:
                for point in fcurve.keyframe_points:
                    point.interpolation = "LINEAR"
                fcurve.update()

        foot = rig.pose.bones["foot" + side]
        leg_ik = foot.constraints.new(type="IK")
        leg_ik.name = "FitPulsePushUpToeIK" + side
        leg_ik.target = toe_target
        leg_ik.pole_target = leg_pole
        leg_ik.pole_angle = -math.pi * 0.5
        leg_ik.chain_count = 5
        leg_ik.iterations = 100
        leg_ik.use_stretch = False
        leg_ik.influence = 1.0

    scene.frame_set(scene.frame_start)
    view_layer.update()
    print(
        "PUSHUP_CONTACT_IK PASS "
        f"hand_z=({hand_targets['.L'].z:.3f},{hand_targets['.R'].z:.3f})m "
        f"toe_targets_z=({toe_targets['.L'].z:.3f},{toe_targets['.R'].z:.3f})m "
        f"elbow_pole_target=animated_per_frame pole_angle=-90deg frames={len(frame_range)} "
        "target_flare=45deg pole_basis=desired_elbow chain_arm=4 wrist_joint_contact=on "
        "chain_leg=5 knee_pole=animated_per_frame pole_angle=-90deg"
    )


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
        wrist_joints = {
            side: bone_point("wrist" + side, "head")
            for side in (".L", ".R")
        }
        hand_tips = {
            side: bone_point("wrist" + side, "tail")
            for side in (".L", ".R")
        }
        return {
            "wrists": wrists, "wrist_joints": wrist_joints, "hand_tips": hand_tips,
            "toes": toes, "shoulders": shoulders,
            "hips": hips, "ankles": ankles, "knees": knees,
            "elbows": elbows, "elbow_bases": elbows_outer,
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
            if point.z < -0.06 or point.z > 0.08:
                raise RuntimeError(
                    f"push-up toe-floor contact failed at frame {frame} {side}: "
                    f"toe z={point.z:.3f} m; expected [-0.06, 0.08] m"
                )

        shoulder, hip, knee, ankle = (
            pose["shoulders"], pose["hips"], pose["knees"], pose["ankles"]
        )
        body_axis = ankle - shoulder
        horizontal_span = math.sqrt(body_axis.x ** 2 + body_axis.y ** 2)
        body_angle = math.degrees(math.atan2(abs(body_axis.z), max(horizontal_span, 1e-7)))
        max_body_angle = max(max_body_angle, body_angle)
        if body_angle > 18.0:
            raise RuntimeError(
                f"push-up body-line angle failed at frame {frame}: "
                f"{body_angle:.1f} degrees > 18 degrees"
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
        if hip_dev > 0.12:
            raise RuntimeError(
                f"push-up trunk line failed at frame {frame}: hip deviation "
                f"{hip_dev:.3f} m > 0.12 m"
            )
        if knee_dev > 0.12:
            raise RuntimeError(
                f"push-up leg line failed at frame {frame}: knee deviation "
                f"{knee_dev:.3f} m > 0.12 m"
            )

        for side in (".L", ".R"):
            shoulder_point = pose["elbow_bases"][side]
            elbow_point = pose["elbows"][side]
            wrist_joint_point = pose["wrist_joints"][side]
            hand_tip_point = pose["hand_tips"][side]
            # Measure the elbow at the actual wrist joint, not the fingertips.
            # Using wrist.tail folds hand length and wrist bend into the elbow
            # angle and can falsely accept a backward-folded hand as a valid elbow.
            upper = shoulder_point - elbow_point
            forearm = wrist_joint_point - elbow_point
            trunk = hip - shoulder
            joint_angle = angle_degrees(upper, forearm)
            # Elbow flare is assessed in the horizontal/top-down plane, not by
            # the 3D side-view angle that naturally approaches 90 degrees.
            arm_horizontal = Vector((
                elbow_point.x - shoulder_point.x,
                elbow_point.y - shoulder_point.y,
                0.0,
            ))
            trunk_horizontal = Vector((trunk.x, trunk.y, 0.0))
            # Preserve the signed direction: a 135-degree forward fold is not
            # an acceptable substitute for a 45-degree backward-and-out path.
            arm_to_trunk = angle_degrees(arm_horizontal, trunk_horizontal)
            trunk_axis = Vector((trunk_horizontal.x, trunk_horizontal.y, 0.0))
            if trunk_axis.length < 1e-7:
                raise RuntimeError(f"push-up QA: degenerate horizontal trunk axis at frame {frame}")
            trunk_axis.normalize()
            lateral_axis = Vector((trunk_axis.y, -trunk_axis.x, 0.0))
            side_sign = 1.0 if side == ".L" else -1.0
            signed_outward = arm_horizontal.normalized().dot(lateral_axis) * side_sign

            # A valid elbow path must bend toward the feet and out from the torso,
            # not through the head/forward side. Project the elbow off the direct
            # shoulder-to-wrist-joint line and check the signed 3D bend direction.
            shoulder_to_wrist = wrist_joint_point - shoulder_point
            if shoulder_to_wrist.length < 1e-5:
                raise RuntimeError(f"push-up QA: degenerate shoulder-to-wrist axis at frame {frame} {side}")
            arm_axis = shoulder_to_wrist.normalized()
            projection_t = max(0.0, min(1.0,
                (elbow_point - shoulder_point).dot(shoulder_to_wrist) /
                shoulder_to_wrist.length_squared))
            elbow_offset = elbow_point - (shoulder_point + shoulder_to_wrist * projection_t)
            preferred_bend = trunk_axis + lateral_axis * side_sign
            expected_bend = preferred_bend - arm_axis * preferred_bend.dot(arm_axis)
            if joint_angle <= 145.0:
                if elbow_offset.length < 0.015:
                    raise RuntimeError(
                        f"push-up elbow bend direction failed at frame {frame} {side}: "
                        f"flexed elbow has only {elbow_offset.length:.3f} m offset from arm axis"
                    )
                if expected_bend.length < 1e-5:
                    raise RuntimeError(f"push-up QA: degenerate expected elbow plane at frame {frame} {side}")
                bend_alignment = elbow_offset.normalized().dot(expected_bend.normalized())
                if bend_alignment < 0.20:
                    raise RuntimeError(
                        f"push-up elbow bend direction failed at frame {frame} {side}: "
                        f"signed alignment={bend_alignment:.3f}; expected bend toward feet and out"
                    )

            # The fingertips are separate from the wrist joint; keep them close to
            # the support plane so a valid joint angle cannot hide a folded/embedded hand.
            if hand_tip_point.z < -0.05 or hand_tip_point.z > 0.10:
                raise RuntimeError(
                    f"push-up fingertip-floor contact failed at frame {frame} {side}: "
                    f"tip z={hand_tip_point.z:.3f} m; expected [-0.05, 0.10] m"
                )
            hand_axis = hand_tip_point - wrist_joint_point
            if hand_axis.length < 1e-5 or abs(hand_axis.normalized().z) > math.sin(math.radians(30.0)):
                raise RuntimeError(
                    f"push-up palm-plane alignment failed at frame {frame} {side}: "
                    f"hand axis z-ratio={abs(hand_axis.normalized().z) if hand_axis.length >= 1e-5 else 1.0:.3f}; "
                    "expected the hand/finger axis within 30 degrees of the floor plane"
                )

            elbow_angles.append(joint_angle)
            if joint_angle < 45.0 or joint_angle > 180.0:
                raise RuntimeError(
                    f"push-up elbow flexion failed at frame {frame} {side}: "
                    f"{joint_angle:.1f} degrees outside 45–180 degrees"
                )
            if elbow_point.z > shoulder_point.z + 0.10:
                raise RuntimeError(
                    f"push-up elbow direction failed at frame {frame} {side}: "
                    f"elbow is {elbow_point.z - shoulder_point.z:.3f} m above shoulder"
                )
            if elbow_point.z < pose["wrists"][side].z - 0.05:
                raise RuntimeError(
                    f"push-up elbow direction failed at frame {frame} {side}: "
                    f"elbow is below the planted wrist plane (elbow_z={elbow_point.z:.3f}, "
                    f"wrist_center_z={pose['wrists'][side].z:.3f})"
                )
            # In a near-locked top-plank position the upper arm's floor-plane
            # projection becomes ill-conditioned: tiny bone-roll changes dominate
            # its apparent flare. Assess the 25–75 degree tracking angle only
            # while the elbow is clearly flexed, without widening that range.
            if joint_angle <= 145.0:
                elbow_to_trunk_angles.append(arm_to_trunk)
                if signed_outward < math.sin(math.radians(25.0)) or signed_outward > math.sin(math.radians(75.0)):
                    raise RuntimeError(
                        f"push-up elbow handedness failed at frame {frame} {side}: "
                        f"signed outward component={signed_outward:.3f}; "
                        "expected positive outward flare on the anatomical side"
                    )
                if arm_to_trunk < 25.0 or arm_to_trunk > 75.0:
                    print(
                        "PUSHUP_ELBOW_DEBUG "
                        f"frame={frame} side={side} angle={arm_to_trunk:.1f}deg "
                        f"joint={joint_angle:.1f}deg "
                        f"shoulder=({shoulder_point.x:.3f},{shoulder_point.y:.3f},{shoulder_point.z:.3f}) "
                        f"elbow=({elbow_point.x:.3f},{elbow_point.y:.3f},{elbow_point.z:.3f}) "
                        f"wrist_joint=({wrist_joint_point.x:.3f},{wrist_joint_point.y:.3f},{wrist_joint_point.z:.3f}) "
                        f"trunk=({trunk.x:.3f},{trunk.y:.3f},{trunk.z:.3f})"
                    )
                    raise RuntimeError(
                        f"push-up elbow path failed at frame {frame} {side}: "
                        f"horizontal upper-arm/trunk angle={arm_to_trunk:.1f} degrees "
                        f"with elbow flexion={joint_angle:.1f} degrees; "
                        "expected a controlled back-and-out path (25–75 degrees)"
                    )

    if first is None or last is None:
        raise RuntimeError("push-up QA: no frames were sampled")
    if len(elbow_to_trunk_angles) < 5:
        raise RuntimeError(
            "push-up elbow-path QA needs at least 5 flexed-arm samples "
            f"(elbow angle <=145 degrees); observed {len(elbow_to_trunk_angles)}"
        )

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
        f"elbow_abduction=[{min(elbow_to_trunk_angles):.1f},{max(elbow_to_trunk_angles):.1f}]deg "
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
retime_push_up = '''    if spec.get("id") == "push_up":
        # The reference clip is 46 source frames (~1.53 s at 30 fps), too fast
        # for the catalog's controlled 3.2 s teaching cycle. Stretch the baked
        # retarget action in frame time; do not skip source poses or alter joint
        # angles. Keep fps at 30 so GLB, video, and transparent frames agree.
        source_frame_end = frame_end
        fps = float(spec.get("fps", 30))
        target_duration = float(spec.get("duration", 3.2))
        target_frame_end = 1 + int(round(target_duration * fps))
        if source_frame_end < 2 or target_frame_end < source_frame_end:
            raise RuntimeError(
                f"push-up retime invalid: source frames={source_frame_end}, "
                f"target frames={target_frame_end}"
            )
        scale = (target_frame_end - 1) / (source_frame_end - 1)
        for owner in [rig] + [obj for obj, _ in prop_objs]:
            action = owner.animation_data.action if owner.animation_data else None
            if action is None:
                continue
            for fcurve in action.fcurves:
                for point in fcurve.keyframe_points:
                    point.co.x = 1.0 + (point.co.x - 1.0) * scale
                    point.handle_left.x = 1.0 + (point.handle_left.x - 1.0) * scale
                    point.handle_right.x = 1.0 + (point.handle_right.x - 1.0) * scale
                fcurve.update()
        frame_end = target_frame_end
        scene.frame_start, scene.frame_end = 1, frame_end
        scene.frame_step = 1
        scene.frame_set(1)
        actual_duration = (frame_end - 1) / fps
        if abs(actual_duration - target_duration) > 0.02:
            raise RuntimeError(
                f"push-up retime duration mismatch: {actual_duration:.3f}s "
                f"vs target {target_duration:.3f}s"
            )
        print(
            f"PUSHUP_RETIME PASS source_frames={source_frame_end} "
            f"output_frames={frame_end} duration={actual_duration:.3f}s fps={fps:g}"
        )
        apply_push_up_contact_ik(rig)
        assert_push_up_pose(rig, frame_end)

'''
if source_text.count(main_insert) != 1:
    raise SystemExit("Unexpected camera setup marker; refusing unsafe push-up retime")
source_text = source_text.replace(
    main_insert,
    retime_push_up + main_insert,
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
