extends Control
## Responsive, reusable exercise brief browser for the FitPulse animation workshop.
## This scene deliberately never paints a fake character when an animation is missing.

const CATALOG_PATH := "res://animation-pipeline/catalog/exercise_catalog.json"

var _exercises: Array = []
var _selected_id := ""
var _query := ""
var _environment_code := "all"
var _profile_code := "male"

var _environment_filter: OptionButton
var _profile_filter: OptionButton
var _search: LineEdit
var _grid: GridContainer
var _detail: VBoxContainer
var _result_count: Label


func _ready() -> void:
    _build_ui()
    _load_catalog()


func _build_ui() -> void:
    set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)

    var background := ColorRect.new()
    background.color = Color("#0d1215")
    background.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
    background.mouse_filter = Control.MOUSE_FILTER_IGNORE
    add_child(background)

    var margins := MarginContainer.new()
    margins.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
    margins.add_theme_constant_override("margin_left", 24)
    margins.add_theme_constant_override("margin_right", 24)
    margins.add_theme_constant_override("margin_top", 22)
    margins.add_theme_constant_override("margin_bottom", 22)
    add_child(margins)

    var page := VBoxContainer.new()
    page.size_flags_horizontal = Control.SIZE_EXPAND_FILL
    page.size_flags_vertical = Control.SIZE_EXPAND_FILL
    page.add_theme_constant_override("separation", 12)
    margins.add_child(page)

    var eyebrow := Label.new()
    eyebrow.text = "FITPULSE  /  ANIMATION WORKSHOP"
    eyebrow.add_theme_color_override("font_color", Color("#8fd9b8"))
    eyebrow.add_theme_font_size_override("font_size", 12)
    page.add_child(eyebrow)

    var title := Label.new()
    title.text = "Библиотека упражнений"
    title.add_theme_color_override("font_color", Color("#edf3f0"))
    title.add_theme_font_size_override("font_size", 28)
    page.add_child(title)

    var intro := Label.new()
    intro.text = "Единый каталог для дома и зала: техника, фазы движения, оборудование и статус анимации. Неподготовленный клип не подменяется заглушкой."
    intro.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
    intro.add_theme_color_override("font_color", Color("#aebbb6"))
    page.add_child(intro)

    var filters := HBoxContainer.new()
    filters.add_theme_constant_override("separation", 8)
    page.add_child(filters)

    _search = LineEdit.new()
    _search.placeholder_text = "Найти упражнение…"
    _search.size_flags_horizontal = Control.SIZE_EXPAND_FILL
    _search.custom_minimum_size = Vector2(180, 40)
    _search.text_changed.connect(_on_search_changed)
    filters.add_child(_search)

    _environment_filter = OptionButton.new()
    _add_filter_option(_environment_filter, "Дом + зал", "all")
    _add_filter_option(_environment_filter, "Дома", "home")
    _add_filter_option(_environment_filter, "В зале", "gym")
    _environment_filter.custom_minimum_size = Vector2(110, 40)
    _environment_filter.item_selected.connect(_on_environment_changed)
    filters.add_child(_environment_filter)

    _profile_filter = OptionButton.new()
    _add_filter_option(_profile_filter, "Мужской", "male")
    _add_filter_option(_profile_filter, "Женский", "female")
    _profile_filter.custom_minimum_size = Vector2(120, 40)
    _profile_filter.item_selected.connect(_on_profile_changed)
    filters.add_child(_profile_filter)

    _result_count = Label.new()
    _result_count.add_theme_color_override("font_color", Color("#8fd9b8"))
    page.add_child(_result_count)

    var scroll := ScrollContainer.new()
    scroll.size_flags_horizontal = Control.SIZE_EXPAND_FILL
    scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
    scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
    page.add_child(scroll)

    var content := VBoxContainer.new()
    content.size_flags_horizontal = Control.SIZE_EXPAND_FILL
    content.add_theme_constant_override("separation", 16)
    scroll.add_child(content)

    _grid = GridContainer.new()
    _grid.columns = 2
    _grid.size_flags_horizontal = Control.SIZE_EXPAND_FILL
    _grid.add_theme_constant_override("h_separation", 12)
    _grid.add_theme_constant_override("v_separation", 12)
    content.add_child(_grid)

    var separator := HSeparator.new()
    separator.add_theme_color_override("separator", Color("#2b3b3b"))
    content.add_child(separator)

    var detail_title := Label.new()
    detail_title.text = "КАРТОЧКА УПРАЖНЕНИЯ"
    detail_title.add_theme_color_override("font_color", Color("#8fd9b8"))
    detail_title.add_theme_font_size_override("font_size", 12)
    content.add_child(detail_title)

    var detail_panel := PanelContainer.new()
    detail_panel.add_theme_stylebox_override("panel", _panel_style(Color("#151e21"), Color("#2b3b3b")))
    detail_panel.size_flags_horizontal = Control.SIZE_EXPAND_FILL
    content.add_child(detail_panel)

    _detail = VBoxContainer.new()
    _detail.size_flags_horizontal = Control.SIZE_EXPAND_FILL
    _detail.add_theme_constant_override("separation", 10)
    detail_panel.add_child(_detail)


