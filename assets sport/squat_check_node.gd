extends Node
## Headless-проверка приседа: положить в tools/squat_check.gd и запустить
##   godot --headless -s tools/squat_check.gd
## Код возврата: 0 — все проверки пройдены, 1 — есть провалы.
## Печатает отчёт с числами, чтобы правки можно было сравнивать до/после.
##
## Режим персонажа (НЕ проверялся автором патча — нет модели в среде):
##   godot --headless -s tools/squat_check.gd -- --character=res://путь/к/модели.glb
## Тогда риг — CharacterRig, имена костей переводятся через CharacterRig.BONE_MAP, а
## сравнение L/R по кватернионам пропускается (у костей персонажа свои rest-повороты).
## Рантайм-версия tools/squat_check.gd (v3): запускается сценой в редакторе (F5),
## потому что headless-CLI на целевой машине недоступен.
## Отличия от CLI: нет quit(), режим персонажа включается флагом в инспекторе,
## отчёт дублируется на экран.
@export var use_character: bool = false
@export var character_model_path: String = "res://assets/characters/superhero_male/Superhero_Male_FullBody.gltf"

var _log: PackedStringArray = []
var _label: Label


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
var _is_char := false
var _bone_map: Dictionary = {}
var _failures := PackedStringArray()
var _result: Dictionary = {}
var _data: ExerciseData
var _cycles := 1
var _cycle_dur := 1.0
var _anim_name := &"squat_check"


func _ready() -> void:
	_build_overlay()
	var model_path := ""
	if use_character:
		model_path = character_model_path
	if model_path != "":
		var char_rig := CharacterRig.new()
		char_rig.model_path = model_path
		_rig = char_rig
		_is_char = true
		_bone_map = CharacterRig.BONE_MAP
		_p("режим персонажа: " + str(model_path))
	else:
		_rig = HumanoidRig.new()
	_rig.name = "Rig"
	add_child(_rig)
	await get_tree().process_frame

	_skel = _rig.get_skeleton()
	if _skel == null:
		_fail("риг не построил Skeleton3D")
		_finish()
		return

	_player = AnimationPlayer.new()
	_player.name = "AnimationPlayer"
	_rig.add_child(_player)

	var data := BodyweightSquatExercise.build()
	_data = data
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
	_cycles = int(result["cycles"])
	_cycle_dur = float(result["cycle_duration"])
	var duration: float = float(result["duration"])
	_p("=== squat_check: длительность %.2f с (%d повтор., цикл %.2f с), треков %d ===" % [duration, _cycles, _cycle_dur, anim.get_track_count()])
	for w in result["warnings"]:
		_p("  билдер предупреждает: " + str(w))

	_check_feet(duration)
	_check_loop(duration)
	_check_depth(duration)
	_check_motion(duration)
	_check_lag_and_asymmetry(_cycle_dur)   # только первый повтор: пики остальных смещены
	_check_legs_3d(duration)
	_check_reps(duration)
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
		_p("  стопа %-7s макс. сдвиг %.1f мм" % [bone, d * 1000.0])
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
	_p("  стык цикла: макс. разрыв %.2f°" % worst)
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
	_p("  низ на t=%.2f с: сустав таза y=%.3f, колено y=%.3f" % [t_min, hip_joint_y, knee_y])
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
			var idx := _skel.find_bone(_bn(String(bone)))
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

	_p("  полных остановок: %d на %d повтор(а), самая долгая %.2f с" % [stops, _cycles, worst_dead])
	_p("  макс. рывок (град/с²): %.0f" % worst_jerk)
	if worst_dead > MAX_DEAD_RUN:
		_fail("тело полностью замирает на %.2f с (> %.2f)" % [worst_dead, MAX_DEAD_RUN])
	if stops > _cycles:
		_fail("%d полных остановок на %d повтор(а): допустима одна на повтор — наверху" % [stops, _cycles])


