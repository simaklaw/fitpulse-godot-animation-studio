"""Patch the pinned OpenGym3D Blender pipeline for a fixed pull-up rack.

Adds a static procedural rack only; it does not change the upstream rig,
keyframe maths, character, materials, GLB exporter, or joint QA.
"""
from pathlib import Path
import re

source = Path("pipeline/build_exercise.py")
text = source.read_text()

place_old = '    for obj, anchor in prop_objs:\n        obj.location = wrist(anchor) if anchor in (".L", ".R") else mid\n'
place_new = '    for obj, anchor in prop_objs:\n        if anchor == "static":\n            continue\n        obj.location = wrist(anchor) if anchor in (".L", ".R") else mid\n'
if text.count(place_old) != 1:
    raise SystemExit("Unexpected upstream place_props implementation; refusing an unsafe patch")
text = text.replace(place_old, place_new, 1)

# Improve the delivered motion preview rather than leaving the upstream watch-sized
# render as the only video. The GLB animation remains unchanged.
# Match each setting independently because upstream has changed frame_step formatting
# between revisions; fail closed unless every expected setting appears exactly once.
quality_rules = [
    # Target the preview-specific values only. Upstream also sets a 512px
    # thumbnail earlier in the file, which must remain untouched.
    (r"(?m)^(\s*scene\.render\.resolution_x\s*=\s*scene\.render\.resolution_y\s*=\s*)240\s*$", r"\g<1>720", "preview resolution"),
    (r"(?m)^(\s*scene\.cycles\.samples\s*=\s*)12\s*$", r"\g<1>8", "preview Cycles samples"),
    (r"(?m)^(\s*scene\.frame_step\s*=\s*)2(\s*(?:#.*)?)$", r"\g<1>1\g<2>", "preview frame step"),
]
for pattern, replacement, label in quality_rules:
    text, count = re.subn(pattern, replacement, text)
    if count != 1:
        raise SystemExit(f"Expected exactly one upstream {label} setting; found {count}; refusing an unsafe quality patch")

helper = r'''def build_pull_up_rig():
    """Create a stationary powder-coated rack used only by the pull-up spec."""
    steel = make_material("Pull-up rig steel", (0.095, 0.115, 0.135, 1.0), roughness=0.3)
    objects = []

    bpy.ops.mesh.primitive_cylinder_add(
        vertices=48, radius=0.028, depth=1.8,
        location=(0.0, -0.025, 2.453), rotation=(0.0, math.pi / 2, 0.0))
    bar = bpy.context.active_object
    bar.name = "PullUpBar"
    bar.data.materials.append(steel)
    objects.append(bar)

    for x, side in ((-0.9, "L"), (0.9, "R")):
        bpy.ops.mesh.primitive_cylinder_add(
            vertices=32, radius=0.036, depth=2.453,
            location=(x, -0.025, 1.2265))
        post = bpy.context.active_object
        post.name = "PullUpPost_" + side
        post.data.materials.append(steel)
        objects.append(post)

        bpy.ops.mesh.primitive_cube_add(size=1.0, location=(x, -0.025, 0.04))
        foot = bpy.context.active_object
        foot.name = "PullUpBase_" + side
        foot.dimensions = (0.34, 0.46, 0.08)
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
        foot.data.materials.append(steel)
        objects.append(foot)

    return objects


'''
if "def build_pull_up_rig():" in text:
    raise SystemExit("The pull-up rack patch appears to have already been applied")
needle = "def place_props(rig, prop_objs, frame):\n"
if text.count(needle) != 1:
    raise SystemExit("Could not locate the upstream place_props function")
text = text.replace(needle, helper + needle, 1)

contact_helper = r'''def assert_pull_up_bar_contact(rig, frame_end):
    """Check wrist-to-fixed-bar distance at every rendered frame."""
    scene = bpy.context.scene
    worst = 0.0
    worst_at = None
    for frame in range(1, frame_end + 1):
        scene.frame_set(frame)
        for side in (".L", ".R"):
            wrist = rig.pose.bones.get("wrist" + side)
            if wrist is None:
                raise RuntimeError(f"pull-up contact gate: missing wrist{side}")
            point = rig.matrix_world @ wrist.tail
            radial = math.sqrt((point.y + 0.025) ** 2 + (point.z - 2.453) ** 2)
            beyond_bar = max(0.0, abs(point.x) - 0.88)
            distance = math.sqrt(radial ** 2 + beyond_bar ** 2)
            print(f"CONTACT_FRAME frame={frame} side={side} wrist=({point.x:.3f},{point.y:.3f},{point.z:.3f}) bar=({0.0:.3f},{-0.025:.3f},{2.453:.3f}) distance={distance:.3f}")
            if distance > worst:
                worst = distance
                worst_at = (frame, side, tuple(round(v, 3) for v in point))
    limit = 0.08
    print(f"CONTACT pull_up: max wrist-to-bar distance {worst:.3f} m at {worst_at}; limit {limit:.2f} m")
    if worst > limit:
        raise RuntimeError(f"pull-up hand-to-bar contact failed: {worst:.3f} m > {limit:.2f} m")


'''
if text.count(needle) != 1:
    raise SystemExit("Could not locate the upstream prop helper insertion point")