func _add_filter_option(control: OptionButton, label: String, value: String) -> void:
    control.add_item(label)
    control.set_item_metadata(control.item_count - 1, value)


func _panel_style(fill: Color, edge: Color) -> StyleBoxFlat:
    var style := StyleBoxFlat.new()
    style.bg_color = fill
    style.border_color = edge
    style.set_border_width_all(1)
    style.set_corner_radius_all(12)
    style.content_margin_left = 14
    style.content_margin_right = 14
    style.content_margin_top = 12
    style.content_margin_bottom = 12
    return style


func _load_catalog() -> void:
    if not FileAccess.file_exists(CATALOG_PATH):
        _show_error("Не найден каталог: " + CATALOG_PATH)
        return
    var file := FileAccess.open(CATALOG_PATH, FileAccess.READ)
    if file == null:
        _show_error("Не удалось открыть каталог упражнений.")
        return
    var parsed: Variant = JSON.parse_string(file.get_as_text())
    if not parsed is Dictionary or not parsed.has("exercises") or not parsed["exercises"] is Array:
        _show_error("Файл каталога имеет неверную структуру JSON.")
        return
    _exercises = parsed["exercises"]
    if _exercises.is_empty():
        _show_error("В каталоге пока нет упражнений.")
        return
    _selected_id = str(_exercises[0].get("id", ""))
    _render_catalog()


func _show_error(message: String) -> void:
    if _result_count != null:
        _result_count.text = "ОШИБКА КАТАЛОГА"
    if _detail != null:
        _clear_children(_detail)
        _detail.add_child(_label(message, 15, Color("#ffb6a9")))


func _on_search_changed(value: String) -> void:
    _query = value.strip_edges().to_lower()
    _render_catalog()


func _on_environment_changed(index: int) -> void:
    _environment_code = str(_environment_filter.get_item_metadata(index))
    _render_catalog()


func _on_profile_changed(index: int) -> void:
    _profile_code = str(_profile_filter.get_item_metadata(index))
    _render_catalog()


func _filtered_exercises() -> Array:
    var result: Array = []
    for exercise in _exercises:
        if _environment_code != "all" and not exercise.get("environments", []).has(_environment_code):
            continue
        if not _query.is_empty():
            var haystack := " ".join([
                str(exercise.get("id", "")),
                str(exercise.get("name_ru", "")),
                str(exercise.get("name_en", "")),
                str(exercise.get("category", "")),
                str(exercise.get("movement", {}).get("pattern", "")),
                " ".join(exercise.get("equipment", [])),
                " ".join(exercise.get("primary_muscles", []))
            ]).to_lower()
            if not haystack.contains(_query):
                continue
        result.append(exercise)
    return result


