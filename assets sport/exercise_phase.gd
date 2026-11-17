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
