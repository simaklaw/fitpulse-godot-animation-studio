extends Node3D
## Тест мокап-анимации из SportDemoAnimPack (персонаж Quinn + записанное движение).
##
## Что умеет:
##   * играет анимацию из FBX, скорость настраивается (по умолчанию чуть медленнее
##     оригинала — 0.85×);
##   * вращение вокруг персонажа: тащить пальцем/мышью, щипок или колесо — зум;
##   * пресеты вида 1/2/3, пробел — пауза, R — с начала.
##
## ВАЖНО: текстуры Quinn в пак НЕ входят (в FBX ссылки на T_Quinn_*.TGA),
## поэтому меш красится нейтральным материалом. Это не мешает оценить движение.

@export var fbx_path: String = "res://assets/characters/sportdemo/AS_Calisthenics_001_Squats.FBX"
@export var clothing_path: String = "res://assets/characters/sportdemo_clothes/277-male raglan tshirt/glb/glb.glb"
## Путь к скиннутой одежде (raglan t-shirt glTF). Переключается в инспекторе.
## Скорость проигрывания: 1.0 — как в файле, меньше — медленнее.
@export var play_speed: float = 0.85
@export var yaw_degrees: float = 0.0
@export var skin_color: Color = Color(0.80, 0.64, 0.53)
@export var face_color: Color = Color(1.00, 0.90, 0.75)  ## цвет кожи головы/лица
## Путь к FBX-файлу с анимацией. По умолчанию присед; нажмите 1 (присед) или 2 (отжимание).
const ANIM_PATHS: Array = [
	"res://assets/characters/sportdemo/AS_Calisthenics_001_Squats.FBX",
	"res://assets/characters/sportdemo/AS_Calisthenics_004_Push_ups.FBX",
]

var _player: AnimationPlayer
var _skeleton: Skeleton3D
var _label: Label
var _root: Node3D
var _camera: Camera3D

# Орбита
var _target := Vector3(0.0, 0.9, 0.0)
var _radius := 0.95
var _yaw := 90.0          ## градусы: 90 = сбоку
var _pitch := 6.0
var _distance := 3.2
var _dragging := false

const PITCH_MIN := -25.0
const PITCH_MAX := 70.0
const VIEWS: Array = [
	{"name": "Сбоку", "yaw": 90.0, "pitch": 6.0},
	{"name": "3/4", "yaw": 135.0, "pitch": 12.0},
	{"name": "Спереди", "yaw": 180.0, "pitch": 6.0},
]
var _view_index := 0
var _fbx_index := 0      ## 0 = присед, 1 = отжимание
var _fbx_inst: Node3D = null   ## текущий экземпляр FBX-анимации


func _ready() -> void:
	_build_world()
	_load_animated_fbx()
	_label = _build_hud()


func _process(_delta: float) -> void:
	_update_camera()
	if _label == null:
		return
	var t := 0.0
	var p: AnimationPlayer = _get_player()
	if p != null and String(p.current_animation) != "":
		t = p.current_animation_position
	var bones := 0
	if _skeleton != null:
		bones = _skeleton.get_bone_count()
	var pname := "-"
	var fps := 1.0
	if p != null:
		pname = String(p.current_animation)
		fps = p.speed_scale
	var view_name := String(VIEWS[_view_index]["name"])
	_label.text = "МОКАП-ТЕСТ\nфайл: %s\nанимация: %s · скорость %.2f×\nt = %.2f с · костей %d\nвид: %s\nТянуть — вращать · щипок/колесо — зум\n1/2 — сменить анимацию · 1/2/3 — виды\nпробел пауза · R сброс · +/- скорость" % [
		fbx_path.get_file(),
		pname,
		fps,
		t, bones, view_name,
	]


