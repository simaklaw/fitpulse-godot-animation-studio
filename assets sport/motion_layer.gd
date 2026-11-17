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
const WEIGHT_SHIFT_X := 0.006       ## м: перенос веса таза по x (≤ 1 см), решатель держит лодыжки

## Запаздывание каналов, секунды. Дистальные сегменты отстают сильнее.
const ARM_LAGS: Dictionary = {
	&"shoulder_flexion_l": 0.10, &"shoulder_flexion_r": 0.13,
	&"shoulder_abduction_l": 0.10, &"shoulder_abduction_r": 0.13,
	&"elbow_flexion_l": 0.13, &"elbow_flexion_r": 0.16,
}

var loose_arms: bool = true
var depth_ref: float = 1.0
var _breath: Array = []   # {start, end, from, to}
var total_duration: float = 1.0


## phases — полный список фаз всей анимации (все запечённые повторы подряд).
func _init(phases: Array, has_bar: bool, depth_reference: float) -> void:
	loose_arms = not has_bar
	depth_ref = maxf(depth_reference, 1.0)

	var level := 0.0
	var t := 0.0
	for phase: ExercisePhase in phases:
		var target := level
		if phase.breath == &"inhale":
			target = 1.0
		elif phase.breath == &"exhale":
			target = 0.0
		_breath.append({"start": t, "end": t + phase.duration, "from": level, "to": target})
		level = target
		t += phase.duration
	total_duration = maxf(t, 0.001)


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

	# --- перенос веса: медленный сдвиг таза по x при неподвижных лодыжках ---
	# Служебный ключ: PoseSolver забирает его и двигает таз. Работает только при согнутых
	# коленях: у почти прямой ноги (колено ≈5°) сдвиг в 6 мм раскачивает голень на ~3° и
	# упирается в предел IK (рывок), а в стойке он всё равно не виден.
	if loose_arms:
		var bend := smoothstep(15.0, 60.0, absf(float(pose.get(&"thigh_angle_l", 0.0))))
		pose[&"_weight_shift_x"] = sin(TAU * t / total_duration) * WEIGHT_SHIFT_X * bend
