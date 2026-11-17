class_name PoseSolver
extends RefCounted
## Кинематика ног + проверки техники.
##
## Что изменилось (Этап 2):
##   * Ноги решаются в 3D, ОБЕ. Стопы стоят на ширине stance_width (ширина между
##     лодыжками), носки развёрнуты на toe_out, колено ведётся по оси носка
##     (pole-вектор), таз по x строго между стопами.
##   * Двухзвенный аналитический IK: лодыжка — цель, таз — по глубине из авторских
##     thigh_angle / knee_flexion, колено — по pole. Из позиций суставов получаются
##     повороты бедра (flex / abd / rot) и стопы (dorsi / toe_out / ankle_roll), так что
##     стопа остаётся ПЛОСКОЙ на полу при любом наклоне голени (раньше при toe_out
##     носок гулял на ~4 мм, потому что не было крена).
##   * Старый сагиттальный путь жив: USE_3D = false, либо если упражнение само задаёт
##     ankle_dorsiflexion (подъём на носки и т.п.).
##
## Система координат рига: +Y вверх, -Z вперёд, +X вправо, пол y = 0.
## Размеры сегментов берутся из рига. Авторские каналы ног задают ГЛУБИНУ:
##   thigh_angle — угол бедра от вертикали в сагиттальной проекции,
##   knee_flexion — сгибание колена (расстояние таз–лодыжка).
## hip_abduction / hip_rotation / ankle_roll вручную не задаются — их считает решатель.

## Включить 3D-решатель ног.
const USE_3D := true

# --- Допустимые диапазоны (техника, а не анатомический максимум) -----------
const MAX_ANKLE_DORSIFLEXION := 38.0
const MAX_SPINE_FLEXION := 12.0
const BAR_BALANCE_TOLERANCE := 0.10
const BAR_PATH_TOLERANCE := 0.10
## Риг-независимый критерий глубины: сустав таза ниже сустава колена не меньше чем на
## столько, м. Процент глубины зависит от пропорций бедро/голень конкретной модели
## (на капсуле 62 %, на персонаже ~53 % при тех же углах) и остаётся только справочным.
const MIN_HIP_BELOW_KNEE := 0.02
const MIN_SQUAT_DEPTH_PERCENT := 58.0   ## справочно, в проверках не используется
## Колено медиальнее линии таз–лодыжка больше чем на это, м — валгус.
const KNEE_VALGUS_TOLERANCE := 0.02
## Колено по горизонтали отклоняется от оси носка больше чем на это — «колени гуляют».
const KNEE_TRACKING_TOLERANCE_DEG := 12.0


