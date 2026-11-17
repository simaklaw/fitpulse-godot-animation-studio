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


func get_bone_names() -> Array:
	var names = []
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
