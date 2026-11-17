# FitPulse — код движения, версия 2 (после патча «естественный присед»)

Godot 4.7, GDScript со строгой типизацией. Всё ниже — АКТУАЛЬНЫЕ файлы проекта.
Версия 1 (до патча) описывала только сплайн Catmull-Rom; здесь уже применён
патч fitpulse_squat_patch.zip (PCHIP-кривые, 3D-решатель ног, MotionLayer).

## Конвейер

```
ExerciseData (base_pose + phases + stance_width + has_bar)
        ↓
ExerciseAnimationBuilder.build()
  1. позы фаз складываются в цепочку (каждая наследует предыдущую)
  2. по каждому каналу строится монотонный кубический Эрмит (PCHIP)
  3. сэмплирование 60 Гц по общему времени
  4. MotionLayer: запаздывание рук, дыхание, асимметрия
  5. PoseSolver.solve(rig, pose, stance_width): 3D-IK обеих ног + метрики
  6. rig.build_bone_rotations(): каналы → кватернионы костей
        ↓
Animation (rotation-треки + одна position-дорожка таза)
        ↓
ExerciseAnimator (фазы, повторы, темп, метрики в HUD)
```

## Что уже сделано (не искать заново)

| Проблема | Решение | Статус |
|---|---|---|
| остановки на стыках фаз (smoothstep) | PCHIP по каналам, 60 Гц | сделано |
| таз проваливался под пол | абсолютная pose-позиция через `rig.hips_pose_position` | сделано |
| руки двигались синхронно с корпусом | `MotionLayer` — лаги 0.10–0.16 с | сделано |
| нет дыхания | `MotionLayer.breath_at` из `phase.breath` | сделано |
| идеальная симметрия | асимметрия рук/корпуса, растущая с глубиной | сделано |
| носок «гулял» 3.9 мм | 3D-решатель ног + канал `ankle_roll` | сделано |
| стойка уже/шире нужного | `ExerciseData.stance_width` + 3D-IK | сделано |
| валгус не проверялся | метрики `knee_valgus`, `knee_tracking_deg`, `pelvis_x_error` | сделано |

## Что осталось открытым (вопросы для разбора)

1. **T2. Вариативность повторов** — `baked_reps`: N циклов с детерминированной
   вариацией (глубина ±1.5°, длительность ±5 %, руки ±4°). Сейчас повтор всегда
   идентичен, а человек так не делает.
2. **T4. Динамика через `ease`** — поле `ExercisePhase.ease` объявлено, но
   НЕ ИСПОЛЬЗУЕТСЯ: скорость задаётся только геометрией PCHIP. Предлагалось
   масштабировать касательные на концах сегмента с ограничением Фритша–Карлсона.
3. **T5. Перенос веса** — микро-смещение таза по x (≤1 см) с сохранением
   позиций лодыжек.
4. **Пауза внизу** — поза в hold-фазе абсолютно неподвижна (PCHIP даёт ноль
   скорости). Живой человек в паузе микродвижется.
5. **Переход веса стопа→стопа** и работа рук вне корпуса — не моделируются.
6. **Лицо/взгляд** — голова компенсирует наклон на 85 %, но глаза и мимика
   отсутствуют; на низкополигональной модели это может читаться как «маска».
7. **Ступня** — `ankle_roll` считается решателем, но подошва не проверяется на
   отрыв по трём точкам (пятка/носок/внутренний край).

## Известные ограничения среды

`godot --headless` на целевой машине недоступен (только Android-редактор),
поэтому числа из брифа локально НЕ подтверждены. Для проверки сделан
рантайм-порт: `tools/squat_check_node.gd` + `scenes/tools/check.tscn`,
переключатель `use_character` (HumanoidRig / CharacterRig).

## Файлы

| Файл | Роль |
|---|---|
| `scripts/animation/exercise_phase.gd` | фаза, кривые ease (не используются) |
| `scripts/animation/pose_utils.gd` | sym / merge / blend поз |
| `scripts/animation/exercise_data.gd` | данные упражнения, `stance_width`, `has_bar` |
| `scripts/animation/motion_layer.gd` | рассинхрон, дыхание, асимметрия |
| `scripts/animation/pose_solver.gd` | **3D-решатель ног** + метрики техники |
| `scripts/animation/exercise_animation_builder.gd` | **PCHIP** + сборка Animation |
| `scripts/animation/exercise_animator.gd` | проигрывание, фазы, темп |
| `scripts/exercises/bodyweight_squat.gd` | данные приседа (7 фаз, stance 0.40) |
| `scripts/rig/humanoid_rig.gd` | капсульный скелет, каналы → кватернионы |
| `scripts/rig/character_rig.gd` | скелет персонажа glTF + ретаргет осей |
| `tools/squat_check.gd` | headless-проверка (эталон, требует CLI) |


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
## Ширина стойки между лодыжками, м. 0 = как в риге (стопы под тазобедренными суставами).
## Для приседа — около ширины плеч (0.36–0.42).
@export var stance_width: float = 0.0

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