## Решает позу: дополняет каналы производными величинами и считает метрики.
## stance_width — ширина между лодыжками, м (0 = как в риге).
## Возвращает { "channels": Dictionary, "hips_offset": Vector3, "metrics": Dictionary }.
static func solve(rig: HumanoidRig, authored: Dictionary, stance_width: float = 0.0) -> Dictionary:
	var channels: Dictionary = authored.duplicate()
	# Перенос веса: служебный ключ слоя движения, не канал рига.
	var weight_shift := float(channels.get(&"_weight_shift_x", 0.0))
	channels.erase(&"_weight_shift_x")
	var manual_ankle := authored.has(&"ankle_dorsiflexion_l") or authored.has(&"ankle_dorsiflexion_r")

	var pelvis := float(channels.get(&"pelvis_pitch", 0.0))
	var spine_lean := float(channels.get(&"spine_lean", 0.0))
	var chest_lean := float(channels.get(&"chest_lean", 0.0))
	var torso_lean := pelvis + spine_lean + chest_lean

	var left := _limb(channels, "l")
	var right := _limb(channels, "r")

	# Угол бедра из «world» в локальный (Hips повёрнут на -pelvis_pitch).
	channels[&"thigh_angle_l"] = left["thigh"] + pelvis
	channels[&"thigh_angle_r"] = right["thigh"] + pelvis

	# Голеностоп (сагиттальный путь): стопа плоская.
	if not channels.has(&"ankle_dorsiflexion_l"):
		channels[&"ankle_dorsiflexion_l"] = left["knee"] - left["thigh"]
	if not channels.has(&"ankle_dorsiflexion_r"):
		channels[&"ankle_dorsiflexion_r"] = right["knee"] - right["thigh"]

	# --- сагиттальная кинематика от неподвижной лодыжки -----------------------
	var thigh_len := rig.get_bone_length(&"Thigh_L")
	var shin_len := rig.get_bone_length(&"Shin_L")
	var ankle := rig.get_rest_origin(&"Foot_L")
	var toe := rig.get_rest_origin(&"Toe_L")
	var hips_rest := rig.get_rest_origin(&"Hips")
	var thigh_offset := rig.get_rest_origin(&"Thigh_L") - hips_rest

	var thigh_rad := deg_to_rad(left["thigh"])
	var shin_rad := deg_to_rad(left["thigh"] - left["knee"])

	var hip_y := ankle.y + thigh_len * cos(thigh_rad) + shin_len * cos(shin_rad)
	var hip_z := ankle.z + thigh_len * sin(thigh_rad) + shin_len * sin(shin_rad)
	var knee_y := hip_y - thigh_len * cos(thigh_rad)
	var knee_z := hip_z - thigh_len * sin(thigh_rad)

	var pelvis_rad := deg_to_rad(pelvis)
	var rotated_offset := Basis(Vector3.RIGHT, -pelvis_rad) * thigh_offset
	var hips_world_y := hip_y - rotated_offset.y
	var hips_world_z := hip_z - rotated_offset.z
	var hips_world_x := hips_rest.x

	var knee_valgus := 0.0
	var knee_tracking := 0.0
	var stance_now := 0.0
	var pelvis_x_error := 0.0

	# --- 3D-путь: обе ноги, стойка шире, колено по носку ---------------------
	if USE_3D and not manual_ankle:
		var leg := _solve_legs_3d(
			rig, float(channels.get(&"toe_out_l", 0.0)), left["thigh"], left["knee"],
			pelvis, hip_y, hip_z, stance_width, weight_shift
		)
		var overrides: Dictionary = leg["channels"]
		for key: StringName in overrides:
			channels[key] = overrides[key]
		var hips_world: Vector3 = leg["hips_world"]
		hips_world_x = hips_world.x
		hips_world_y = hips_world.y
		hips_world_z = hips_world.z
		hip_y = float(leg["hip_y"])
		knee_y = float(leg["knee_y"])
		knee_z = float(leg["knee_z"])
		knee_valgus = float(leg["knee_valgus"])
		knee_tracking = float(leg["knee_tracking"])
		stance_now = float(leg["stance"])
		pelvis_x_error = float(leg["pelvis_x_error"])

	var hips_offset := Vector3(
		hips_world_x - hips_rest.x, hips_world_y - hips_rest.y, hips_world_z - hips_rest.z
	)
	var dorsiflexion := float(channels[&"ankle_dorsiflexion_l"])

	# --- голова: уровень взгляда ---------------------------------------------
	if not channels.has(&"neck_lean"):
		channels[&"neck_lean"] = -torso_lean * 0.5
	if not channels.has(&"head_lean"):
		channels[&"head_lean"] = -torso_lean * 0.5

	# --- гриф: по фактической цепочке сегментов ------------------------------
	var lean_rad := deg_to_rad(torso_lean)
	var seg_hips_spine := rig.get_rest_origin(&"Spine") - hips_rest
	var seg_spine_chest := rig.get_rest_origin(&"Chest") - rig.get_rest_origin(&"Spine")

	var hips_world_pos := Vector3(hips_world_x, hips_world_y, hips_world_z)
	var bar_world := hips_world_pos \
		+ Basis(Vector3.RIGHT, -pelvis_rad) * seg_hips_spine \
		+ Basis(Vector3.RIGHT, -deg_to_rad(pelvis + spine_lean)) * seg_spine_chest \
		+ Basis(Vector3.RIGHT, -lean_rad) * HumanoidRig.BAR_LOCAL_POS

	var midfoot_z := (ankle.z + toe.z) * 0.5
	var hip_rest_height: float = rig.get_rest_origin(&"Thigh_L").y

	var metrics := {
		"hip_height": hip_y,
		"hip_below_knee": knee_y - hip_y,
		"depth_percent": 100.0 * (hip_rest_height - hip_y) / maxf(hip_rest_height, 0.001),
		"knee_flexion": float(channels.get(&"knee_flexion_l", left["knee"])),
		"ankle_dorsiflexion": dorsiflexion,
		"torso_lean": torso_lean,
		"pelvis_pitch": pelvis,
		"spine_lean": spine_lean,
		"hip_flexion": left["thigh"] + torso_lean,
		"knee_height": knee_y,
		"knee_forward": (toe.z - knee_z),
		"bar_height": bar_world.y,
		"bar_z": bar_world.z,
		"bar_balance": bar_world.z - midfoot_z,
		"hips_offset": hips_offset,
		# --- 3D-метрики (0, если решатель сагиттальный) ---
		"knee_valgus": knee_valgus,
		"knee_tracking_deg": knee_tracking,
		"stance_width": stance_now,
		"pelvis_x_error": pelvis_x_error,
	}

	return {
		"channels": channels,
		"hips_offset": hips_offset,
		"metrics": metrics,
	}


