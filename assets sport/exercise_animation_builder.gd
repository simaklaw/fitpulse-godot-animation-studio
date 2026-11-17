class_name ExerciseAnimationBuilder
extends RefCounted
## Генератор Animation из ExerciseData (scripts/animation/exercise_animation_builder.gd).
##
## Что изменено относительно прежней версии:
##   * Кривая считается ПО КАНАЛАМ: монотонный кубический Эрмит (PCHIP, Fritsch–Butland).
##     Канал останавливается только там, где он реально разворачивается или стоит
##     (экстремум / удержание). Раньше «остановочными» были целые узлы для ВСЕХ каналов
##     сразу — отсюда ощущение механизма. PCHIP не даёт перелётов, поэтому clamp не нужен.
##   * Каждый канал сэмплируется по своему времени (MotionLayer.lag_for): руки отстают.
##   * Поверх идёт MotionLayer: дыхание, голова, лёгкая асимметрия.
##   * Равномерная сетка кадров 60 Гц по общему времени (раньше — шаги по фазам с округлением).
##   * Предупреждение «таз выше колена» теперь только для самой глубокой фазы:
##     в стойке и на середине спуска таз и должен быть выше колена.
##
## Формат возвращаемого словаря не изменился (ExerciseAnimator работает без правок).

const SAMPLE_RATE_HZ := 60.0

## Вариация запечённых повторов (детерминированная, по номеру повтора; повтор 0 — как в данных).
## Циклически повторяется каждые 3 повтора. Подбирается так, чтобы разница читалась как
## «человек повторил», но не как «ошибка техники»: глубина ±1.2°, темп ±5 %, руки ±6 %.
const REP_DEPTH_DELTA: Array = [0.0, -1.2, 0.9]   ## град, к thigh и knee одновременно
const REP_TEMPO_MUL: Array = [1.0, 0.95, 1.04]
const REP_ARM_MUL: Array = [1.0, 1.06, 0.94]

const SKELETON_NODE_NAME := "Skeleton3D"
const HIPS_BONE := &"Hips"


