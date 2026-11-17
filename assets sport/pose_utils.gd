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
