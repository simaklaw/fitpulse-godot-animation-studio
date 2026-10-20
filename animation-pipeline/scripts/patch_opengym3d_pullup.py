"""Patch the pinned OpenGym3D Blender pipeline for a fixed pull-up rack.

Adds a static procedural rack only; it does not change the upstream rig,
keyframe maths, character, materials, GLB exporter, or joint QA.
"""
from pathlib import Path

source = Path("pipeline/build_exercise.py")
text = source.read_text()

place_old = '    for obj, anchor in prop_objs:\n        obj.location = wrist(anchor) if anchor in (".L", ".R") else mid\n'
place_new = '    for obj, anchor in prop_objs:\n        if anchor == "static":\n            continue\n        obj.location = wrist(anchor) if anchor in (".L", ".R") else mid\n'
if text.count(place_old) != 1:
    raise SystemExit("Unexpected upstream place_props implementation; refusing an unsafe patch")
text = text.replace(place_old, place_new, 1)

helper = r'''def build_pull_up_rig():
    """Create a stationary powder-coated rack used only by the pull-up spec."""
    steel = make_material("Pull-up rig steel", (0.095, 0.115, 0.135, 1.0), roughness=0.3)
    objects = []

    bpy.ops.mesh.primitive_cylinder_add(
        vertices=48, radius=0.028, depth=1.8,
        location=(0.0, -0.025, 2.153), rotation=(0.0, math.pi / 2, 0.0))
    bar = bpy.context.active_object
    bar.name = "PullUpBar"
    bar.data.materials.append(steel)
    objects.append(bar)

    for x, side in ((-0.9, "L"), (0.9, "R")):
        bpy.ops.mesh.primitive_cylinder_add(
            vertices=32, radius=0.036, depth=2.153,
            location=(x, -0.025, 1.0765))
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
            radial = math.sqrt((point.y + 0.025) ** 2 + (point.z - 2.153) ** 2)
            beyond_bar = max(0.0, abs(point.x) - 0.88)
            distance = math.sqrt(radial ** 2 + beyond_bar ** 2)
            print(f"CONTACT_FRAME frame={frame} side={side} wrist=({point.x:.3f},{point.y:.3f},{point.z:.3f}) bar=({0.0:.3f},{-0.025:.3f},{2.153:.3f}) distance={distance:.3f}")
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
text = text.replace(needle, contact_helper + needle, 1)

main_old = '        prop_objs = build_props(spec)\n        if mocap and mocap_kind == "video":'
main_new = '        prop_objs = build_props(spec)\n        if spec.get("id") == "pull_up":\n            prop_objs.extend((obj, "static") for obj in build_pull_up_rig())\n        if mocap and mocap_kind == "video":'
if text.count(main_old) != 1:
    raise SystemExit("Unexpected upstream main build block; refusing an unsafe patch")
text = text.replace(main_old, main_new, 1)

anim_old = '            animate(driver, rig, spec, frame_end, prop_objs)\n        bpy.data.objects.remove(driver, do_unlink=True)'
anim_new = '            animate(driver, rig, spec, frame_end, prop_objs)\n            if spec.get("id") == "pull_up":\n                assert_pull_up_bar_contact(rig, frame_end)\n        bpy.data.objects.remove(driver, do_unlink=True)'
if text.count(anim_old) != 1:
    raise SystemExit("Unexpected upstream animation block; refusing an unsafe contact-check patch")
text = text.replace(anim_old, anim_new, 1)

source.write_text(text)
print("Patched upstream renderer: static pull-up rack enabled.")