static func build(rig: HumanoidRig, data: ExerciseData) -> Dictionary:
	var problems := data.validate()
	if not problems.is_empty():
		for problem in problems:
			push_error("ExerciseData '%s': %s" % [data.exercise_id, problem])
		return _empty_result()

	if rig == null or rig.get_skeleton() == null:
		push_error("ExerciseAnimationBuilder: риг не построен")
		return _empty_result()

	# --- 0. Повторы: N копий фаз подряд, каждая слегка отличается ------------
	var cycles: int = maxi(1, data.baked_reps)
	var per_cycle: int = data.phases.size()
	var phases = []
	for r in cycles:
		for phase: ExercisePhase in data.phases:
			phases.append(_varied_phase(phase, r))

	# --- 1. Цепочка поз: каждая фаза наследует предыдущую -------------------
	var start_pose: Dictionary = PoseUtils.sym(data.base_pose)
	var current: Dictionary = start_pose.duplicate()
	var targets = []
	for phase: ExercisePhase in phases:
		var overrides := PoseUtils.sym(phase.pose)
		current = PoseUtils.merge(current, overrides)
		targets.append(current.duplicate())

	var depth_ref := 1.0
	for target: Dictionary in targets:
		depth_ref = maxf(depth_ref, absf(float(target.get(&"thigh_angle_l", 0.0))))
	var layer := MotionLayer.new(phases, data.has_bar, depth_ref)

	# --- 1.5. Проверка имён каналов (в том числе добавляемых слоем) ---------
	var unknown := rig.validate_channels(targets + [start_pose, MotionLayer.probe_channels()])
	if not unknown.is_empty():
		for problem in unknown:
			push_error("ExerciseData '%s': %s" % [data.exercise_id, problem])
		return _empty_result()

	# --- 2. Кривые по каналам ----------------------------------------------
	var poses: Array = [start_pose]
	poses.append_array(targets)
	var times: Array = [0.0]
	var acc := 0.0
	for phase: ExercisePhase in phases:
		acc += phase.duration
		times.append(acc)
	var duration := acc

	var curves := _build_curves(poses, times)

	# --- 3. Сэмплирование: равномерная сетка по общему времени --------------
	var step_count: int = maxi(2, int(ceil(duration * SAMPLE_RATE_HZ)))
	var frames = []
	var frame_metrics = []
	for k in range(step_count + 1):
		var frame_time := minf(duration * float(k) / float(step_count), duration)
		var pose := _sample_pose(curves, times, duration, data.loop, frame_time, layer)
		var frame_solved := PoseSolver.solve(rig, pose, data.stance_width)
		frames.append(_make_frame(rig, frame_time, frame_solved))
		frame_metrics.append({"time": frame_time, "metrics": frame_solved["metrics"]})

	var phase_spans = []
	var cycle_starts = []
	for i in phases.size():
		if i % per_cycle == 0:
			cycle_starts.append(float(times[i]))
		phase_spans.append({
			"index": i % per_cycle,   # номер фазы внутри повтора
			"slot": i,                # сквозной номер по всей анимации
			"cycle": _cycle_of(i, per_cycle),   # номер повтора
			"start": float(times[i]),
			"end": float(times[i + 1]),
			"phase": phases[i],
		})

	# --- 4. Набор костей и треки -------------------------------------------
	var skeleton_path := rig.get_skeleton_node_path()
	var bone_order: Dictionary = {}
	var ordered_names := rig.get_bone_names()
	for i in ordered_names.size():
		bone_order[ordered_names[i]] = i

	var used_bones: Dictionary = {}
	for frame: Dictionary in frames:
		for bone: StringName in frame["rotations"]:
			used_bones[bone] = true

	var sorted_bones = []
	for bone: StringName in used_bones:
		sorted_bones.append(bone)
	sorted_bones.sort_custom(func(a: StringName, b: StringName) -> bool:
		return int(bone_order.get(a, 999)) < int(bone_order.get(b, 999))
	)

	var anim := Animation.new()
	anim.resource_name = String(data.display_name)
	anim.loop_mode = Animation.LOOP_LINEAR if data.loop else Animation.LOOP_NONE

	for bone: StringName in sorted_bones:
		var track := anim.add_track(Animation.TYPE_ROTATION_3D)
		# Путь трека: "узел:кость" — РОВНО ОДИН subname (см. animation_mixer.cpp).
		anim.track_set_path(track, NodePath("%s:%s" % [skeleton_path, bone]))
		anim.track_set_interpolation_type(track, Animation.INTERPOLATION_LINEAR)
		for frame: Dictionary in frames:
			var rotations: Dictionary = frame["rotations"]
			var quat: Quaternion = rotations.get(bone, Quaternion.IDENTITY)
			anim.rotation_track_insert_key(track, float(frame["time"]), quat)

	# Единственная translation-дорожка — таз. Позиция АБСОЛЮТНАЯ (rest + смещение),
	# её считает риг.
	var root_bone := rig.get_root_bone_name()
	var position_track := anim.add_track(Animation.TYPE_POSITION_3D)
	anim.track_set_path(position_track, NodePath("%s:%s" % [skeleton_path, root_bone]))
	anim.track_set_interpolation_type(position_track, Animation.INTERPOLATION_LINEAR)
	for frame: Dictionary in frames:
		var offset: Vector3 = frame["hips_offset"]
		anim.position_track_insert_key(position_track, float(frame["time"]), rig.hips_pose_position(offset))

	# Длина задаётся явно: вставка ключей её не растягивает.
	anim.length = duration

	# --- 5. Метрики техники по фазам + предупреждения ----------------------
	var phase_metrics = []
	var deepest_by_cycle: Dictionary = {}   # cycle -> {slot, margin}
	for i in phases.size():
		var solved_target: Dictionary = PoseSolver.solve(rig, targets[i], data.stance_width)
		var metrics: Dictionary = solved_target["metrics"]
		var margin := float(metrics["hip_below_knee"])
		var cyc := _cycle_of(i, per_cycle)
		if not deepest_by_cycle.has(cyc) or margin > float(deepest_by_cycle[cyc]["margin"]):
			deepest_by_cycle[cyc] = {"slot": i, "margin": margin}
		var checks := PoseSolver.check(data.technique_kind, metrics, data.has_bar)
		phase_metrics.append({"index": i, "metrics": metrics, "checks": checks})

	var warnings := PackedStringArray()
	for i in phase_metrics.size():
		var phase: ExercisePhase = phases[i]
		var checks: Array = phase_metrics[i]["checks"]
		# В приседе первый пункт check() — глубина. Её имеет смысл проверять только
		# в самой глубокой фазе каждого повтора; в остальных «таз выше колена» — норма.
		var is_deepest: bool = int(deepest_by_cycle[_cycle_of(i, per_cycle)]["slot"]) == i
		var first := 1 if (data.technique_kind == &"squat" and not is_deepest) else 0
		for c in range(first, checks.size()):
			var check: Dictionary = checks[c]
			if check["level"] == "warn":
				var msg := "%s: %s" % [phase.label, check["text"]]
				if cycles > 1:
					msg = "Повтор %d. %s" % [_cycle_of(i, per_cycle) + 1, msg]
				if not warnings.has(msg):
					warnings.append(msg)

	var bar_min := INF
	var bar_max := -INF
	for frame: Dictionary in frames:
		var bar_z := float(frame["metrics"]["bar_z"])
		bar_min = minf(bar_min, bar_z)
		bar_max = maxf(bar_max, bar_z)
	var spread := bar_max - bar_min
	if data.has_bar and spread > PoseSolver.BAR_PATH_TOLERANCE:
		warnings.append("Траектория грифа уходит от вертикали: %.0f см по горизонтали" % (spread * 100.0))

	return {
		"animation": anim,
		"duration": duration,
		"phase_spans": phase_spans,
		"phase_metrics": phase_metrics,
		"warnings": warnings,
		"bar_path_spread": spread,
		"frame_metrics": frame_metrics,
		"cycles": cycles,
		"cycle_duration": duration / float(cycles),
		"cycle_starts": cycle_starts,
	}


