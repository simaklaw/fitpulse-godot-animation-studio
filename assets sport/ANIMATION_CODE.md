# FitPulse — код, отвечающий за движение (для разбора)

Проект: Godot 4.7, GDScript. Всё, что ниже — реальные файлы проекта, без правок.
Собрано: 2026-11-02 19:57 +10

## Как устроен конвейер

```
ExerciseData (base_pose + phases)      ← данные упражнения, углы в градусах
        ↓
ExerciseAnimationBuilder.build()
    ├─ позы фаз складываются в цепочку (каждая наследует предыдущую)
    ├─ Catmull-Rom сплайн по позам  → поза на каждый сэмпл (30 Гц)
    ├─ PoseSolver.solve()           → производные каналы + кинематика таза
    └─ HumanoidRig/CharacterRig.build_bone_rotations() → кватернионы костей
        ↓
Animation (rotation-треки на кость + position-трек таза)
        ↓
ExerciseAnimator (фазы, повторы, темп, метрики для HUD)
```

## Файлы

| Файл | Роль |
|---|---|
| `scripts/animation/exercise_phase.gd` | фаза, кривые ease |
| `scripts/animation/pose_utils.gd` | sym / merge / blend поз |
| `scripts/animation/exercise_data.gd` | структура данных упражнения |
| `scripts/animation/pose_solver.gd` | кинематика + проверки техники |
| `scripts/animation/exercise_animation_builder.gd` | сплайн + генерация Animation |
| `scripts/animation/exercise_animator.gd` | проигрывание, метрики |
| `scripts/exercises/bodyweight_squat.gd` | данные приседа |
| `scripts/rig/humanoid_rig.gd` | скелет + каналы → кватернионы (капсульный) |
| `scripts/rig/character_rig.gd` | то же для скелета персонажа + ретаргет осей |


---

## `scripts/animation/exercise_phase.gd`

```gdscript
@tool
class_name ExercisePhase
extends Resource
## Одна фаза упражнения.
##
## Фаза — это отрезок движения от предыдущей позы до pose за время duration.
## Такое деление не «для красоты»: техника силовых упражнений описывается именно
## фазами (подготовка → эксцентрика → пауза → концентрика → фиксация), и у
## каждой фазы свой темп, дыхание и типичные ошибки.
##
## pose — ПОЛНАЯ целевая поза в конце фазы (каналы рига, градусы).
## Пустой pose = фаза-удержание (поза не меняется) — так делается пауза в
## нижней точке без баллистики.

enum Ease {
	LINEAR,      ## равномерно; для удержаний
	SMOOTH,      ## плавный старт и торможение (ease-in-out) — эксцентрика
	ACCELERATE,  ## старт медленный, к концу разгон — выход из «мёртвой точки»
	DECELERATE,  ## старт быстрый, к концу торможение — фиксация вверху
}

@export var phase_id: StringName = &""
@export var label: String = ""
## Что должен делать атлет в этой фазе (показывается в HUD/подсказках).
@export_multiline var cue: String = ""
@export var duration: float = 1.0
@export var ease: Ease = Ease.SMOOTH
@export var pose: Dictionary = {}
## inhale / exhale / hold — дыхание синхронизировано с фазами.
@export var breath: StringName = &""


## Кривая прогресса 0..1 внутри фазы. Именно она задаёт профиль скорости:
## эксцентрика разгоняется под весом, концентрика тормозит у фиксации.
static func ease_value(mode: Ease, t: float) -> float:
	var x: float = clampf(t, 0.0, 1.0)
	match mode:
		Ease.LINEAR:
			return x
		Ease.ACCELERATE:
			return pow(x, 1.7)
		Ease.DECELERATE:
			return 1.0 - pow(1.0 - x, 1.7)
		_:
			# smoothstep: нулевая скорость на границах — без рывков в суставах
			return x * x * (3.0 - 2.0 * x)


func is_hold() -> bool:
	return pose.is_empty()
```

---

## `scripts/animation/pose_utils.gd`

```gdscript
class_name PoseUtils
extends RefCounted
## Утилиты для словарей поз (канал → градусы).


## Разворачивает парные каналы на обе стороны.
## Писать в каждой позе "knee_flexion_l" и "knee_flexion_r" — шум, поэтому
## в данных упражнения пишем "knee_flexion": 125, а sym() делает из этого
## пару. Парность берётся из таблицы каналов рига — единый источник правды.
static func sym(partial: Dictionary) -> Dictionary:
	var result: Dictionary = {}
	for key: StringName in partial:
		var text := String(key)

		# Уже с суффиксом — не трогаем (асимметрия вроде выпада).
		if text.ends_with("_l") or text.ends_with("_r"):
			result[key] = partial[key]
			continue

		var spec: Dictionary = HumanoidRig.CHANNELS.get(key, {})
		if spec.is_empty() or not bool(spec.get("sided", false)):
			result[key] = partial[key]
			continue

		result[StringName(text + "_l")] = partial[key]
		result[StringName(text + "_r")] = partial[key]
	return result


## Дополняет base значениями из overrides (overrides главнее).
static func merge(base: Dictionary, overrides: Dictionary) -> Dictionary:
	var result: Dictionary = base.duplicate()
	for key: StringName in overrides:
		result[key] = overrides[key]
	return result


## Линейная интерполяция двух поз. Ключи, которых нет в одной из поз,
## берутся из другой — так позы не «прыгают» из-за забытого канала.
static func blend(a: Dictionary, b: Dictionary, weight: float) -> Dictionary:
	var t: float = clampf(weight, 0.0, 1.0)
	var result: Dictionary = {}

	for key: StringName in a:
		var va := float(a[key])
		var vb := float(b.get(key, va))
		result[key] = lerpf(va, vb, t)

	for key: StringName in b:
		if result.has(key):
			continue
		result[key] = float(b[key])
	return result
```

---

## `scripts/animation/exercise_data.gd`

```gdscript
@tool
class_name ExerciseData
extends Resource
## Описание упражнения как данных, а не как набора захардкоженных анимаций.
##
## Одно упражнение = base_pose + список фаз. Из этого билдер генерирует
## Animation с треками для Skeleton3D. Добавление нового упражнения — это новый
## файл данных, а не копипаста анимации.

@export var exercise_id: StringName = &""
@export var display_name: String = ""
@export_multiline var description: String = ""
## Вид движения для проверок PoseSolver: "squat", "hinge", "push", "pull"...
@export var technique_kind: StringName = &"squat"
@export var equipment: String = ""
## Есть ли в упражнении гриф. Если false — риг не строит штангу, а PoseSolver
## не проверяет баланс грифа: для упражнений с собственным весом «гриф над
## серединой стопы» превратился бы в вечное ложное предупреждение.
@export var has_bar: bool = false

@export var muscles_primary: PackedStringArray = []
@export var muscles_secondary: PackedStringArray = []
## Ключевые моменты техники (для экрана упражнения).
@export var setup_cues: PackedStringArray = []
@export var common_mistakes: PackedStringArray = []

## Поза, с которой начинается анимация (t = 0). Дальше фазы накапливаются:
## каждая фаза наследует предыдущую позу и переопределяет только свои каналы.
@export var base_pose: Dictionary = {}
@export var phases: Array[ExercisePhase] = []

@export var loop: bool = true
@export var animation_name: StringName = &"exercise"
## Множитель темпа по умолчанию: 1.0 = заложенный в фазах темп.
@export var default_tempo: float = 1.0


func total_duration() -> float:
	var total := 0.0
	for phase: ExercisePhase in phases:
		total += phase.duration
	return total


## Проверка данных до генерации. Возвращает список проблем (пустой = всё ок).
func validate() -> PackedStringArray:
	var problems := PackedStringArray()

	if exercise_id == &"":
		problems.append("exercise_id не задан")
	if animation_name == &"":
		problems.append("animation_name не задан")
	if phases.is_empty():
		problems.append("нет ни одной фазы")
	if total_duration() <= 0.0:
		problems.append("суммарная длительность фаз = 0")

	for i in phases.size():
		var phase: ExercisePhase = phases[i]
		if phase == null:
			problems.append("фаза %d пустая" % i)
			continue
		if phase.duration <= 0.0:
			problems.append("фаза '%s': duration <= 0" % phase.phase_id)
		if phase.phase_id == &"":
			problems.append("фаза %d: не задан phase_id" % i)

	return problems


func find_phase_index(phase_id: StringName) -> int:
	for i in phases.size():
		if phases[i] != null and phases[i].phase_id == phase_id:
			return i
	return -1
```

---

## `scripts/animation/pose_solver.gd`