## `scripts/animation/motion_layer.gd`

```gdscript
class_name MotionLayer
extends RefCounted
## Слой «живости» поверх авторских поз упражнения (scripts/animation/motion_layer.gd).
##
## Что делает (всё детерминировано, без random — цикл замыкается, экспорт воспроизводим):
##   1. Рассинхрон (overlap / follow-through): руки запаздывают относительно корпуса,
##      предплечье — ещё больше, чем плечо; левая и правая рука — на разную долю секунды.
##   2. Голова: взгляд не «прибит» к горизонту, а ведётся от корпуса с запаздыванием,
##      компенсируя наклон на ~85 % (остальное — лёгкий взгляд вниз).
##   3. Дыхание: грудная клетка и лопатки поднимаются на вдохе, опускаются на выдохе.
##      Уровень лёгких берётся из ExercisePhase.breath (inhale / exhale / иначе держим).
##   4. Лёгкая асимметрия, нарастающая с глубиной: боковой наклон, скрутка, руки неравны.
##
## ВАЖНО: ноги НЕ трогаются — PoseSolver считает таз от левой лодыжки, и любая
## асимметрия в ногах оторвала бы правую стопу от пола.
## Если в упражнении есть гриф (has_bar), запаздывание и асимметрия рук отключены:
## кисти должны оставаться на грифе.

const HEAD_LAG := 0.08
const NECK_COMP := 0.45      ## доля наклона корпуса, компенсируемая шеей
const HEAD_COMP := 0.40      ## ... и головой (итого 0.85 → взгляд чуть вниз)

const BREATH_CHEST := 2.5    ## градусов разгибания грудного отдела на полном вдохе
const BREATH_SCAPULA := 1.5  ## градусов подъёма лопатки на полном вдохе

const ASYM_SPINE_SIDE := 1.2
const ASYM_SPINE_TWIST := 1.0
const ASYM_SHOULDER_L := 2.0
const ASYM_SHOULDER_R := 0.5
const ASYM_ELBOW_R := 3.0
const ASYM_SHOULDER_FLEX_R := 1.5   ## идея Gemini: правая рука чуть дальше вперёд
const ASYM_SCAPULA_R := 0.8         ## идея Gemini: правая лопатка чуть выше

## Запаздывание каналов, секунды. Дистальные сегменты отстают сильнее.
const ARM_LAGS: Dictionary = {
	&"shoulder_flexion_l": 0.10, &"shoulder_flexion_r": 0.13,
	&"shoulder_abduction_l": 0.10, &"shoulder_abduction_r": 0.13,
	&"elbow_flexion_l": 0.13, &"elbow_flexion_r": 0.16,
}

var loose_arms: bool = true
var depth_ref: float = 1.0
var _breath: Array = []   # {start, end, from, to}


func _init(data: ExerciseData, depth_reference: float) -> void:
	loose_arms = not data.has_bar
	depth_ref = maxf(depth_reference, 1.0)

	var level := 0.0
	var t := 0.0
	for phase: ExercisePhase in data.phases:
		var target := level
		if phase.breath == &"inhale":
			target = 1.0
		elif phase.breath == &"exhale":
			target = 0.0
		_breath.append({"start": t, "end": t + phase.duration, "from": level, "to": target})
		level = target
		t += phase.duration


## Каналы, которые слой может добавить, — для однократной проверки имён в риге.
static func probe_channels() -> Dictionary:
	return {
		&"chest_lean": 0.0,
		&"neck_lean": 0.0,
		&"head_lean": 0.0,
		&"spine_side": 0.0,
		&"spine_twist": 0.0,
		&"scapula_lift_l": 0.0,
		&"scapula_lift_r": 0.0,
		&"shoulder_abduction_l": 0.0,
		&"shoulder_abduction_r": 0.0,
		&"elbow_flexion_r": 0.0,
		&"shoulder_flexion_r": 0.0,
	}


func lag_for(key: StringName) -> float:
	if not loose_arms:
		return 0.0
	return float(ARM_LAGS.get(key, 0.0))


## Уровень лёгких 0..1 в момент t (плавный переход внутри фазы).
func breath_at(t: float) -> float:
	for span: Dictionary in _breath:
		var s := float(span["start"])
		var e := float(span["end"])
		if t >= s and t < e:
			var u := clampf((t - s) / maxf(e - s, 0.0001), 0.0, 1.0)
			var smooth := u * u * (3.0 - 2.0 * u)
			return lerpf(float(span["from"]), float(span["to"]), smooth)
	if _breath.is_empty():
		return 0.0
	var last: Dictionary = _breath.back()
	return float(last["to"])


## Дописывает вторичное движение в уже собранную (с запаздываниями) позу.
## torso_lean_lagged — наклон корпуса (таз+поясница+грудь), взятый в момент t - HEAD_LAG.
func apply_secondary(pose: Dictionary, t: float, torso_lean_lagged: float) -> void:
	# --- голова: ведётся от корпуса, но не «приклеена» к горизонту ---
	if not pose.has(&"neck_lean"):
		pose[&"neck_lean"] = -torso_lean_lagged * NECK_COMP
	if not pose.has(&"head_lean"):
		pose[&"head_lean"] = -torso_lean_lagged * HEAD_COMP

	# --- дыхание ---
	var b := breath_at(t)
	pose[&"chest_lean"] = float(pose.get(&"chest_lean", 0.0)) - BREATH_CHEST * b
	for side: String in ["l", "r"]:
		var key := StringName("scapula_lift_" + side)
		pose[key] = float(pose.get(key, 0.0)) + BREATH_SCAPULA * b

	# --- асимметрия, растущая с глубиной ---
	if loose_arms:
		var thigh := absf(float(pose.get(&"thigh_angle_l", 0.0)))
		var depth := clampf(thigh / depth_ref, 0.0, 1.0)
		pose[&"spine_side"] = float(pose.get(&"spine_side", 0.0)) + ASYM_SPINE_SIDE * depth
		pose[&"spine_twist"] = float(pose.get(&"spine_twist", 0.0)) + ASYM_SPINE_TWIST * depth
		pose[&"shoulder_abduction_l"] = float(pose.get(&"shoulder_abduction_l", 0.0)) + ASYM_SHOULDER_L * depth
		pose[&"shoulder_abduction_r"] = float(pose.get(&"shoulder_abduction_r", 0.0)) + ASYM_SHOULDER_R * depth
		pose[&"elbow_flexion_r"] = float(pose.get(&"elbow_flexion_r", 0.0)) + ASYM_ELBOW_R * depth
		pose[&"shoulder_flexion_r"] = float(pose.get(&"shoulder_flexion_r", 0.0)) + ASYM_SHOULDER_FLEX_R * depth
		pose[&"scapula_lift_r"] = float(pose.get(&"scapula_lift_r", 0.0)) + ASYM_SCAPULA_R * depth
```

