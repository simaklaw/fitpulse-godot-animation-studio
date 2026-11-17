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
func get_bone_names() -> Array:
	var names = []
	for spec: Dictionary in BONES:
		names.append(spec["name"])
	return names