```gdscript
class_name PoseSolver
extends RefCounted
## Сагиттальная (плоская) кинематика + проверки техники.
##
## Зачем это отдельно от рига:
##   * Скелет просто поворачивает кости. А ПРАВИЛЬНАЯ поза — это когда стопа
##     стоит на полу, голеностоп сгибается ровно настолько, насколько требует
##     голень, а таз опускается по дуге, не сдвигая стопы.
##   * Здесь эти связи решаются аналитически (2D, плоскость YZ):
##       - угол голени = угол бедра - сгибание колена;
##       - тыльное сгибание стопы выбирается так, чтобы стопа осталась ПЛОСКОЙ;
##       - смещение таза считается от неподвижной лодыжки (стопа не скользит);
##       - положение грифа считается по цепочке сегментов, по нему — баланс.
##
## Всё считается в метрах/градусах в системе рига: +Y вверх, -Z вперёд,
## пол на y = 0. Размеры сегментов берутся ИЗ РИГА, поэтому не могут разойтись
## с фактическим скелетом.

# --- Допустимые диапазоны (техника, а не анатомический максимум) -----------
## Свыше этого пятка отрывается от пола или глубину приходится сокращать.
const MAX_ANKLE_DORSIFLEXION := 38.0
## Сгибание поясницы относительно таза. Нейтрально ≈ 0–8°, 12 — уже на грани:
## дальше спина под нагрузкой начинает округляться.
const MAX_SPINE_FLEXION := 12.0
## Гриф относительно середины стопы, м. Стопа ~0.29 м, так что 10 см — это уже
## треть стопы: дальше момент в голеностопе становится заметным.
const BAR_BALANCE_TOLERANCE := 0.10
## Горизонтальный разброс траектории грифа (по z) за повтор, м. Гриф должен идти
## почти вертикально; ±5 см по ходу — норма, 10 см — уже «гуляет».
const BAR_PATH_TOLERANCE := 0.10
## Минимальная глубина: в этом риге параллель бедра полу = 58 % хода таза.
const MIN_SQUAT_DEPTH_PERCENT := 58.0


## Решает позу: дополняет каналы производными величинами и считает метрики.
## Возвращает { "channels": Dictionary, "hips_offset": Vector3, "metrics": Dictionary }.
static func solve(rig: HumanoidRig, authored: Dictionary) -> Dictionary:
	var channels: Dictionary = authored.duplicate()

	var pelvis := float(channels.get(&"pelvis_pitch", 0.0))
	var spine_lean := float(channels.get(&"spine_lean", 0.0))
	var chest_lean := float(channels.get(&"chest_lean", 0.0))
	var torso_lean := pelvis + spine_lean + chest_lean

	var left := _limb(channels, "l")
	var right := _limb(channels, "r")

	# --- приведение угла бедра из «world» в локальный ------------------------
	# Автор задаёт угол бедра от вертикали (как меряют по видео). Кость Thigh —
	# ребёнок Hips, а Hips повёрнут на -pelvis_pitch, значит локальный угол
	# должен компенсировать наклон таза.
	channels[&"thigh_angle_l"] = left["thigh"] + pelvis
	channels[&"thigh_angle_r"] = right["thigh"] + pelvis

	# --- голеностоп: стопа остаётся плоской --------------------------------
	# Угол голени к вертикали = thigh - knee. Чтобы стопа лежала на полу,
	# голеностоп должен скомпенсировать этот наклон: dorsiflexion = knee - thigh.
	if not channels.has(&"ankle_dorsiflexion_l"):
		channels[&"ankle_dorsiflexion_l"] = left["knee"] - left["thigh"]
	if not channels.has(&"ankle_dorsiflexion_r"):
		channels[&"ankle_dorsiflexion_r"] = right["knee"] - right["thigh"]
	# Метрику отдаём по фактическому каналу: если упражнение задаёт голеностоп
	# вручную (например, подъём на носки), проверка честно это покажет.
	var dorsiflexion := float(channels[&"ankle_dorsiflexion_l"])

	# --- голова: уровень взгляда --------------------------------------------
	# Корпус наклонён на torso_lean; чтобы взгляд остался горизонтальным,
	# шея и голова разгибаются суммарно на ту же величину (по половине).
	if not channels.has(&"neck_lean"):
		channels[&"neck_lean"] = -torso_lean * 0.5
	if not channels.has(&"head_lean"):
		channels[&"head_lean"] = -torso_lean * 0.5

	# --- кинематика ноги от неподвижной лодыжки -----------------------------
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

	# Кость Hips стоит на смещении thigh_offset от сустава; с наклоном таза это
	# смещение тоже поворачивается (2 см, но пусть будет честно).
	var pelvis_rad := deg_to_rad(pelvis)
	var rotated_offset := Basis(Vector3.RIGHT, -pelvis_rad) * thigh_offset
	var hips_world_y := hip_y - rotated_offset.y
	var hips_world_z := hip_z - rotated_offset.z
	var hips_offset := Vector3(0.0, hips_world_y - hips_rest.y, hips_world_z - hips_rest.z)

	# --- гриф: по фактической цепочке сегментов ------------------------------
	# Hips → Spine поворачивается только на наклон таза, Spine → Chest — на
	# таз+поясницу, Chest → гриф — на полный наклон корпуса. Если считать гриф
	# жёстким рычагом от таза, на глубоком приседе набегает до 1.6 см ошибки,
	# а вместе с ней и ложный «баланс».
	var lean_rad := deg_to_rad(torso_lean)
	var seg_hips_spine := rig.get_rest_origin(&"Spine") - hips_rest
	var seg_spine_chest := rig.get_rest_origin(&"Chest") - rig.get_rest_origin(&"Spine")

	var hips_world := Vector3(0.0, hips_world_y, hips_world_z)
	var bar_world := hips_world \
		+ Basis(Vector3.RIGHT, -pelvis_rad) * seg_hips_spine \
		+ Basis(Vector3.RIGHT, -deg_to_rad(pelvis + spine_lean)) * seg_spine_chest \
		+ Basis(Vector3.RIGHT, -lean_rad) * HumanoidRig.BAR_LOCAL_POS

	var midfoot_z := (ankle.z + toe.z) * 0.5
	var hip_rest_height: float = rig.get_rest_origin(&"Thigh_L").y

	var metrics := {
		# Высота тазобедренного сустава от пола, м.
		"hip_height": hip_y,
		# Насколько таз опустился относительно стойки, %.
		"depth_percent": 100.0 * (hip_rest_height - hip_y) / maxf(hip_rest_height, 0.001),
		"knee_flexion": left["knee"],
		"ankle_dorsiflexion": dorsiflexion,
		"torso_lean": torso_lean,
		"pelvis_pitch": pelvis,
		"spine_lean": spine_lean,
		# Сгибание в ТБС от полного разгибания (стоя ≈ 0), градусы.
		"hip_flexion": left["thigh"] + torso_lean,
		"knee_height": knee_y,
		"knee_forward": (toe.z - knee_z),      # + = колено впереди носка
		"bar_height": bar_world.y,
		"bar_z": bar_world.z,
		"bar_balance": bar_world.z - midfoot_z,  # 0 = гриф над серединой стопы
		"hips_offset": hips_offset,
	}

	return {
		"channels": channels,
		"hips_offset": hips_offset,
		"metrics": metrics,
	}


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
## has_bar = false отключает проверку баланса грифа: у упражнений с собственным
## весом грифа нет, и «гриф впереди стопы» было бы ложной ошибкой.
static func check(exercise_kind: StringName, m: Dictionary, has_bar: bool = true) -> Array:
	var result: Array = []

	# 1. Глубина. Основной критерий — факт: таз ниже колена. Проценты хода таза
	# проверяются как ВТОРОЙ, независимый фильтр: в этом риге параллель бедра
	# полу соответствует MIN_SQUAT_DEPTH_PERCENT, и если поза не дотянула до неё,
	# таз формально уже ниже колена, но присед всё равно неполный.
	var depth := float(m.get("depth_percent", 0.0))
	var hip_height := float(m.get("hip_height", 0.0))
	var knee_height := float(m.get("knee_height", 0.0))
	if exercise_kind == &"squat":
		if hip_height >= knee_height:
			result.append({"level": "warn", "text": "Таз выше колена (%.0f%%) — присед не засчитан" % depth})
		elif depth < MIN_SQUAT_DEPTH_PERCENT:
			result.append({"level": "warn", "text": "Глубина %.0f%% < %.0f%% — бёдра не дошли до параллели" % [depth, MIN_SQUAT_DEPTH_PERCENT]})
		else:
			result.append({"level": "ok", "text": "Глубина %.0f%% — таз ниже колена" % depth})

	# 2. Голеностоп: если нужно больше, пятка оторвётся от пола.
	var dorsi := float(m.get("ankle_dorsiflexion", 0.0))
	if dorsi > MAX_ANKLE_DORSIFLEXION:
		result.append({"level": "warn", "text": "Голеностоп %.0f° > %.0f° — пятка оторвётся" % [dorsi, MAX_ANKLE_DORSIFLEXION]})
	else:
		result.append({"level": "ok", "text": "Голеностоп %.0f° — пятка на полу" % dorsi})

	# 3. Поясница: сгибание относительно таза = округление спины под штангой.
	var spine := float(m.get("spine_lean", 0.0))
	if spine > MAX_SPINE_FLEXION:
		result.append({"level": "warn", "text": "Поясница %.0f° > %.0f° — спина округляется" % [spine, MAX_SPINE_FLEXION]})
	else:
		result.append({"level": "ok", "text": "Поясница %.0f° — в пределах нормы" % spine})

	# 4. Баланс: гриф должен идти над серединой стопы, иначе момент в голеностоп.
	# Для упражнений без грифа пункт пропускается целиком.
	if has_bar:
		var balance := float(m.get("bar_balance", 0.0))
		if absf(balance) > BAR_BALANCE_TOLERANCE:
			var where := "сзади" if balance > 0.0 else "впереди"
			result.append({"level": "warn", "text": "Гриф %.0f см %s середины стопы" % [absf(balance) * 100.0, where]})
		else:
			result.append({"level": "ok", "text": "Гриф над стопой (Δ %.0f см)" % (balance * 100.0)})

	return result
```

---

## `scripts/animation/exercise_animation_builder.gd`