---

## `scripts/animation/pose_solver.gd`

```gdscript
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
const MIN_SQUAT_DEPTH_PERCENT := 58.0
## Колено медиальнее линии таз–лодыжка больше чем на это, м — валгус.
const KNEE_VALGUS_TOLERANCE := 0.02
## Колено по горизонтали отклоняется от оси носка больше чем на это — «колени гуляют».
const KNEE_TRACKING_TOLERANCE_DEG := 12.0


## Решает позу: дополняет каналы производными величинами и считает метрики.
## stance_width — ширина между лодыжками, м (0 = как в риге).
## Возвращает { "channels": Dictionary, "hips_offset": Vector3, "metrics": Dictionary }.
static func solve(rig: HumanoidRig, authored: Dictionary, stance_width: float = 0.0) -> Dictionary:
	var channels: Dictionary = authored.duplicate()
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
			pelvis, hip_y, hip_z, stance_width
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
	pelvis_deg: float, planar_hip_y: float, planar_hip_z: float, stance_width: float
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
	var hip_x_l := hips_rest.x + rot_l.x
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
	if exercise_kind == &"squat":
		if hip_height >= knee_height:
			result.append({"level": "warn", "text": "Таз выше колена (%.0f%%) — присед не засчитан" % depth})
		elif depth < MIN_SQUAT_DEPTH_PERCENT:
			result.append({"level": "warn", "text": "Глубина %.0f%% < %.0f%% — бёдра не дошли до параллели" % [depth, MIN_SQUAT_DEPTH_PERCENT]})
		else:
			result.append({"level": "ok", "text": "Глубина %.0f%% — таз ниже колена" % depth})

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
```

