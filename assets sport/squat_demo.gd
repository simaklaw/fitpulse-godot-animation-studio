extends Node3D
## Демо-сцена: присед со штангой + HUD с текущими метриками техники.
##
## Сцена собирается кодом, чтобы не тащить в репозиторий .tscn с зашитыми
## субресурсами: риг, свет, камера и HUD создаются в рантайме, а сцена содержит
## только дерево узлов (Rig / AnimationPlayer / ExerciseAnimator).

const VIEWS: Array = [
	{"name": "Сбоку", "position": Vector3(3.4, 1.15, 0.15)},      # техника — сбоку
	{"name": "3/4", "position": Vector3(2.4, 1.35, -2.4)},
	{"name": "Спереди", "position": Vector3(0.0, 1.30, -3.4)},
]
const VIEW_TARGET := Vector3(0.0, 0.85, 0.0)

var _animator: ExerciseAnimator
var _rig: HumanoidRig
var _camera: Camera3D
var _view_index := 0

var _phase_label: Label
var _cue_label: Label
var _metrics_label: Label
var _checks_label: Label
var _status_label: Label
var _message_label: Label

var _hud_timer := 0.0


func _ready() -> void:
	_build_environment()
	_build_floor()
	_build_light()
	_build_camera()

	_rig = get_node_or_null("Rig") as HumanoidRig
	_animator = get_node_or_null("ExerciseAnimator") as ExerciseAnimator

	_build_hud()

	if _rig == null or _animator == null:
		push_error("SquatDemo: ожидались узлы Rig и ExerciseAnimator")
		return

	_animator.exercise_ready.connect(_on_exercise_ready)
	_animator.rep_completed.connect(_on_rep_completed)

	# Домашняя тренировка без инвентаря: приседание с собственным весом.
	# Присед со штангой (BackSquatExercise) остаётся для «зала» и включается
	# позже — там же, где риг получает has_barbell = true.
	var data := BodyweightSquatExercise.build()
	if _animator.setup(_rig, data):
		_animator.play(true)
	_apply_view(0)


func _process(delta: float) -> void:
	_hud_timer -= delta
	if _hud_timer > 0.0:
		return
	_hud_timer = 0.1
	_refresh_hud()


func _unhandled_input(event: InputEvent) -> void:
	var key := event as InputEventKey
	if key == null or not key.pressed:
		return
	if _animator == null:
		return
	match key.keycode:
		KEY_SPACE:
			_animator.toggle_pause()
		KEY_R:
			_animator.play(true)
		KEY_1:
			_apply_view(0)
		KEY_2:
			_apply_view(1)
		KEY_3:
			_apply_view(2)
		KEY_EQUAL, KEY_KP_ADD:
			_animator.set_tempo_scale(_animator.get_tempo_scale() + 0.1)
		KEY_MINUS, KEY_KP_SUBTRACT:
			_animator.set_tempo_scale(_animator.get_tempo_scale() - 0.1)
		KEY_RIGHT:
			_animator.seek_phase(mini(_animator.get_current_phase_index() + 1, _animator.get_phase_count() - 1))
		KEY_LEFT:
			_animator.seek_phase(maxi(_animator.get_current_phase_index() - 1, 0))


# ---------------------------------------------------------------------------
# Мир
# ---------------------------------------------------------------------------
func _build_environment() -> void:
	var env := Environment.new()
	env.background_mode = Environment.BG_COLOR
	env.background_color = Color(0.085, 0.095, 0.12)
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.ambient_light_color = Color(0.62, 0.68, 0.82)
	env.ambient_light_energy = 0.65
	var world := WorldEnvironment.new()
	world.environment = env
	add_child(world)


func _build_floor() -> void:
	var material := StandardMaterial3D.new()
	material.albedo_color = Color(0.17, 0.19, 0.21)
	material.roughness = 0.92

	var plane := PlaneMesh.new()
	plane.size = Vector2(14.0, 14.0)

	var floor_instance := MeshInstance3D.new()
	floor_instance.name = "Floor"
	floor_instance.mesh = plane
	floor_instance.material_override = material
	add_child(floor_instance)


func _build_light() -> void:
	var light := DirectionalLight3D.new()
	light.name = "Sun"
	light.rotation_degrees = Vector3(-48.0, -35.0, 0.0)
	light.light_energy = 1.15
	light.shadow_enabled = true
	add_child(light)


func _build_camera() -> void:
	_camera = Camera3D.new()
	_camera.name = "Camera3D"
	_camera.fov = 42.0
	add_child(_camera)
	_camera.current = true


func _apply_view(index: int) -> void:
	_view_index = clampi(index, 0, VIEWS.size() - 1)
	if _camera == null:
		return
	var view: Dictionary = VIEWS[_view_index]
	_camera.global_position = view["position"]
	_camera.look_at(VIEW_TARGET, Vector3.UP)


