extends Node3D
## Плеер мокап-анимаций: переключение упражнений, пауза, ползунок времени, орбита камеры.
## Каждое упражнение — отдельный FBX с анимацией (свой Skeleton3D и AnimationPlayer).
##
## Управление пальцем (Android):
##   * кнопки внизу: упражнения, пауза, сначала, скорость, вид, зум;
##   * ползунок времени: потянуть — пауза и перемотка, отпустить — продолжить;
##   * свободная область экрана: один палец вращает камеру, щипок — зум.
## Клавиатура/мышь (ПК): 1–4 выбор, пробел пауза, R сброс, +/- скорость, V вид,
##   ←/→ шаг по времени, колесо — зум, левая кнопка мыши — вращение.

@export var play_speed: float = 0.85
## Список одежды: жёсткие меши (без скина). bone="" — крепить к кости груди.
const const const CLOTHES: Array = [: Array = [: Array = [
	{"name": "Raglan футболка", "path": "res://assets/characters/sportdemo_const CLOTHES: Array = [/277-male raglan tshirt/glb/glb.glb", "bone": ""},
]

const FILES: Array = [
	{"name": "Присед", "path": "res://assets/characters/sportdemo/AS_Calisthenics_001_Squats.FBX"},
	{"name": "Отжимание", "path": "res://assets/characters/sportdemo/AS_Calisthenics_004_Push_ups.FBX"},
	{"name": "Скручивания", "path": "res://assets/characters/sportdemo/AS_Calisthenics_044_Standing_Oblique_Twists.FBX"},
	{"name": "Подъём ног", "path": "res://assets/characters/sportdemo/AS_PullUpBar_016_Half_Leg_Raises.FBX"},
]
const VIEWS: Array = [
	{"name": "Сбоку", "yaw": 90.0, "pitch": 6.0},
	{"name": "3/4", "yaw": 135.0, "pitch": 12.0},
	{"name": "Спереди", "yaw": 180.0, "pitch": 6.0},
	{"name": "Сзади", "yaw": 0.0, "pitch": 6.0},
]
const SPEED_MIN := 0.1
const SPEED_MAX := 2.0
const PITCH_MIN := -25.0
const PITCH_MAX := 70.0
const DIST_MIN := 1.2
const DIST_MAX := 9.0
const FRAME_STEP := 0.05          ## с: шаг по времени стрелками на паузе

## Список упражнений (по умолчанию FILES). Переопределяется до добавления в дерево — для тестов.
var files: Array = FILES.duplicate()

var _current: Node3D = null
var _player: AnimationPlayer = null
var _skeleton: Skeleton3D = null
var _index := 0
var _load_id := 0                 ## защита от устаревших загрузок при быстром переключении

# Камера (орбита)
var _camera: Camera3D
var _target := Vector3(0.0, 0.9, 0.0)
var _yaw := 90.0
var _pitch := 6.0
var _distance := 3.2
var _view_index := 0
var _touches: Dictionary = {}     ## index пальца → true (только начатые вне панели)
var _mouse_orbit := false

# Интерфейс
var _label: Label
var _bottom: PanelContainer
var _slider: HSlider
var _scrubbing := false
var _was_playing := false
var _exercise_buttons: Array = []
var _pause_button: Button
var _speed_label: Label
var _status := ""


func _ready() -> void:
	_build_world()
	_build_ui()
	_load_current()


func _process(_delta: float) -> void:
	_update_camera()
	if _label == null:
		return

	var t := 0.0
	var length := _anim_length()
	var speed := 0.0
	var state := "—"
	if _player != null:
		speed = _player.speed_scale
		state = "▶" if _player.is_playing() else "⏸"
		if length > 0.0:
			t = _player.current_animation_position
	var info = files[_index]
	if _player == null:
		_label.text = "%s\n%s" % [String(info["name"]), _status]   # причина, почему не играет
	else:
		_label.text = "%s %s\n%.2f / %.2f с · %.2f×" % [state, String(info["name"]), t, length, speed]
	if _speed_label != null:
		_speed_label.text = "%.2f×" % speed
	if _slider != null and not _scrubbing and length > 0.0:
		_slider.max_value = length
		_slider.set_value_no_signal(t)


# ---------------------------------------------------------------------------
# Ввод
# ---------------------------------------------------------------------------
## Касания, мышь и щипок читаем в _input (до GUI), чтобы работало и когда указатель
## над интерфейсом; сами решаем по прямоугольнику нижней панели, вращать камеру или нет.
func _input(event: InputEvent) -> void:
	if event is InputEventScreenTouch:
		var touch := event as InputEventScreenTouch
		if touch.pressed:
			if not _over_panel(touch.position):
				_touches[touch.index] = true
		else:
			_touches.erase(touch.index)
		return

	if event is InputEventScreenDrag:
		var drag := event as InputEventScreenDrag
		# Один палец вращает, два — это щипок (зум), а не вращение.
		if _touches.size() == 1 and _touches.has(drag.index):
			_orbit(drag.relative)
		return

	if event is InputEventMagnifyGesture:
		var gesture := event as InputEventMagnifyGesture
		_zoom(1.0 / maxf(gesture.factor, 0.01))
		return

	# Мышь. События, эмулированные из касаний, пропускаем: касания уже обработаны выше,
	# иначе камера вращалась бы вдвое быстрее.
	if event is InputEventMouseButton:
		var button := event as InputEventMouseButton
		if button.device == InputEvent.DEVICE_ID_EMULATION:
			return
		match button.button_index:
			MOUSE_BUTTON_LEFT:
				_mouse_orbit = button.pressed and not _over_panel(button.position)
			MOUSE_BUTTON_WHEEL_UP:
				if button.pressed and not _over_panel(button.position):
					_zoom(0.9)
			MOUSE_BUTTON_WHEEL_DOWN:
				if button.pressed and not _over_panel(button.position):
					_zoom(1.1)
		return

	if event is InputEventMouseMotion:
		var motion := event as InputEventMouseMotion
		if motion.device != InputEvent.DEVICE_ID_EMULATION and _mouse_orbit:
			_orbit(motion.relative)


func _unhandled_input(event: InputEvent) -> void:
	var key := event as InputEventKey
	if key == null or not key.pressed:
		return
	match key.keycode:
		KEY_1:
			_switch(0)
		KEY_2:
			_switch(1)
		KEY_3:
			_switch(2)
		KEY_4:
			_switch(3)
		KEY_SPACE:
			_toggle_pause()
		KEY_R:
			_restart()
		KEY_V:
			_cycle_view()
		KEY_EQUAL, KEY_KP_ADD:
			_change_speed(0.05)
		KEY_MINUS, KEY_KP_SUBTRACT:
			_change_speed(-0.05)
		KEY_RIGHT:
			_step_time(FRAME_STEP)
		KEY_LEFT:
			_step_time(-FRAME_STEP)


func _over_panel(panel_pos: Vector2) -> bool:
	return _bottom != null and _bottom.get_global_rect().has_point(panel_pos)


# ---------------------------------------------------------------------------
# Действия
# ---------------------------------------------------------------------------
func _switch(index: int) -> void:
	if index < 0 or index >= files.size():
		return
	if index == _index and _current != null:
		return
	_index = index
	_load_current()


func _toggle_pause() -> void:
	if _player == null:
		return
	if _player.is_playing():
		_player.pause()
	else:
		_player.play()


func _restart() -> void:
	if _player == null:
		return
	_player.seek(0.0, true)
	if not _player.is_playing():
		_player.play()


func _change_speed(delta: float) -> void:
	play_speed = clampf(play_speed + delta, SPEED_MIN, SPEED_MAX)
	if _player != null:
		_player.speed_scale = play_speed


## ВАЖНО: после pause() у AnimationPlayer current_animation пуст, а имя хранит
## assigned_animation — поэтому длину и «есть ли анимация» берём по нему.
func _anim_length() -> float:
	if _player == null or _player.assigned_animation == "":
		return 0.0
	var anim: Animation = _player.get_animation(_player.assigned_animation)
	if anim == null:
		return 0.0
	return anim.length


func _step_time(delta: float) -> void:
	var length := _anim_length()
	if _player == null or length <= 0.0:
		return
	var t := clampf(_player.current_animation_position + delta, 0.0, length)
	_player.seek(t, true)


func _cycle_view() -> void:
	_set_view((_view_index + 1) % VIEWS.size())


func _set_view(index: int) -> void:
	_view_index = clampi(index, 0, VIEWS.size() - 1)
	var view: Dictionary = VIEWS[_view_index]
	_yaw = float(view["yaw"])
	_pitch = float(view["pitch"])


func _orbit(relative: Vector2) -> void:
	_yaw -= relative.x * 0.35
	_pitch = clampf(_pitch + relative.y * 0.35, PITCH_MIN, PITCH_MAX)


func _zoom(factor: float) -> void:
	_distance = clampf(_distance * factor, DIST_MIN, DIST_MAX)


func _on_scrub_started() -> void:
	_scrubbing = true
	if _player != null:
		_was_playing = _player.is_playing()
		_player.pause()


func _on_scrub_value(value: float) -> void:
	if _scrubbing and _anim_length() > 0.0:
		_player.seek(value, true)


func _on_scrub_ended(_changed: bool) -> void:
	_scrubbing = false
	if _player != null and _was_playing:
		_player.play()


# ---------------------------------------------------------------------------
# Загрузка упражнения
# ---------------------------------------------------------------------------
func _load_current() -> void:
	_load_id += 1
	var my_id := _load_id

	if _current != null:
		remove_child(_current)
		_current.queue_free()
		_current = null
	_player = null
	_skeleton = null
	_sync_exercise_buttons()

	var info = files[_index]
	var path := String(info["path"])
	if not ResourceLoader.exists(path):
		_set_status("НЕТ ФАЙЛА: %s" % path)
		return
	var packed := load(path) as PackedScene
	if packed == null:
		_set_status("Не удалось загрузить: %s" % path)
		return
	var instance := packed.instantiate() as Node3D
	if instance == null:
		_set_status("Не удалось создать экземпляр: %s" % path)
		return
	if my_id != _load_id:
		instance.queue_free()
		return

	_current = instance
	_current.name = "CurrentExercise"
	add_child(_current)

	_skeleton = _find_first(_current, "Skeleton3D") as Skeleton3D
	_player = _find_first(_current, "AnimationPlayer") as AnimationPlayer
	if _skeleton != null:
		print("[mocap player] загружен '%s', костей: %d" % [info["name"], _skeleton.get_bone_count()])
		_frame_skeleton()

	if _player == null:
		_set_status("AnimationPlayer не найден: %s" % path)
		return
	var names := _player.get_animation_list()
	if names.is_empty():
		_set_status("Анимаций нет: %s" % path)
		return

	var anim_name: StringName = names[0]
	var anim := _player.get_animation(anim_name)
	if anim != null:
		anim.loop_mode = Animation.LOOP_LINEAR
		if _slider != null:
			_slider.max_value = maxf(anim.length, 0.01)
			_slider.set_value_no_signal(0.0)
		print("[mocap] играем '%s', длина %.2f с, треков %d" % [anim_name, anim.length, anim.get_track_count()])
	_player.speed_scale = play_speed
	_player.play(anim_name)
	_set_status("Загружено: %s" % info["name"])

	# Привязка одежды и покраска головы после загрузки скелета.
	_attach_const CLOTHES: Array = [()
	_paint_head()


func _attach_const CLOTHES: Array = [() -> void:
	## Одежда в проекте — жёсткие меши без скина (raglan glb, mens t-shirt gltf, tanktop fbx).
	## Скиннуть их на UE-скелет мокапа по именам костей нельзя (имён нет), поэтому одежда
	## крепится к кости груди (spine_03) и масштабируется под торс персонажа.
	if _skeleton == null:
		return

	var chest_idx := _find_bone_any(["spine_03", "spine_02", "Chest"])
	if chest_idx < 0:
		push_warning("[mocap] нет кости груди — одежду не к чему прикрепить")
		return

	# Размер торса в метрах: от таза (spine_01) до шеи/верха груди.
	var torso_len := 0.55
	var hips_idx := _find_bone_any(["spine_01", "Spine"])
	if hips_idx >= 0:
		var a: Vector3 = _skeleton.get_bone_global_rest(chest_idx).origin
		var b: Vector3 = _skeleton.get_bone_global_rest(hips_idx).origin
		torso_len = maxf(a.distance_to(b), 0.15)

	for entry in const CLOTHES: Array = [:
		_add_cloth(String(entry["path"]), String(entry["bone"]), torso_len)


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

	# AABB одежды в её локальных координатах (до переноса под кость).
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

	# Позиционируем меш так, чтобы центр его AABB совпал с костью груди,
	# а высота стала равна ~1.9 длины торса (футболка закрывает грудь и живот).
	var scale_f := torso_len * 1.9 / size.y
	var center := (low + high) * 0.5
	var pivot := Node3D.new()
	pivot.name = "Fit"
	pivot.scale = Vector3(scale_f, scale_f, scale_f)
	pivot.position = -center * scale_f
	attachment.add_child(pivot)

	# Переносим całый корень одежды (Cloth) под pivot — все его дети поедут за ним.
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
	var start: Node = node if node != null else _current
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
		mat.albedo_color = Color(0.80, 0.64, 0.53)
		mat.roughness = 0.65
	mi.material_override = mat


## Камера смотрит на центр скелета, расстояние — по росту (FBX из разных паков разного масштаба).
func _frame_skeleton() -> void:
	if _skeleton == null or _skeleton.get_bone_count() == 0:
		return
	var low := Vector3(INF, INF, INF)
	var high := Vector3(-INF, -INF, -INF)
	for i in _skeleton.get_bone_count():
		var point: Vector3 = _skeleton.global_transform * _skeleton.get_bone_global_rest(i).origin
		low = low.min(point)
		high = high.max(point)
	var height := high.y - low.y
	if height < 0.2:
		return
	_target = (low + high) * 0.5
	_distance = clampf(height * 1.9, DIST_MIN, DIST_MAX)


func _find_first(node: Node, type_name: String) -> Node:
	if node.is_class(type_name):
		return node
	for child in node.get_children():
		var found := _find_first(child, type_name)
		if found != null:
			return found
	return null


# ---------------------------------------------------------------------------
# Мир
# ---------------------------------------------------------------------------
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
	_set_view(0)
	_update_camera()


func _update_camera() -> void:
	if _camera == null or not _camera.is_inside_tree():
		return
	var rad_yaw := deg_to_rad(_yaw)
	var rad_pitch := deg_to_rad(_pitch)
	_camera.global_position = Vector3(
		_target.x + _distance * cos(rad_pitch) * sin(rad_yaw),
		_target.y + _distance * sin(rad_pitch),
		_target.z + _distance * cos(rad_pitch) * cos(rad_yaw)
	)
	_camera.look_at(_target, Vector3.UP)


# ---------------------------------------------------------------------------
# Интерфейс
# ---------------------------------------------------------------------------
func _build_ui() -> void:
	var layer := CanvasLayer.new()
	add_child(layer)

	# Верхняя плашка: только информация, касания пропускает к камере.
	var top := PanelContainer.new()
	top.mouse_filter = Control.MOUSE_FILTER_IGNORE
	top.position = Vector2(12.0, 12.0)
	top.add_theme_stylebox_override("panel", _panel_style(0.55))
	layer.add_child(top)
	_label = Label.new()
	_label.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_label.add_theme_font_size_override("font_size", 18)
	_label.add_theme_color_override("font_color", Color(0.9, 0.94, 1.0))
	top.add_child(_label)

	# Нижняя панель управления (растёт вверх от нижнего края).
	_bottom = PanelContainer.new()
	_bottom.set_anchors_and_offsets_preset(Control.PRESET_BOTTOM_WIDE)
	_bottom.offset_left = 8.0
	_bottom.offset_right = -8.0
	_bottom.offset_bottom = -8.0
	_bottom.grow_vertical = Control.GROW_DIRECTION_BEGIN
	_bottom.add_theme_stylebox_override("panel", _panel_style(0.72))
	layer.add_child(_bottom)

	var column := VBoxContainer.new()
	column.add_theme_constant_override("separation", 6)
	_bottom.add_child(column)

	# Ряд 1: упражнения
	var exercises := HFlowContainer.new()
	exercises.add_theme_constant_override("h_separation", 6)
	exercises.add_theme_constant_override("v_separation", 6)
	column.add_child(exercises)
	var group := ButtonGroup.new()
	for i in files.size():
		var info = files[i]
		var button := _make_button("%d · %s" % [i + 1, String(info["name"])], _switch.bind(i))
		button.toggle_mode = true
		button.button_group = group
		exercises.add_child(button)
		_exercise_buttons.append(button)

	# Ряд 2: управление
	var controls := HFlowContainer.new()
	controls.add_theme_constant_override("h_separation", 6)
	controls.add_theme_constant_override("v_separation", 6)
	column.add_child(controls)
	_pause_button = _make_button("⏯ Пауза", _toggle_pause)
	controls.add_child(_pause_button)
	controls.add_child(_make_button("⟲ Сначала", _restart))
	controls.add_child(_make_button("− Медл.", _change_speed.bind(-0.05)))
	_speed_label = Label.new()
	_speed_label.custom_minimum_size = Vector2(64.0, 0.0)
	_speed_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_speed_label.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	_speed_label.add_theme_font_size_override("font_size", 18)
	controls.add_child(_speed_label)
	controls.add_child(_make_button("+ Быстр.", _change_speed.bind(0.05)))
	controls.add_child(_make_button("Вид", _cycle_view))
	controls.add_child(_make_button("Зум −", _zoom.bind(1.15)))
	controls.add_child(_make_button("Зум +", _zoom.bind(0.87)))

	# Ряд 3: ползунок времени
	_slider = HSlider.new()
	_slider.min_value = 0.0
	_slider.max_value = 1.0
	_slider.step = 0.01
	_slider.custom_minimum_size = Vector2(0.0, 44.0)
	_slider.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_slider.drag_started.connect(_on_scrub_started)
	_slider.value_changed.connect(_on_scrub_value)
	_slider.drag_ended.connect(_on_scrub_ended)
	column.add_child(_slider)


func _make_button(text: String, action: Callable) -> Button:
	var button := Button.new()
	button.text = text
	button.focus_mode = Control.FOCUS_NONE
	button.custom_minimum_size = Vector2(0.0, 52.0)
	button.add_theme_font_size_override("font_size", 18)
	button.pressed.connect(action)
	return button


func _panel_style(alpha: float) -> StyleBoxFlat:
	var style := StyleBoxFlat.new()
	style.bg_color = Color(0.0, 0.0, 0.0, alpha)
	style.set_corner_radius_all(8)
	style.content_margin_left = 12.0
	style.content_margin_right = 12.0
	style.content_margin_top = 8.0
	style.content_margin_bottom = 8.0
	return style


func _sync_exercise_buttons() -> void:
	for i in _exercise_buttons.size():
		_exercise_buttons[i].set_pressed_no_signal(i == _index)


func _set_status(text: String) -> void:
	_status = text
	print("[mocap player] ", text)