---

## `scripts/animation/exercise_animation_builder.gd`

```gdscript
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

	# --- 1. Цепочка поз: каждая фаза наследует предыдущую -------------------
	var start_pose: Dictionary = PoseUtils.sym(data.base_pose)
	var current: Dictionary = start_pose.duplicate()
	var targets: Array[Dictionary] = []
	for phase: ExercisePhase in data.phases:
		var overrides := PoseUtils.sym(phase.pose)
		current = PoseUtils.merge(current, overrides)
		targets.append(current.duplicate())

	var depth_ref := 1.0
	for target: Dictionary in targets:
		depth_ref = maxf(depth_ref, absf(float(target.get(&"thigh_angle_l", 0.0))))
	var layer := MotionLayer.new(data, depth_ref)

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
	for phase: ExercisePhase in data.phases:
		acc += phase.duration
		times.append(acc)
	var duration := acc

	var curves := _build_curves(poses, times)

	# --- 3. Сэмплирование: равномерная сетка по общему времени --------------
	var step_count: int = maxi(2, int(ceil(duration * SAMPLE_RATE_HZ)))
	var frames: Array[Dictionary] = []
	var frame_metrics: Array[Dictionary] = []
	for k in range(step_count + 1):
		var frame_time := minf(duration * float(k) / float(step_count), duration)
		var pose := _sample_pose(curves, times, duration, data.loop, frame_time, layer)
		var frame_solved := PoseSolver.solve(rig, pose, data.stance_width)
		frames.append(_make_frame(rig, frame_time, frame_solved))
		frame_metrics.append({"time": frame_time, "metrics": frame_solved["metrics"]})

	var phase_spans: Array[Dictionary] = []
	for i in data.phases.size():
		phase_spans.append({
			"index": i,
			"start": float(times[i]),
			"end": float(times[i + 1]),
			"phase": data.phases[i],
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
	var phase_metrics: Array[Dictionary] = []
	var deepest := 0
	var deepest_depth := -INF
	for i in data.phases.size():
		var solved_target: Dictionary = PoseSolver.solve(rig, targets[i], data.stance_width)
		var metrics: Dictionary = solved_target["metrics"]
		var depth_value := float(metrics["depth_percent"])
		if depth_value > deepest_depth:
			deepest_depth = depth_value
			deepest = i
		var checks := PoseSolver.check(data.technique_kind, metrics, data.has_bar)
		phase_metrics.append({"index": i, "metrics": metrics, "checks": checks})

	var warnings := PackedStringArray()
	for i in phase_metrics.size():
		var phase: ExercisePhase = data.phases[i]
		var checks: Array = phase_metrics[i]["checks"]
		# В приседе первый пункт check() — глубина. Её имеет смысл проверять только
		# в самой глубокой фазе; в остальных «таз выше колена» — норма.
		var first := 1 if (data.technique_kind == &"squat" and i != deepest) else 0
		for c in range(first, checks.size()):
			var check: Dictionary = checks[c]
			if check["level"] == "warn":
				warnings.append("%s: %s" % [phase.label, check["text"]])

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
	}


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
## Приседание с собственным весом (scripts/exercises/bodyweight_squat.gd).
##
## Что изменено относительно прежней версии:
##   * Нет «мёртвой» паузы внизу: фаза bottom_settle — это доседание на 3–4° с
##     торможением, потом разворот. Тело не замирает, а «садится» в нижнюю точку.
##   * Руки выносятся до ~85° (почти горизонт) — реальный противовес вместо 55°.
##   * Мёртвая точка при подъёме получается сама: разворот из нулевой скорости.
##   * Подготовка = вдох + расслабление коленей (фаза inhale), выдох — на выпрямлении.
##   * Темп: спуск ≈ 2.0 с, подъём ≈ 1.4 с — контролируемый эксцентрик, быстрее вверх.
##
## Подъём торса соответствует глубине: наклон корпуса внизу ≈ 36° (таз 30 + поясница 6).

const STAND_THIGH := 2.0
const STAND_KNEE := 5.0
const BOTTOM_THIGH := 95.5     ## бедро чуть выше горизонта → таз ниже колена
const BOTTOM_KNEE := 129.0     ## голеностоп ≈ 33.5° при пределе 38°
const BOTTOM_PELVIS := 30.0
const BOTTOM_SPINE := 6.0
const BREAK_THIGH := 62.0
const BREAK_KNEE := 92.0
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
	data.stance_width = 0.40   # между лодыжками ≈ ширина плеч
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
		"Отскок из нижней точки — доседать плавно, без баллистики",
		"Корпус падает вперёд — держать вес над серединой стопы",
	])

	# Стойка: руки свободно вдоль корпуса.
	data.base_pose = PoseUtils.sym({
		&"thigh_angle": STAND_THIGH,
		&"knee_flexion": STAND_KNEE,
		&"pelvis_pitch": 6.0,
		&"spine_lean": 3.0,
		&"toe_out": 15.0,
		&"shoulder_abduction": 8.0,
		&"shoulder_flexion": 0.0,
		&"elbow_flexion": 10.0,
	})

	var phases: Array[ExercisePhase] = []

	# 1. Вдох и «расстёгивание» коленей. Грудь поднимается (дыхание в MotionLayer),
	#    руки чуть трогаются — предвестник движения.
	phases.append(_phase(
		&"setup", "Подготовка",
		"Вдох, живот в тонусе, колени мягко разблокированы",
		0.45, ExercisePhase.Ease.SMOOTH, &"inhale",
		{
			&"thigh_angle": 6.0, &"knee_flexion": 11.0,
			&"pelvis_pitch": 7.0, &"spine_lean": 4.0,
			&"shoulder_flexion": 6.0, &"elbow_flexion": 12.0,
		}
	))

	# 2. Начало спуска: колени и таз уходят вместе, руки начинают подниматься.
	phases.append(_phase(
		&"descent_top", "Опускание: колени",
		"Колени вперёд по носкам, таз идёт назад-вниз, стопы прижаты",
		0.6, ExercisePhase.Ease.SMOOTH, &"hold",
		{
			&"thigh_angle": 28.0,
			&"knee_flexion": 48.0,
			&"pelvis_pitch": 15.0,
			&"spine_lean": 5.0,
			&"shoulder_flexion": 38.0,
			&"elbow_flexion": 16.0,
		}
	))

	# 3. Основной спуск: максимальная скорость в середине, затем торможение.
	phases.append(_phase(
		&"descent_low", "Опускание: вниз",
		"Таз между стоп, колени по носкам, пятки на полу",
		0.95, ExercisePhase.Ease.SMOOTH, &"hold",
		{
			&"thigh_angle": 88.0,
			&"knee_flexion": 120.0,
			&"pelvis_pitch": 28.0,
			&"spine_lean": 6.0,
			&"shoulder_flexion": 82.0,
			&"elbow_flexion": 12.0,
		}
	))

	# 4. Доседание: тело не замирает, а садится на последние градусы и разворачивается.
	phases.append(_phase(
		&"bottom_settle", "Низ",
		"Мягко сажусь в нижнюю точку, без отскока, вес по всей стопе",
		0.4, ExercisePhase.Ease.DECELERATE, &"hold",
		{
			&"thigh_angle": BOTTOM_THIGH,
			&"knee_flexion": BOTTOM_KNEE,
			&"pelvis_pitch": BOTTOM_PELVIS,
			&"spine_lean": BOTTOM_SPINE,
			&"shoulder_flexion": 86.0,
			&"elbow_flexion": 12.0,
		}
	))

	# 5. Мёртвая точка: разворот из нулевой скорости, затем набор.
	phases.append(_phase(
		&"ascent_break", "Проход мёртвой точки",
		"Толкаю пол всей стопой, колени и таз поднимаются вместе",
		0.55, ExercisePhase.Ease.ACCELERATE, &"hold",
		{
			&"thigh_angle": BREAK_THIGH,
			&"knee_flexion": BREAK_KNEE,
			&"pelvis_pitch": BREAK_PELVIS,
			&"spine_lean": BREAK_SPINE,
			&"shoulder_flexion": 62.0,
			&"elbow_flexion": 14.0,
		}
	))

	# 6. Выпрямление с торможением у фиксации. Выдох.
	phases.append(_phase(
		&"ascent_finish", "Выпрямление",
		"Выдох, колени выпрямляются, таз доведён вперёд",
		0.85, ExercisePhase.Ease.DECELERATE, &"exhale",
		{
			&"thigh_angle": STAND_THIGH,
			&"knee_flexion": STAND_KNEE,
			&"pelvis_pitch": 6.0,
			&"spine_lean": 3.0,
			&"shoulder_flexion": 0.0,
			&"elbow_flexion": 10.0,
		}
	))

	# 7. Фиксация: короткая, руки досаживаются за счёт запаздывания в MotionLayer.
	phases.append(_phase(
		&"lockout", "Фиксация",
		"Колени почти прямые (5°), таз доведён",
		0.3, ExercisePhase.Ease.LINEAR, &"", {}
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
	# Крен стопы (инверсия/эверсия). Задаётся ТОЛЬКО PoseSolver: когда голень
	# наклонена вбок (широкая стойка), стопа остаётся плоской на полу за счёт крена.
	&"ankle_roll": {"bone_l": &"Foot_L", "bone_r": &"Foot_R", "sided": true, "axis": 2,
		"sign_l": 1.0, "sign_r": 1.0, "label": "Крен стопы"},

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

## `tools/squat_check.gd`

```gdscript
extends SceneTree
## Headless-проверка приседа: положить в tools/squat_check.gd и запустить
##   godot --headless -s tools/squat_check.gd
## Код возврата: 0 — все проверки пройдены, 1 — есть провалы.
## Печатает отчёт с числами, чтобы правки можно было сравнивать до/после.

