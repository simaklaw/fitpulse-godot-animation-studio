extends SceneTree
## Рантайм-проверка mocap_player.gd на фейковых «FBX» (скелет + AnimationPlayer в памяти).
var _fails := 0
func _ok(cond: bool, text: String) -> void:
	print(("  ок: " if cond else "  ПРОВАЛ: ") + text)
	if not cond:
		_fails += 1

func _make_fake(path: String, bone_height: float) -> void:
	var root_node := Node3D.new()
	root_node.name = "Root"
	var skel := Skeleton3D.new()
	skel.name = "Skeleton3D"
	root_node.add_child(skel)
	skel.owner = root_node
	skel.add_bone("hips"); skel.add_bone("head"); skel.add_bone("foot")
	skel.set_bone_parent(1, 0)
	skel.set_bone_parent(2, 0)
	skel.set_bone_rest(0, Transform3D(Basis.IDENTITY, Vector3(0, bone_height * 0.55, 0)))
	skel.set_bone_rest(1, Transform3D(Basis.IDENTITY, Vector3(0, bone_height * 0.45, 0)))
	skel.set_bone_rest(2, Transform3D(Basis.IDENTITY, Vector3(0, -bone_height * 0.55, 0)))
	skel.reset_bone_poses()
	var ap := AnimationPlayer.new()
	ap.name = "AnimationPlayer"
	root_node.add_child(ap)
	ap.owner = root_node
	var anim := Animation.new()
	anim.length = 2.0
	var tr := anim.add_track(Animation.TYPE_ROTATION_3D)
	anim.track_set_path(tr, NodePath("Skeleton3D:hips"))
	anim.rotation_track_insert_key(tr, 0.0, Quaternion.IDENTITY)
	anim.rotation_track_insert_key(tr, 2.0, Quaternion(Vector3.RIGHT, 0.5))
	var lib := AnimationLibrary.new()
	lib.add_animation(&"Fake", anim)
	ap.add_animation_library("", lib)
	var packed := PackedScene.new()
	packed.pack(root_node)
	ResourceSaver.save(packed, path)
	root_node.free()