## Двусторонний решатель ног. Возвращает переопределения каналов и геометрию левой ноги.
static func _solve_legs_3d(
	rig: HumanoidRig, toe_out_deg: float, thigh_world_deg: float, knee_deg: float,
	pelvis_deg: float, planar_hip_y: float, planar_hip_z: float, stance_width: float,
	weight_shift: float = 0.0
) -> Dictionary:
	var a := rig.get_bone_length(&"Thigh_L")
	var b := rig.get_bone_length(&"Shin_L")
	var hips_rest := rig.get_rest_origin(&"Hips")
	var ank_l := rig.get_rest_origin(&"Foot_L")
	var ank_r := rig.get_rest_origin(&"Foot_R")
	var off_l := rig.get_rest_origin(&"Thigh_L") - hips_rest
	var off_r := rig.get_rest_origin(&"Thigh_R") - hips_rest

	# Целевые лодыжки: стойка шире на extra с каждой стороны.
	var rest_width := absf(ank_r.x - ank_l.x)
	var extra := 0.0
	if stance_width > 0.0:
		extra = maxf(0.0, (stance_width - rest_width) * 0.5)
	var tgt_l := ank_l + Vector3(-extra, 0.0, 0.0)
	var tgt_r := ank_r + Vector3(extra, 0.0, 0.0)

	var hips_basis := Basis(Vector3.RIGHT, -deg_to_rad(pelvis_deg))
	var rot_l := hips_basis * off_l
	var rot_r := hips_basis * off_r

	# Глубину берём из сагиттального решения: вперёд-назад как есть, а высоту
	# уменьшаем на боковой вынос (длина «таз–лодыжка» сохраняется → то же сгибание колена).
	# Перенос веса: таз уходит по x, лодыжки остаются на месте — IK сам доворачивает ноги.
	var hip_x_l := hips_rest.x + weight_shift + rot_l.x
	var dx := hip_x_l - tgt_l.x
	var dy_pl := planar_hip_y - ank_l.y
	var dz := planar_hip_z - ank_l.z
	var dy := sqrt(maxf(dy_pl * dy_pl - dx * dx, 0.0004))

	var hip_l := Vector3(hip_x_l, ank_l.y + dy, ank_l.z + dz)
	var hips_world := hip_l - rot_l
	var hip_r := hips_world + rot_r

	var channels: Dictionary = {}
	var left_info: Dictionary = {}
	for side: String in ["l", "r"]:
		var is_left := side == "l"
		var hip_pos := hip_l if is_left else hip_r
		var target := tgt_l if is_left else tgt_r
		var outward := -1.0 if is_left else 1.0
		var phi := deg_to_rad(toe_out_deg)
		var pole := Vector3(outward * sin(phi), 0.0, -cos(phi))

		var ik := _leg_ik(hip_pos, target, a, b, pole)
		var thigh_world: Basis = ik["thigh_basis"]
		var k := float(ik["knee_rad"])

		# Бедро: локальная ориентация относительно таза → каналы.
		var t_local := hips_basis.inverse() * thigh_world
		var te := t_local.get_euler(EulerOrder.EULER_ORDER_YXZ)
		channels[StringName("thigh_angle_" + side)] = rad_to_deg(te.x) / _sign(rig, "thigh_angle", side)
		channels[StringName("hip_rotation_" + side)] = rad_to_deg(te.y) / _sign(rig, "hip_rotation", side)
		channels[StringName("hip_abduction_" + side)] = rad_to_deg(te.z) / _sign(rig, "hip_abduction", side)
		channels[StringName("knee_flexion_" + side)] = rad_to_deg(k)

		# Стопа: плоская на полу, развёрнута на toe_out.
		var shin_world := thigh_world * Basis(Vector3.RIGHT, -k)
		var yaw := deg_to_rad(toe_out_deg) * _sign(rig, "toe_out", side)
		var foot_world := Basis(Vector3.UP, yaw)
		var foot_local := shin_world.inverse() * foot_world
		var fe := foot_local.get_euler(EulerOrder.EULER_ORDER_YXZ)
		channels[StringName("ankle_dorsiflexion_" + side)] = rad_to_deg(fe.x) / _sign(rig, "ankle_dorsiflexion", side)
		channels[StringName("toe_out_" + side)] = rad_to_deg(fe.y) / _sign(rig, "toe_out", side)
		channels[StringName("ankle_roll_" + side)] = rad_to_deg(fe.z) / _sign(rig, "ankle_roll", side)

		if is_left:
			left_info = ik
			left_info["hip"] = hip_pos
			left_info["target"] = target

	var knee: Vector3 = left_info["knee"]
	var hip_j: Vector3 = left_info["hip"]
	var tgt: Vector3 = left_info["target"]

	# Валгус: колено относительно прямой «таз → лодыжка» на высоте колена.
	var span_y := maxf(hip_j.y - tgt.y, 0.001)
	var t_line := clampf((hip_j.y - knee.y) / span_y, 0.0, 1.0)
	var x_line := hip_j.x + (tgt.x - hip_j.x) * t_line
	var valgus := knee.x - x_line   # + = колено медиальнее (левая нога)

	# Колено по горизонтали против оси носка: смотрим на отклонение колена от прямой
	# «таз → лодыжка» (у почти прямой ноги оно мало и не оценивается).
	var z_line := hip_j.z + (tgt.z - hip_j.z) * t_line
	var h := Vector2(knee.x - x_line, knee.z - z_line)
	var tracking := 0.0
	if h.length() > 0.03:
		var phi2 := deg_to_rad(toe_out_deg)
		var toe_dir := Vector2(-sin(phi2), -cos(phi2))
		tracking = rad_to_deg(absf(h.normalized().angle_to(toe_dir)))

	return {
		"channels": channels,
		"hips_world": hips_world,
		"hip_y": hip_l.y,
		"knee_y": knee.y,
		"knee_z": knee.z,
		"knee_valgus": valgus,
		"knee_tracking": tracking,
		"stance": absf(tgt_r.x - tgt_l.x),
		"pelvis_x_error": absf(hips_world.x - (tgt_l.x + tgt_r.x) * 0.5),
	}