const FOOT_TOL := 0.006          ## м: стопа не должна ездить по полу
const LOOP_TOL_DEG := 0.5        ## град: стык цикла
const DEAD_SPEED_DEG := 1.0      ## град/с: ниже этого кость считается неподвижной
const MAX_DEAD_RUN := 0.45       ## с: дольше этого «всё тело замерло» — механизм
const MIN_STOP_RUN := 0.1        ## с: короче — это разворот, а не остановка
const SAMPLE_DT := 1.0 / 60.0

const WATCH_BONES: Array[StringName] = [
	&"Hips", &"Spine", &"Chest", &"Head",
	&"Thigh_L", &"Thigh_R", &"Shin_L", &"Shin_R",
	&"UpperArm_L", &"UpperArm_R", &"Forearm_L", &"Forearm_R",
]

var _rig: HumanoidRig
var _skel: Skeleton3D
var _player: AnimationPlayer
var _failures := PackedStringArray()
var _result: Dictionary = {}
var _anim_name := &"squat_check"


func _initialize() -> void:
	_rig = HumanoidRig.new()
	_rig.name = "Rig"
	root.add_child(_rig)
	await process_frame

	_skel = _rig.get_skeleton()
	if _skel == null:
		_fail("риг не построил Skeleton3D")
		_finish()
		return

	_player = AnimationPlayer.new()
	_player.name = "AnimationPlayer"
	_rig.add_child(_player)

	var data := BodyweightSquatExercise.build()
	var result := ExerciseAnimationBuilder.build(_rig, data)
	var anim: Animation = result["animation"]
	if anim == null:
		_fail("билдер вернул null: %s" % str(result["warnings"]))
		_finish()
		return

	var library := AnimationLibrary.new()
	library.add_animation(_anim_name, anim)
	_player.add_animation_library("", library)
	_player.play(_anim_name)
	_player.pause()

	_result = result
	var duration: float = float(result["duration"])
	print("=== squat_check: длительность %.2f с, треков %d ===" % [duration, anim.get_track_count()])
	for w in result["warnings"]:
		print("  билдер предупреждает: ", w)

	_check_feet(duration)
	_check_loop(duration)
	_check_depth(duration)
	_check_motion(duration)
	_check_lag_and_asymmetry(duration)
	_check_legs_3d(duration)
	_finish()