func _initialize() -> void:
	_make_fake("user://fake_a.tscn", 1.8)
	_make_fake("user://fake_b.tscn", 1.7)

	var player := (load("res://scripts/demo/mocap_player.gd") as GDScript).new() as Node3D
	player.files = [
		{"name": "А", "path": "user://fake_a.tscn"},
		{"name": "Б", "path": "user://fake_b.tscn"},
		{"name": "Нет", "path": "user://missing.tscn"},
	]
	root.add_child(player)
	for i in 4:
		await process_frame

	var ap: AnimationPlayer = player.get("_player")
	_ok(ap != null, "AnimationPlayer найден после загрузки")
	_ok(ap != null and ap.is_playing(), "анимация играет")
	_ok(ap != null and absf(ap.speed_scale - 0.85) < 0.001, "скорость 0.85")
	var anim := ap.get_animation(&"Fake")
	_ok(anim.loop_mode == Animation.LOOP_LINEAR, "анимация зациклена")
	var slider: HSlider = player.get("_slider")
	_ok(absf(slider.max_value - 2.0) < 0.001, "ползунок: длина = 2.0 (получено %.2f)" % slider.max_value)

	# кадрирование по росту скелета (1.8 м): цель по центру, расстояние ≈ 1.9 × рост
	var target: Vector3 = player.get("_target")
	var dist: float = player.get("_distance")
	_ok(absf(target.y - 0.9) < 0.1, "камера нацелена на центр скелета (y=%.2f)" % target.y)
	_ok(absf(dist - 1.8 * 1.9) < 0.3, "расстояние по росту (%.2f)" % dist)

	# пауза / сначала
	player.call("_toggle_pause")
	_ok(not ap.is_playing(), "пауза работает")
	player.call("_toggle_pause")
	_ok(ap.is_playing(), "продолжение работает")

	# перемотка ползунком: старт → значение → конец
	player.call("_on_scrub_started")
	_ok(not ap.is_playing(), "начало перемотки ставит паузу")
	player.call("_on_scrub_value", 1.2)
	_ok(absf(ap.current_animation_position - 1.2) < 0.02, "перемотка на 1.2 с (получено %.2f)" % ap.current_animation_position)
	await process_frame
	_ok(absf(ap.current_animation_position - 1.2) < 0.02, "позиция держится на паузе после кадра (%.2f)" % ap.current_animation_position)
	_ok(absf(float(player.get("_slider").value) - 1.2) < 0.02 or bool(player.get("_scrubbing")), "ползунок не откатывается во время перемотки")
	player.call("_on_scrub_ended", true)
	_ok(ap.is_playing(), "после перемотки воспроизведение продолжилось")

	# скорость
	player.call("_change_speed", 0.05)
	_ok(absf(ap.speed_scale - 0.90) < 0.001, "скорость +0.05 → 0.90")
	for i in 60:
		player.call("_change_speed", -0.05)
	_ok(absf(ap.speed_scale - 0.1) < 0.001, "скорость не уходит ниже 0.10 (%.2f)" % ap.speed_scale)

	# перемотка, когда анимация уже стоит на паузе: после отпускания остаётся на паузе, ползунок не откатывается
	player.call("_toggle_pause")
	_ok(not ap.is_playing(), "пауза поставлена вручную")
	player.call("_on_scrub_started")
	player.call("_on_scrub_value", 0.7)
	player.call("_on_scrub_ended", true)
	for i in 3:
		await process_frame
	_ok(not ap.is_playing(), "после перемотки на паузе воспроизведение НЕ запустилось")
	_ok(absf(float(player.get("_slider").value) - 0.7) < 0.02, "ползунок остался на 0.7 (получено %.2f)" % float(player.get("_slider").value))
	var hud: Label = player.get("_label")
	_ok(hud.text.contains("0.70") and hud.text.contains("2.00"), "HUD на паузе показывает время: «%s»" % hud.text.replace("\n", " | "))
	player.call("_toggle_pause")

	# шаг по времени на паузе
	player.call("_toggle_pause")
	player.call("_restart")
	player.call("_toggle_pause")
	player.call("_step_time", 0.5)
	_ok(absf(ap.current_animation_position - 0.5) < 0.02, "шаг по времени +0.5 с")

	# орбита и зум
	var yaw0: float = player.get("_yaw")
	player.call("_orbit", Vector2(100.0, 0.0))
	var yaw1: float = player.get("_yaw")
	_ok(absf((yaw0 - yaw1) - 35.0) < 0.01, "орбита: сдвиг 100 px = 35°")
	player.call("_orbit", Vector2(0.0, 10000.0))
	_ok(float(player.get("_pitch")) <= 70.0, "тангаж ограничен сверху")
	for i in 40:
		player.call("_zoom", 0.5)
	_ok(float(player.get("_distance")) >= 1.2, "зум ограничен снизу")
	player.call("_cycle_view")
	_ok(int(player.get("_view_index")) == 1, "смена вида")

	# переключение на второе и несуществующее упражнение
	player.call("_switch", 1)
	for i in 3:
		await process_frame
	ap = player.get("_player")
	_ok(ap != null and ap.is_playing(), "после переключения играет второе упражнение")
	var skel: Skeleton3D = player.get("_skeleton")
	_ok(skel != null and skel.get_bone_count() == 3, "скелет второго упражнения загружен")
	player.call("_switch", 2)
	for i in 3:
		await process_frame
	_ok(player.get("_player") == null, "несуществующий файл: плеер сброшен без падения")
	var label: Label = player.get("_label")
	_ok(label.text.contains("НЕТ ФАЙЛА"), "причина показана в HUD: «%s»" % label.text.replace("\n", " | "))
	player.call("_switch", 0)
	for i in 3:
		await process_frame
	_ok(player.get("_player") != null, "возврат к первому упражнению")

	# эмулированная мышь не вращает камеру второй раз
	var yaw_before: float = player.get("_yaw")
	var ev := InputEventMouseButton.new()
	ev.button_index = MOUSE_BUTTON_LEFT
	ev.pressed = true
	ev.device = InputEvent.DEVICE_ID_EMULATION
	player.call("_input", ev)
	var mv := InputEventMouseMotion.new()
	mv.relative = Vector2(50.0, 0.0)
	mv.device = InputEvent.DEVICE_ID_EMULATION
	player.call("_input", mv)
	_ok(is_equal_approx(float(player.get("_yaw")), yaw_before), "эмулированная из касания мышь игнорируется")
	# настоящий палец: touch + drag вращает
	var touch := InputEventScreenTouch.new()
	touch.index = 0
	touch.pressed = true
	touch.position = Vector2(300.0, 100.0)
	player.call("_input", touch)
	var drag := InputEventScreenDrag.new()
	drag.index = 0
	drag.relative = Vector2(40.0, 0.0)
	player.call("_input", drag)
	_ok(float(player.get("_yaw")) < yaw_before - 13.0, "один палец вращает камеру")
	var touch2 := InputEventScreenTouch.new()
	touch2.index = 1
	touch2.pressed = true
	touch2.position = Vector2(400.0, 100.0)
	player.call("_input", touch2)
	var yaw_two: float = player.get("_yaw")
	player.call("_input", drag)
	_ok(is_equal_approx(float(player.get("_yaw")), yaw_two), "два пальца (щипок) камеру не вращают")

	print("=== итог: %s ===" % ("ВСЁ ОК" if _fails == 0 else "%d провал(ов)" % _fails))
	quit(0 if _fails == 0 else 1)
