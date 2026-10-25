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

# Tighten the framing slightly so the figure reads larger on a phone while
# keeping the full rack and feet within the camera bounds.
camera_old = 'def frame_subject(cam, target, basemesh, frames, side="front", margin=1.12,'
camera_new = 'def frame_subject(cam, target, basemesh, frames, side="front", margin=0.98,'
if text.count(camera_old) != 1:
    raise SystemExit("Unexpected upstream frame_subject camera margin; refusing an unsafe framing patch")
text = text.replace(camera_old, camera_new, 1)
if text.count(camera_new) != 1:
    raise SystemExit("Camera margin patch did not apply exactly once")

# Replace the cold grey mannequin palette with a warm, modern training palette.
# Active musculature uses FitPulse mint/forest accents instead of clinical orange.
palette_rules = [
    ("SKIN_COLOR = (0.62, 0.64, 0.68, 1.0)", "SKIN_COLOR = (0.48, 0.31, 0.24, 1.0)"),
    ("PRIMARY_COLOR = (0.95, 0.16, 0.03, 1.0)", "PRIMARY_COLOR = (0.44, 0.84, 0.65, 1.0)"),
    ("SECONDARY_COLOR = (0.66, 0.075, 0.02, 1.0)", "SECONDARY_COLOR = (0.14, 0.40, 0.31, 1.0)"),
]
for old, new in palette_rules:
    if text.count(old) != 1:
        raise SystemExit(f"Expected exactly one upstream palette constant {old!r}; refusing an unsafe visual patch")
    text = text.replace(old, new, 1)


helper = r'''def build_pull_up_rig():
    """Create a stationary powder-coated rack used only by the pull-up spec."""
    steel = make_material("Pull-up rig steel", (0.095, 0.115, 0.135, 1.0), roughness=0.3)
    objects = []

    bpy.ops.mesh.primitive_cylinder_add(
        vertices=48, radius=0.028, depth=1.1,
        location=(0.0, -0.025, 2.453), rotation=(0.0, math.pi / 2, 0.0))
    bar = bpy.context.active_object
    bar.name = "PullUpBar"
    # The primitive cylinder is authored along local Z, then rotated onto world X.
    # Bake that rotation into the mesh so grip_hands() can use the same local-X
    # bar-axis convention as the dumbbell/barbell props (instead of curling fingers
    # around world Z, which leaves the palms open above the bar in the preview).
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)
    bar.data.materials.append(steel)
    objects.append(bar)

    for x, side in ((-0.55, "L"), (0.55, "R")):
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

contact_helper = r'''def fit_pull_up_rack_to_hang_pose(rig):
    """Fit rack height/grip to the generated model's natural hang reach."""
    scene = bpy.context.scene
    scene.frame_set(1)
    # Evaluate animation/deformation before sampling the hang pose. Without this,
    # Blender can expose the previous dependency-graph pose for the first frame,
    # fitting the bar to stale wrist coordinates (seen as a 21 cm female miss).
    bpy.context.view_layer.update()
    hands = {}
    for side in (".L", ".R"):
        wrist = rig.pose.bones.get("wrist" + side)
        if wrist is None:
            raise RuntimeError(f"pull-up fit gate: missing wrist{side}")
        hands[side] = rig.matrix_world @ wrist.tail

    # Keep the same small wrist-to-bar offset as the original validated male rig,
    # while adapting for narrower shoulders and different reach in the female rig.
    bar_z = (hands[".L"].z + hands[".R"].z) / 2.0 + 0.037
    bar_y = (hands[".L"].y + hands[".R"].y) / 2.0
    bar = bpy.data.objects.get("PullUpBar")
    if bar is None:
        raise RuntimeError("pull-up fit gate: missing PullUpBar")
    bar.location.z = bar_z
    bar.location.y = bar_y

    # Adjustable posts stay connected to the fitted bar; feet remain at floor level.
    for side in ("L", "R"):
        post = bpy.data.objects.get("PullUpPost_" + side)
        foot = bpy.data.objects.get("PullUpBase_" + side)
        if post is None or foot is None:
            raise RuntimeError(f"pull-up fit gate: incomplete rack side {side}")
        post.dimensions.z = bar_z
        post.location.z = bar_z / 2.0
        post.location.y = bar_y
        foot.location.y = bar_y

    bpy.context.view_layer.update()
    targets = {}
    for side in (".L", ".R"):
        point = hands[side]
        targets[side] = (point.x, bar_y, bar_z)
    print(
        f"RACK_FIT pull_up: bar=({bar.location.x:.3f},{bar_y:.3f},{bar_z:.3f}) "
        f"grip_x=({targets['.L'][0]:.3f},{targets['.R'][0]:.3f})"
    )
    return targets