# ---------------------------------------------------------------------------
# Вариация повторов
# ---------------------------------------------------------------------------

## Номер повтора по сквозному номеру фазы (явное деление без предупреждений GDScript).
static func _cycle_of(slot: int, per_cycle: int) -> int:
	return floori(float(slot) / float(per_cycle))


## Копия фазы для повтора rep. Повтор 0 — исходная фаза без изменений.
## Вариация касается только рабочих узлов: вес глубины растёт от 0 (стойка) до 1 (низ),
## поэтому стойка и фиксация остаются идентичными и цикл замыкается без дрейфа.
static func _varied_phase(phase: ExercisePhase, rep: int) -> ExercisePhase:
	if rep == 0:
		return phase
	var variant := rep % REP_DEPTH_DELTA.size()
	var p: ExercisePhase = phase.duplicate()
	p.pose = phase.pose.duplicate()
	p.duration = phase.duration * REP_TEMPO_MUL[variant]

	var depth_delta: float = REP_DEPTH_DELTA[variant]
	var arm_mul: float = REP_ARM_MUL[variant]
	for key: StringName in p.pose:
		var text := String(key)
		var value := float(p.pose[key])
		if text.begins_with("thigh_angle"):
			p.pose[key] = value + depth_delta * clampf((value - 30.0) / 60.0, 0.0, 1.0)
		elif text.begins_with("knee_flexion"):
			p.pose[key] = value + depth_delta * clampf((value - 50.0) / 70.0, 0.0, 1.0)
		elif text.begins_with("shoulder_flexion"):
			p.pose[key] = value * arm_mul
	return p


# ---------------------------------------------------------------------------
# Кривые
# ---------------------------------------------------------------------------

## Для каждого канала: значения в узлах + касательные PCHIP.
## Канал, которого нет в ранних позах цепочки, «протягивается» назад своим первым
## значением — поза не прыгает из-за забытого канала.
static func _build_curves(poses: Array, times: Array) -> Dictionary:
	var all_keys: Dictionary = {}
	for p: Dictionary in poses:
		for key: StringName in p:
			all_keys[key] = true

	var curves: Dictionary = {}
	for key: StringName in all_keys:
		var raw: Array = []
		for p: Dictionary in poses:
			raw.append(float(p[key]) if p.has(key) else NAN)

		var first_value := 0.0
		for v in raw:
			if not is_nan(float(v)):
				first_value = float(v)
				break
		var prev := first_value
		for i in raw.size():
			if is_nan(float(raw[i])):
				raw[i] = prev
			else:
				prev = float(raw[i])

		curves[key] = {"values": raw, "tangents": _channel_tangents(raw, times)}
	return curves