```gdscript
class_name ExerciseAnimationBuilder
extends RefCounted
## Генератор Animation из ExerciseData.
##
## Почему не «ручные» 2–3 ключа на позу:
##   * Настоящая техника — это не линейная интерполяция углов. Эксцентрика
##     разгоняется под весом и тормозит у нижней точки, концентрика «продавливает»
##     мёртвую точку и тормозит у фиксации. Если поставить два ключа, Godot
##     сгладит их одинаково и движение станет механическим.
##   * Поэтому поза сэмплируется по времени с частотой SAMPLE_RATE_HZ, а профиль
##     прогресса внутри фазы задаётся кривой ExercisePhase.ease_value().
##   * Таз при этом считается кинематикой (PoseSolver) на КАЖДОМ кадре, поэтому
##     стопы не «плывут» по полу — это главный визуальный признак правильного
##     приседа.

## Частота сэмплирования кривой движения.
const SAMPLE_RATE_HZ := 30.0

const SKELETON_NODE_NAME := "Skeleton3D"
const HIPS_BONE := &"Hips"


## Собирает анимацию. Возвращает словарь:
##   animation      : Animation (null, если данные некорректны)
##   duration       : float
##   phase_spans    : Array[Dictionary] — {index, start, end, phase}
##   phase_metrics  : Array[Dictionary] — {index, metrics, checks}
##   warnings       : PackedStringArray
##   bar_path_spread: float — горизонтальный разброс траектории грифа (z), м
##   frame_metrics  : Array[Dictionary] — {time, metrics} на каждый кадр
static func build(rig: HumanoidRig, data: ExerciseData) -> Dictionary:
	var problems := data.validate()
	if not problems.is_empty():
		for problem in problems:
			push_error("ExerciseData '%s': %s" % [data.exercise_id, problem])
		return _empty_result()

	if rig == null or rig.get_skeleton() == null:
		push_error("ExerciseAnimationBuilder: риг не построен")
		return _empty_result()

	# --- 1. Цепочка поз: каждая фаза наследует предыдущую -------------------
	# Так хват грифа, заданный в base_pose, живёт весь повтор, даже если в позах
	# последующих фаз руки не упомянуты. Переопределять нужно только то, что
	# реально меняется в этой фазе.
	var start_pose: Dictionary = PoseUtils.sym(data.base_pose)
	var current: Dictionary = start_pose.duplicate()
	var targets: Array[Dictionary] = []
	for phase: ExercisePhase in data.phases:
		var overrides := PoseUtils.sym(phase.pose)
		current = PoseUtils.merge(current, overrides)
		targets.append(current.duplicate())

	# --- 1.5. Проверка имён каналов (один раз, а не на каждом сэмпле) --------
	var unknown := rig.validate_channels(targets + [start_pose])
	if not unknown.is_empty():
		for problem in unknown:
			push_error("ExerciseData '%s': %s" % [data.exercise_id, problem])
		return _empty_result()

	# --- 2. Сэмплирование движения -----------------------------------------
	#
	# ПОЧЕМУ СПЛАЙН, А НЕ СГЛАЖИВАНИЕ ВНУТРИ ФАЗЫ.
	# smoothstep каждой фазы даёт нулевую скорость на ОБОИХ концах. Фаз семь,
	# значит движение останавливалось бы семь раз за повтор — визуально это и
	# есть «робот»: разгон-торможение-разгон-торможение.
	# Поэтому позы на границах фаз считаются узлами сплайна Catmull-Rom:
	# скорость переносится через стык, и тело движется непрерывно.
	# Ноль скорости остаётся только там, где он физически нужен: старт,
	# пауза внизу и фиксация вверху (фазы-удержания).
	var poses: Array = [start_pose]
	poses.append_array(targets)
	var times: Array = [0.0]
	var acc := 0.0
	for phase: ExercisePhase in data.phases:
		acc += phase.duration
		times.append(acc)

	# Узлы, где движение должно реально останавливаться.
	var rest_at: Array = []
	for k in poses.size():
		var rest := k == 0 or k == poses.size() - 1
		if not rest and k - 1 < data.phases.size():
			rest = rest or data.phases[k - 1].is_hold()
		if not rest and k < data.phases.size():
			rest = rest or data.phases[k].is_hold()
		rest_at.append(rest)

	var tangents := _pose_tangents(poses, times, rest_at)

	var frames: Array[Dictionary] = []
	var frame_metrics: Array[Dictionary] = []
	var phase_spans: Array[Dictionary] = []
	var solved := PoseSolver.solve(rig, start_pose)
	frames.append(_make_frame(rig, 0.0, solved))
	frame_metrics.append({"time": 0.0, "metrics": solved["metrics"]})

	var time := 0.0
	for i in data.phases.size():
		var phase: ExercisePhase = data.phases[i]
		var span_start := time
		var steps: int = maxi(1, int(round(phase.duration * SAMPLE_RATE_HZ)))
		var p0: Dictionary = poses[i]
		var p1: Dictionary = poses[i + 1]
		var m0: Dictionary = tangents[i]
		var m1: Dictionary = tangents[i + 1]

		for step in range(1, steps + 1):
			var t_norm := float(step) / float(steps)
			var pose := _pose_hermite(p0, p1, m0, m1, phase.duration, t_norm)
			var frame_time := span_start + phase.duration * t_norm
			var frame_solved := PoseSolver.solve(rig, pose)
			frames.append(_make_frame(rig, frame_time, frame_solved))
			frame_metrics.append({"time": frame_time, "metrics": frame_solved["metrics"]})

		time = span_start + phase.duration
		phase_spans.append({
			"index": i,
			"start": span_start,
			"end": time,
			"phase": phase,
		})

	var duration := time

	# --- 3. Набор костей и треки -------------------------------------------
	# Путь к скелету зависит от рига: у капсульного это "Skeleton3D",
	# у персонажа — вложенный узел внутри инстанцированной модели.
	var skeleton_path := rig.get_skeleton_node_path()
	var bone_order: Dictionary = {}
	var ordered_names := rig.get_bone_names()
	for i in ordered_names.size():
		bone_order[ordered_names[i]] = i

	var used_bones: Dictionary = {}
	for frame: Dictionary in frames:
		for bone: StringName in frame["rotations"]:
			used_bones[bone] = true

	var sorted_bones: Array[StringName] = []
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
		# Путь трека для кости: "узел:кость" — РОВНО ОДИН subname.
		# AnimationMixer привязывает трек к кости только если
		# path.get_subname_count() == 1 (scene/animation/animation_mixer.cpp);
		# при "Skeleton3D:ИмяКости:rotation" subname два, кость не находится и
		# трек применяется к самому Skeleton3D. Тип трека уже говорит, ЧТО
		# анимируется, поэтому имя свойства в пути не нужно.
		anim.track_set_path(track, NodePath("%s:%s" % [skeleton_path, bone]))
		anim.track_set_interpolation_type(track, Animation.INTERPOLATION_LINEAR)
		for frame: Dictionary in frames:
			var rotations: Dictionary = frame["rotations"]
			var quat: Quaternion = rotations.get(bone, Quaternion.IDENTITY)
			anim.rotation_track_insert_key(track, float(frame["time"]), quat)

	# Положение таза — единственная translation-дорожка: остальные кости только
	# вращаются, иначе конечности будут «разъезжаться» из суставов.
	#
	# ВАЖНО: pose-позиция кости в Skeleton3D — это НЕ смещение относительно rest,
	# а полная локальная позиция (для корневой кости — в системе скелета).
	# Если писать сюда голый hips_offset (дельту), таз встанет в y ≈ 0 вместо
	# y ≈ 0.95, и вся фигура уедет под пол. Поэтому ключ считает сам риг:
	# у капсульного это rest + смещение, у персонажа — ещё и пересчёт осей.
	var root_bone := rig.get_root_bone_name()
	var position_track := anim.add_track(Animation.TYPE_POSITION_3D)
	anim.track_set_path(position_track, NodePath("%s:%s" % [skeleton_path, root_bone]))
	anim.track_set_interpolation_type(position_track, Animation.INTERPOLATION_LINEAR)
	for frame: Dictionary in frames:
		var offset: Vector3 = frame["hips_offset"]
		anim.position_track_insert_key(position_track, float(frame["time"]), rig.hips_pose_position(offset))

	# Длительность задаётся явно: вставка ключей НЕ растягивает Animation.length
	# (у нового Animation он 1.0), а от length зависят и проигрывание, и цикл.
	anim.length = duration

	# --- 4. Метрики техники по фазам + предупреждения ----------------------
	var phase_metrics: Array[Dictionary] = []
	var warnings := PackedStringArray()
	var bar_min := INF
	var bar_max := -INF

	for frame: Dictionary in frames:
		var bar_z := float(frame["metrics"]["bar_z"])
		bar_min = minf(bar_min, bar_z)
		bar_max = maxf(bar_max, bar_z)

	for i in data.phases.size():
		var phase: ExercisePhase = data.phases[i]
		# Явные типы обязательны: `var x := dict["key"]` не выводится (Variant без
		# типа) и валит компиляцию GDScript проверкой is_hard_type().
		var solved_target: Dictionary = PoseSolver.solve(rig, targets[i])
		var metrics: Dictionary = solved_target["metrics"]
		var checks := PoseSolver.check(data.technique_kind, metrics, data.has_bar)
		phase_metrics.append({"index": i, "metrics": metrics, "checks": checks})
		for check: Dictionary in checks:
			if check["level"] == "warn":
				warnings.append("%s: %s" % [phase.label, check["text"]])

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
	}


## Касательные для сплайна Catmull-Rom по цепочке поз.
## Считаются как центральная разность: (следующая - предыдущая) / Δt.
## В узлах-остановках (старт, удержания, финиш) касательная обнуляется,
## иначе сплайн «протаскивал» бы тело сквозь паузу.
static func _pose_tangents(poses: Array, times: Array, rest_at: Array) -> Array:
	var n := poses.size()
	var result: Array = []
	for i in n:
		var tangent: Dictionary = {}
		if i > 0 and i < n - 1 and not bool(rest_at[i]):
			var dt := float(times[i + 1]) - float(times[i - 1])
			if dt > 0.0001:
				var prev: Dictionary = poses[i - 1]
				var cur: Dictionary = poses[i]
				var next: Dictionary = poses[i + 1]
				for key: StringName in cur:
					var a := float(prev.get(key, cur[key]))
					var b := float(next.get(key, cur[key]))
					tangent[key] = (b - a) / dt
		result.append(tangent)
	return result


## Кубическая интерполяция Эрмита между двумя позами с заданными касательными.
## u — доля внутри фазы (0..1), dt — длительность фазы в секундах.
static func _pose_hermite(
	p0: Dictionary, p1: Dictionary, m0: Dictionary, m1: Dictionary,
	dt: float, u: float
) -> Dictionary:
	var u2 := u * u
	var u3 := u2 * u
	var h00 := 2.0 * u3 - 3.0 * u2 + 1.0
	var h10 := u3 - 2.0 * u2 + u
	var h01 := -2.0 * u3 + 3.0 * u2
	var h11 := u3 - u2

	var result: Dictionary = {}
	for key: StringName in p0:
		result[key] = _channel_hermite(p0, p1, m0, m1, key, h00, h10, h01, h11, dt)
	for key: StringName in p1:
		if not result.has(key):
			result[key] = _channel_hermite(p0, p1, m0, m1, key, h00, h10, h01, h11, dt)
	return result


static func _channel_hermite(
	p0: Dictionary, p1: Dictionary, m0: Dictionary, m1: Dictionary,
	key: StringName, h00: float, h10: float, h01: float, h11: float, dt: float
) -> float:
	var has_a := p0.has(key)
	var has_b := p1.has(key)
	if not has_a and not has_b:
		return 0.0
	var a := float(p0[key]) if has_a else float(p1[key])
	var b := float(p1[key]) if has_b else a
	# Канал не меняется в этой фазе — держим ровно, без «перелёта» сплайна.
	if absf(b - a) < 0.000001:
		return a
	var value := h00 * a + h10 * dt * float(m0.get(key, 0.0)) \
		+ h01 * b + h11 * dt * float(m1.get(key, 0.0))
	# Ограничение перелёта: сустав не должен уехать дальше, чем до соседней
	# целевой позы. Без этого Catmull-Rom на резких стыках даёт выбросы
	# (например, колено «проскакивает» глубже нижней точки).
	return clampf(value, minf(a, b), maxf(a, b))


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
	}
```

---

## `scripts/animation/exercise_animator.gd`