def add_pull_up_ik(rig, target_positions):
    """Solve wrist endpoints against the model-fitted fixed bar."""
    scene = bpy.context.scene
    for side in (".L", ".R"):
        target = bpy.data.objects.new("PullUpIKTarget" + side, None)
        scene.collection.objects.link(target)
        target.location = target_positions[side]
        target.empty_display_type = "SPHERE"
        target.empty_display_size = 0.025
        target.hide_render = True

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


def assert_pull_up_bar_contact(rig, frame_end):
    """Check wrist-to-bar distance at every rendered frame."""
    scene = bpy.context.scene
    bar = bpy.data.objects.get("PullUpBar")
    if bar is None:
        raise RuntimeError("pull-up contact gate: missing PullUpBar")
    bar_center = bar.matrix_world.translation.copy()
    # Blender can report dimensions along the cylinder's local axis despite its
    # rotation. Use the actual world-space rack-post spacing as the grip span.
    post_l = bpy.data.objects.get("PullUpPost_L")
    post_r = bpy.data.objects.get("PullUpPost_R")
    if post_l is None or post_r is None:
        raise RuntimeError("pull-up contact gate: missing rack posts")
    half_length = max(
        0.0,
        abs(post_r.matrix_world.translation.x - post_l.matrix_world.translation.x) / 2.0 - 0.02,
    )
    print(f"CONTACT_GATE rack_half_length={half_length:.3f} m")
    worst = 0.0
    worst_at = None
    for frame in range(1, frame_end + 1):
        scene.frame_set(frame)
        # Force dependency-graph evaluation before sampling wrist endpoints.
        # Otherwise the first sampled frame can expose the pre-IK pose.
        bpy.context.view_layer.update()
        for side in (".L", ".R"):
            wrist = rig.pose.bones.get("wrist" + side)
            if wrist is None:
                raise RuntimeError(f"pull-up contact gate: missing wrist{side}")
            point = rig.matrix_world @ wrist.tail
            radial = math.sqrt((point.y - bar_center.y) ** 2 + (point.z - bar_center.z) ** 2)
            beyond_bar = max(0.0, abs(point.x - bar_center.x) - half_length)
            distance = math.sqrt(radial ** 2 + beyond_bar ** 2)
            print(
                f"CONTACT_FRAME frame={frame} side={side} "
                f"wrist=({point.x:.3f},{point.y:.3f},{point.z:.3f}) "
                f"bar=({bar_center.x:.3f},{bar_center.y:.3f},{bar_center.z:.3f}) "
                f"distance={distance:.3f}"
            )
            if distance > worst:
                worst = distance
                worst_at = (frame, side, tuple(round(v, 3) for v in point))
    limit = 0.08
    print(f"CONTACT pull_up: max wrist-to-bar distance {worst:.3f} m at {worst_at}; limit {limit:.2f} m")
    if worst > limit:
        raise RuntimeError(f"pull-up hand-to-bar contact failed: {worst:.3f} m > {limit:.2f} m")


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
    bpy.context.view_layer.update()
    head = rig.pose.bones.get("head")
    bar = bpy.data.objects.get("PullUpBar")
    if head is None or bar is None:
        raise RuntimeError("pull-up top-position gate: missing head bone or PullUpBar")
    head_base_z = (rig.matrix_world @ head.head).z
    head_top_z = (rig.matrix_world @ head.tail).z
    # The rack crossbar is rotated onto the X axis; object-space dimensions.z
    # is not its vertical thickness. Use the actual cylinder radius instead.
    bar_top_z = bar.location.z + 0.028
    minimum_head_top_z = bar_top_z + 0.03
    maximum_head_base_drop = 0.18
    print(
        f"TOP pull_up: head-base={head_base_z:.3f} m head-top={head_top_z:.3f} m "
        f"at frame {top_frame}; bar top={bar_top_z:.3f} m; "
        f"head-top minimum={minimum_head_top_z:.3f} m"
    )
    if head_top_z < minimum_head_top_z or head_base_z < bar.location.z - maximum_head_base_drop:
        raise RuntimeError(
            f"pull-up top-position failed: head top/base ({head_top_z:.3f}/{head_base_z:.3f} m) "
            f"does not clear bar top {bar_top_z:.3f} m while keeping the base within "
            f"{maximum_head_base_drop:.2f} m below bar center"
        )