## Касательные PCHIP (неравномерная сетка). Нулевая касательная — на экстремумах
## и плато (удержание); концы — тоже нулевые (старт и замыкание цикла).
static func _channel_tangents(values: Array, times: Array) -> Array:
	var n := values.size()
	var tangents: Array = []
	tangents.resize(n)
	if n < 2:
		for i in n:
			tangents[i] = 0.0
		return tangents

	var h: Array = []
	var d: Array = []
	for i in n - 1:
		var hi := maxf(float(times[i + 1]) - float(times[i]), 0.0001)
		h.append(hi)
		d.append((float(values[i + 1]) - float(values[i])) / hi)

	tangents[0] = 0.0
	tangents[n - 1] = 0.0
	for i in range(1, n - 1):
		var d0: float = d[i - 1]
		var d1: float = d[i]
		if d0 * d1 <= 0.0:
			tangents[i] = 0.0
		else:
			var w1: float = 2.0 * float(h[i]) + float(h[i - 1])
			var w2: float = float(h[i]) + 2.0 * float(h[i - 1])
			tangents[i] = (w1 + w2) / (w1 / d0 + w2 / d1)
	return tangents


static func _eval(curve: Dictionary, times: Array, t: float) -> float:
	var values: Array = curve["values"]
	var tangents: Array = curve["tangents"]
	var last := times.size() - 1

	var i := 0
	while i < last - 1 and t >= float(times[i + 1]):
		i += 1

	var t0 := float(times[i])
	var h := maxf(float(times[i + 1]) - t0, 0.0001)
	var u := clampf((t - t0) / h, 0.0, 1.0)
	var a := float(values[i])
	var b := float(values[i + 1])
	if absf(b - a) < 0.000001:
		return a

	var u2 := u * u
	var u3 := u2 * u
	return (2.0 * u3 - 3.0 * u2 + 1.0) * a \
		+ (u3 - 2.0 * u2 + u) * h * float(tangents[i]) \
		+ (-2.0 * u3 + 3.0 * u2) * b \
		+ (u3 - u2) * h * float(tangents[i + 1])


static func _value_at(curves: Dictionary, times: Array, key: StringName, t: float) -> float:
	if not curves.has(key):
		return 0.0
	return _eval(curves[key], times, t)


static func _wrap_time(t: float, duration: float, loop: bool) -> float:
	if loop:
		return fposmod(t, duration)
	return clampf(t, 0.0, duration)


## Поза в момент t: у каждого канала своё время (запаздывание), сверху — MotionLayer.
static func _sample_pose(
	curves: Dictionary, times: Array, duration: float, loop: bool,
	t: float, layer: MotionLayer
) -> Dictionary:
	var pose: Dictionary = {}
	for key: StringName in curves:
		var tk := _wrap_time(t - layer.lag_for(key), duration, loop)
		pose[key] = _eval(curves[key], times, tk)

	var th := _wrap_time(t - MotionLayer.HEAD_LAG, duration, loop)
	var lean_lagged := _value_at(curves, times, &"pelvis_pitch", th) \
		+ _value_at(curves, times, &"spine_lean", th) \
		+ _value_at(curves, times, &"chest_lean", th)

	layer.apply_secondary(pose, _wrap_time(t, duration, loop), lean_lagged)
	return pose


static func _make_frame(rig: HumanoidRig, time: float, solved: Dictionary) -> Dictionary:
	var channels: Dictionary = solved["channels"]
	return {
		"time": time,
		"rotations": rig.build_bone_rotations(channels),
		"hips_offset": solved["hips_offset"],
		"metrics": solved["metrics"],
	}


static func _empty_result() -> Dictionary:
	return {
		"animation": null,
		"duration": 0.0,
		"phase_spans": [],
		"phase_metrics": [],
		"warnings": PackedStringArray(["Данные упражнения некорректны"]),
		"bar_path_spread": 0.0,
		"frame_metrics": [],
		"cycles": 1,
		"cycle_duration": 0.0,
		"cycle_starts": [],
	}
