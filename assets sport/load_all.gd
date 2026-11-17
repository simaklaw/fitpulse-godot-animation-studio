extends SceneTree
## Загружает ВСЕ .gd проекта и сообщает о тех, что не компилируются.
func _initialize() -> void:
	var bad := PackedStringArray()
	var total := 0
	var stack = ["res://"]
	while not stack.is_empty():
		var dir_path: String = stack.pop_back()
		var dir := DirAccess.open(dir_path)
		if dir == null:
			continue
		for d in dir.get_directories():
			if not d.begins_with("."):
				stack.append(dir_path.path_join(d))
		for f in dir.get_files():
			if f.ends_with(".gd"):
				total += 1
				var path := dir_path.path_join(f)
				var script := load(path) as GDScript
				if script == null or not script.can_instantiate() and not script.is_abstract():
					bad.append(path)
	print("скриптов проверено: %d, не компилируется: %d" % [total, bad.size()])
	for b in bad:
		print("  ПЛОХОЙ: ", b)
	quit(0 if bad.is_empty() else 1)