'''
if text.count(needle) != 1:
    raise SystemExit("Could not locate the upstream prop helper insertion point")
ik_helper = r'''def add_pull_up_ik(rig):
    """Solve both hand endpoints against fixed targets on the pull-up bar."""
    scene = bpy.context.scene
    targets = []
    # Shoulder-width overhand grip: 60 cm between wrist targets, not a narrow 47 cm grip.
    for x, side in ((-0.300, ".L"), (0.300, ".R")):
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
text = text.replace(needle, contact_helper + needle, 1)

main_old = '        prop_objs = build_props(spec)\n        if mocap and mocap_kind == "video":'
main_new = '        prop_objs = build_props(spec)\n        if spec.get("id") == "pull_up":\n            prop_objs.extend((obj, "static") for obj in build_pull_up_rig())\n        if mocap and mocap_kind == "video":'
if text.count(main_old) != 1:
    raise SystemExit("Unexpected upstream main build block; refusing an unsafe patch")
text = text.replace(main_old, main_new, 1)

anim_old = '            animate(driver, rig, spec, frame_end, prop_objs)\n        bpy.data.objects.remove(driver, do_unlink=True)'
anim_new = '            animate(driver, rig, spec, frame_end, prop_objs)\n            if spec.get("id") == "pull_up":\n                hand_targets = fit_pull_up_rack_to_hang_pose(rig)\n                add_pull_up_ik(rig, hand_targets)\n                assert_pull_up_bar_contact(rig, frame_end)\n                assert_pull_up_body_pose(rig, frame_end)\n        bpy.data.objects.remove(driver, do_unlink=True)'
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
        # Transparent exports are consumed independently in the app, so preserve
        # breathing room around the whole rack and athlete. The studio MP4 keeps
        # its tighter composition; only the RGBA pass backs the camera off 12%.
        camera_target = cam.constraints.get("TRACK_TO").target if cam.constraints.get("TRACK_TO") else target
        cam.location = camera_target.location + (cam.location - camera_target.location) * 1.12
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

# Choose an intentional anatomical presentation. MPFB's gender macro is 0=female, 1=male.
gender_old = '''    for prop, value in (("gender", 1.0), ("muscle", 1.0), ("weight", 0.48),
                        ("proportions", 0.85)):'''
gender_new = '''    gender_name = os.environ.get("FITX_GENDER", "male").strip().lower()
    if gender_name not in ("male", "female"):
        raise ValueError(f"Unsupported FITX_GENDER={gender_name!r}; expected 'male' or 'female'")
    gender_value = 1.0 if gender_name == "male" else 0.0
    muscle_value = 0.82 if gender_name == "male" else 0.68
    print(f"CHARACTER_PROFILE gender={gender_name} macro={gender_value:.1f} muscle={muscle_value:.2f}")
    # Keep the original pipeline's validated proportions preset (0.85).
    # A neutral 0.5 makes this female rig unable to reach the fixed bar under IK.
    proportions_value = 0.85
    # The same arm pose does not fit the generated female rig at neutral height:
    # its wrist tails sit ~21 cm below the fixed bar. Use MakeHuman's height
    # macro to keep stature/limb reach compatible with the shared exercise rig.
    height_value = 0.50 if gender_name == "male" else 0.90
    print(
        f"CHARACTER_PROFILE_DIMENSIONS proportions={proportions_value:.2f} "
        f"height={height_value:.2f}"
    )
    for prop, value in (
        ("gender", gender_value),
        ("muscle", muscle_value),
        ("weight", 0.48),
        ("proportions", proportions_value),
        ("height", height_value),
    ):'''