```gdscript
class_name ExerciseAnimator
extends Node
## Проигрывание сгенерированной анимации упражнения: фазы, повторы, темп.
##
## Слой между «данными упражнения» и AnimationPlayer. Нужен потому, что
## приложению важны не только пиксели, но и состояние движения: какая сейчас
## фаза, сколько повторов сделано, какие метрики техники СЕЙЧАС и есть ли
## предупреждения. Метрики берутся из тех же данных, из которых собрана
## анимация, поэтому подсказки не могут разойтись с картинкой.

signal phase_changed(index: int, phase: ExercisePhase)
signal rep_completed(reps: int)
signal exercise_ready(data: ExerciseData, warnings: PackedStringArray)

@export var animation_player_path: NodePath = ^"../Rig/AnimationPlayer"

var rig: HumanoidRig
var data: ExerciseData
var duration := 0.0
var warnings := PackedStringArray()
var reps := 0

var _player: AnimationPlayer
var _phase_spans: Array = []
var _phase_metrics: Array = []
var _frame_metrics: Array = []
var _current_phase := -1
var _last_position := 0.0
var _tempo := 1.0


func _ready() -> void:
	_player = get_node_or_null(animation_player_path) as AnimationPlayer


## Собирает анимацию из данных и регистрирует её в AnimationPlayer.
## Возвращает true, если всё собралось.
func setup(rig_ref: HumanoidRig, exercise: ExerciseData) -> bool:
	if rig_ref == null or exercise == null:
		push_error("ExerciseAnimator: rig/data не заданы")
		return false

	rig = rig_ref
	data = exercise

	if _player == null:
		_player = get_node_or_null(animation_player_path) as AnimationPlayer
	if _player == null:
		push_error("ExerciseAnimator: не найден AnimationPlayer по пути '%s'" % animation_player_path)
		return false

	var result := ExerciseAnimationBuilder.build(rig, data)
	var animation: Animation = result["animation"]
	if animation == null:
		warnings = result["warnings"]
		exercise_ready.emit(data, warnings)
		return false

	duration = float(result["duration"])
	_phase_spans = result["phase_spans"]
	_phase_metrics = result["phase_metrics"]
	_frame_metrics = result["frame_metrics"]
	warnings = result["warnings"]

	var library: AnimationLibrary
	if _player.has_animation_library(""):
		library = _player.get_animation_library("")
	else:
		library = AnimationLibrary.new()
		_player.add_animation_library("", library)

	if library.has_animation(data.animation_name):
		library.remove_animation(data.animation_name)
	library.add_animation(data.animation_name, animation)

	if not _player.animation_finished.is_connected(_on_animation_finished):
		_player.animation_finished.connect(_on_animation_finished)

	set_tempo_scale(data.default_tempo)
	_current_phase = -1
	reps = 0
	exercise_ready.emit(data, warnings)
	return true


func play(from_start: bool = true) -> void:
	if _player == null or data == null:
		return
	if from_start:
		_seek_internal(0.0)
	_player.play(data.animation_name)


func pause() -> void:
	if _player != null:
		_player.pause()


## Возобновление без аргумента продолжает с текущей позиции (pause() её сохраняет).
func resume() -> void:
	if _player != null:
		_player.play()


func toggle_pause() -> void:
	if _player == null:
		return
	if _player.is_playing():
		_player.pause()
	else:
		_player.play()


func is_playing() -> bool:
	return _player != null and _player.is_playing()


## Темп: 1.0 — как в данных, 0.7 — медленнее (разбор техники), 1.3 — быстрее.
func set_tempo_scale(value: float) -> void:
	_tempo = clampf(value, 0.2, 3.0)
	if _player != null:
		_player.speed_scale = _tempo


func get_tempo_scale() -> float:
	return _tempo


func seek_phase(index: int) -> void:
	if index < 0 or index >= _phase_spans.size():
		return
	_seek_internal(float(_phase_spans[index]["start"]))


func get_phase_count() -> int:
	return _phase_spans.size()


func get_current_phase_index() -> int:
	return _current_phase


func get_current_phase() -> ExercisePhase:
	if _current_phase < 0 or _current_phase >= _phase_spans.size():
		return null
	return _phase_spans[_current_phase]["phase"] as ExercisePhase


## Метрики техники НА ТЕКУЩИЙ КАДР (интерполяция между сэмплами), а не целевой
## позы фазы: иначе HUD всю эксцентрику показывал бы углы нижней точки.
func get_current_metrics() -> Dictionary:
	if _player == null or _frame_metrics.is_empty():
		return {}
	return _sample_metrics(_player.current_animation_position)


## Проверки техники для текущего кадра.
func get_current_checks() -> Array:
	var metrics := get_current_metrics()
	if metrics.is_empty() or data == null:
		return []
	return PoseSolver.check(data.technique_kind, metrics, data.has_bar)


## Метрики целевой позы фазы (для экрана «разбор фазы»).
func get_phase_target_metrics() -> Dictionary:
	if _current_phase < 0 or _current_phase >= _phase_metrics.size():
		return {}
	return _phase_metrics[_current_phase]["metrics"]


func _seek_internal(time: float) -> void:
	if _player == null:
		return
	_player.seek(time, true)
	_last_position = time


func _sample_metrics(position: float) -> Dictionary:
	var last := _frame_metrics.size() - 1
	if position <= float(_frame_metrics[0]["time"]):
		return _frame_metrics[0]["metrics"]
	if position >= float(_frame_metrics[last]["time"]):
		return _frame_metrics[last]["metrics"]

	var lo := 0
	var hi := last
	while hi - lo > 1:
		var mid: int = (lo + hi) >> 1
		if float(_frame_metrics[mid]["time"]) <= position:
			lo = mid
		else:
			hi = mid

	var a: Dictionary = _frame_metrics[lo]
	var b: Dictionary = _frame_metrics[hi]
	var span: float = float(b["time"]) - float(a["time"])
	var t: float = 0.0 if span <= 0.0 else (position - float(a["time"])) / span
	var from: Dictionary = a["metrics"]
	var to: Dictionary = b["metrics"]

	var result: Dictionary = {}
	for key in from:
		var va: Variant = from[key]
		var vb: Variant = to.get(key, va)
		if typeof(va) == TYPE_FLOAT and typeof(vb) == TYPE_FLOAT:
			result[key] = lerpf(va, vb, t)
		else:
			result[key] = va
	return result


func _process(_delta: float) -> void:
	if _player == null or duration <= 0.0 or not _player.is_playing():
		return

	var position: float = _player.current_animation_position

	# Определение фазы: интервалы [start, end) из данных. Дешевле, чем method-
	# треки, и не зависит от версии Animation, зато даёт те же сигналы.
	for i in _phase_spans.size():
		var span: Dictionary = _phase_spans[i]
		if position >= float(span["start"]) and position < float(span["end"]):
			if i != _current_phase:
				_current_phase = i
				phase_changed.emit(i, span["phase"])
			break

	# Замыкание цикла = завершённый повтор.
	if position + 0.001 < _last_position:
		reps += 1
		rep_completed.emit(reps)
	_last_position = position


func _on_animation_finished(animation_name: StringName) -> void:
	# Сигнал общий для ВСЕХ анимаций AnimationPlayer, поэтому чужую анимацию
	# (например, тестовую) нужно отфильтровать, иначе она засчитает повтор.
	if data == null or animation_name != data.animation_name:
		return
	# Для незацикленной анимации повтор считается по её завершению.
	if not data.loop:
		reps += 1
		rep_completed.emit(reps)
		_current_phase = -1
	# Позиция после финиша равна duration; сбрасываем её, чтобы следующий
	# play(false) не принял старт «из конца» за прошедший повтор.
	_last_position = 0.0
```

---

## `scripts/exercises/bodyweight_squat.gd`

```gdscript
class_name BodyweightSquatExercise
extends RefCounted
## Приседание с собственным весом — базовое домашнее упражнение.
##
## Отличия от приседа со штангой (back_squat.gd):
##   * нет грифа → нет каналов хвата, нет проверки баланса грифа;
##   * руки свободны и работают как противовес: внизу выносятся вперёд;
##   * корпус можно держать чуть вертикальнее (нет веса на спине).
##
## Техническая модель та же: стопа стоит на полу, её положение не меняется.
## Высота и сдвиг таза выводятся из углов бедра и колена (PoseSolver), поэтому
## стопа не «плывёт» и не проваливается.

const STAND_THIGH := 2.0
const STAND_KNEE := 5.0
const BOTTOM_THIGH := 95.0     ## бедро чуть выше горизонта → таз ниже колена
const BOTTOM_KNEE := 129.0     ## глубокий, но контролируемый присед
const BOTTOM_PELVIS := 30.0    ## наклон таза внизу (меньше, чем со штангой)
const BOTTOM_SPINE := 6.0      ## поясница почти нейтральна (порог 12°)
const BREAK_THIGH := 60.0
const BREAK_KNEE := 90.0
const BREAK_PELVIS := 26.0
const BREAK_SPINE := 6.0


static func build() -> ExerciseData:
	var data := ExerciseData.new()
	data.exercise_id = &"bodyweight_squat"
	data.display_name = "Приседание"
	data.technique_kind = &"squat"
	data.equipment = ""
	data.animation_name = &"bodyweight_squat"
	data.has_bar = false
	data.loop = true
	data.default_tempo = 1.0

	data.description = "Приседание с собственным весом: таз опускается между стоп, " \
		+ "колени идут по направлению носков, пятки остаются на полу."

	data.muscles_primary = PackedStringArray([
		"Квадрицепс", "Большая ягодичная",
	])
	data.muscles_secondary = PackedStringArray([
		"Приводящие мышцы бедра", "Задняя поверхность бедра",
		"Икроножные", "Мышцы кора",
	])

	data.setup_cues = PackedStringArray([
		"Стопы на ширине плеч, носки развёрнуты на 15–20°",
		"Вес распределён по всей стопе, не на носках",
		"Живот в тонусе, спина ровная на всём протяжении",
		"Колени идут по направлению носков, не внутрь",
		"Внизу таз ниже колена, без отскока",
	])

	data.common_mistakes = PackedStringArray([
		"Пятки отрываются от пола — не хватает подвижности голеностопа",
		"Колени заваливаются внутрь — разводить их по носкам",
		"Округление поясницы внизу — не брать глубину больше доступной",
		"Отскок из нижней точки — пауза 0.25 с вместо баллистики",
		"Корпус падает вперёд — держать вес над серединой стопы",
	])

	# Стойка: руки свободно вдоль корпуса, вес на всей стопе.
	# Грифа нет, поэтому никаких каналов хвата здесь не задаётся.
	data.base_pose = PoseUtils.sym({
		&"thigh_angle": STAND_THIGH,
		&"knee_flexion": STAND_KNEE,
		&"pelvis_pitch": 6.0,
		&"spine_lean": 3.0,
		&"toe_out": 15.0,
		# Руки чуть отведены от корпуса, локти мягко согнуты.
		&"shoulder_abduction": 8.0,
		&"shoulder_flexion": 0.0,
		&"elbow_flexion": 10.0,
	})

	var phases: Array[ExercisePhase] = []

	# 1. Подготовка: вдох, живот в тонусе, вес на середине стопы.
	phases.append(_phase(
		&"setup", "Подготовка",
		"Стою ровно, стопы на ширине плеч, вдох, живот в тонусе",
		0.6, ExercisePhase.Ease.SMOOTH, &"inhale",
		{&"thigh_angle": 8.0, &"knee_flexion": 14.0, &"pelvis_pitch": 8.0, &"spine_lean": 4.0}
	))

	# 2. Начало опускания: колени сгибаются раньше таза — иначе таз уходит
	#    назад и вес съезжает на пятку.
	phases.append(_phase(
		&"descent_top", "Опускание: колени",
		"Сгибаю колени, таз идёт вниз-назад, стопы прижаты",
		0.6, ExercisePhase.Ease.SMOOTH, &"hold",
		{
			&"thigh_angle": 30.0,
			&"knee_flexion": 52.0,
			&"pelvis_pitch": 16.0,
			&"spine_lean": 6.0,
			# Руки начинают выноситься вперёд как противовес.
			&"shoulder_flexion": 25.0,
			&"elbow_flexion": 20.0,
		}
	))

	# 3. Основная эксцентрика: под весом разгоняется и тормозит у нижней точки.
	phases.append(_phase(
		&"descent_low", "Опускание: вниз",
		"Таз между стоп, колени по носкам, пятки на полу",
		0.9, ExercisePhase.Ease.SMOOTH, &"hold",
		{
			&"thigh_angle": BOTTOM_THIGH,
			&"knee_flexion": BOTTOM_KNEE,
			&"pelvis_pitch": BOTTOM_PELVIS,
			&"spine_lean": BOTTOM_SPINE,
			# Руки вынесены вперёд — баланс без грифа.
			&"shoulder_flexion": 55.0,
			&"elbow_flexion": 15.0,
		}
	))

	# 4. Пауза внизу: контроль без отскока.
	phases.append(_phase(
		&"bottom_pause", "Пауза внизу",
		"Стоп: 0.25 с без отскока, вес на середине стопы",
		0.25, ExercisePhase.Ease.LINEAR, &"hold", {}
	))

	# 5. Мёртвая точка сразу над низом — старт медленный, затем разгон.
	phases.append(_phase(
		&"ascent_break", "Проход мёртвой точки",
		"Толкаю пол всей стопой, колени и таз поднимаются одновременно",
		0.5, ExercisePhase.Ease.ACCELERATE, &"hold",
		{
			&"thigh_angle": BREAK_THIGH,
			&"knee_flexion": BREAK_KNEE,
			&"pelvis_pitch": BREAK_PELVIS,
			&"spine_lean": BREAK_SPINE,
			&"shoulder_flexion": 35.0,
			&"elbow_flexion": 15.0,
		}
	))

	# 6. Выход в стойку с торможением у фиксации.
	phases.append(_phase(
		&"ascent_finish", "Выпрямление",
		"Выдох, колени выпрямляются, таз доведён",
		0.8, ExercisePhase.Ease.DECELERATE, &"exhale",
		{
			&"thigh_angle": STAND_THIGH,
			&"knee_flexion": STAND_KNEE,
			&"pelvis_pitch": 6.0,
			&"spine_lean": 3.0,
			&"shoulder_flexion": 0.0,
			&"elbow_flexion": 10.0,
		}
	))

	# 7. Фиксация: колени почти прямые, без гиперэкстензии.
	phases.append(_phase(
		&"lockout", "Фиксация",
		"Колени почти прямые (5°), таз доведён, дыхание ровное",
		0.2, ExercisePhase.Ease.LINEAR, &"", {}
	))

	data.phases = phases
	return data


static func _phase(
	phase_id: StringName,
	label: String,
	cue: String,
	duration: float,
	ease: ExercisePhase.Ease,
	breath: StringName,
	pose: Dictionary
) -> ExercisePhase:
	var phase := ExercisePhase.new()
	phase.phase_id = phase_id
	phase.label = label
	phase.cue = cue
	phase.duration = duration
	phase.ease = ease
	phase.breath = breath
	phase.pose = PoseUtils.sym(pose)
	return phase
```

