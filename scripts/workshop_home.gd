extends Control
## Main entry point for the FitPulse exercise-animation workshop.
## Opens production briefs and previews explicitly; never claims missing animations exist.

const CATALOG_PATH := "res://animation-pipeline/catalog/exercise_catalog.json"
const CATALOG_SCENE := "res://scenes/exercise_catalog_preview.tscn"
const PULL_UP_SCENE := "res://scenes/pull_up_preview.tscn"

var _stats_label: Label
var _error_label: Label


func _ready() -> void:
    _build_ui()
    _load_stats()


func _build_ui() -> void:
    set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)

    var background := ColorRect.new()
    background.color = Color("#0d1215")
    background.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
    background.mouse_filter = Control.MOUSE_FILTER_IGNORE
    add_child(background)

    var margins := MarginContainer.new()
    margins.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
    margins.add_theme_constant_override("margin_left", 28)
    margins.add_theme_constant_override("margin_right", 28)
    margins.add_theme_constant_override("margin_top", 28)
    margins.add_theme_constant_override("margin_bottom", 28)
    add_child(margins)

    var scroll := ScrollContainer.new()
    scroll.size_flags_horizontal = Control.SIZE_EXPAND_FILL
    scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
    scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
    margins.add_child(scroll)

    var page := VBoxContainer.new()
    page.size_flags_horizontal = Control.SIZE_EXPAND_FILL
    page.add_theme_constant_override("separation", 18)
    scroll.add_child(page)

    var eyebrow := _label("FITPULSE  /  ANIMATION WORKSHOP", 12, Color("#8fd9b8"))
    page.add_child(eyebrow)

    var title := _label("Мастерская анимаций", 34, Color("#edf3f0"))
    page.add_child(title)

    var intro := _label(
        "Единая точка входа для библиотеки упражнений, технических заданий и просмотра прототипов. Каждый клип имеет отдельный статус готовности и набор проверок техники.",
        15,
        Color("#aebbb6")
    )
    page.add_child(intro)

    var stats_panel := PanelContainer.new()
    stats_panel.add_theme_stylebox_override("panel", _panel_style(Color("#151e21"), Color("#2b3b3b")))
    page.add_child(stats_panel)

    var stats_column := VBoxContainer.new()
    stats_column.add_theme_constant_override("separation", 8)
    stats_panel.add_child(stats_column)

    stats_column.add_child(_label("СОСТОЯНИЕ ПРОЕКТА", 12, Color("#8fd9b8")))
    _stats_label = _label("Загружаю каталог…", 16, Color("#edf3f0"))
    stats_column.add_child(_stats_label)
    _error_label = _label("", 12, Color("#ffb6a9"))
    stats_column.add_child(_error_label)

    page.add_child(_label("Рабочие разделы", 21, Color("#edf3f0")))
    page.add_child(_build_action_card(
        "Каталог упражнений",
        "Поиск, фильтры «дом / зал», мужской и женский профиль, техника, фазы, альтернативы инвентаря и обязательные ворота качества.",
        "Открыть каталог",
        _open_catalog
    ))
    page.add_child(_build_action_card(
        "Прототип подтягивания",
        "Текущая отдельная 2D-анимация для проверки цикла. Это технический прототип, а не принятая production-анимация.",
        "Смотреть движение",
        _open_pull_up
    ))

    var note := _label(
        "Важно: описание упражнения, успешная компиляция и готовая анимация — три разных статуса. Пустое медиа не заменяется случайной заглушкой. Перед публикацией каждого клипа нужны проверки контактов, суставов, цикла и человеческий просмотр техники.",
        13,
        Color("#c6d0cb")
    )
    page.add_child(note)


func _load_stats() -> void:
    if not FileAccess.file_exists(CATALOG_PATH):
        _stats_label.text = "Каталог не найден"
        _error_label.text = CATALOG_PATH
        return
    var file := FileAccess.open(CATALOG_PATH, FileAccess.READ)
    if file == null:
        _stats_label.text = "Каталог недоступен для чтения"
        return
    var parsed: Variant = JSON.parse_string(file.get_as_text())
    if not parsed is Dictionary or not parsed.get("exercises") is Array:
        _stats_label.text = "Некорректный JSON каталога"
        return
    var exercises: Array = parsed["exercises"]
    var home_count := 0
    var gym_count := 0
    var approved_count := 0
    var brief_count := 0
    var prototype_count := 0
    for exercise in exercises:
        if exercise.get("environments", []).has("home"):
            home_count += 1
        if exercise.get("environments", []).has("gym"):
            gym_count += 1
        match str(exercise.get("production_status", "brief_only")):
            "human_approved":
                approved_count += 1
            "brief_only":
                brief_count += 1
            "prototype_unreviewed":
                prototype_count += 1
    _stats_label.text = "%d briefs  ·  %d для дома  ·  %d для зала\n%d одобрено  ·  %d прототип без принятия  ·  %d заданий без готового клипа" % [
        exercises.size(), home_count, gym_count, approved_count, prototype_count, brief_count
    ]


func _build_action_card(title_text: String, description: String, button_text: String, callback: Callable) -> Control:
    var panel := PanelContainer.new()
    panel.size_flags_horizontal = Control.SIZE_EXPAND_FILL
    panel.add_theme_stylebox_override("panel", _panel_style(Color("#151e21"), Color("#2b3b3b")))

    var layout := VBoxContainer.new()
    layout.add_theme_constant_override("separation", 10)
    panel.add_child(layout)

    layout.add_child(_label(title_text, 20, Color("#edf3f0")))
    layout.add_child(_label(description, 14, Color("#aebbb6")))

    var button := Button.new()
    button.text = button_text
    button.custom_minimum_size.y = 46
    button.size_flags_horizontal = Control.SIZE_EXPAND_FILL
    button.pressed.connect(callback)
    layout.add_child(button)
    return panel


func _panel_style(fill: Color, edge: Color) -> StyleBoxFlat:
    var style := StyleBoxFlat.new()
    style.bg_color = fill
    style.border_color = edge
    style.set_border_width_all(1)
    style.set_corner_radius_all(12)
    style.content_margin_left = 16
    style.content_margin_right = 16
    style.content_margin_top = 16
    style.content_margin_bottom = 16
    return style


func _label(text_value: String, font_size: int, tint: Color) -> Label:
    var label := Label.new()
    label.text = text_value
    label.add_theme_font_size_override("font_size", font_size)
    label.add_theme_color_override("font_color", tint)
    label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
    label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
    return label


func _open_catalog() -> void:
    _change_scene(CATALOG_SCENE)


func _open_pull_up() -> void:
    _change_scene(PULL_UP_SCENE)


func _change_scene(path: String) -> void:
    var error := get_tree().change_scene_to_file(path)
    if error != OK:
        _error_label.text = "Не удалось открыть сцену: %s (код %d)" % [path, error]
        push_error(_error_label.text)
