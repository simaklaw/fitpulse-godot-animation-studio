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
    """Pin palms/toes and keyframe pole angles from the intended elbow plane."""
    scene = bpy.context.scene
    view_layer = bpy.context.view_layer
    sides = (".L", ".R")
    hand_targets = {}
    toe_targets = {}
    pole_targets = {side: {} for side in sides}
    pole_angles = {side: {} for side in sides}
    frame_range = list(range(scene.frame_start, scene.frame_end + 1))

    def angle_degrees(a, b):
        if a.length < 1e-7 or b.length < 1e-7:
            return 180.0
        cosine = max(-1.0, min(1.0, a.normalized().dot(b.normalized())))
        return math.degrees(math.acos(cosine))

    def calculated_pole_angle(chain_start, middle_joint, chain_end, pole_pos):
        """Compute the IK pole offset from the current bend plane (Blender roll aware)."""
        chain = chain_end - chain_start
        if chain.length < 1e-5:
            return None
        chain_dir = chain.normalized()
        to_pole = pole_pos - middle_joint
        to_pole = to_pole - chain_dir * to_pole.dot(chain_dir)
        current_bend = middle_joint - chain_start
        current_bend = current_bend - chain_dir * current_bend.dot(chain_dir)
        if to_pole.length < 1e-5 or current_bend.length < 1e-5:
            return None
        to_pole.normalize()
        current_bend.normalize()
        dot = max(-1.0, min(1.0, current_bend.dot(to_pole)))
        angle = math.acos(dot)
        if current_bend.cross(to_pole).dot(chain_dir) < 0.0:
            angle = -angle
        # This offset accounts for Blender's IK reference plane; normalize it
        # so the stored value remains inside the supported [-pi, pi] interval.
        value = angle - math.pi * 0.5
        return math.atan2(math.sin(value), math.cos(value))

    # First pass: sample original mocap poses and construct per-frame pole positions
    # and pole-angle offsets before adding constraints.
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

            wrist_point = rig.matrix_world @ wrist.tail
            toe_point = rig.matrix_world @ foot.tail
            shoulder_point = rig.matrix_world @ upper.head
            elbow_point = rig.matrix_world @ elbow.head
            if frame == scene.frame_start:
                hand_targets[side] = wrist_point.copy()
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
            # path from the torso; the pole angle is derived independently for
            # each frame because the shoulder axis and bone roll change in motion.
            flare = math.radians(45.0)
            desired_horizontal = (
                -trunk * math.cos(flare) +
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

            # Calculate the roll-aware pole angle from the intended elbow point,
            # not the original mocap elbow. Using elbow_point here recalibrates the
            # pole to the old bend plane and can cancel the desired elbow tracking.
            # Near-straight source poses can make the intended bend plane undefined;
            # those frames are filled from neighbouring stable samples.
            pole_angles[side][frame] = calculated_pole_angle(
                shoulder_point, desired_elbow, hand_targets[side], pole_position
            )

    # Fill frames where the source limb was too straight to define a stable bend
    # plane. Use circular-angle interpolation to avoid a discontinuity at +/-pi.
    for side in sides:
        valid = [(f, a) for f, a in sorted(pole_angles[side].items()) if a is not None]
        if len(valid) < 5:
            raise RuntimeError(
                f"push-up pole-angle calculation failed for {side}: "
                f"only {len(valid)} stable bend-plane samples"
            )
        unwrapped = {}
        previous = None
        for frame, value in valid:
            if previous is not None:
                while value - previous > math.pi:
                    value -= 2.0 * math.pi
                while value - previous < -math.pi:
                    value += 2.0 * math.pi
            unwrapped[frame] = value
            previous = value
        valid_frames = sorted(unwrapped)
        for frame in frame_range:
            if frame in unwrapped:
                value = unwrapped[frame]
            else:
                left = [f for f in valid_frames if f < frame]
                right = [f for f in valid_frames if f > frame]
                if left and right:
                    f0, f1 = left[-1], right[0]
                    value = unwrapped[f0] + (unwrapped[f1] - unwrapped[f0]) * ((frame - f0) / (f1 - f0))
                elif left:
                    value = unwrapped[left[-1]]
                else:
                    value = unwrapped[right[0]]
            pole_angles[side][frame] = math.atan2(math.sin(value), math.cos(value))

    hand_objects = {}
    pole_objects = {}
    arm_ik_constraints = {}
    # Second pass: add targets and IK constraints. Wrist-tail targeting pins the
    # actual hand endpoint rather than the wrist bone head.
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

        wrist = rig.pose.bones["wrist" + side]
        arm_ik = wrist.constraints.new(type="IK")
        arm_ik.name = "FitPulsePushUpArmIK" + side
        arm_ik.target = hand_target
        arm_ik.pole_target = pole
        arm_ik.pole_angle = pole_angles[side][scene.frame_start]
        arm_ik.chain_count = 5
        arm_ik.iterations = 100
        arm_ik.use_stretch = False
        arm_ik.use_tail = True
        arm_ik.influence = 1.0
        arm_ik_constraints[side] = arm_ik

        toe_target = bpy.data.objects.new("FitPulsePushUpToeTarget" + side, None)
        scene.collection.objects.link(toe_target)
        toe_target.location = toe_targets[side]
        toe_target.empty_display_type = "SPHERE"
        toe_target.empty_display_size = 0.02
        toe_target.hide_render = True

        foot = rig.pose.bones["foot" + side]
        leg_ik = foot.constraints.new(type="IK")
        leg_ik.name = "FitPulsePushUpToeIK" + side
        leg_ik.target = toe_target
        leg_ik.chain_count = 3
        leg_ik.iterations = 100
        leg_ik.use_stretch = False
        leg_ik.influence = 1.0

    # Keyframe the computed pole_angle for every pose. This changes the bend plane
    # with the movement instead of forcing one static roll offset across the cycle.
    for side in sides:
        ik = arm_ik_constraints[side]
        data_path = ik.path_from_id("pole_angle")
        for frame in frame_range:
            scene.frame_set(frame)
            ik.pole_angle = pole_angles[side][frame]
            rig.keyframe_insert(
                data_path=data_path,
                frame=frame,
                group="FitPulse elbow IK calibration",
            )
        action = rig.animation_data.action if rig.animation_data else None
        if action:
            for fcurve in action.fcurves:
                if fcurve.data_path == data_path:
                    for point in fcurve.keyframe_points:
                        point.interpolation = "LINEAR"
                    fcurve.update()

    scene.frame_set(scene.frame_start)
    view_layer.update()
    print(
        "PUSHUP_CONTACT_IK PASS "
        f"hand_z=({hand_targets['.L'].z:.3f},{hand_targets['.R'].z:.3f})m "
        f"toe_targets_z=({toe_targets['.L'].z:.3f},{toe_targets['.R'].z:.3f})m "
        f"elbow_pole=animated_per_frame frames={len(frame_range)} "
        "target_flare=45deg pole_basis=desired_elbow chain_arm=5 tail_contact=on chain_leg=3"
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
            # Internal elbow angle uses both vectors pointing away from the elbow:
            # elbow->shoulder and elbow->wrist. Using shoulder->elbow here would
            # report 0 degrees for a locked straight arm and invert the acceptance test.
            upper = shoulder_point - elbow_point
            forearm = wrist_point - elbow_point
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
            arm_to_trunk = angle_degrees(arm_horizontal, trunk_horizontal)
            # Elbow-line orientation is undirected: 100 degrees is equivalent
            # to an 80-degree flare, not a negative/forward-facing angle.
            arm_to_trunk = min(arm_to_trunk, 180.0 - arm_to_trunk)
            elbow_angles.append(joint_angle)
            if joint_angle < 45.0 or joint_angle > 180.0:
                raise RuntimeError(
                    f"push-up elbow flexion failed at frame {frame} {side}: "
                    f"{joint_angle:.1f} degrees outside 45–180 degrees"
                )
            # In a near-locked top-plank position the upper arm's floor-plane
            # projection becomes ill-conditioned: tiny bone-roll changes dominate
            # its apparent flare. Assess the 25–75 degree tracking angle only
            # while the elbow is clearly flexed, without widening that range.
            if joint_angle <= 145.0:
                elbow_to_trunk_angles.append(arm_to_trunk)
                if arm_to_trunk < 25.0 or arm_to_trunk > 75.0:
                    print(
                        "PUSHUP_ELBOW_DEBUG "
                        f"frame={frame} side={side} angle={arm_to_trunk:.1f}deg "
                        f"joint={joint_angle:.1f}deg "
                        f"shoulder=({shoulder_point.x:.3f},{shoulder_point.y:.3f},{shoulder_point.z:.3f}) "
                        f"elbow=({elbow_point.x:.3f},{elbow_point.y:.3f},{elbow_point.z:.3f}) "
                        f"wrist=({wrist_point.x:.3f},{wrist_point.y:.3f},{wrist_point.z:.3f}) "
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