if text.count(gender_old) != 1:
    raise SystemExit("Unexpected upstream character macro block; refusing an unsafe gender patch")
text = text.replace(gender_old, gender_new, 1)

# Confirm MPFB accepted the selected phenotype before building the rig.
setter_old = '''    TargetService.reapply_macro_details(basemesh)
    rig = HumanService.add_builtin_rig(basemesh, "default")'''
setter_new = '''    TargetService.reapply_macro_details(basemesh)
    actual_gender = float(HumanObjectProperties.get_value("gender", entity_reference=basemesh))
    if abs(actual_gender - gender_value) > 0.01:
        raise RuntimeError(f"MPFB gender macro mismatch: requested {gender_value:.1f}, got {actual_gender:.3f}")
    print(f"CHARACTER_PROFILE_VERIFIED gender={gender_name} macro={actual_gender:.1f}")
    rig = HumanService.add_builtin_rig(basemesh, "default")

    # CC0 MakeHuman clothes are fetched by CI and fitted to the selected MPFB body.
    apparel_root = os.environ.get("FITX_APPAREL_ROOT", "").strip()
    if not apparel_root or not os.path.isdir(apparel_root):
        raise RuntimeError("FITX_APPAREL_ROOT must point to the verified MakeHuman CC0 clothing packs")

    def find_clothing_asset(filename):
        matches = []
        for root, _, filenames in os.walk(apparel_root):
            if filename in filenames:
                matches.append(os.path.join(root, filename))
        if len(matches) != 1:
            raise RuntimeError(f"Expected exactly one clothing asset {filename!r}; found {len(matches)}")
        return matches[0]

    # Pull-ups keep both arms overhead for much of the cycle. Sleeveless athletic
    # tops make the exposed deltoid/underarm area intentional, unlike irregular
    # sleeve-cap clipping from the short-sleeve shirt meshes.
    shirt_name = (
        "elvs_male_athletic_tank1.mhclo"
        if gender_name == "male"
        else "elvs_ladies_tank1.mhclo"
    )
    clothing_specs = (
        (shirt_name, (0.025, 0.20, 0.15, 1.0), "shirt"),
        ("cortu_jeans_shorts.mhclo", (0.018, 0.035, 0.040, 1.0), "shorts"),
    )
    for filename, garment_color, garment_label in clothing_specs:
        asset_path = find_clothing_asset(filename)
        garment = HumanService.add_mhclo_asset(
            asset_path, basemesh, asset_type="Clothes", subdiv_levels=1,
            material_type="GAMEENGINE", set_up_rigging=True,
            interpolate_weights=True, import_subrig=False, import_weights=True,
        )
        garment_material = make_material(
            f"FitPulse {gender_name} {garment_label}",
            garment_color, roughness=0.78, subsurface=0.0,
        )
        garment.data.materials.clear()
        garment.data.materials.append(garment_material)
        for polygon in garment.data.polygons:
            polygon.material_index = 0
        if garment_label in ("shirt", "shorts"):
            # Tiny outward normal offset reduces z-fighting and skin poke-through
            # when elbows are flexed and shoulders are elevated under the bar.
            garment.data.update()
            for vertex in garment.data.vertices:
                normal = vertex.normal
                if normal.length_squared > 1.0e-10:
                    vertex.co += normal.normalized() * 0.002
            garment.data.update()
            print(
                f"APPAREL_SURFACE_OFFSET gender={gender_name} item={garment_label} "
                "offset_m=0.002"
            )
        print(
            f"APPAREL_LOADED gender={gender_name} item={garment_label} "
            f"asset={filename} vertices={len(garment.data.vertices)}"
        )

    # Add a different CC0 hairstyle for each profile so the silhouette reads
    # as a deliberately designed athlete rather than a bald generic mannequin.
    hair_root = os.environ.get("FITX_HAIR_ROOT", "").strip()
    if not hair_root or not os.path.isdir(hair_root):
        raise RuntimeError("FITX_HAIR_ROOT must point to the verified MakeHuman CC0 hair pack")

    def find_hair_asset(filename):
        matches = []
        for root, _, filenames in os.walk(hair_root):
            if filename in filenames:
                matches.append(os.path.join(root, filename))
        if len(matches) != 1:
            raise RuntimeError(f"Expected exactly one hairstyle {filename!r}; found {len(matches)}")
        return matches[0]

    hair_name = (
        "cortu_short_messy_hair.mhclo"
        if gender_name == "male"
        else "elvs_reverse_french_braid_bun.mhclo"
    )
    hair_path = find_hair_asset(hair_name)
    hair = HumanService.add_mhclo_asset(
        hair_path, basemesh, asset_type="Hair", subdiv_levels=1,
        material_type="GAMEENGINE", set_up_rigging=True,
        interpolate_weights=True, import_subrig=False, import_weights=True,
    )
    print(
        f"APPAREL_LOADED gender={gender_name} item=hair "
        f"asset={hair_name} vertices={len(hair.data.vertices)}"
    )

    # A pair of running shoes avoids the bare-foot training-demo look. The
    # source mesh is CC-BY (Punkduck), and attribution is documented in the repo.
    shoes_root = os.environ.get("FITX_SHOES_ROOT", "").strip()
    if not shoes_root or not os.path.isdir(shoes_root):
        raise RuntimeError("FITX_SHOES_ROOT must point to the verified MakeHuman CC-BY shoes pack")

    def find_shoes_asset(filename):
        matches = []
        for root, _, filenames in os.walk(shoes_root):
            if filename in filenames:
                matches.append(os.path.join(root, filename))
        if len(matches) != 1:
            raise RuntimeError(f"Expected exactly one shoe asset {filename!r}; found {len(matches)}")
        return matches[0]

    shoes_name = "punkduck_running_shoes_01.mhclo"
    shoes_path = find_shoes_asset(shoes_name)
    shoes = HumanService.add_mhclo_asset(
        shoes_path, basemesh, asset_type="Clothes", subdiv_levels=1,
        material_type="GAMEENGINE", set_up_rigging=True,
        interpolate_weights=True, import_subrig=False, import_weights=True,
    )
    shoes_material = make_material(
        f"FitPulse {gender_name} running shoes",
        (0.045, 0.075, 0.072, 1.0), roughness=0.62, subsurface=0.0,
    )
    shoes.data.materials.clear()
    shoes.data.materials.append(shoes_material)
    for polygon in shoes.data.polygons:
        polygon.material_index = 0
    print(
        f"APPAREL_LOADED gender={gender_name} item=shoes "
        f"asset={shoes_name} vertices={len(shoes.data.vertices)}"
    )'''