---

## `scripts/rig/humanoid_rig.gd`

```gdscript
class_name HumanoidRig
extends Node3D
## Процедурный гуманоидный риг для анимаций упражнений.
##
## ВАЖНО: намеренно БЕЗ @tool. Если бы скрипт исполнялся в редакторе, он
## построил бы Skeleton3D и меши прямо в редактируемой сцене; при сохранении
## они запеклись бы в .tscn, а в рантайме появился бы второй скелет, и пути
## треков вида "Skeleton3D:..." перестали бы находить узел.
##
## Зачем свой риг, а не готовая модель:
##   1. Анимация упражнения — это в первую очередь УГЛЫ СУСТАВОВ. Когда скелет
##      строится кодом, углы задаются в градусах и проверяются математикой, а не
##      «на глаз» в редакторе.
##   2. Нет зависимости от ассетов: проект собирается и запускается без .glb.
##   3. Имена костей стабильны, поэтому треки AnimationPlayer можно генерировать.
##
## Соглашения (важно для всех треков):
##   * Персонаж смотрит в -Z (forward), +Y — вверх, +X — вправо (сторона "_r").
##   * У ВСЕХ костей rest-basis = identity. Это осознанное решение: тогда
##     локальный поворот кости — это просто поворот вокруг осей родителя, и
##     сгибание в колене/бедре остаётся «плоским» сагиттальным вращением.
##   * Смещение кости задаётся в пространстве родителя (offset), поэтому длина
##     конечности = расстояние до дочернего сустава. Именно из этой таблицы
##     PoseSolver берёт размеры сегментов — они не могут разойтись.
##   * Высота пола = 0. Лодыжка в стойке: y = 0.08, ось носка: z = -0.15.
##
## Кости (28):
##   Hips → Spine → Chest → Neck → Head
##   Chest → Clavicle_L/R → UpperArm_L/R → Forearm_L/R → Hand_L/R
##   Hips  → Thigh_L/R → Shin_L/R → Foot_L/R → Toe_L/R

# ---------------------------------------------------------------------------
# Скелет. Порядок важен: родитель должен быть добавлен раньше ребёнка.
# offset — положение сустава в системе родителя (rest-basis = identity).
# ---------------------------------------------------------------------------
const BONES: Array = [
	{"name": &"Hips", "parent": &"", "offset": Vector3(0.0, 0.95, 0.0)},

	# Позвоночник: 3 сегмента + шея + голова. Таз (Hips) — корень и для ног,
	# поэтому наклон корпуса вперёд делается тазом (ant. tilt) и поясницей.
	{"name": &"Spine", "parent": &"Hips", "offset": Vector3(0.0, 0.08, 0.0)},
	{"name": &"Chest", "parent": &"Spine", "offset": Vector3(0.0, 0.20, 0.0)},
	{"name": &"Neck", "parent": &"Chest", "offset": Vector3(0.0, 0.17, 0.0)},
	{"name": &"Head", "parent": &"Neck", "offset": Vector3(0.0, 0.13, 0.0)},

	# Руки. Плечо на высоте 1.40 м — анатомически ~0.79 роста (рост рига 1.77 м).
	{"name": &"Clavicle_L", "parent": &"Chest", "offset": Vector3(-0.03, 0.17, 0.0)},
	{"name": &"UpperArm_L", "parent": &"Clavicle_L", "offset": Vector3(-0.17, 0.0, 0.0)},
	{"name": &"Forearm_L", "parent": &"UpperArm_L", "offset": Vector3(0.0, -0.30, 0.0)},
	{"name": &"Hand_L", "parent": &"Forearm_L", "offset": Vector3(0.0, -0.26, 0.0)},

	{"name": &"Clavicle_R", "parent": &"Chest", "offset": Vector3(0.03, 0.17, 0.0)},
	{"name": &"UpperArm_R", "parent": &"Clavicle_R", "offset": Vector3(0.17, 0.0, 0.0)},
	{"name": &"Forearm_R", "parent": &"UpperArm_R", "offset": Vector3(0.0, -0.30, 0.0)},
	{"name": &"Hand_R", "parent": &"Forearm_R", "offset": Vector3(0.0, -0.26, 0.0)},

	# Ноги. Ширина стойки 0.20 м между тазобедренными суставами.
	# Бедро 0.45, голень 0.40 → лодыжка 0.08 (стопа стоит на полу).
	{"name": &"Thigh_L", "parent": &"Hips", "offset": Vector3(-0.10, -0.02, 0.0)},
	{"name": &"Shin_L", "parent": &"Thigh_L", "offset": Vector3(0.0, -0.45, 0.0)},
	{"name": &"Foot_L", "parent": &"Shin_L", "offset": Vector3(0.0, -0.40, 0.0)},
	{"name": &"Toe_L", "parent": &"Foot_L", "offset": Vector3(0.0, -0.07, -0.15)},

	{"name": &"Thigh_R", "parent": &"Hips", "offset": Vector3(0.10, -0.02, 0.0)},
	{"name": &"Shin_R", "parent": &"Thigh_R", "offset": Vector3(0.0, -0.45, 0.0)},
	{"name": &"Foot_R", "parent": &"Shin_R", "offset": Vector3(0.0, -0.40, 0.0)},
	{"name": &"Toe_R", "parent": &"Foot_R", "offset": Vector3(0.0, -0.07, -0.15)},
]

# ---------------------------------------------------------------------------
# Визуальные «капсулы» вместо настоящего скина.
# BoneAttachment3D жёстко привязывает меш к кости — для проверки техники этого
# достаточно и не требует скиннинга (в проде сюда ставится skinned mesh).
# Спецификации с суффиксом _l зеркалятся на _r по X автоматически.
# ---------------------------------------------------------------------------
const ATTACHMENTS: Array = [
	{"bone": &"Hips", "type": &"box", "size": Vector3(0.30, 0.20, 0.22), "pos": Vector3(0.0, 0.02, 0.0)},
	{"bone": &"Spine", "type": &"capsule", "radius": 0.115, "height": 0.34, "pos": Vector3(0.0, 0.09, 0.0)},
	{"bone": &"Chest", "type": &"capsule", "radius": 0.145, "height": 0.42, "pos": Vector3(0.0, 0.09, 0.0)},
	{"bone": &"Neck", "type": &"capsule", "radius": 0.050, "height": 0.14, "pos": Vector3(0.0, 0.06, 0.0)},
	{"bone": &"Head", "type": &"capsule", "radius": 0.105, "height": 0.26, "pos": Vector3(0.0, 0.11, 0.0)},

	{"bone": &"Clavicle_L", "type": &"box", "size": Vector3(0.16, 0.06, 0.06), "pos": Vector3(-0.07, 0.0, 0.0)},
	{"bone": &"UpperArm_L", "type": &"capsule", "radius": 0.052, "height": 0.28, "pos": Vector3(0.0, -0.15, 0.0)},
	{"bone": &"Forearm_L", "type": &"capsule", "radius": 0.042, "height": 0.24, "pos": Vector3(0.0, -0.13, 0.0)},
	{"bone": &"Hand_L", "type": &"box", "size": Vector3(0.09, 0.15, 0.05), "pos": Vector3(0.0, -0.075, 0.0)},

	{"bone": &"Thigh_L", "type": &"capsule", "radius": 0.085, "height": 0.43, "pos": Vector3(0.0, -0.225, 0.0)},
	{"bone": &"Shin_L", "type": &"capsule", "radius": 0.060, "height": 0.38, "pos": Vector3(0.0, -0.20, 0.0)},
	{"bone": &"Foot_L", "type": &"box", "size": Vector3(0.09, 0.07, 0.24), "pos": Vector3(0.0, -0.045, -0.06)},
	{"bone": &"Toe_L", "type": &"box", "size": Vector3(0.09, 0.05, 0.09), "pos": Vector3(0.0, -0.02, -0.04)},
]

# ---------------------------------------------------------------------------
# Таблица каналов: «анатомическое имя → кость + ось + знак».
#
# Это единственное место, где живёт соответствие «градусы в данных упражнения →
# поворот кости». Каналы с суффиксом _l/_r зеркальны (см. sign_l / sign_r).
#
# axis: 0 = X (сагиттальная плоскость, сгибание/разгибание),
#       1 = Y (скрутка вокруг оси сегмента),
#       2 = Z (фронтальная плоскость, отведение).
# Значения в данных — ВСЕГДА в градусах в анатомическом смысле (см. label).
# ---------------------------------------------------------------------------
const CHANNELS: Dictionary = {
	# --- таз и позвоночник ---------------------------------------------------
	# + = передний наклон таза (anterior pelvic tilt). Поворот кости: -X,
	# потому что «верх» таза должен уехать вперёд (-Z).
	&"pelvis_pitch": {"bone_l": &"Hips", "bone_r": &"Hips", "sided": false, "axis": 0,
		"sign_l": -1.0, "sign_r": -1.0, "label": "Наклон таза вперёд"},
	# + = наклон позвоночника вперёд (поясница). Это НАСТОЯЩЕЕ сгибание спины,
	# поэтому в приседе оно ограничено (см. PoseSolver.MAX_SPINE_FLEXION).
	&"spine_lean": {"bone_l": &"Spine", "bone_r": &"Spine", "sided": false, "axis": 0,
		"sign_l": -1.0, "sign_r": -1.0, "label": "Наклон поясницы вперёд"},
	&"chest_lean": {"bone_l": &"Chest", "bone_r": &"Chest", "sided": false, "axis": 0,
		"sign_l": -1.0, "sign_r": -1.0, "label": "Наклон грудного отдела вперёд"},
	&"neck_lean": {"bone_l": &"Neck", "bone_r": &"Neck", "sided": false, "axis": 0,
		"sign_l": -1.0, "sign_r": -1.0, "label": "Наклон шеи вперёд"},
	&"head_lean": {"bone_l": &"Head", "bone_r": &"Head", "sided": false, "axis": 0,
		"sign_l": -1.0, "sign_r": -1.0, "label": "Наклон головы вперёд"},
	# Боковой наклон / скрутка корпуса (для будущих упражнений).
	&"spine_side": {"bone_l": &"Spine", "bone_r": &"Spine", "sided": false, "axis": 2,
		"sign_l": -1.0, "sign_r": -1.0, "label": "Боковой наклон"},
	&"spine_twist": {"bone_l": &"Spine", "bone_r": &"Spine", "sided": false, "axis": 1,
		"sign_l": 1.0, "sign_r": 1.0, "label": "Скрутка корпуса"},

	# --- тазобедренный сустав -------------------------------------------------
	# ЛОКАЛЬНЫЙ угол бедра (относительно таза). Абсолютный угол от вертикали
	# считает PoseSolver: thigh_angle_world = thigh_angle_local - pelvis_rot.
	&"thigh_angle": {"bone_l": &"Thigh_L", "bone_r": &"Thigh_R", "sided": true, "axis": 0,
		"sign_l": 1.0, "sign_r": 1.0, "label": "Сгибание бедра (лок.)"},
	&"hip_abduction": {"bone_l": &"Thigh_L", "bone_r": &"Thigh_R", "sided": true, "axis": 2,
		"sign_l": -1.0, "sign_r": 1.0, "label": "Отведение бедра"},
	&"hip_rotation": {"bone_l": &"Thigh_L", "bone_r": &"Thigh_R", "sided": true, "axis": 1,
		"sign_l": -1.0, "sign_r": 1.0, "label": "Ротация бедра"},

	# --- колено ---------------------------------------------------------------
	# + = сгибание (0 = прямая нога). Поворот -X: голень уходит назад (+Z).
	&"knee_flexion": {"bone_l": &"Shin_L", "bone_r": &"Shin_R", "sided": true, "axis": 0,
		"sign_l": -1.0, "sign_r": -1.0, "label": "Сгибание колена"},

	# --- голеностоп -----------------------------------------------------------
	# + = тыльное сгибание (носок тянется вверх, голень наклоняется вперёд).
	&"ankle_dorsiflexion": {"bone_l": &"Foot_L", "bone_r": &"Foot_R", "sided": true, "axis": 0,
		"sign_l": 1.0, "sign_r": 1.0, "label": "Тыльное сгибание стопы"},
	# + = носок наружу (в стойке). Зеркально: левая стопа вращается в -X.
	&"toe_out": {"bone_l": &"Foot_L", "bone_r": &"Foot_R", "sided": true, "axis": 1,
		"sign_l": 1.0, "sign_r": -1.0, "label": "Разворот носков наружу"},

	# --- лопатка (ключица) ----------------------------------------------------
	# Отдельная степень свободы, без которой хват штанги геометрически невозможен:
	# ключица поднимается и отводится назад, поднося плечевой сустав к грифу.
	#
	# ВАЖНО про оси. Ключица идёт от центра к плечу ВДОЛЬ ОСИ X, а плечевой
	# сустав сидит на её конце (offset UpperArm = -0.17 по X). Поэтому вращение
	# ключицы вокруг X НЕ СДВИГАЕТ плечо вообще (точка лежит на оси вращения):
	# подъём лопатки — это поворот вокруг Z (фронтальная плоскость), а отведение
	# назад — поворот вокруг Y (горизонтальная плоскость). Если поменять их
	# местами (как было раньше: lift по X, retraction по Z), канал lift становится
	# мёртвым, а retraction уводит плечо вперёд — и кисть не достаёт до грифа.
	#
	# + = подъём (плечо вверх). Для левой руки (плечо в -X) подъём — это поворот
	# вокруг Z на отрицательный угол, для правой — на положительный.
	&"scapula_lift": {"bone_l": &"Clavicle_L", "bone_r": &"Clavicle_R", "sided": true, "axis": 2,
		"sign_l": -1.0, "sign_r": 1.0, "label": "Подъём лопатки"},
	# + = отведение назад (плечо уходит за спину, в +Z). Левая рука: поворот
	# вокруг Y на отрицательный угол, правая — на положительный.
	&"scapula_retraction": {"bone_l": &"Clavicle_L", "bone_r": &"Clavicle_R", "sided": true, "axis": 1,
		"sign_l": -1.0, "sign_r": 1.0, "label": "Отведение лопатки назад"},

	# --- плечо ----------------------------------------------------------------
	&"shoulder_flexion": {"bone_l": &"UpperArm_L", "bone_r": &"UpperArm_R", "sided": true, "axis": 0,
		"sign_l": 1.0, "sign_r": 1.0, "label": "Сгибание плеча (рука вперёд)"},
	# + = отведение в сторону (рука уходит от корпуса). Знак зеркальный.
	&"shoulder_abduction": {"bone_l": &"UpperArm_L", "bone_r": &"UpperArm_R", "sided": true, "axis": 2,
		"sign_l": -1.0, "sign_r": 1.0, "label": "Отведение плеча"},
	&"shoulder_twist": {"bone_l": &"UpperArm_L", "bone_r": &"UpperArm_R", "sided": true, "axis": 1,
		"sign_l": -1.0, "sign_r": 1.0, "label": "Ротация плеча"},
	&"elbow_flexion": {"bone_l": &"Forearm_L", "bone_r": &"Forearm_R", "sided": true, "axis": 0,
		"sign_l": 1.0, "sign_r": 1.0, "label": "Сгибание локтя"},
	&"wrist_pitch": {"bone_l": &"Hand_L", "bone_r": &"Hand_R", "sided": true, "axis": 0,
		"sign_l": 1.0, "sign_r": 1.0, "label": "Сгибание кисти"},
}

# Штанга: положение грифа на спине (локально в кости Chest).
# Высота подобрана под high-bar: гриф лежит НА трапециях, чуть выше плечевого
# сустава (плечо в Chest-локальных = 0.17). При 0.14 гриф визуально «проваливался»
# в лопатки; 0.21 ставит его на верх трапеции, как в реальном хвате.
# Z = +0.07 — гриф за линией плеч (за спиной), иначе он окажется в шее.
const BAR_LOCAL_POS := Vector3(0.0, 0.21, 0.07)
const BAR_LENGTH := 1.45
const BAR_RADIUS := 0.016
const PLATE_OFFSET_X := 0.62
const PLATE_RADIUS := 0.22
const PLATE_THICKNESS := 0.045

## Строить ли штангу. Домашние тренировки идут без инвентаря, поэтому по
## умолчанию штанги нет; для зала выставляется true (в сцене или из кода).
@export var has_barbell: bool = false

var _built := false
var _skeleton: Skeleton3D
var _rest_world: Dictionary = {}   # StringName -> Vector3 (мировое rest-положение сустава)
var _lengths: Dictionary = {}      # StringName -> float (длина до дочернего сустава)
var _body_material: StandardMaterial3D
var _bar_material: StandardMaterial3D
var _plate_material: StandardMaterial3D


func _ready() -> void:
	if _built:
		return
	_build()


# ---------------------------------------------------------------------------
# Построение
# ---------------------------------------------------------------------------
func _build() -> void:
	_built = true
	_make_materials()

	_skeleton = Skeleton3D.new()
	_skeleton.name = "Skeleton3D"
	add_child(_skeleton)

	var index: Dictionary = {}
	var offsets: Dictionary = {}
	for spec: Dictionary in BONES:
		var bone_name: StringName = spec["name"]
		var parent_name: StringName = spec["parent"]
		var offset: Vector3 = spec["offset"]
		offsets[bone_name] = offset

		var idx: int = _skeleton.add_bone(String(bone_name))
		index[bone_name] = idx
		if parent_name != &"":
			_skeleton.set_bone_parent(idx, index[parent_name])
			_rest_world[bone_name] = _rest_world[parent_name] + offset
		else:
			_rest_world[bone_name] = offset
		# rest-basis = identity: локальный поворот кости = поворот вокруг осей родителя
		_skeleton.set_bone_rest(idx, Transform3D(Basis.IDENTITY, offset))

	# КРИТИЧНО: set_bone_rest() НЕ инициализирует позу кости. Пока поза —
	# identity, global_pose = parent_global_pose * pose, то есть все кости
	# схлопнулись бы в origin скелета (rest к композиции позы не применяется).
	# reset_bone_poses() копирует rest в позу и ставит скелет в исходную стойку.
	_skeleton.reset_bone_poses()

	_compute_lengths(offsets)
	_add_attachments()
	if has_barbell:
		_add_bar()


func _compute_lengths(offsets: Dictionary) -> void:
	var children: Dictionary = {}
	for spec: Dictionary in BONES:
		var parent_name: StringName = spec["parent"]
		if parent_name == &"":
			continue
		if not children.has(parent_name):
			children[parent_name] = []
		children[parent_name].append(spec["name"])

	for bone_name: StringName in children:
		var child_list: Array = children[bone_name]
		if child_list.size() == 1:
			var child_offset: Vector3 = offsets[child_list[0]]
			_lengths[bone_name] = child_offset.length()


func _make_materials() -> void:
	_body_material = StandardMaterial3D.new()
	_body_material.albedo_color = Color(0.82, 0.83, 0.86)
	_body_material.roughness = 0.65

	_bar_material = StandardMaterial3D.new()
	_bar_material.albedo_color = Color(0.72, 0.74, 0.78)
	_bar_material.metallic = 0.9
	_bar_material.roughness = 0.25

	_plate_material = StandardMaterial3D.new()
	_plate_material.albedo_color = Color(0.16, 0.17, 0.20)
	_plate_material.metallic = 0.6
	_plate_material.roughness = 0.45


func _add_attachments() -> void:
	for spec: Dictionary in ATTACHMENTS:
		var bone_name: StringName = spec["bone"]
		_attach_mesh(bone_name, _make_mesh(spec), spec["pos"], _body_material)
		# Зеркальная копия для парных костей.
		# ВНИМАНИЕ: суффиксы костей — ЗАГЛАВНЫЕ ("_L"/"_R"), как в BONES.
		# Проверка на "_l" в нижнем регистре не срабатывала ни разу, поэтому
		# правая рука и нога вообще не создавались (персонаж был «одноруким»).
		var text := String(bone_name)
		if text.ends_with("_L"):
			var mirrored_bone := StringName(text.substr(0, text.length() - 2) + "_R")
			var pos: Vector3 = spec["pos"]
			pos.x = -pos.x
			_attach_mesh(mirrored_bone, _make_mesh(spec), pos, _body_material)


func _make_mesh(spec: Dictionary) -> Mesh:
	var type: StringName = spec["type"]
	if type == &"box":
		var box := BoxMesh.new()
		box.size = spec["size"]
		return box
	var capsule := CapsuleMesh.new()
	capsule.radius = spec["radius"]
	capsule.height = spec["height"]
	return capsule


func _attach_mesh(bone_name: StringName, mesh: Mesh, local_pos: Vector3, material: Material) -> MeshInstance3D:
	var attachment := BoneAttachment3D.new()
	_skeleton.add_child(attachment)
	# bone_name назначаем ПОСЛЕ добавления в дерево: сеттер ищет родителя-Skeleton3D.
	attachment.bone_name = String(bone_name)

	var mesh_instance := MeshInstance3D.new()
	mesh_instance.mesh = mesh
	mesh_instance.position = local_pos
	mesh_instance.material_override = material
	attachment.add_child(mesh_instance)
	return mesh_instance


func _add_bar() -> void:
	var attachment := BoneAttachment3D.new()
	_skeleton.add_child(attachment)
	attachment.bone_name = "Chest"

	var bar_root := Node3D.new()
	bar_root.name = "Bar"
	bar_root.position = BAR_LOCAL_POS
	attachment.add_child(bar_root)

	var bar_mesh := CylinderMesh.new()
	bar_mesh.top_radius = BAR_RADIUS
	bar_mesh.bottom_radius = BAR_RADIUS
	bar_mesh.height = BAR_LENGTH
	var bar := MeshInstance3D.new()
	bar.mesh = bar_mesh
	bar.rotation_degrees = Vector3(0.0, 0.0, 90.0)  # ось цилиндра Y → X
	bar.material_override = _bar_material
	bar_root.add_child(bar)

	for side: float in [-1.0, 1.0]:
		var plate := MeshInstance3D.new()
		var plate_mesh := CylinderMesh.new()
		plate_mesh.top_radius = PLATE_RADIUS
		plate_mesh.bottom_radius = PLATE_RADIUS
		plate_mesh.height = PLATE_THICKNESS
		plate.mesh = plate_mesh
		plate.rotation_degrees = Vector3(0.0, 0.0, 90.0)
		plate.position = Vector3(PLATE_OFFSET_X * side, 0.0, 0.0)
		plate.material_override = _plate_material
		bar_root.add_child(plate)


# ---------------------------------------------------------------------------
# Публичный API для PoseSolver и билдера анимаций
# ---------------------------------------------------------------------------
func get_skeleton() -> Skeleton3D:
	return _skeleton


## Мировое rest-положение сустава (позиция в позе покоя, пол = y 0).
func get_rest_origin(bone_name: StringName) -> Vector3:
	return _rest_world.get(bone_name, Vector3.ZERO)


## Длина кости (расстояние до единственного дочернего сустава), метры.
func get_bone_length(bone_name: StringName) -> float:
	if not _lengths.has(bone_name):
		push_error("HumanoidRig: нет длины для кости '%s' (у неё не один дочерний сустав)" % bone_name)
		return 0.0
	return _lengths[bone_name]


## Смещение грифа относительно таза в позе покоя — база для расчёта баланса.
func get_bar_rest_offset() -> Vector3:
	return get_rest_origin(&"Chest") + BAR_LOCAL_POS - get_rest_origin(&"Hips")


## Превращает каналы (градусы) в кватернионы локальных поворотов костей.
## Возвращает { bone_name: Quaternion }. Один источник правды и для анимации,
## и для живого превью.
## Неизвестные каналы здесь МОЛЧА пропускаются: метод вызывается на каждый
## сэмпл (~150 раз), поэтому валидация вынесена в validate_channels().
func build_bone_rotations(channels: Dictionary) -> Dictionary:
	var eulers: Dictionary = {}   # bone -> Vector3 (радианы по осям X, Y, Z)

	for key: StringName in channels:
		var resolved := resolve_channel(key)
		if resolved.is_empty():
			continue
		var bone: StringName = resolved["bone"]
		var axis: int = resolved["axis"]
		var sign: float = resolved["sign"]
		var degrees: float = float(channels[key])

		if not eulers.has(bone):
			eulers[bone] = Vector3.ZERO
		var euler: Vector3 = eulers[bone]
		var delta := deg_to_rad(degrees) * sign
		match axis:
			0:
				euler.x += delta
			1:
				euler.y += delta
			_:
				euler.z += delta
		eulers[bone] = euler

	var rotations: Dictionary = {}
	for bone: StringName in eulers:
		# Порядок осей задан явно: для костей с двумя осями (бедро X+Z, плечо X+Z)
		# результат зависит от порядка, и это должно быть осознанным решением.
		var basis := Basis.from_euler(eulers[bone], EulerOrder.EULER_ORDER_YXZ)
		rotations[bone] = basis.get_rotation_quaternion()
	return rotations


## Однократная проверка набора каналов (до генерации анимации).
## Возвращает список проблем; пустой — всё в порядке.
func validate_channels(sets: Array) -> PackedStringArray:
	var problems := PackedStringArray()
	var seen: Dictionary = {}
	for channels: Dictionary in sets:
		for key: StringName in channels:
			if seen.has(key):
				continue
			seen[key] = true
			var text := String(key)
			var side := ""
			var base := text
			if text.ends_with("_l") or text.ends_with("_r"):
				side = text.substr(text.length() - 1, 1)
				base = text.substr(0, text.length() - 2)
			var spec: Dictionary = CHANNELS.get(StringName(base), {})
			if spec.is_empty():
				problems.append("неизвестный канал %s" % text)
			elif not bool(spec["sided"]) and side != "":
				problems.append("канал %s не парный, суффикс %s недопустим" % [base, side])
			elif bool(spec["sided"]) and side == "":
				problems.append("парному каналу %s нужен суффикс _l или _r" % base)
	return problems


## Разбор ключа канала: "knee_flexion_l" → {bone, axis, sign}.
## Возвращает пустой Dictionary для некорректного ключа (без ошибок в консоль).
func resolve_channel(key: StringName) -> Dictionary:
	var text := String(key)
	var side := ""
	var base := text

	if text.ends_with("_l") or text.ends_with("_r"):
		side = text.substr(text.length() - 1, 1)
		base = text.substr(0, text.length() - 2)

	var spec: Dictionary = CHANNELS.get(StringName(base), {})
	if spec.is_empty():
		return {}

	if not bool(spec["sided"]):
		if side != "":
			return {}
		return {
			"bone": spec["bone_l"],
			"axis": int(spec["axis"]),
			"sign": float(spec["sign_l"]),
		}

	if side == "":
		return {}

	if side == "l":
		return {"bone": spec["bone_l"], "axis": int(spec["axis"]), "sign": float(spec["sign_l"])}
	return {"bone": spec["bone_r"], "axis": int(spec["axis"]), "sign": float(spec["sign_r"])}


## Прямая установка позы (для отладки/превью без AnimationPlayer).
func apply_channels(channels: Dictionary) -> void:
	if not _built:
		_build()
	var rotations := build_bone_rotations(channels)
	for bone: StringName in rotations:
		var idx: int = _skeleton.find_bone(String(bone))
		if idx >= 0:
			_skeleton.set_bone_pose_rotation(idx, rotations[bone])


## Имя корневой кости (у капсульного рига — Hips, у персонажа — pelvis).
func get_root_bone_name() -> StringName:
	return &"Hips"


## Путь к Skeleton3D относительно этого узла — нужен для путей треков.
func get_skeleton_node_path() -> String:
	return "Skeleton3D"


## Позиция таза для position-дорожки: pose-позиция = rest + смещение.
func hips_pose_position(offset: Vector3) -> Vector3:
	return get_rest_origin(&"Hips") + offset


## Все имена костей в порядке иерархии — используется билдером для треков.
func get_bone_names() -> Array[StringName]:
	var names: Array[StringName] = []
	for spec: Dictionary in BONES:
		names.append(spec["name"])
	return names
```

