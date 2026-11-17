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
## Сколько повторов запекается в одну анимацию. При N > 1 каждый повтор слегка
## отличается (глубина, темп, руки) — детерминированно, по номеру повтора.
@export var baked_reps: int = 1

@export var muscles_primary: PackedStringArray = []
@export var muscles_secondary: PackedStringArray = []
## Ключевые моменты техники (для экрана упражнения).
@export var setup_cues: PackedStringArray = []
@export var common_mistakes: PackedStringArray = []

## Поза, с которой начинается анимация (t = 0). Дальше фазы накапливаются:
## каждая фаза наследует предыдущую позу и переопределяет только свои каналы.
@export var base_pose: Dictionary = {}
@export var phases = []

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
	if baked_reps < 1:
		problems.append("baked_reps < 1")
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