func _check_lag_and_asymmetry(duration: float) -> void:
	var peak_leg_t := 0.0
	var peak_arm_t := 0.0
	var peak_leg := -1.0
	var peak_arm := -1.0
	var t := 0.0
	while t <= duration:
		_seek(t)
		var leg := _skel.get_bone_pose_rotation(_skel.find_bone(_bn("Thigh_L"))).angle_to(Quaternion.IDENTITY)
		var arm := _skel.get_bone_pose_rotation(_skel.find_bone(_bn("UpperArm_L"))).angle_to(Quaternion.IDENTITY)
		if leg > peak_leg:
			peak_leg = leg
			peak_leg_t = t
		if arm > peak_arm:
			peak_arm = arm
			peak_arm_t = t
		t += SAMPLE_DT
	var lag := peak_arm_t - peak_leg_t
	_p("  пик ноги %.2f с, пик руки %.2f с, отставание рук %.2f с" % [peak_leg_t, peak_arm_t, lag])
	if lag < 0.03 or lag > 0.5:
		_fail("руки не отстают от ног на 0.03–0.5 с (сейчас %.2f)" % lag)

	_seek(peak_leg_t)
	var leg_l := _skel.get_bone_pose_rotation(_skel.find_bone(_bn("Thigh_L")))
	var leg_r := _skel.get_bone_pose_rotation(_skel.find_bone(_bn("Thigh_R")))
	var arm_l := _skel.get_bone_pose_rotation(_skel.find_bone(_bn("UpperArm_L")))
	var arm_r := _skel.get_bone_pose_rotation(_skel.find_bone(_bn("UpperArm_R")))
	var leg_diff := rad_to_deg(leg_l.angle_to(_mirror(leg_r)))
	var arm_diff := rad_to_deg(arm_l.angle_to(_mirror(arm_r)))
	_p("  разница L/R внизу: ноги %.2f° (≤3, перенос веса), руки %.2f° (должно быть > 0.3)" % [leg_diff, arm_diff])
	# Ноги теперь чуть различаются из-за переноса веса (таз сдвинут на ≤6 мм при неподвижных
	# стопах). Строгий критерий — сами стопы (_check_feet); здесь лишь верхняя граница.
	if _is_char:
		_p("  (персонаж: сравнение L/R по кватернионам пропущено)")
		return
	if leg_diff > 3.0:
		_fail("ноги слишком асимметричны (%.2f° > 3°)" % leg_diff)
	if arm_diff < 0.3:
		_fail("руки идеально симметричны (%.2f°)" % arm_diff)


func _check_legs_3d(duration: float) -> void:
	# Абсолютная геометрия по скелету (проверяет декомпозицию IK в углы костей).
	var width_expected := _data.stance_width
	_seek(0.0)
	var ankle_y0 := _origin(&"Foot_L").y
	var worst_width := 0.0
	var worst_knee_out := -INF       # + = колено медиальнее линии таз–лодыжка (валгус)
	var worst_y := 0.0
	var t := 0.0
	while t <= duration:
		_seek(t)
		var al := _origin(&"Foot_L")
		var ar := _origin(&"Foot_R")
		worst_width = maxf(worst_width, absf(absf(ar.x - al.x) - width_expected))
		worst_y = maxf(worst_y, absf(al.y - ankle_y0))
		var hip := _origin(&"Thigh_L")
		var knee := _origin(&"Shin_L")
		var span := maxf(hip.y - al.y, 0.001)
		var tl := clampf((hip.y - knee.y) / span, 0.0, 1.0)
		var x_line := hip.x + (al.x - hip.x) * tl
		worst_knee_out = maxf(worst_knee_out, knee.x - x_line)
		t += SAMPLE_DT
	_p("  3D: ширина стойки: макс. отклонение от %.2f м = %.1f мм" % [width_expected, worst_width * 1000.0])
	_p("  3D: лодыжка по высоте: макс. отклонение %.1f мм" % (worst_y * 1000.0))
	_p("  3D: макс. валгус (по скелету) %.1f мм" % (worst_knee_out * 1000.0))
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
	_p("  внизу (фаза %d): глубина %.1f%%, голеностоп %.1f°, колено вдоль носка %.1f°, валгус %.1f мм, стойка %.3f м" % [
		deepest, float(m["depth_percent"]), float(m["ankle_dorsiflexion"]),
		float(m["knee_tracking_deg"]), float(m["knee_valgus"]) * 1000.0, float(m["stance_width"])])