## Двухзвенный IK: колено — на конусе вокруг оси таз→лодыжка, по pole-вектору.
## Возвращает { knee, knee_rad, thigh_basis } — thigh_basis в мировой системе:
## колонка Y = -(направление бедра), колонка Z выбрана так, что голень лежит в плоскости
## сгибания колена (локальная ось X бедра = ось шарнира колена).
static func _leg_ik(hip: Vector3, ankle: Vector3, a: float, b: float, pole: Vector3) -> Dictionary:
	var v := ankle - hip
	var dist := clampf(v.length(), absf(a - b) + 0.0005, a + b - 0.0005)
	var e := v.normalized()

	var cos_alpha := clampf((a * a + dist * dist - b * b) / (2.0 * a * dist), -1.0, 1.0)
	var alpha := acos(cos_alpha)

	var p := pole - e * pole.dot(e)
	if p.length() < 0.00001:
		p = Vector3.FORWARD - e * Vector3.FORWARD.dot(e)
	p = p.normalized()

	var u := (e * cos_alpha + p * sin(alpha)).normalized()   # таз → колено
	var knee := hip + u * a
	var s := (ankle - knee).normalized()                       # колено → лодыжка

	var cos_k := clampf(u.dot(s), -1.0, 1.0)
	var k := acos(cos_k)

	var y_axis := -u
	var z_axis := Vector3.BACK
	var sin_k := sin(k)
	if sin_k > 0.0005:
		z_axis = (s - u * cos_k) / sin_k
	else:
		# Нога почти прямая: плоскость сгибания задаёт pole.
		z_axis = (-p - y_axis * (-p).dot(y_axis))
	z_axis = (z_axis - y_axis * z_axis.dot(y_axis)).normalized()
	var x_axis := y_axis.cross(z_axis).normalized()

	return {
		"knee": knee,
		"knee_rad": k,
		"thigh_basis": Basis(x_axis, y_axis, z_axis),
	}


