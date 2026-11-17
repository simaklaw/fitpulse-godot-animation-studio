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
var _current_phase := -1        ## номер фазы ВНУТРИ повтора (для HUD: «Фаза 4/7»)
var _current_slot := -1         ## сквозной номер фазы по всей анимации (все запечённые повторы)
var _cycle := 0                 ## номер повтора внутри запечённой анимации
var _cycles := 1
var _best_margin := -INF        ## лучшая глубина текущего повтора: таз ниже колена, м
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
	_cycles = int(result.get("cycles", 1))

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
	_current_slot = -1
	_cycle = 0
	_best_margin = -INF
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


## index — номер фазы внутри повтора; прыжок делается в текущий повтор.
func seek_phase(index: int) -> void:
	if index < 0 or index >= get_phase_count():
		return
	var slot := clampi(_cycle, 0, _cycles - 1) * get_phase_count() + index
	if slot >= _phase_spans.size():
		return
	_seek_internal(float(_phase_spans[slot]["start"]))


## Число фаз одного повтора (не всей запечённой анимации).
func get_phase_count() -> int:
	return data.phases.size() if data != null else 0


func get_current_phase_index() -> int:
	return _current_phase


func get_current_phase() -> ExercisePhase:
	if _current_slot < 0 or _current_slot >= _phase_spans.size():
		return null
	return _phase_spans[_current_slot]["phase"] as ExercisePhase


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
	var checks := PoseSolver.check(data.technique_kind, metrics, data.has_bar)
	# Глубина в приседе оценивается по ЛУЧШЕЙ точке повтора, а не по кадру: на спуске
	# таз и должен быть выше колена, и «присед не засчитан» там — ложная тревога.
	if data.technique_kind == &"squat" and not checks.is_empty():
		checks[0] = _squat_depth_check(metrics)
	return checks


func _squat_depth_check(metrics: Dictionary) -> Dictionary:
	var current := float(metrics.get("hip_below_knee", 0.0))
	var best := maxf(_best_margin, current)
	var need := PoseSolver.MIN_HIP_BELOW_KNEE
	if best >= need:
		return {"level": "ok", "text": "Глубина достигнута: таз ниже колена на %.0f см" % (best * 100.0)}
	# Уже поднимаемся, а нужной глубины так и не было — недосед.
	if current < best - 0.015 and best > -INF:
		return {"level": "warn", "text": "Недосед: таз ниже колена лишь на %.1f см (нужно ≥ %.0f см)" % [best * 100.0, need * 100.0]}
	return {"level": "ok", "text": "Опускание: до нужной глубины %.0f см" % maxf((need - current) * 100.0, 0.0)}


## Метрики целевой позы фазы (для экрана «разбор фазы»).
func get_phase_target_metrics() -> Dictionary:
	if _current_slot < 0 or _current_slot >= _phase_metrics.size():
		return {}
	return _phase_metrics[_current_slot]["metrics"]


func _seek_internal(time: float) -> void:
	if _player == null:
		return
	_player.seek(time, true)
	_last_position = time
	_cycle = _cycle_at(time)
	_best_margin = -INF


func _cycle_at(position: float) -> int:
	for span: Dictionary in _phase_spans:
		if position >= float(span["start"]) and position < float(span["end"]):
			return int(span["cycle"])
	return 0


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

	# Замыкание всей запечённой анимации = завершён последний повтор.
	var wrapped := position + 0.001 < _last_position
	if wrapped:
		reps += 1
		rep_completed.emit(reps)
		_cycle = 0
		_best_margin = -INF

	# Определение фазы: интервалы [start, end) из данных. Дешевле, чем method-
	# треки, и не зависит от версии Animation, зато даёт те же сигналы.
	for i in _phase_spans.size():
		var span: Dictionary = _phase_spans[i]
		if position >= float(span["start"]) and position < float(span["end"]):
			if i != _current_slot:
				var new_cycle := int(span["cycle"])
				# Граница между запечёнными повторами = завершённый повтор
				# (замыкание всей анимации посчитано выше).
				if new_cycle > _cycle:
					reps += 1
					rep_completed.emit(reps)
					_best_margin = -INF
				_cycle = new_cycle
				_current_slot = i
				_current_phase = int(span["index"])
				phase_changed.emit(_current_phase, span["phase"])
			break

	if not _frame_metrics.is_empty():
		var m := _sample_metrics(position)
		if m.has("hip_below_knee"):
			_best_margin = maxf(_best_margin, float(m["hip_below_knee"]))
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
		_current_slot = -1
	# Позиция после финиша равна duration; сбрасываем её, чтобы следующий
	# play(false) не принял старт «из конца» за прошедший повтор.
	_last_position = 0.0