# ---------------------------------------------------------------------------
# HUD
# ---------------------------------------------------------------------------
func _build_hud() -> void:
	var layer := CanvasLayer.new()
	add_child(layer)

	var background := ColorRect.new()
	background.color = Color(0.0, 0.0, 0.0, 0.52)
	background.position = Vector2(14.0, 14.0)
	background.size = Vector2(660.0, 292.0)
	layer.add_child(background)

	var box := VBoxContainer.new()
	box.position = Vector2(28.0, 26.0)
	box.size = Vector2(632.0, 268.0)
	box.add_theme_constant_override("separation", 7)
	layer.add_child(box)

	_status_label = _add_label(box, 20, Color(0.68, 0.78, 0.95))
	_message_label = _add_label(box, 19, Color(1.0, 0.86, 0.55))
	_phase_label = _add_label(box, 24, Color(1.0, 1.0, 1.0))
	_cue_label = _add_label(box, 18, Color(0.85, 0.88, 0.92))
	_metrics_label = _add_label(box, 18, Color(0.70, 0.92, 1.0))
	_checks_label = _add_label(box, 17, Color(0.80, 0.85, 0.80))

	var buttons := HBoxContainer.new()
	buttons.add_theme_constant_override("separation", 10)
	box.add_child(buttons)

	# Обработчики — именованные методы, а не лямбды: читается лучше и не зависит
	# от разбора многострочных lambda в аргументах.
	_add_button(buttons, "▶ / ⏸", _on_pause_pressed)
	_add_button(buttons, "Темп −", _on_tempo_down)
	_add_button(buttons, "Темп +", _on_tempo_up)
	_add_button(buttons, "След. фаза", _on_next_phase)
	_add_button(buttons, "Вид", _on_cycle_view)


func _on_pause_pressed() -> void:
	if _animator != null:
		_animator.toggle_pause()


func _on_tempo_down() -> void:
	if _animator != null:
		_animator.set_tempo_scale(_animator.get_tempo_scale() - 0.1)


func _on_tempo_up() -> void:
	if _animator != null:
		_animator.set_tempo_scale(_animator.get_tempo_scale() + 0.1)


func _on_next_phase() -> void:
	if _animator == null:
		return
	var next := mini(_animator.get_current_phase_index() + 1, _animator.get_phase_count() - 1)
	_animator.seek_phase(next)


func _on_cycle_view() -> void:
	_apply_view((_view_index + 1) % VIEWS.size())


func _add_label(parent: Control, font_size: int, color: Color) -> Label:
	var label := Label.new()
	label.add_theme_font_size_override("font_size", font_size)
	label.add_theme_color_override("font_color", color)
	label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	label.custom_minimum_size = Vector2(632.0, 0.0)
	parent.add_child(label)
	return label


func _add_button(parent: Control, text: String, action: Callable) -> void:
	var button := Button.new()
	button.text = text
	button.custom_minimum_size = Vector2(0.0, 44.0)
	button.pressed.connect(action)
	parent.add_child(button)


func _on_exercise_ready(exercise: ExerciseData, warnings: PackedStringArray) -> void:
	_message_label.text = "Загружено: %s · %d фаз" % [exercise.display_name, exercise.phases.size()]
	for line in warnings:
		push_warning("%s: %s" % [exercise.display_name, line])


func _on_rep_completed(reps: int) -> void:
	_message_label.text = "Повтор %d завершён" % reps


func _refresh_hud() -> void:
	if _animator == null:
		return

	var phase := _animator.get_current_phase()
	var index := _animator.get_current_phase_index()
	var total := _animator.get_phase_count()

	if phase != null:
		var breath := ""
		match phase.breath:
			&"inhale":
				breath = " · вдох"
			&"exhale":
				breath = " · выдох"
			&"hold":
				breath = " · задержка"
		_phase_label.text = "Фаза %d/%d — %s (%.1f с)%s" % [index + 1, total, phase.label, phase.duration, breath]
		_cue_label.text = phase.cue

	_status_label.text = "%s · темп %.1f× · повторов: %d" % [
		"▶" if _animator.is_playing() else "⏸",
		_animator.get_tempo_scale(),
		_animator.reps,
	]

	var metrics := _animator.get_current_metrics()
	if not metrics.is_empty():
		# Глубину показываем ЗАЗОРОМ «таз ниже колена» в см, а не процентом:
		# процент зависит от пропорций рига (на капсуле 62 %, на персонаже 53 %
		# при тех же углах) и читается как ложный недосед.
		# Без грифа строку про гриф не показываем: «Δ0 см» — шум в HUD.
		var text := "Колено %.0f° · Голеностоп %.0f° · Корпус %.0f° · Таз ниже колена %.1f см" % [
			float(metrics["knee_flexion"]),
			float(metrics["ankle_dorsiflexion"]),
			float(metrics["torso_lean"]),
			float(metrics.get("hip_below_knee", 0.0)) * 100.0,
		]
		if _animator.data != null and _animator.data.has_bar:
			text += " · Гриф Δ%.0f см" % (float(metrics["bar_balance"]) * 100.0)
		_metrics_label.text = text

	var lines := PackedStringArray()
	for check: Dictionary in _animator.get_current_checks():
		var prefix := "✔ " if check["level"] == "ok" else "⚠ "
		lines.append(prefix + String(check["text"]))
	_checks_label.text = "\n".join(lines)