func _render_catalog() -> void:
    if _grid == null:
        return
    _clear_children(_grid)
    var visible := _filtered_exercises()
    _result_count.text = "%d упражнений  ·  профиль: %s" % [
        visible.size(),
        "мужской" if _profile_code == "male" else "женский"
    ]

    for exercise in visible:
        _grid.add_child(_build_card(exercise))

    var selected_is_visible := false
    for exercise in visible:
        if str(exercise.get("id", "")) == _selected_id:
            selected_is_visible = true
            break
    if not selected_is_visible:
        _selected_id = str(visible[0].get("id", "")) if not visible.is_empty() else ""
    _render_detail()


func _build_card(exercise: Dictionary) -> Control:
    var panel := PanelContainer.new()
    panel.size_flags_horizontal = Control.SIZE_EXPAND_FILL
    panel.custom_minimum_size = Vector2(280, 150)
    panel.add_theme_stylebox_override("panel", _panel_style(Color("#151e21"), Color("#2b3b3b")))

    var body := VBoxContainer.new()
    body.add_theme_constant_override("separation", 7)
    panel.add_child(body)

    var title := Label.new()
    title.text = str(exercise.get("name_ru", exercise.get("id", "Без названия")))
    title.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
    title.add_theme_color_override("font_color", Color("#edf3f0"))
    title.add_theme_font_size_override("font_size", 16)
    body.add_child(title)

    var metadata := Label.new()
    metadata.text = "%s  ·  %s" % [
        _category_label(str(exercise.get("category", ""))),
        _difficulty_label(str(exercise.get("difficulty", "")))
    ]
    metadata.add_theme_color_override("font_color", Color("#8fd9b8"))
    body.add_child(metadata)

    var environment_names: Array = []
    for env in exercise.get("environments", []):
        environment_names.append("дом" if env == "home" else "зал")
    var equipment_names: Array = exercise.get("equipment", [])
    var context := Label.new()
    context.text = "Среда: %s\nИнвентарь: %s" % [
        ", ".join(environment_names),
        ", ".join(equipment_names) if not equipment_names.is_empty() else "не требуется"
    ]
    context.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
    context.add_theme_color_override("font_color", Color("#aebbb6"))
    body.add_child(context)

    var media := _profile_media(exercise)
    body.add_child(_build_media_preview(media, Vector2(220, 115)))

    var status := Label.new()
    status.text = _status_label(str(exercise.get("production_status", "brief_only")))
    status.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
    status.add_theme_color_override("font_color", Color("#f0c77b") if exercise.get("production_status") != "human_approved" else Color("#8fd9b8"))
    body.add_child(status)

    var open_button := Button.new()
    open_button.text = "Открыть технику"
    open_button.custom_minimum_size.y = 38
    open_button.pressed.connect(_select_exercise.bind(str(exercise.get("id", ""))))
    body.add_child(open_button)

    return panel


func _profile_media(exercise: Dictionary) -> Dictionary:
    var profiles: Dictionary = exercise.get("media_profiles", {})
    return profiles.get(_profile_code, {})


func _as_resource_path(value: String) -> String:
    var path := value.strip_edges()
    if path.is_empty():
        return ""
    if path.begins_with("res://") or path.begins_with("user://"):
        return path
    return "res://" + path.trim_prefix("/")