func _unhandled_input(event: InputEvent) -> void:
	# --- вращение и зум ---
	if event is InputEventScreenDrag:
		var drag := event as InputEventScreenDrag
		_orbit(drag.relative)
		return
	if event is InputEventMouseMotion:
		var motion := event as InputEventMouseMotion
		if _dragging:
			_orbit(motion.relative)
		return
	if event is InputEventMouseButton:
		var mb := event as InputEventMouseButton
		match mb.button_index:
			MOUSE_BUTTON_LEFT:
				_dragging = mb.pressed
			MOUSE_BUTTON_WHEEL_UP:
				if mb.pressed:
					_zoom(0.9)
			MOUSE_BUTTON_WHEEL_DOWN:
				if mb.pressed:
					_zoom(1.1)
		return
	if event is InputEventMagnifyGesture:
		var mg := event as InputEventMagnifyGesture
		_zoom(1.0 / maxf(mg.factor, 0.01))
		return

	# --- клавиши ---
	var key := event as InputEventKey
	if key == null or not key.pressed:
		return
	match key.keycode:
		KEY_SPACE:
			var p := _get_player()
			if p != null:
				if p.is_playing():
					p.pause()
				else:
					p.play()
		KEY_R:
			var p := _get_player()
			if p != null:
				p.seek(0.0, true)
		KEY_1:
			_set_fbx(0)
		KEY_2:
			_set_fbx(1)
		KEY_3:
			_set_view(2)
		KEY_EQUAL, KEY_KP_ADD:
			play_speed = clampf(play_speed + 0.05, 0.2, 2.0)
			var p := _get_player()
			if p != null:
				p.speed_scale = play_speed
		KEY_MINUS, KEY_KP_SUBTRACT:
			play_speed = clampf(play_speed - 0.05, 0.2, 2.0)
			var p := _get_player()
			if p != null:
				p.speed_scale = play_speed


func _orbit(relative: Vector2) -> void:
	_yaw -= relative.x * 0.35
	_pitch += relative.y * 0.35
	_pitch = clampf(_pitch, PITCH_MIN, PITCH_MAX)
	_update_camera()


func _zoom(factor: float) -> void:
	_distance = clampf(_distance * factor, 1.5, 8.0)
	_update_camera()


func _set_view(index: int) -> void:
	if index < 0 or index >= VIEWS.size():
		return
	_view_index = index
	var v: Dictionary = VIEWS[_view_index]
	_yaw = float(v["yaw"])
	_pitch = float(v["pitch"])
	_update_camera()


func _update_camera() -> void:
	var cam := _camera
	if cam == null:
		return
	var rad_yaw := deg_to_rad(_yaw)
	var rad_pitch := deg_to_rad(_pitch)
	var x := _target.x + _distance * cos(rad_pitch) * sin(rad_yaw)
	var y := _target.y + _distance * sin(rad_pitch)
	var z := _target.z + _distance * cos(rad_pitch) * cos(rad_yaw)
	cam.global_position = Vector3(x, y, z)
	cam.look_at(_target, Vector3.UP)


func _frame_and_apply(index: int) -> void:
	pass


func _bones_aabb() -> AABB:
	var aabb := AABB()
	if _skeleton == null:
		return aabb
	var count := _skeleton.get_bone_count()
	for i in count:
		var bpos: Vector3 = _skeleton.get_bone_global_pose(i).origin
		if i == 0:
			aabb = AABB(bpos, Vector3(0.01, 0.01, 0.01))
		else:
			aabb = aabb.merge(AABB(bpos, Vector3(0.01, 0.01, 0.01)))
	return aabb


func _build_world() -> void:
	var env := Environment.new()
	env.background_mode = Environment.BG_COLOR
	env.background_color = Color(0.09, 0.10, 0.13)
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.ambient_light_color = Color(0.7, 0.75, 0.85)
	env.ambient_light_energy = 0.7
	var world := WorldEnvironment.new()
	world.environment = env
	add_child(world)

	## _root — узел-контейнер для анимированного FBX.
	_root = Node3D.new()
	_root.name = "CharacterRoot"
	add_child(_root)

	var floor_mesh := PlaneMesh.new()
	floor_mesh.size = Vector2(12.0, 12.0)
	var floor_instance := MeshInstance3D.new()
	floor_instance.mesh = floor_mesh
	var mat := StandardMaterial3D.new()
	mat.albedo_color = Color(0.18, 0.19, 0.22)
	mat.roughness = 0.95
	floor_instance.material_override = mat
	add_child(floor_instance)

	var light := DirectionalLight3D.new()
	light.rotation_degrees = Vector3(-50.0, -35.0, 0.0)
	light.light_energy = 1.2
	light.shadow_enabled = true
	add_child(light)

	_camera = Camera3D.new()
	_camera.fov = 40.0
	add_child(_camera)
	_camera.current = true
	_update_camera()


func _build_hud() -> Label:
	var layer := CanvasLayer.new()
	add_child(layer)
	var bg := ColorRect.new()
	bg.color = Color(0.0, 0.0, 0.0, 0.55)
	bg.position = Vector2(12.0, 12.0)
	bg.size = Vector2(560.0, 220.0)
	layer.add_child(bg)
	var label := Label.new()
	label.position = Vector2(24.0, 22.0)
	label.size = Vector2(540.0, 200.0)
	label.add_theme_font_size_override("font_size", 15)
	label.add_theme_color_override("font_color", Color(0.9, 0.94, 1.0))
	label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	layer.add_child(label)
	return label


func _set_status(text: String) -> void:
	print("[mocap] ", text)
	if _label != null:
		_label.text = text


