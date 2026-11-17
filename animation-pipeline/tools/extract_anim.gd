#!/usr/bin/env -S godot --headless --script
## extract_anim.gd — извлечение скелета + Animation из Godot .scn (импорт-кэш SportDemoAnimPack).
## Запуск в CI (Godot 4.3+/4.7 headless):
##   godot --headless --path . --script animation-pipeline/tools/extract_anim.gd \
##     -- --input "assets sport/AS_....scn" --output out/squat.glb
##
## Не генерирует движение: только перенос существующих треков AnimStack в glTF 2.0.
## Правило AGENTS.md §1: procedural animation запрещена.

extends SceneTree

const USAGE := "Usage: extract_anim.gd -- --input <path.scn> --output <path.glb> [--anim-name <name>]"

func _initialize() -> void:
	var args := _parse_args(OS.get_cmdline_user_args())
	if not args.has("input") or not args.has("output"):
		push_error(USAGE)
		quit(2)
		return

	var input_path: String = args["input"]
	var output_path: String = args["output"]
	var anim_filter: String = args.get("anim_name", "")

	if not FileAccess.file_exists(input_path):
		push_error("Input not found: %s" % input_path)
		quit(1)
		return

	var packed: PackedScene = load(input_path) as PackedScene
	if packed == null:
		push_error("Failed to load PackedScene: %s" % input_path)
		quit(1)
		return

	var root: Node = packed.instantiate()
	if root == null:
		push_error("instantiate() returned null")
		quit(1)
		return
	get_root().add_child(root)

	var skeleton := _find_skeleton(root)
	var player := _find_animation_player(root)
	if skeleton == null:
		push_error("No Skeleton3D found in scene")
		quit(1)
		return
	if player == null:
		push_error("No AnimationPlayer found in scene")
		quit(1)
		return

	var lib_names: PackedStringArray = player.get_animation_library_list()
	var report: Dictionary = {
		"input": input_path,
		"bones": skeleton.get_bone_count(),
		"bone_names": [],
		"animations": [],
		"output": output_path,
	}
	for i in skeleton.get_bone_count():
		report["bone_names"].append(skeleton.get_bone_name(i))

	for lib_name in lib_names:
		var lib: AnimationLibrary = player.get_animation_library(lib_name)
		for anim_name in lib.get_animation_list():
			if anim_filter != "" and str(anim_name) != anim_filter:
				continue
			var anim: Animation = lib.get_animation(anim_name)
			report["animations"].append({
				"library": lib_name,
				"name": str(anim_name),
				"length": anim.length,
				"step": anim.step,
				"track_count": anim.get_track_count(),
			})

	# Export via glTFDocument (Godot 4.x)
	var doc := GLTFDocument.new()
	var state := GLTFState.new()
	var err: Error = doc.append_from_scene(root, state)
	if err != OK:
		push_error("GLTFDocument.append_from_scene failed: %s" % error_string(err))
		quit(1)
		return

	err = doc.write_to_filesystem(state, output_path)
	if err != OK:
		push_error("write_to_filesystem failed: %s" % error_string(err))
		quit(1)
		return

	var report_path := output_path.get_basename() + ".extract.json"
	var f := FileAccess.open(report_path, FileAccess.WRITE)
	if f:
		f.store_string(JSON.stringify(report, "\t"))
		f.close()

	print("OK extract: bones=%d anims=%d -> %s" % [
		report["bones"], report["animations"].size(), output_path
	])
	print("Report: %s" % report_path)
	quit(0)


func _find_skeleton(n: Node) -> Skeleton3D:
	if n is Skeleton3D:
		return n as Skeleton3D
	for c in n.get_children():
		var found := _find_skeleton(c)
		if found:
			return found
	return null


func _find_animation_player(n: Node) -> AnimationPlayer:
	if n is AnimationPlayer:
		return n as AnimationPlayer
	for c in n.get_children():
		var found := _find_animation_player(c)
		if found:
			return found
	return null


func _parse_args(user_args: PackedStringArray) -> Dictionary:
	var out: Dictionary = {}
	var i := 0
	while i < user_args.size():
		var a: String = user_args[i]
		if a.begins_with("--") and i + 1 < user_args.size():
			out[a.substr(2)] = user_args[i + 1]
			i += 2
		else:
			i += 1
	return out