func _build_media_preview(media: Dictionary, target_size: Vector2) -> Control:
    var sprite_path := _as_resource_path(str(media.get("sprite_frames") or ""))
    if not sprite_path.is_empty() and ResourceLoader.exists(sprite_path):
        var frames := load(sprite_path) as SpriteFrames
        if frames != null and not frames.get_animation_names().is_empty():
            var holder := SubViewportContainer.new()
            holder.custom_minimum_size = target_size
            holder.stretch = true
            var viewport := SubViewport.new()
            viewport.size = Vector2i(maxi(1, int(target_size.x)), maxi(1, int(target_size.y)))
            viewport.transparent_bg = true
            holder.add_child(viewport)
            var sprite := AnimatedSprite2D.new()
            sprite.sprite_frames = frames
            sprite.animation = "default" if frames.has_animation("default") else frames.get_animation_names()[0]
            var texture := frames.get_frame_texture(sprite.animation, 0)
            if texture != null:
                var frame_size := texture.get_size()
                var scale_factor: float = minf(target_size.x / maxf(frame_size.x, 1.0), target_size.y / maxf(frame_size.y, 1.0)) * 0.9
                sprite.scale = Vector2.ONE * scale_factor
            sprite.position = Vector2(viewport.size.x / 2.0, viewport.size.y / 2.0)
            viewport.add_child(sprite)
            sprite.play()
            return holder

    var video_path := _as_resource_path(str(media.get("video") or ""))
    if not video_path.is_empty() and ResourceLoader.exists(video_path):
        var stream := load(video_path)
        if stream is VideoStream:
            var player := VideoStreamPlayer.new()
            player.custom_minimum_size = target_size
            player.size_flags_horizontal = Control.SIZE_EXPAND_FILL
            player.stream = stream
            player.autoplay = true
            player.loop = true
            return player

    var poster_path := _as_resource_path(str(media.get("poster") or ""))
    if not poster_path.is_empty() and ResourceLoader.exists(poster_path):
        var texture := load(poster_path) as Texture2D
        if texture != null:
            var image := TextureRect.new()
            image.texture = texture
            image.custom_minimum_size = target_size
            image.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
            image.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
            return image

    var notice := Label.new()
    notice.text = "АНИМАЦИЯ ЕЩЁ НЕ СОЗДАНА\nБез случайной заглушки"
    notice.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
    notice.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
    notice.custom_minimum_size = target_size
    notice.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
    notice.add_theme_color_override("font_color", Color("#879791"))
    notice.add_theme_font_size_override("font_size", 12)
    return notice


func _select_exercise(exercise_id: String) -> void:
    _selected_id = exercise_id
    _render_catalog()


func _render_detail() -> void:
    if _detail == null:
        return
    _clear_children(_detail)
    var exercise: Dictionary = {}
    for candidate in _exercises:
        if str(candidate.get("id", "")) == _selected_id:
            exercise = candidate
            break
    if exercise.is_empty():
        _detail.add_child(_label("Нет упражнений по этому фильтру. Измени поиск или среду.", 15, Color("#aebbb6")))
        return

    _detail.add_child(_label(str(exercise.get("name_ru", exercise.get("id", ""))), 24, Color("#edf3f0")))
    _detail.add_child(_label(str(exercise.get("name_en", "")) + "  ·  " + str(exercise.get("id", "")), 12, Color("#8fd9b8")))
    _detail.add_child(_label("Renderer adapter: " + str(exercise.get("movement", {}).get("renderer_adapter", "not_assigned")), 12, Color("#aebbb6")))
    if str(exercise.get("id", "")) == "pull_up":
        var open_preview := Button.new()
        open_preview.text = "Открыть текущий 2D-прототип подтягивания"
        open_preview.custom_minimum_size.y = 42
        open_preview.pressed.connect(_open_pull_up_preview)
        _detail.add_child(open_preview)
    _detail.add_child(_build_media_preview(_profile_media(exercise), Vector2(280, 190)))
    _detail.add_child(_label("СТАТУС", 12, Color("#8fd9b8")))
    _detail.add_child(_label(_status_label(str(exercise.get("production_status", "brief_only"))), 15, Color("#f0c77b")))
    _detail.add_child(_label("Подготовка", 15, Color("#edf3f0")))
    _detail.add_child(_label(str(exercise.get("technique", {}).get("setup_ru", "")), 13, Color("#c6d0cb")))
    _append_bullets("Последовательность выполнения", exercise.get("technique", {}).get("instructions_ru", []))
    _append_bullets("Ключевые подсказки техники", exercise.get("technique", {}).get("cues_ru", []))
    _append_bullets("Типичные ошибки, которые нужно исключить в рендере", exercise.get("technique", {}).get("common_errors_ru", []))
    _detail.add_child(_label("Дыхание", 15, Color("#edf3f0")))
    _detail.add_child(_label(str(exercise.get("technique", {}).get("breathing_ru", "")), 13, Color("#c6d0cb")))
    _detail.add_child(_label("Ограничения безопасности", 15, Color("#edf3f0")))
    _detail.add_child(_label(str(exercise.get("technique", {}).get("safety_ru", "")), 13, Color("#c6d0cb")))
    _append_bullets("Фазы анимации", _phase_lines(exercise.get("movement", {}).get("phases", [])))
    _append_bullets("Основные мышцы", exercise.get("primary_muscles", []))
    _append_bullets("Вспомогательные мышцы", exercise.get("secondary_muscles", []))
    _append_bullets("Альтернативы оборудования", _alternative_lines(exercise.get("equipment_alternatives", [])))
    _append_bullets("Обязательные ворота качества", exercise.get("quality_gates", []))


