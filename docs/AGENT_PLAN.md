# AGENT_PLAN.md — рабочий план ИИ-агентов FitPulse Animation Studio

Версия: 1.0 (2026-11-17). Координатор: владелец (simaklaw) + архитектор.
Язык отчётов: русский. Владелец работает С ТЕЛЕФОНА (Godot 4.7.2 Android-редактор,
локальный CLI/headless НЕДОСТУПЕН). Вся проверка результатов — через CI-артефакты
(контактные листы PNG, клипы WebM/WebP) и логи GitHub Actions. Не требовать от
владельца локальных запусков Blender/Godot CLI.

## 0. Контекст и цель

Проект — мастерская анимаций для мобильного приложения FitPulse (репо simaklaw/forma).
Продукт: прозрачные зацикленные клипы упражнений (male/female) + poster + manifest,
интегрируемые в forma через контракт verifiedExerciseMedia.

Партия 1 (цель ближайших ~2 недель): 4 упражнения из купленного на Fab
SportDemoAnimPack, уже импортированного в Godot на устройстве владельца:
- AS_Calisthenics_001_Squats        → bodyweight_squat
- AS_Calisthenics_004_Push_ups      → push_up
- AS_Calisthenics_044_Standing_Oblique_Twists → standing_oblique_twists (новый brief)
- AS_PullUpBar_016_Half_Leg_Raises  → hanging_leg_raises (новый brief)

Исходные FBX слишком тяжёлые для загрузки. В репо уже лежит импорт-кэш Godot
(.scn, ~2.5 МБ каждый) в папке "assets sport". Конвейер партии 1:
.scn → [Godot headless CI] извлечение скелет+анимация → GLB (в R2, НЕ в git)
→ [Blender headless CI] ретаргет на Quaternius (CC0, UE-скелет) male/female
→ QC → рендер с альфой → ffmpeg (WebM/WebP/poster/contact-sheet)
→ артефакты CI → ревью владельца с телефона → PR в forma.

## 1. Жёсткие правила (нарушение = остановка работы)

1. ЗАПРЕЩЕНО процедурно генерировать движения (углы костей, ключевые кадры,
   IK-«починки» в стиле grip_*.js). Движения — ТОЛЬКО из AnimStack пака/mocap.
2. ЗАПРЕЩЕНО использовать как руководство: ANIMATION_CODE.md, ANIMATION_CODE_v2.md,
   grip_*.js, bake*.mjs, build_*.mjs, back_squat.gd, bodyweight_squat.gd —
   это АРХИВ провалившихся экспериментов. Читать только для исторической справки.
3. ЗАПРЕЩЕНО ослаблять валидаторы, gates, тесты ради зелёного CI.
4. ЗАПРЕЩЕНО ставить automated_qa_passed / human_approved без доказательств.
   human_approved ставит ТОЛЬКО владелец после визуального ревью.
5. ЗАПРЕЩЕНО коммитить в git лицензионные исходники и производные: FBX пака,
   извлечённые GLB с анимацией пака. Промежуточные GLB — только в Cloudflare R2.
6. Секреты — только GitHub Secrets.
7. В forma НЕ трогать логику приложения. Только медиа + manifest + тесты контракта.
8. Одна задача = одна ветка = один PR. Прямые push в main запрещены.
9. Новые инструменты/зависимости — только с одобрения владельца.
10. После 2 неудачных попыток починить один дефект — СТОП, вопрос владельцу.

## 2. Факты текущего состояния

- Репо публичное.
- "assets sport": .scn/.md5/.vulkan.cache импорт-кэша 4 FBX + архивные скрипты
  + WORKING_STATE.md (перенесён в docs/). Оригинальных .FBX в репо НЕТ.
- Персонаж: Quaternius Universal Base Characters [Standard], CC0 1.0.
- Пак: SportDemoAnimPack (Fab). UE-скелет + correction bones.
- Уже опубликовано: pull-up и push-up (male/female) в forma.
- Каталог: animation-pipeline/catalog/exercise_catalog.json.

## 3. Definition of Done (партия 1)

Для каждого из 4 упражнений:
- [ ] GLB анимации извлечён, лежит в R2, описан в assets_manifest.json.
- [ ] Ретаргет на Quaternius male И female, QC-отчёт.
- [ ] Рендер: прозрачный фон, зацикленный клип, WebM(VP9 alpha)+WebP+poster,
      контактный лист 12 кадров.
- [ ] Brief в каталоге, adapter зарегистрирован, валидатор зелёный.
- [ ] Владелец одобрил каждый из 8 вариантов (approve/reject).
- [ ] PR в forma: медиа + manifest + тесты; CI зелёный; playback на Android.
- [ ] assets/fitpulse/<exercise>/... опубликован.

## 4. Задачи по фазам (кратко)

### T-1. Заземление
Прочитать AGENTS.md, этот план, EXERCISE_PRODUCTION_WORKFLOW.md,
MESH2MOTION_RETARGET_TRIAL.md, schema, registry, WORKING_STATE, manifest forma.
Выписать ТОЧНЫЙ контракт медиа forma. Отчёт «факты vs предположения».

### Фаза 0 — гигиена (агент B)
T0.1 AGENTS.md + ссылка на план.
T0.2 Архив experiments/ (grip_*, bake*, build_*, ANIMATION_CODE*, squat.gd, animator_check*).
     WORKING_STATE.md → docs/.
T0.3 assets_manifest.json + схема + валидатор.
T0.4 R2 setup docs + CI upload step.

### Фаза 1 — извлечение (агент A)
T1.1 extract_anim.gd + workflow.
T1.2 Прогон 4 .scn → таблица-отчёт.
T1.3 Загрузка GLB в R2.
T1.4 Удаление .scn из git после успеха (согласовать).

### Фаза 2 — персонаж (агент B)
T2.1 Quaternius download + SHA + commit если <20 МБ.
T2.2 bones_map.json.

### Фаза 3 — ретаргет (агент A)
T3.1 retarget.py (quaternion delta, pelvis scale, cycle trim).
T3.2 qc_retarget.py.
T3.3 Female-вариант.
T3.4 Довести bodyweight_squat до зелёного QC.

### Фаза 4 — рендер (агент A)
T4.1 render_exercise.py (Workbench, film_transparent).
T4.2 ffmpeg WebM/WebP/poster/contact_sheet.
T4.3 workflow_dispatch render-exercise.yml.

### Фаза 5 — каталог (агент B)
T5.1 Briefs standing_oblique_twists + hanging_leg_raises.
T5.2 Измеримые gates в qc.
T5.3 Манифест выходов.

### Фаза 6 — ревью и публикация
T6.1 Пакет ревью владельцу (8 вариантов).
T6.2 PR в forma.
T6.3 Публикация studio-side.

## 5–9. Спецификации, отчётность, роли, СТОП, риски

См. полную версию у координатора. Ключевое:
- Скелет пака: UE + correction (*_twist_*, clavicle_scap_*, calf_kneeBack_*) — IGNORE.
- Quaternius Godot-UE: 65 костей, T→A через BIND_POSE.
- Ретаргет: per-bone quaternion delta; pelvis translation scale; fps=30; один цикл.
- Рендер: прозрачность обязательна; единый фрейминг; Workbench-first.
- R2: fitpulse-studio-raw/{pack-anim,retarget,renders-intermediate}/.
- После 2 неудачных попыток на один дефект — СТОП.
- Любое сомнение в лицензии / .scn не читается / gate пришлось бы ослабить — СТОП.