# --- проверки -----------------------------------------------------------

func _check_feet(duration: float) -> void:
	_seek(0.0)
	var ref: Dictionary = {}
	for bone: StringName in [&"Foot_L", &"Foot_R", &"Toe_L", &"Toe_R"]:
		ref[bone] = _origin(bone)

	var worst: Dictionary = {}
	for bone: StringName in ref:
		worst[bone] = 0.0

	var t := 0.0
	while t <= duration:
		_seek(t)
		for bone: StringName in ref:
			var d := _origin(bone).distance_to(ref[bone])
			worst[bone] = maxf(float(worst[bone]), d)
		t += SAMPLE_DT

	for bone: StringName in worst:
		var d := float(worst[bone])
		print("  стопа %-7s макс. сдвиг %.1f мм" % [bone, d * 1000.0])
		if d > FOOT_TOL:
			_fail("%s проскальзывает/отрывается: %.1f мм > %.1f мм" % [bone, d * 1000.0, FOOT_TOL * 1000.0])


func _check_loop(duration: float) -> void:
	_seek(0.0)
	var first: Dictionary = {}
	for bone in _skel.get_bone_count():
		first[bone] = _skel.get_bone_pose_rotation(bone)
	_seek(duration - 0.0001)
	var worst := 0.0
	for bone in first:
		var q: Quaternion = _skel.get_bone_pose_rotation(bone)
		worst = maxf(worst, rad_to_deg(q.angle_to(first[bone])))
	print("  стык цикла: макс. разрыв %.2f°" % worst)
	if worst > LOOP_TOL_DEG:
		_fail("разрыв на стыке цикла %.2f° > %.2f°" % [worst, LOOP_TOL_DEG])


