class_name ClothingAttach
extends RefCounted
## Утилита для привязки одежды к скелету персонажа.
##
## Одежда из SportDemoAnimPack / mens_t_shirt / base_sweatpants и т.п.
## скиннена на тот же скелет, что и мокап-персонаж (UE-скелет), поэтому кости
## сопоставляются по именам.
##
## Два случая:
##   * скиннутый меш (у MeshInstance3D есть skin) — переносится под целевой Skeleton3D
##     и получает его в качестве скелета; Godot сам сопоставит кости по именам скина;
##   * жёсткий меш без скина (например, танк-топ) — крепится к ОДНОЙ кости через
##     BoneAttachment3D и двигается вместе с ней.
##
## Использование:
##   var clothing := load("res://path/to/clothing.fbx").instantiate()
##   ClothingAttach.bind_to_skeleton(clothing, character_skeleton, clothing_skeleton)

## Кость для жёстких мешей без скина, если не указана другая и если она есть в скелете.
const RIGID_BONE_CANDIDATES: Array = ["spine_03", "spine_02", "spine_01", "Chest", "Spine"]


## Возвращает число привязанных мешей. clothing_skeleton не обязателен (оставлен ради
## совместимости с прежним вызовом) — для логики он больше не нужен.
static func bind_to_skeleton(
	clothing_root: Node3D,
	target_skeleton: Skeleton3D,
	_clothing_skeleton: Skeleton3D = null,
	rigid_bone: String = ""
) -> int:
	if clothing_root == null or target_skeleton == null:
		return 0

	# Сначала собираем меши, потом переносим: нельзя менять дерево во время обхода.
	var meshes: Array = []
	_collect_meshes(clothing_root, meshes)

	var bone_for_rigid := _pick_rigid_bone(target_skeleton, rigid_bone)
	var attached := 0
	for mesh_node: MeshInstance3D in meshes:
		var old_parent := mesh_node.get_parent()
		if old_parent != null:
			old_parent.remove_child(mesh_node)

		if mesh_node.skin != null:
			# Скиннутый меш: живёт под целевым скелетом и использует его кости.
			target_skeleton.add_child(mesh_node)
			mesh_node.skeleton = mesh_node.get_path_to(target_skeleton)
			mesh_node.transform = Transform3D.IDENTITY
			attached += 1
		elif bone_for_rigid != "":
			var attachment := BoneAttachment3D.new()
			attachment.name = "Clothing_" + String(mesh_node.name)
			target_skeleton.add_child(attachment)
			attachment.bone_name = bone_for_rigid
			attachment.add_child(mesh_node)
			attached += 1
		else:
			# Подходящей кости нет — меш остаётся рядом со скелетом, но не двигается.
			target_skeleton.add_child(mesh_node)
			push_warning("ClothingAttach: нет кости для жёсткого меша '%s'" % mesh_node.name)

	# Пустой контейнер одежды больше не нужен.
	if clothing_root.get_parent() == null:
		clothing_root.queue_free()

	print("[ClothingAttach] привязано %d мешей" % attached)
	return attached


static func _collect_meshes(node: Node, out: Array) -> void:
	if node is MeshInstance3D:
		out.append(node as MeshInstance3D)
	for child in node.get_children():
		_collect_meshes(child, out)


static func _pick_rigid_bone(skeleton: Skeleton3D, requested: String) -> String:
	if requested != "" and skeleton.find_bone(requested) >= 0:
		return requested
	for candidate in RIGID_BONE_CANDIDATES:
		if skeleton.find_bone(candidate) >= 0:
			return candidate
	return ""