static func _sign(rig: HumanoidRig, base: String, side: String) -> float:
	var resolved := rig.resolve_channel(StringName("%s_%s" % [base, side]))
	if resolved.is_empty():
		return 1.0
	var s := float(resolved.get("sign", 1.0))
	return s if absf(s) > 0.5 else 1.0


## Читает парные каналы; при отсутствии одной стороны — зеркалит другую.
static func _limb(channels: Dictionary, side: String) -> Dictionary:
	var other := "r" if side == "l" else "l"
	var thigh_key := StringName("thigh_angle_" + side)
	var knee_key := StringName("knee_flexion_" + side)

	var thigh := float(channels.get(thigh_key, channels.get(StringName("thigh_angle_" + other), 0.0)))
	var knee := float(channels.get(knee_key, channels.get(StringName("knee_flexion_" + other), 0.0)))
	return {"thigh": thigh, "knee": knee}


## Проверка метрик на соответствие технике. Возвращает массив словарей:
## { "level": "ok"|"warn", "text": String }.
## ВАЖНО: для приседа первым элементом всегда идёт проверка глубины — на этом
## держится фильтрация предупреждений в ExerciseAnimationBuilder.
static func check(exercise_kind: StringName, m: Dictionary, has_bar: bool = true) -> Array:
	var result: Array = []

	var depth := float(m.get("depth_percent", 0.0))
	var hip_height := float(m.get("hip_height", 0.0))
	var knee_height := float(m.get("knee_height", 0.0))
	var margin := float(m.get("hip_below_knee", knee_height - hip_height))
	if exercise_kind == &"squat":
		if margin <= 0.0:
			result.append({"level": "warn", "text": "Таз выше колена на %.0f см — присед не засчитан" % (-margin * 100.0)})
		elif margin < MIN_HIP_BELOW_KNEE:
			result.append({"level": "warn", "text": "Недосед: таз ниже колена лишь на %.1f см (нужно ≥ %.0f см)" % [margin * 100.0, MIN_HIP_BELOW_KNEE * 100.0]})
		else:
			result.append({"level": "ok", "text": "Глубина: таз ниже колена на %.0f см (%.0f%% высоты)" % [margin * 100.0, depth]})

	var dorsi := float(m.get("ankle_dorsiflexion", 0.0))
	if dorsi > MAX_ANKLE_DORSIFLEXION:
		result.append({"level": "warn", "text": "Голеностоп %.0f° > %.0f° — пятка оторвётся" % [dorsi, MAX_ANKLE_DORSIFLEXION]})
	else:
		result.append({"level": "ok", "text": "Голеностоп %.0f° — пятка на полу" % dorsi})

	var spine := float(m.get("spine_lean", 0.0))
	if spine > MAX_SPINE_FLEXION:
		result.append({"level": "warn", "text": "Поясница %.0f° > %.0f° — спина округляется" % [spine, MAX_SPINE_FLEXION]})
	else:
		result.append({"level": "ok", "text": "Поясница %.0f° — в пределах нормы" % spine})

	if has_bar:
		var balance := float(m.get("bar_balance", 0.0))
		if absf(balance) > BAR_BALANCE_TOLERANCE:
			var where := "сзади" if balance > 0.0 else "впереди"
			result.append({"level": "warn", "text": "Гриф %.0f см %s середины стопы" % [absf(balance) * 100.0, where]})
		else:
			result.append({"level": "ok", "text": "Гриф над стопой (Δ %.0f см)" % (balance * 100.0)})

	# --- 3D: колени (только если решатель дал метрики) ---
	if m.has("knee_valgus") and float(m.get("stance_width", 0.0)) > 0.0:
		var valgus := float(m["knee_valgus"])
		if valgus > KNEE_VALGUS_TOLERANCE:
			result.append({"level": "warn", "text": "Колено внутрь на %.1f см — валгус" % (valgus * 100.0)})
		else:
			result.append({"level": "ok", "text": "Колени не заваливаются внутрь"})
		var tracking := float(m.get("knee_tracking_deg", 0.0))
		if tracking > KNEE_TRACKING_TOLERANCE_DEG:
			result.append({"level": "warn", "text": "Колено уходит от оси носка на %.0f°" % tracking})
		else:
			result.append({"level": "ok", "text": "Колени идут по носкам (Δ %.0f°)" % tracking})

	return result