## Простая «кожа» вместо отсутствующих текстур пака.
func _paint_meshes(node: Node) -> void:
	if node is MeshInstance3D:
		var mi := node as MeshInstance3D
		var tag := String(mi.name).to_lower()
		if mi.mesh != null:
			tag += " " + String(mi.mesh.resource_name).to_lower()
		var mat := StandardMaterial3D.new()
		if tag.contains("eye"):
			mat.albedo_color = Color(0.88, 0.89, 0.92)
			mat.roughness = 0.15
		elif tag.contains("teeth") or tag.contains("tooth") or tag.contains("tongue"):
			mat.albedo_color = Color(0.94, 0.93, 0.90)
			mat.roughness = 0.35
		else:
			mat.albedo_color = skin_color
			mat.roughness = 0.65
		mi.material_override = mat
	for child in node.get_children():
		_paint_meshes(child)


func _load_animated_fbx() -> void:
	## Загружает анимированный FBX (161 кость) и привязывает его к _root.
	## Анимированный FBX из SportDemoAnimPack уже скиннен на UE-скелет.
	if not ResourceLoader.exists(fbx_path):
		_set_status("НЕТ ФАЙЛА: " + fbx_path)
		return
	var packed := ResourceLoader.load(fbx_path) as PackedScene
	if packed == null:
		_set_status("НЕ УДАЛОСЬ ЗАГРУЗИТЬ: " + fbx_path)
		return
	var inst := packed.instantiate() as Node3D
	if inst == null:
		_set_status("НЕ УДАЛОСЬ СОЗДАТЬ ЭКЗЕМПЛЯР")
		return
	if _fbx_inst != null:
		_root.remove_child(_fbx_inst)
	_fbx_inst = inst
	_root.add_child(_fbx_inst)
	_skeleton = _find_first(_fbx_inst, "Skeleton3D") as Skeleton3D
	if _skeleton == null:
		printerr("[mocap] Skeleton3D не найден в ", fbx_path)
		_set_status("SKEL NOT FOUND: " + fbx_path)
		return
	var player := _find_first(_fbx_inst, "AnimationPlayer") as AnimationPlayer
	if player != null:
		var names := player.get_animation_list()
		if not names.is_empty():
			player.play(names[0])
			player.speed_scale = 0.85
			_set_status("Анимация: " + names[0] + " | " + fbx_path)
		else:
			_set_status("АНИМАЦИЯ НЕ НАЙДЕНА: " + fbx_path)
	else:
		_set_status("AnimationPlayer не найден: " + fbx_path)
	_attach_clothes()
	_paint_head()


func _attach_clothes() -> void:
	## Одежда — жёсткие меши без скина. Крепим к кости груди и масштабируем под торс.
	if _skeleton == null:
		return

	var chest_idx := _find_bone_any(["spine_03", "spine_02", "Chest"])
	if chest_idx < 0:
		push_warning("[mocap] нет кости груди — одежду не к чему прикрепить")
		return

	var torso_len := 0.55
	var hips_idx := _find_bone_any(["spine_01", "Spine"])
	if hips_idx >= 0:
		var a: Vector3 = _skeleton.get_bone_global_rest(chest_idx).origin
		var b: Vector3 = _skeleton.get_bone_global_rest(hips_idx).origin
		torso_len = maxf(a.distance_to(b), 0.15)

	_add_cloth(clothing_path, "", torso_len)


func _add_cloth(path: String, bone_hint: String, torso_len: float) -> void:
	if not ResourceLoader.exists(path):
		print("[mocap] одежда не найдена, пропускаем: %s" % path)
		return
	var packed := ResourceLoader.load(path) as PackedScene
	if packed == null:
		return
	var inst := packed.instantiate() as Node3D
	if inst == null:
		return

	var meshes: Array = _collect_meshes(inst)
	if meshes.is_empty():
		inst.queue_free()
		return

	var low := Vector3(INF, INF, INF)
	var high := Vector3(-INF, -INF, -INF)
	for mi: MeshInstance3D in meshes:
		if mi.mesh == null:
			continue
		var m_aabb := mi.transform * mi.mesh.get_aabb()
		low = low.min(m_aabb.position)
		low = low.min(m_aabb.position + m_aabb.size)
		high = high.max(m_aabb.position)
		high = high.max(m_aabb.position + m_aabb.size)
	var size := high - low
	if size.y < 0.01 or size.x < 0.01:
		inst.queue_free()
		push_warning("[mocap] у одежды пустой AABB: %s" % path)
		return

	var bone_name := bone_hint
	if bone_hint == "":
		bone_name = _skeleton.get_bone_name(_find_bone_any(["spine_03", "spine_02", "Chest"]))

	var attachment := BoneAttachment3D.new()
	attachment.name = "Cloth_" + path.get_file().get_basename()
	attachment.bone_name = bone_name
	_skeleton.add_child(attachment)

	var scale_f := torso_len * 1.9 / size.y
	var center := (low + high) * 0.5
	var pivot := Node3D.new()
	pivot.name = "Fit"
	pivot.scale = Vector3(scale_f, scale_f, scale_f)
	pivot.position = -center * scale_f
	attachment.add_child(pivot)

	# Переносим entire корень одежды (Cloth) под pivot — все его дети поедут за ним.
	pivot.add_child(inst)
	print("[mocap] одежда надета: %s (кость %s, масштаб %.2f)" % [path.get_file(), bone_name, scale_f])