func _check_depth(duration: float) -> void:
	var min_hip := INF
	var t_min := 0.0
	var t := 0.0
	while t <= duration:
		_seek(t)
		var y := _origin(&"Hips").y
		if y < min_hip:
			min_hip = y
			t_min = t
		t += SAMPLE_DT
	_seek(t_min)
	var hip_joint_y := _origin(&"Thigh_L").y
	var knee_y := _origin(&"Shin_L").y
	print("  низ на t=%.2f с: сустав таза y=%.3f, колено y=%.3f" % [t_min, hip_joint_y, knee_y])
	if hip_joint_y >= knee_y:
		_fail("в нижней точке таз не ниже колена")


func _check_motion(duration: float) -> void:
	var prev: Dictionary = {}
	var prev_speed: Dictionary = {}
	var dead_run := 0.0
	var worst_dead := 0.0
	var stops := 0
	var was_dead := false
	var worst_jerk := 0.0
	var t := 0.0
	while t <= duration:
		_seek(t)
		var energy := 0.0
		for bone: StringName in WATCH_BONES:
			var idx := _skel.find_bone(String(bone))
			if idx < 0:
				continue
			var q: Quaternion = _skel.get_bone_pose_rotation(idx)
			if prev.has(bone):
				var speed := rad_to_deg(q.angle_to(prev[bone])) / SAMPLE_DT
				energy += speed
				if prev_speed.has(bone):
					worst_jerk = maxf(worst_jerk, absf(speed - float(prev_speed[bone])) / SAMPLE_DT)
				prev_speed[bone] = speed
			prev[bone] = q
		if t > 0.0:
			var dead := energy < DEAD_SPEED_DEG * WATCH_BONES.size()
			if dead:
				dead_run += SAMPLE_DT
				worst_dead = maxf(worst_dead, dead_run)
				if dead_run >= MIN_STOP_RUN and not was_dead:
					stops += 1
					was_dead = true
			else:
				dead_run = 0.0
				was_dead = false
		t += SAMPLE_DT

	print("  полных остановок за повтор: %d, самая долгая %.2f с" % [stops, worst_dead])
	print("  макс. рывок (град/с²): %.0f" % worst_jerk)
	if worst_dead > MAX_DEAD_RUN:
		_fail("тело полностью замирает на %.2f с (> %.2f)" % [worst_dead, MAX_DEAD_RUN])
	if stops > 1:
		_fail("%d полных остановок за повтор (допустима 1 — наверху)" % stops)


func _check_lag_and_asymmetry(duration: float) -> void:
	var peak_leg_t := 0.0
	var peak_arm_t := 0.0
	var peak_leg := -1.0
	var peak_arm := -1.0
	var t := 0.0
	while t <= duration:
		_seek(t)
		var leg := _skel.get_bone_pose_rotation(_skel.find_bone("Thigh_L")).angle_to(Quaternion.IDENTITY)
		var arm := _skel.get_bone_pose_rotation(_skel.find_bone("UpperArm_L")).angle_to(Quaternion.IDENTITY)
		if leg > peak_leg:
			peak_leg = leg
			peak_leg_t = t
		if arm > peak_arm:
			peak_arm = arm
			peak_arm_t = t
		t += SAMPLE_DT
	var lag := peak_arm_t - peak_leg_t
	print("  пик ноги %.2f с, пик руки %.2f с, отставание рук %.2f с" % [peak_leg_t, peak_arm_t, lag])
	if lag < 0.03 or lag > 0.5:
		_fail("руки не отстают от ног на 0.03–0.5 с (сейчас %.2f)" % lag)

	_seek(peak_leg_t)
	var leg_l := _skel.get_bone_pose_rotation(_skel.find_bone("Thigh_L"))
	var leg_r := _skel.get_bone_pose_rotation(_skel.find_bone("Thigh_R"))
	var arm_l := _skel.get_bone_pose_rotation(_skel.find_bone("UpperArm_L"))
	var arm_r := _skel.get_bone_pose_rotation(_skel.find_bone("UpperArm_R"))
	var leg_diff := rad_to_deg(leg_l.angle_to(_mirror(leg_r)))
	var arm_diff := rad_to_deg(arm_l.angle_to(_mirror(arm_r)))
	print("  разница L/R внизу: ноги %.2f° (должно быть ~0), руки %.2f° (должно быть > 0.3)" % [leg_diff, arm_diff])
	if leg_diff > 0.5:
		_fail("ноги асимметричны (%.2f°): стопа правой ноги оторвётся" % leg_diff)
	if arm_diff < 0.3:
		_fail("руки идеально симметричны (%.2f°)" % arm_diff)