func _check_reps(duration: float) -> void:
	var pms: Array = _result["phase_metrics"]
	var per_cycle := _data.phases.size()
	var margins: Array[float] = []
	for c in _cycles:
		var best := -INF
		for i in per_cycle:
			best = maxf(best, float(pms[c * per_cycle + i]["metrics"]["hip_below_knee"]))
		margins.append(best)
		_p("  повтор %d: таз ниже колена на %.1f см" % [c + 1, best * 100.0])
		if best < PoseSolver.MIN_HIP_BELOW_KNEE:
			_fail("повтор %d: недосед (%.1f см < %.0f см)" % [c + 1, best * 100.0, PoseSolver.MIN_HIP_BELOW_KNEE * 100.0])

	if _cycles < 2:
		return
	# Повторы должны различаться (глубина и длительность), но не быть ошибкой техники.
	var lo := INF
	var hi := -INF
	for m in margins:
		lo = minf(lo, m)
		hi = maxf(hi, m)
	_p("  разброс глубины между повторами: %.1f мм" % ((hi - lo) * 1000.0))
	if (hi - lo) < 0.003:
		_fail("повторы одинаковы по глубине (разброс < 3 мм)")
	if (hi - lo) > 0.03:
		_fail("повторы слишком разные по глубине (разброс > 3 см)")

	# Цикл замыкается между повторами: поза в начале каждого цикла = поза в начале первого.
	var spans: Array = _result["phase_spans"]
	_seek(0.0)
	var base_q: Dictionary = {}
	for bone in _skel.get_bone_count():
		base_q[bone] = _skel.get_bone_pose_rotation(bone)
	var worst_seam := 0.0
	for c in range(1, _cycles):
		var t := float(spans[c * per_cycle]["start"])
		_seek(t)
		for bone in base_q:
			worst_seam = maxf(worst_seam, rad_to_deg(_skel.get_bone_pose_rotation(bone).angle_to(base_q[bone])))
	_p("  шов между повторами: макс. разрыв позы %.2f°" % worst_seam)
	if worst_seam > 1.5:
		_fail("шов между повторами: поза отличается на %.2f° (> 1.5°)" % worst_seam)


# --- утилиты ------------------------------------------------------------

## Зеркало вращения относительно плоскости YZ (лево <-> право).
## Логическое имя кости (Foot_L) → имя в скелете (у персонажа foot_l).
func _bn(logical: String) -> String:
	if _is_char and _bone_map.has(StringName(logical)):
		return String(_bone_map[StringName(logical)])
	return logical


func _mirror(q: Quaternion) -> Quaternion:
	return Quaternion(q.x, -q.y, -q.z, q.w)


func _seek(t: float) -> void:
	_player.seek(t, true)
	_player.advance(0.0)


func _origin(bone: StringName) -> Vector3:
	var idx := _skel.find_bone(_bn(String(bone)))
	if idx < 0:
		return Vector3.ZERO
	return _skel.global_transform * _skel.get_bone_global_pose(idx).origin


func _fail(text: String) -> void:
	_failures.append(text)
	_p("  ПРОВАЛ: " + str(text))


func _finish() -> void:
	_p("=== итог: %s ===" % ("ВСЁ ОК" if _failures.is_empty() else "%d провал(ов)" % _failures.size()))
	_show_result()


# --- рантайм-обвязка ----------------------------------------------------

func _p(text: String) -> void:
	print(text)
	_log.append(text)


func _show_result() -> void:
	var verdict := "ВСЁ ОК" if _failures.is_empty() else "%d провал(ов)" % _failures.size()
	_p("=== итог: %s ===" % verdict)
	if _label != null:
		_label.text = "\n".join(_log)


func _build_overlay() -> void:
	var layer := CanvasLayer.new()
	add_child(layer)
	var bg := ColorRect.new()
	bg.color = Color(0, 0, 0, 0.78)
	bg.position = Vector2(8, 8)
	bg.size = Vector2(720, 940)
	layer.add_child(bg)
	_label = Label.new()
	_label.position = Vector2(16, 16)
	_label.size = Vector2(704, 924)
	_label.add_theme_font_size_override("font_size", 12)
	_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	layer.add_child(_label)