---

## `scripts/rig/character_rig.gd`

```gdscript
class_name CharacterRig
extends HumanoidRig
## Риг на основе ГОТОВОГО скелета персонажа (glTF) вместо капсульного манекена.
##
## Зачем отдельный класс, а не правка HumanoidRig: капсульный риг строит скелет
## кодом с rest-basis = identity, и вся математика углов написана под это.
## У импортированного персонажа rest-позы другие (T-pose, корневая кость
## повёрнута), поэтому нужно пересчитывать оси. Наследуемся, чтобы PoseSolver,
## билдер и аниматор работали с ним без изменений.
##
## Система координат персонажа (проверено по файлу):
##   * взгляд +Z (у нас −Z), сторона _l = +X (у нас −X), верх +Y (совпадает).
##   * Значит переход «наша система ↔ система персонажа» = поворот на 180° по Y:
##       canon = R_y(180) * char  (меняет знак X и Z)
##   * Сам узел модели тоже поворачивается на 180°, чтобы персонаж смотрел
##     в мировое −Z, как и наш манекен.
##
## Rest-поза персонажа — T-pose (руки в стороны). BIND ниже опускает руки вниз,
## чтобы rest персонажа совпал с rest нашего рига (руки вдоль корпуса).

## Путь к glTF-модели персонажа.
@export var model_path: String = "res://assets/characters/superhero_male/Superhero_Male_FullBody.gltf"
## Имя узла-контейнера, под которым инстанцируется модель.
@export var model_node_name: String = "Model"
## Поворот модели вокруг Y: переводит «взгляд +Z» персонажа в наш «−Z».
@export var model_yaw_degrees: float = 180.0

## Имя скелетного узла в импортированной сцене (обычно Skeleton3D).
const SKELETON_NODE := "Skeleton3D"

## Соответствие: логическое имя кости (как в HumanoidRig.BONES и в CHANNELS)
## → фактическое имя кости в скелете персонажа.
const BONE_MAP: Dictionary = {
	&"Hips": "pelvis",
	&"Spine": "spine_01",
	&"Chest": "spine_03",
	&"Neck": "neck_01",
	&"Head": "Head",

	&"Clavicle_L": "clavicle_l",
	&"UpperArm_L": "upperarm_l",
	&"Forearm_L": "lowerarm_l",
	&"Hand_L": "hand_l",
	&"Clavicle_R": "clavicle_r",
	&"UpperArm_R": "upperarm_r",
	&"Forearm_R": "lowerarm_r",
	&"Hand_R": "hand_r",

	&"Thigh_L": "thigh_l",
	&"Shin_L": "calf_l",
	&"Foot_L": "foot_l",
	&"Toe_L": "ball_l",
	&"Thigh_R": "thigh_r",
	&"Shin_R": "calf_r",
	&"Foot_R": "foot_r",
	&"Toe_R": "ball_r",
}

## Пары «кость → дочерний сустав» для расчёта длин сегментов.
const LENGTH_PAIRS: Array = [
	[&"Hips", &"Spine"], [&"Spine", &"Chest"], [&"Chest", &"Neck"], [&"Neck", &"Head"],
	[&"Clavicle_L", &"UpperArm_L"], [&"UpperArm_L", &"Forearm_L"], [&"Forearm_L", &"Hand_L"],
	[&"Clavicle_R", &"UpperArm_R"], [&"UpperArm_R", &"Forearm_R"], [&"Forearm_R", &"Hand_R"],
	[&"Thigh_L", &"Shin_L"], [&"Shin_L", &"Foot_L"], [&"Foot_L", &"Toe_L"],
	[&"Thigh_R", &"Shin_R"], [&"Shin_R", &"Foot_R"], [&"Foot_R", &"Toe_R"],
]

## Постоянная поправка позы: переводит T-pose персонажа в A-pose (руки вниз),
## чтобы его rest совпал с rest капсульного рига. Значения — в каналах, поэтому
## знаки зеркалирования берутся из CHANNELS автоматически.
const BIND_POSE: Dictionary = {
	&"shoulder_abduction": -70.0,
}

var _model: Node3D
var _skeleton_rel_path := ""
## actual bone name → index в скелете
var _actual_index: Dictionary = {}
## actual bone name → rest-поворот (локальный, Quaternion)
var _rest_local_q: Dictionary = {}
## actual bone name → локальная rest-позиция
var _rest_local_pos: Dictionary = {}
## actual bone name → rest-базис РОДИТЕЛЯ в системе скелета
var _parent_rest_basis: Dictionary = {}


func _ready() -> void:
	if _built:
		return
	_build_from_model()


func _build_from_model() -> void:
	_built = true
	_make_materials()

	if not ResourceLoader.exists(model_path):
		push_error("CharacterRig: не найден файл модели '%s'" % model_path)
		return

	var packed := load(model_path) as PackedScene
	if packed == null:
		push_error("CharacterRig: '%s' не PackedScene (не импортирован?)" % model_path)
		return

	_model = packed.instantiate() as Node3D
	if _model == null:
		push_error("CharacterRig: не удалось создать экземпляр модели")
		return
	_model.name = model_node_name
	_model.rotation_degrees = Vector3(0.0, model_yaw_degrees, 0.0)
	add_child(_model)

	_skeleton = _find_skeleton(_model)
	if _skeleton == null:
		push_error("CharacterRig: в модели нет Skeleton3D")
		return

	_skeleton_rel_path = String(get_path_to(_skeleton))
	_collect_rest_data()
	_add_bar_if_needed()


func _add_bar_if_needed() -> void:
	# Штанга крепится к кости Chest, которой у персонажа нет (там spine_03).
	# Крепление грифа к скелету персонажа ещё не сделано — для домашних
	# тренировок без инвентаря оно и не нужно.
	if has_barbell:
		push_warning("CharacterRig: крепление штанги к персонажу пока не реализовано")


func _find_skeleton(node: Node) -> Skeleton3D:
	if node is Skeleton3D:
		return node as Skeleton3D
	for child in node.get_children():
		var found := _find_skeleton(child)
		if found != null:
			return found
	return null


func _collect_rest_data() -> void:
	for logical: StringName in BONE_MAP:
		var actual: String = BONE_MAP[logical]
		var idx := _skeleton.find_bone(actual)
		if idx < 0:
			push_error("CharacterRig: в скелете нет кости '%s' (для %s)" % [actual, logical])
			continue
		_actual_index[StringName(actual)] = idx

		var rest_local: Transform3D = _skeleton.get_bone_rest(idx)
		_rest_local_q[StringName(actual)] = rest_local.basis.get_rotation_quaternion()
		_rest_local_pos[StringName(actual)] = rest_local.origin

		var parent_idx := _skeleton.get_bone_parent(idx)
		if parent_idx >= 0:
			_parent_rest_basis[StringName(actual)] = _skeleton.get_bone_global_rest(parent_idx).basis
		else:
			_parent_rest_basis[StringName(actual)] = Basis.IDENTITY

		# Позиция сустава в системе скелета, переведённая в НАШУ систему:
		# canon = R_y(180) * char → меняем знак X и Z.
		var g := _skeleton.get_bone_global_rest(idx).origin
		_rest_world[logical] = Vector3(-g.x, g.y, -g.z)

	# Длины сегментов — расстояние между суставами (инвариант к повороту).
	for pair: Array in LENGTH_PAIRS:
		var from: StringName = pair[0]
		var to: StringName = pair[1]
		if _rest_world.has(from) and _rest_world.has(to):
			_lengths[from] = (_rest_world[to] - _rest_world[from]).length()


# ---------------------------------------------------------------------------
# API, совпадающий с HumanoidRig
# ---------------------------------------------------------------------------
func get_root_bone_name() -> StringName:
	return &"pelvis"


func get_skeleton_node_path() -> String:
	return _skeleton_rel_path


## Позиция таза для position-дорожки: offset приходит из PoseSolver в НАШЕЙ
## системе, а pose-позиция кости живёт в системе родителя персонажа.
func hips_pose_position(offset: Vector3) -> Vector3:
	var actual := StringName(BONE_MAP[&"Hips"])
	var local_rest: Vector3 = _rest_local_pos.get(actual, Vector3.ZERO)
	# canon → char: снова меняем знак X и Z.
	var char_offset := Vector3(-offset.x, offset.y, -offset.z)
	var parent_basis: Basis = _parent_rest_basis.get(actual, Basis.IDENTITY)
	return local_rest + parent_basis.inverse() * char_offset


func get_bone_names() -> Array[StringName]:
	var names: Array[StringName] = []
	for actual: StringName in _actual_index:
		names.append(actual)
	names.sort_custom(func(a: StringName, b: StringName) -> bool:
		return int(_actual_index[a]) < int(_actual_index[b])
	)
	return names


func resolve_channel(key: StringName) -> Dictionary:
	var resolved := super.resolve_channel(key)
	if resolved.is_empty():
		return {}
	var logical: StringName = resolved["bone"]
	if not BONE_MAP.has(logical):
		return {}
	resolved["bone"] = StringName(BONE_MAP[logical])
	return resolved


## Переводит канал в поворот КОСТИ ПЕРСОНАЖА.
##
## Отличие от капсульного рига: там rest-basis = identity, и «повернуть на X
## градусов вокруг оси X» = просто Quaternion(X, θ). Здесь у костей свои
## rest-ориентации, поэтому ось нужно перевести в систему родителя:
##   ось_в_родителе = parent_rest_basis⁻¹ · (R_y(180) · ось_канон)
## и домножить полученный поворот СЛЕВА на rest-поворот кости.
func build_bone_rotations(channels: Dictionary) -> Dictionary:
	var merged := _with_bind(channels)
	var eulers: Dictionary = {}   # actual bone -> Vector3 (радианы по осям X, Y, Z)

	for key: StringName in merged:
		var resolved := resolve_channel(key)
		if resolved.is_empty():
			continue
		var bone: StringName = resolved["bone"]
		var axis: int = resolved["axis"]
		var sign: float = resolved["sign"]
		var degrees: float = float(merged[key])

		if not eulers.has(bone):
			eulers[bone] = Vector3.ZERO
		var euler: Vector3 = eulers[bone]
		var delta := deg_to_rad(degrees) * sign
		match axis:
			0:
				euler.x += delta
			1:
				euler.y += delta
			_:
				euler.z += delta
		eulers[bone] = euler

	var rotations: Dictionary = {}
	for bone: StringName in eulers:
		var e: Vector3 = eulers[bone]
		var basis: Basis = _parent_rest_basis.get(bone, Basis.IDENTITY)
		# Порядок осей — тот же YXZ, что и в капсульном риге.
		var qy := Quaternion(_axis_in_parent(basis, Vector3.UP), e.y)
		var qx := Quaternion(_axis_in_parent(basis, Vector3.RIGHT), e.x)
		var qz := Quaternion(_axis_in_parent(basis, Vector3.BACK), e.z)
		var q := (qy * qx * qz).normalized()
		var rest_q: Quaternion = _rest_local_q.get(bone, Quaternion.IDENTITY)
		rotations[bone] = (q * rest_q).normalized()
	return rotations


func _axis_in_parent(parent_rest: Basis, canon_axis: Vector3) -> Vector3:
	# R_y(180): канонические X и Z меняют знак.
	var char_axis := Vector3(-canon_axis.x, canon_axis.y, -canon_axis.z)
	var axis := parent_rest.inverse() * char_axis
	if axis.length() < 0.000001:
		return Vector3.RIGHT
	return axis.normalized()


func _with_bind(channels: Dictionary) -> Dictionary:
	var out: Dictionary = channels.duplicate()
	for base: StringName in BIND_POSE:
		var value := float(BIND_POSE[base])
		for suffix: String in ["_l", "_r"]:
			var key := StringName(String(base) + suffix)
			out[key] = float(out.get(key, 0.0)) + value
	return out


func get_bar_rest_offset() -> Vector3:
	return _rest_world.get(&"Chest", Vector3.ZERO) + BAR_LOCAL_POS - _rest_world.get(&"Hips", Vector3.ZERO)
```

