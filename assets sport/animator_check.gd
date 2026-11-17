extends SceneTree
## Проверка ExerciseAnimator: счёт повторов при baked_reps > 1 и HUD-оценка глубины.
##   godot --headless -s tools/animator_check.gd
## Код возврата 0 — всё ок.

var _failures := PackedStringArray()


func _initialize() -> void:
	var rig := HumanoidRig.new()
	rig.name = "Rig"
	root.add_child(rig)
	var player := AnimationPlayer.new()
	player.name = "AnimationPlayer"
	rig.add_child(player)
	var animator := ExerciseAnimator.new()
	animator.name = "Animator"
	animator.animation_player_path = ^"../Rig/AnimationPlayer"
	root.add_child(animator)
	await process_frame

	var data := BodyweightSquatExercise.build()
	if not animator.setup(rig, data):
		_fail("setup() вернул false: %s" % str(animator.warnings))
		_finish()
		return

	var counted: Array[int] = []
	animator.rep_completed.connect(func(n: int) -> void: counted.append(n))
	var phases_seen: Array[int] = []
	animator.phase_changed.connect(func(i: int, _p: ExercisePhase) -> void: phases_seen.append(i))

	var dur := animator.duration
	var K := animator.get_phase_count()
	print("=== animator_check: длительность %.2f с, фаз в повторе %d, повторов в анимации %d ===" % [dur, K, data.baked_reps])
	if K != data.phases.size():
		_fail("get_phase_count() = %d, ожидалось %d" % [K, data.phases.size()])

	animator.play(true)
	var dt := 1.0 / 30.0
	var t := 0.0
	var warn_during_descent := 0
	var warn_after_bottom := 0
	var depth_ok_seen := false
	# два полных прохода анимации
	while t < dur * 2.0 + dt * 2.0:
		t += dt
		player.seek(fposmod(t, dur), true)
		animator._process(dt)
		var checks := animator.get_current_checks()
		if not checks.is_empty():
			var depth_check: Dictionary = checks[0]
			var phase_idx := animator.get_current_phase_index()
			# спуск: фазы 1..2 (descent_top, descent_low) — предупреждений о глубине быть не должно
			if (phase_idx == 1 or phase_idx == 2) and depth_check["level"] == "warn":
				warn_during_descent += 1
			if depth_check["level"] == "ok" and String(depth_check["text"]).begins_with("Глубина достигнута"):
				depth_ok_seen = true
			if phase_idx >= 4 and depth_check["level"] == "warn":
				warn_after_bottom += 1

	print("  засчитано повторов за 2 прохода: %d (ожидалось %d), события: %s" % [animator.reps, data.baked_reps * 2, str(counted)])
	if animator.reps != data.baked_reps * 2:
		_fail("счёт повторов: %d вместо %d" % [animator.reps, data.baked_reps * 2])
	var expect_seq: Array[int] = []
	for i in data.baked_reps * 2:
		expect_seq.append(i + 1)
	if counted != expect_seq:
		_fail("rep_completed пришёл в порядке %s, ожидалось %s" % [str(counted), str(expect_seq)])

	print("  HUD: ложных «недосед» на спуске: %d, после низа: %d, «Глубина достигнута» показано: %s" % [warn_during_descent, warn_after_bottom, str(depth_ok_seen)])
	if warn_during_descent > 0:
		_fail("HUD ругается на глубину во время спуска (%d кадров)" % warn_during_descent)
	if warn_after_bottom > 0:
		_fail("HUD пишет недосед при нормальной глубине (%d кадров)" % warn_after_bottom)
	if not depth_ok_seen:
		_fail("HUD ни разу не показал «Глубина достигнута»")

	# индекс фазы внутри повтора: 0..K-1, и все они встречаются
	var seen := {}
	for p in phases_seen:
		seen[p] = true
		if p < 0 or p >= K:
			_fail("phase_changed с индексом вне 0..%d: %d" % [K - 1, p])
	if seen.size() != K:
		_fail("встретились не все фазы: %s" % str(seen.keys()))

	# seek_phase прыгает внутри текущего повтора и не засчитывает повтор
	var before := animator.reps
	animator.seek_phase(0)
	animator._process(dt)
	if animator.reps != before:
		_fail("seek_phase(0) засчитал повтор (было %d, стало %d)" % [before, animator.reps])

	_finish()


func _fail(text: String) -> void:
	_failures.append(text)
	print("  ПРОВАЛ: ", text)


func _finish() -> void:
	print("=== итог: %s ===" % ("ВСЁ ОК" if _failures.is_empty() else "%d провал(ов)" % _failures.size()))
	quit(0 if _failures.is_empty() else 1)