func _find_bone_any(names: Array) -> int:
	for n in names:
		var idx := _skeleton.find_bone(String(n))
		if idx >= 0:
			return idx
	return -1


func _collect_meshes(node: Node) -> Array:
	var out: Array = []
	if node is MeshInstance3D:
		out.append(node as MeshInstance3D)
	for child in node.get_children():
		out.append_array(_collect_meshes(child))
	return out


func _paint_head(node: Node = null) -> void:
	## Красим голову/лицо мокап-персонажа. Без аргумента — от корня FBX, с аргументом —
	## рекурсивно по вложенным узлам.
	var start: Node = node if node != null else _fbx_inst
	if start == null:
		return
	var hair_mat := StandardMaterial3D.new()
	hair_mat.albedo_texture = load("res://assets/characters/superhero_male/T_Hair_1_BaseColor.png")
	var eye_mat := StandardMaterial3D.new()
	eye_mat.albedo_texture = load("res://assets/characters/superhero_male/T_Eye_Brown.png")
	for child in start.get_children():
		if child is MeshInstance3D:
			var mi := child as MeshInstance3D
			var tag := String(mi.name).to_lower()
			var mesh_name := ""
			if mi.mesh != null:
				mesh_name = String(mi.mesh.resource_name).to_lower()
			tag += " " + mesh_name
			if tag.contains("eye"):
				mi.material_override = eye_mat
			elif tag.contains("hair") or tag.contains("head") or tag.contains("face"):
				mi.material_override = hair_mat
			else:
				_paint_meshes_mi(mi)
		else:
			_paint_head(child)


func _paint_meshes_mi(mi: MeshInstance3D) -> void:
	## Покраска одного MeshInstance цветами (fallback).
	var tag := String(mi.name).to_lower()
	if mi.mesh != null:
		tag += " " + String(mi.mesh.resource_name).to_lower()
	var mat := StandardMaterial3D.new()
	if tag.contains("eye"):
		mat.albedo_color = Color(0.88, 0.89, 0.92)
		mat.roughness = 0.15
	elif tag.contains("teeth") or tag.contains("tooth") or tag.contains("tongue"):
		mat.albedo_color = Color(0.94, 0.93, 0.90)
		mat.roughness = 0.35
	else:
		mat.albedo_color = skin_color
		mat.roughness = 0.65
	mi.material_override = mat


func _set_fbx(index: int) -> void:
	## Переключение между анимациями: 0 = присед, 1 = отжимание.
	if index < 0 or index >= ANIM_PATHS.size():
		return
	_fbx_index = index
	fbx_path = ANIM_PATHS[_fbx_index]
	print("[mocap] переключаем анимацию: " + fbx_path)
	_load_animated_fbx()


func _get_player() -> AnimationPlayer:
	if _fbx_inst == null:
		return null
	return _find_first(_fbx_inst, "AnimationPlayer") as AnimationPlayer


func _find_first(node: Node, type_name: String) -> Node:
	if node.is_class(type_name):
		return node
	for child in node.get_children():
		var found := _find_first(child, type_name)
		if found != null:
			return found
	return null


func _bone_names(limit: int) -> Array:
	var out := Array()
	if _skeleton == null:
		return out
	var count := mini(limit, _skeleton.get_bone_count())
	for i in count:
		out.append(_skeleton.get_bone_name(i))
	return out


func _log_tree(node: Node, depth: int) -> void:
	if depth > 2:
		return
	var name := node.name
	print("  ".repeat(depth) + String(name))
	for child in node.get_children():
		_log_tree(child, depth + 1)


func _longest_animation(names: PackedStringArray) -> StringName:
	var best := ""
	var best_len := 0.0
	for n in names:
		var anim := _get_player().get_animation(n)
		if anim != null and anim.length > best_len:
			best_len = anim.length
			best = n
	return best
