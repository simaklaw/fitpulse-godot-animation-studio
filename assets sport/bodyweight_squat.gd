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
	data.baked_reps = 3       # три слегка разных повтора в одной анимации
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

	var phases = []

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