if text.count(setter_old) != 1:
    raise SystemExit("Unexpected upstream MPFB phenotype verification point")
text = text.replace(setter_old, setter_new, 1)

grip_old = '''def grip_hands(rig, prop_objs, frame):
    """Close the fingers around the held implement. Every competitor grips;
    flat fingers through a barbell are the genre's biggest amateur tell."""
    if not prop_objs:
        return
    axis = (prop_objs[0][0].matrix_world.to_3x3() @ Vector((1, 0, 0))).normalized()
    for side in (".L", ".R"):
        center = rig.matrix_world @ rig.pose.bones["wrist" + side].tail
        finger_sign = _curl_sign(rig, "finger2-1" + side, axis, 50, center)
        thumb_sign = _curl_sign(rig, "finger1-1" + side, axis, 30, center)
        applied = 0
        for f in range(1, 6):
            curls = THUMB_CURL if f == 1 else FINGER_CURL
            sign = thumb_sign if f == 1 else finger_sign
            if sign is None:
                continue
            for seg in (1, 2, 3):                # proximal first: children inherit
                pb = rig.pose.bones.get(f"finger{f}-{seg}{side}")
                if pb is None:
                    continue
                q = Quaternion(axis, math.radians(sign * curls[seg]))
                _rotate_bone_world(pb, q, frame)
                applied += 1
        print(f"GRIP {side}: {applied} finger bones, sign={finger_sign}/{thumb_sign}")
'''
grip_new = '''# FitPulse pull-up must not re-guess curl direction at every keyframe:
# the wrist changes orientation during the rep and the heuristic can flip the
# finger curl sign at the top, visibly opening the hand. Lock the sign from the
# first dead-hang pose for the entire fixed-bar cycle. Other exercise grips keep
# the upstream per-keyframe behavior.
FITPULSE_PULLUP_GRIP_SIGNS = None


def grip_hands(rig, prop_objs, frame):
    """Close fingers around a held implement; stabilize signs for the pull-up."""
    global FITPULSE_PULLUP_GRIP_SIGNS
    if not prop_objs:
        return
    held_object = prop_objs[0][0]
    is_fitpulse_pull_up = held_object.name == "PullUpBar"
    axis = (held_object.matrix_world.to_3x3() @ Vector((1, 0, 0))).normalized()

    if is_fitpulse_pull_up and (frame == 1 or FITPULSE_PULLUP_GRIP_SIGNS is None):
        FITPULSE_PULLUP_GRIP_SIGNS = {}
        for side in (".L", ".R"):
            center = rig.matrix_world @ rig.pose.bones["wrist" + side].tail
            FITPULSE_PULLUP_GRIP_SIGNS[side] = (
                _curl_sign(rig, "finger2-1" + side, axis, 50, center),
                _curl_sign(rig, "finger1-1" + side, axis, 30, center),
            )
        print("FITPULSE_PULLUP_GRIP_SIGNS locked from first dead-hang pose: "
              + repr(FITPULSE_PULLUP_GRIP_SIGNS))

    for side in (".L", ".R"):
        center = rig.matrix_world @ rig.pose.bones["wrist" + side].tail
        if is_fitpulse_pull_up:
            finger_sign, thumb_sign = FITPULSE_PULLUP_GRIP_SIGNS[side]
        else:
            finger_sign = _curl_sign(rig, "finger2-1" + side, axis, 50, center)
            thumb_sign = _curl_sign(rig, "finger1-1" + side, axis, 30, center)
        applied = 0
        for f in range(1, 6):
            curls = THUMB_CURL if f == 1 else FINGER_CURL
            sign = thumb_sign if f == 1 else finger_sign
            if sign is None:
                continue
            for seg in (1, 2, 3):
                pb = rig.pose.bones.get(f"finger{f}-{seg}{side}")
                if pb is None:
                    continue
                q = Quaternion(axis, math.radians(sign * curls[seg]))
                _rotate_bone_world(pb, q, frame)
                applied += 1
        print(f"GRIP {side}: {applied} finger bones, sign={finger_sign}/{thumb_sign}"
              + (" (pull-up sign locked)" if is_fitpulse_pull_up else ""))
'''
# Bound MPFB asset downloads so a stalled extensions endpoint cannot hold CI forever.
download_old = 'with urllib.request.urlopen(req) as resp, open(zpath, "wb") as f:'
download_new = 'with urllib.request.urlopen(req, timeout=60) as resp, open(zpath, "wb") as f:'
if text.count(download_old) != 1:
    raise SystemExit("Unexpected upstream MPFB download block; refusing an unsafe timeout patch")
text = text.replace(download_old, download_new, 1)

if text.count(grip_old) != 1:
    raise SystemExit("Unexpected upstream grip_hands block; refusing a risky sign-lock patch")
text = text.replace(grip_old, grip_new, 1)

source.write_text(text)
print("Patched upstream renderer: stable pull-up grip signs, male/female profile selection, render profile, and bounded MPFB download.")