func _check_legs_3d(duration: float) -> void:
	# Абсолютная геометрия по скелету (проверяет декомпозицию IK в углы костей).
	var width_expected := 0.40
	var worst_width := 0.0
	var worst_knee_out := -INF       # + = колено медиальнее линии таз–лодыжка (валгус)
	var worst_y := 0.0
	var t := 0.0
	while t <= duration:
		_seek(t)
		var al := _origin(&"Foot_L")
		var ar := _origin(&"Foot_R")
		worst_width = maxf(worst_width, absf(absf(ar.x - al.x) - width_expected))
		worst_y = maxf(worst_y, absf(al.y - 0.08))
		var hip := _origin(&"Thigh_L")
		var knee := _origin(&"Shin_L")
		var span := maxf(hip.y - al.y, 0.001)
		var tl := clampf((hip.y - knee.y) / span, 0.0, 1.0)
		var x_line := hip.x + (al.x - hip.x) * tl
		worst_knee_out = maxf(worst_knee_out, knee.x - x_line)
		t += SAMPLE_DT
	print("  3D: ширина стойки: макс. отклонение от %.2f м = %.1f мм" % [width_expected, worst_width * 1000.0])
	print("  3D: лодыжка по высоте: макс. отклонение %.1f мм" % (worst_y * 1000.0))
	print("  3D: макс. валгус (по скелету) %.1f мм" % (worst_knee_out * 1000.0))
	if worst_width > 0.005:
		_fail("ширина стойки не держится или не равна заданной (%.1f мм)" % (worst_width * 1000.0))
	if worst_y > 0.005:
		_fail("лодыжка не на высоте пола (%.1f мм)" % (worst_y * 1000.0))
	if worst_knee_out > 0.02:
		_fail("колено заваливается внутрь на %.1f мм" % (worst_knee_out * 1000.0))

	var deepest := 0
	var best := -INF
	var pms: Array = _result["phase_metrics"]
	for i in pms.size():
		var d := float(pms[i]["metrics"]["depth_percent"])
		if d > best:
			best = d
			deepest = i
	var m: Dictionary = pms[deepest]["metrics"]
	print("  внизу (фаза %d): глубина %.1f%%, голеностоп %.1f°, колено вдоль носка %.1f°, валгус %.1f мм, стойка %.3f м" % [
		deepest, float(m["depth_percent"]), float(m["ankle_dorsiflexion"]),
		float(m["knee_tracking_deg"]), float(m["knee_valgus"]) * 1000.0, float(m["stance_width"])])


# --- утилиты ------------------------------------------------------------

## Зеркало вращения относительно плоскости YZ (лево <-> право).
func _mirror(q: Quaternion) -> Quaternion:
	return Quaternion(q.x, -q.y, -q.z, q.w)


func _seek(t: float) -> void:
	_player.seek(t, true)
	_player.advance(0.0)


func _origin(bone: StringName) -> Vector3:
	var idx := _skel.find_bone(String(bone))
	if idx < 0:
		return Vector3.ZERO
	return _skel.global_transform * _skel.get_bone_global_pose(idx).origin


func _fail(text: String) -> void:
	_failures.append(text)
	print("  ПРОВАЛ: ", text)


func _finish() -> void:
	print("=== итог: %s ===" % ("ВСЁ ОК" if _failures.is_empty() else "%d провал(ов)" % _failures.size()))
	quit(0 if _failures.is_empty() else 1)
```