---

## Что уже пробовали и где, вероятно, осталась «роботизированность»

Это не выводы «за вас», а карта уже проверенных мест, чтобы не искать заново.

### Уже исправлено
1. **Остановки на стыках фаз.** Раньше каждая фаза сглаживалась `smoothstep`
   (нулевая скорость на обоих концах) → тело останавливалось 7 раз за повтор.
   Заменено на сплайн Catmull-Rom по цепочке поз (`_pose_tangents`,
   `_pose_hermite` в `exercise_animation_builder.gd`).
2. **Таз проваливался под пол.** В position-трек писалась дельта вместо
   абсолютной pose-позиции. Исправлено (`rig.hips_pose_position`).

### Гипотезы, которые стоит проверить
1. **Нет динамики веса.** Скорость задаётся только геометрией сплайна.
   Нет профиля «медленно вверху → разгон → торможение внизу» с реальной
   физикой (гравитация, момент в суставе). Смотреть: `_pose_tangents`.
2. **Руки движутся синхронно с корпусом.** Один канал, одна кривая.
   В жизни руки отстают (overlap / follow-through). Сейчас этого нет вообще.
3. **Нет вторичного движения.** Нет дыхания, нет микро-колебаний, нет
   смещения веса стопа→стопа. Всё абсолютно симметрично и статично.
