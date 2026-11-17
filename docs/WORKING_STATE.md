# Рабочая конфигурация (зафиксировано после успешного прогона)

Дата: 2026-11-03. Владелец подтвердил: анимация приседа выглядит естественно.

## Что стоит в проекте
- Godot 4.7.2 (Android-редактор). CLI/headless недоступен.
- Патч **v3** (`fitpulse_squat_patch_v3.zip`) применён поверх кода v2.
- Персонаж: `CharacterRig` (наследник `HumanoidRig`) + glTF
  `assets/characters/superhero_male/Superhero_Male_FullBody.gltf`
  (65 костей, UE-скелет, T-pose → A-pose через `BIND_POSE`).
- Сцена демо: `scenes/demo/squat_demo.tscn`, `Rig` = `CharacterRig`, `has_barbell = false`.
- Упражнение: `BodyweightSquatExercise` — 7 фаз, `stance_width = 0.40`, `baked_reps = 3`.

## Что работает (проверено глазами на устройстве)
- Стойка, глубина, плоские стопы, колени по носкам.
- Три разных повтора вместо одинаковых.
- HUD: «Таз ниже колена 3.5–4.2 см», все проверки ✔.
- Счёт повторов идёт (1, 2, 4 в логе).

## Проверки без CLI (рантайм-порты)
- `scenes/tools/check.tscn` → `tools/squat_check_node.gd` (флаг `use_character`)
- `scenes/tools/animator_check.tscn` → `tools/animator_check_node.gd`

## Открыные вопросы к персонажу
- Руки/плечи выглядят неестественно (это скиннинг модели супергероя, не код).
- Брови крупные и белые — стилизация «супергерой».
- Кандидат на замену: мокап-пак SportDemoAnimPack (см. ниже).

## Новые ассеты
- `assets/characters/sportdemo/` — 4 FBX из купленного SportDemoAnimPack:
  `AS_Calisthenics_001_Squats`, `004_Push_ups`, `044_Standing_Oblique_Twists`,
  `AS_PullUpBar_016_Half_Leg_Raises`. Каждый FBX = меш + скин + UE-скелет
  с корректирующими костями (`clavicle_scap_l`, `calf_twist_01_l`,
  `calf_kneeBack_l`) + AnimStack. Текстуры встроены.