ik_helper = r'''def add_pull_up_ik(rig):
    """Solve both hand endpoints against fixed targets on the pull-up bar."""
    scene = bpy.context.scene
    targets = []
    for x, side in ((-0.235, ".L"), (0.235, ".R")):
        target = bpy.data.objects.new("PullUpIKTarget" + side, None)
        scene.collection.objects.link(target)
        target.location = (x, -0.025, 2.453)
        target.empty_display_type = "SPHERE"
        target.empty_display_size = 0.025
        target.hide_render = True
        targets.append(target)

        wrist = rig.pose.bones.get("wrist" + side)
        if wrist is None:
            raise RuntimeError(f"pull-up IK gate: missing wrist{side}")
        constraint = wrist.constraints.new(type="IK")
        constraint.name = "FitPulsePullUpIK" + side
        constraint.target = target
        constraint.chain_count = 5
        constraint.iterations = 100
        constraint.use_stretch = False
        constraint.influence = 1.0
    bpy.context.view_layer.update()
    return targets


def assert_pull_up_body_pose(rig, frame_end):
    """Require feet to stay clear of the floor and the head to clear the bar."""
    scene = bpy.context.scene
    min_foot_z = float("inf")
    min_foot_at = None
    for frame in range(1, frame_end + 1):
        scene.frame_set(frame)
        for side in (".L", ".R"):
            foot = rig.pose.bones.get("foot" + side)
            if foot is None:
                raise RuntimeError(f"pull-up clearance gate: missing foot{side}")
            point = rig.matrix_world @ foot.tail
            if point.z < min_foot_z:
                min_foot_z = point.z
                min_foot_at = (frame, side, tuple(round(v, 3) for v in point))
    min_clearance = 0.18
    print(f"CLEARANCE pull_up: min foot height {min_foot_z:.3f} m at {min_foot_at}; limit {min_clearance:.2f} m")
    if min_foot_z < min_clearance:
        raise RuntimeError(f"pull-up floor clearance failed: {min_foot_z:.3f} m < {min_clearance:.2f} m")

    top_frame = max(1, min(frame_end, 1 + round((frame_end - 1) * 0.56)))
    scene.frame_set(top_frame)
    head = rig.pose.bones.get("head")
    if head is None:
        raise RuntimeError("pull-up top-position gate: missing head bone")
    head_base_z = (rig.matrix_world @ head.head).z
    bar_top_z = 2.453 + 0.028
    required_head_base_z = bar_top_z + 0.03
    print(f"TOP pull_up: head-base proxy {head_base_z:.3f} m at frame {top_frame}; bar top {bar_top_z:.3f} m; minimum {required_head_base_z:.3f} m")
    if head_base_z < required_head_base_z:
        raise RuntimeError(f"pull-up top-position failed: head-base proxy {head_base_z:.3f} m does not clear bar top {bar_top_z:.3f} m by 0.03 m")


'''
text = text.replace(needle, contact_helper + ik_helper + needle, 1)

main_old = '        prop_objs = build_props(spec)\n        if mocap and mocap_kind == "video":'
main_new = '        prop_objs = build_props(spec)\n        if spec.get("id") == "pull_up":\n            prop_objs.extend((obj, "static") for obj in build_pull_up_rig())\n        if mocap and mocap_kind == "video":'
if text.count(main_old) != 1:
    raise SystemExit("Unexpected upstream main build block; refusing an unsafe patch")
text = text.replace(main_old, main_new, 1)

anim_old = '            animate(driver, rig, spec, frame_end, prop_objs)\n        bpy.data.objects.remove(driver, do_unlink=True)'
anim_new = '            animate(driver, rig, spec, frame_end, prop_objs)\n            if spec.get("id") == "pull_up":\n                add_pull_up_ik(rig)\n                assert_pull_up_bar_contact(rig, frame_end)\n                assert_pull_up_body_pose(rig, frame_end)\n        bpy.data.objects.remove(driver, do_unlink=True)'
if text.count(anim_old) != 1:
    raise SystemExit("Unexpected upstream animation block; refusing an unsafe contact-check patch")
text = text.replace(anim_old, anim_new, 1)

# Add a second alpha-preserving render pass after the studio preview.
alpha_old = '    backdrop = bpy.data.objects.get("Backdrop")\n    if backdrop:\n        bpy.data.objects.remove(backdrop, do_unlink=True)\n    # SCENE mode bakes every animated object into one glTF animation, so the'
alpha_new = '''    backdrop = bpy.data.objects.get("Backdrop")
    if backdrop:
        bpy.data.objects.remove(backdrop, do_unlink=True)

    # Separate transparent PNG sequence for app compositing. Keep the original
    # studio render intact for human review and MP4 preview.
    if spec.get("id") == "pull_up":
        scene.render.film_transparent = True
        scene.render.image_settings.file_format = "PNG"
        scene.render.image_settings.color_mode = "RGBA"
        scene.render.image_settings.color_depth = "8"
        scene.render.resolution_x = scene.render.resolution_y = 720
        scene.cycles.samples = 8
        scene.frame_step = 1
        scene.render.filepath = f"{out_dir}/frames_{spec['id']}_alpha/"
        bpy.ops.render.render(animation=True)

    # SCENE mode bakes every animated object into one glTF animation, so the'''
if text.count(alpha_old) != 1:
    raise SystemExit("Unexpected upstream backdrop/export block; refusing unsafe alpha patch")
text = text.replace(alpha_old, alpha_new, 1)

source.write_text(text)
print("Patched upstream renderer: static pull-up rack enabled.")