4. **Симметрия идеальна.** `PoseUtils.sym()` жёстко зеркалит каналы —
   левая и правая стороны не могут отличаться ни на градус.
5. **Темп постоянный.** `ExerciseAnimator.speed_scale` — константа на весь
   повтор; внутри повтора темп не меняется.
6. **Сэмплирование 30 Гц + LINEAR-интерполяция кватернионов.**
   `SAMPLE_RATE_HZ = 30`, `INTERPOLATION_LINEAR`. Для 4-секундного повтора
   это ~115 ключей; на медленном движении может читаться ступенчатость.
7. **Позы — единственный источник движения.** Нет IK: стопа не «прилипает»
   к полу математически, она следует за углами. При смене пропорций
   (персонаж vs манекен) появляется проскальзывание.
8. **Пауза внизу реализована фазами-удержаниями**, а не удержанием позы с
   микро-движением — тело в паузе абсолютно неподвижно.
9. **Нет предвестников (anticipation).** Перед опусканием нет вдоха-подъёма
   груди, перед подъёмом — микро-сжатия.

### Параметры для экспериментов
| Параметр | Где | Сейчас |
|---|---|---|
| `SAMPLE_RATE_HZ` | builder | 30 |
| `BIND_POSE` | character_rig | `shoulder_abduction: -70` |
| порядок осей | `Basis.from_euler(..., YXZ)` | YXZ |
| `INTERPOLATION_LINEAR` | builder | linear |
| длительности фаз | `bodyweight_squat.gd` | 0.6 / 0.6 / 0.9 / 0.25 / 0.5 / 0.8 / 0.2 |
| `MIN_SQUAT_DEPTH_PERCENT` | pose_solver | 58 |