func _open_pull_up_preview() -> void:
    var error := get_tree().change_scene_to_file("res://scenes/pull_up_preview.tscn")
    if error != OK:
        push_error("Could not open pull-up prototype scene; error code: %d" % error)


func _phase_lines(phases: Array) -> Array:
    var result: Array = []
    for phase in phases:
        result.append("%02d%% — %s: %s" % [
            roundi(float(phase.get("time", 0.0)) * 100.0),
            str(phase.get("name_ru", phase.get("id", ""))),
            str(phase.get("cue_ru", ""))
        ])
    return result


func _alternative_lines(alternatives: Array) -> Array:
    var result: Array = []
    for item in alternatives:
        result.append("%s (%s): %s" % [
            str(item.get("name_ru", "")),
            str(item.get("environment", "")),
            str(item.get("note_ru", ""))
        ])
    return result


func _append_bullets(title_text: String, items: Array) -> void:
    _detail.add_child(_label(title_text, 15, Color("#edf3f0")))
    if items.is_empty():
        _detail.add_child(_label("Не указано", 12, Color("#879791")))
        return
    for item in items:
        var label := _label("• " + str(item), 13, Color("#c6d0cb"))
        label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
        _detail.add_child(label)


func _label(text_value: String, font_size: int, tint: Color) -> Label:
    var label := Label.new()
    label.text = text_value
    label.add_theme_font_size_override("font_size", font_size)
    label.add_theme_color_override("font_color", tint)
    label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
    label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
    return label


func _category_label(value: String) -> String:
    match value:
        "strength": return "СИЛА"
        "cardio": return "КАРДИО"
        "mobility": return "МОБИЛЬНОСТЬ"
        "stretching": return "РАСТЯЖКА"
        "rehabilitation": return "ВОССТАНОВЛЕНИЕ"
        _: return value.to_upper()


func _difficulty_label(value: String) -> String:
    match value:
        "beginner": return "начальный уровень"
        "intermediate": return "средний уровень"
        "advanced": return "продвинутый уровень"
        _: return value


func _status_label(value: String) -> String:
    match value:
        "brief_only": return "ЗАДАНИЕ ГОТОВО · АНИМАЦИЯ НЕ СОЗДАНА"
        "rendering": return "РЕНДЕР В ПРОЦЕССЕ"
        "prototype_unreviewed": return "ПРОТОТИП · НУЖЕН ПРОСМОТР ТЕХНИКИ"
        "automated_qa_passed": return "АВТОПРОВЕРКИ ПРОЙДЕНЫ · НУЖЕН ЧЕЛОВЕЧЕСКИЙ ПРОСМОТР"
        "human_approved": return "АНИМАЦИЯ ПРИНЯТА ПО РЕЗУЛЬТАТАМ ПРОСМОТРА"
        "rejected": return "ОТКЛОНЕНО · ТРЕБУЕТСЯ ДОРАБОТКА"
        _: return "СТАТУС НЕ ЗАДАН"


func _clear_children(node: Node) -> void:
    for child in node.get_children():
        node.remove_child(child)
        child.queue_free()
