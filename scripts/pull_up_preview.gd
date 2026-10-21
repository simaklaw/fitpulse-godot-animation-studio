extends Node2D
## Animated 2D pull-up motion prototype.
## This is an authored transform-based preview, not a validated anatomical rig.

@export_range(0.5, 1.5, 0.1) var cycle_seconds: float = 3.2
@export var auto_play: bool = true
@export var show_phase_label: bool = true

const CANVAS := Vector2(720.0, 720.0)
const BAR_Y := 150.0
const BAR_X0 := 190.0
const BAR_X1 := 530.0
const SKIN := Color("#d9a17d")
const SKIN_SHADE := Color("#9c654d")
const TOP := Color("#243c37")
const TOP_SHADE := Color("#172a27")
const SHORTS := Color("#252b35")
const OUTLINE := Color("#10171b")
const HIGHLIGHT := Color("#e8c0a1")
const METAL := Color("#b8c5cb")
const BG := Color("#10171c")
const ACCENT := Color("#9de5c0")

var elapsed := 0.0
var paused := false
var phase_label := "DEAD HANG"

func _process(delta: float) -> void:
    if auto_play and not paused:
        elapsed += delta
        queue_redraw()

func _unhandled_key_input(event: InputEvent) -> void:
    if event is InputEventKey and event.pressed and not event.echo:
        match event.keycode:
            KEY_SPACE:
                paused = not paused
            KEY_R:
                elapsed = 0.0
                paused = false
            KEY_RIGHT:
                elapsed += cycle_seconds / 24.0
            KEY_LEFT:
                elapsed = maxf(0.0, elapsed - cycle_seconds / 24.0)
            KEY_1:
                cycle_seconds = 4.0
            KEY_2:
                cycle_seconds = 3.2
            KEY_3:
                cycle_seconds = 2.5

func _draw() -> void:
    draw_rect(Rect2(Vector2.ZERO, CANVAS), BG)
    _draw_backdrop()
    _draw_bar()
    var t := fposmod(elapsed, maxf(cycle_seconds, 0.1)) / maxf(cycle_seconds, 0.1)
    var lift := _pull_curve(t)
    phase_label = _phase_for(t)
    _draw_character(lift, t)
    if show_phase_label:
        _draw_hud(t)

func _draw_backdrop() -> void:
    for i in range(7):
        var y := 235.0 + i * 55.0
        draw_line(Vector2(70, y), Vector2(650, y), Color(0.20, 0.28, 0.30, 0.13), 1.0)
    draw_arc(Vector2(360, 390), 235, PI, TAU, 64, Color(0.24, 0.38, 0.35, 0.22), 1.0, true)
    draw_line(Vector2(95, 620), Vector2(625, 620), Color("#314047"), 2.0)

func _draw_bar() -> void:
    draw_line(Vector2(BAR_X0 - 22, BAR_Y), Vector2(BAR_X1 + 22, BAR_Y), OUTLINE, 18.0, true)
    draw_line(Vector2(BAR_X0 - 22, BAR_Y - 2), Vector2(BAR_X1 + 22, BAR_Y - 2), METAL, 10.0, true)
    draw_line(Vector2(BAR_X0 - 22, BAR_Y - 5), Vector2(BAR_X1 + 22, BAR_Y - 5), Color("#edf3f4"), 2.0, true)
    draw_line(Vector2(BAR_X0 - 16, BAR_Y + 8), Vector2(BAR_X0 - 16, 620), Color(0.35, 0.43, 0.45, 0.22), 2.0)
    draw_line(Vector2(BAR_X1 + 16, BAR_Y + 8), Vector2(BAR_X1 + 16, 620), Color(0.35, 0.43, 0.45, 0.22), 2.0)

func _pull_curve(t: float) -> float:
    # Slow concentric phase, brief top, controlled eccentric phase.
    var p := t * 4.0
    if p < 1.0:
        return 0.5 - 0.5 * cos(PI * p)
    if p < 1.25:
        return 1.0
    if p < 3.25:
        return 0.5 + 0.5 * cos(PI * (p - 1.25) / 2.0)
    return 0.0

func _phase_for(t: float) -> String:
    var p := t * 4.0
    if p < 0.15: return "DEAD HANG"
    if p < 0.65: return "SCAPULAR INITIATION"
    if p < 1.0: return "CONTROLLED PULL"
    if p < 1.25: return "TOP POSITION"
    if p < 3.25: return "CONTROLLED DESCENT"
    return "RETURN TO HANG"

func _draw_character(lift: float, t: float) -> void:
    # Fixed hand contact: the bar never moves relative to the palms.
    var left_hand := Vector2(300, BAR_Y + 1)
    var right_hand := Vector2(420, BAR_Y + 1)
    var shoulder_y := lerpf(350.0, 205.0, lift)
    var shoulder_mid := Vector2(360, shoulder_y)
    var hip_mid := Vector2(364, shoulder_y + 126.0)
    var chest := Rect2(Vector2(323, shoulder_y - 8), Vector2(74, 111))
    var elbow_spread := lerpf(72.0, 45.0, lift)
    var elbow_y := lerpf(275.0, 245.0, lift)
    var left_elbow := Vector2(shoulder_mid.x - elbow_spread, elbow_y)
    var right_elbow := Vector2(shoulder_mid.x + elbow_spread, elbow_y)
    var left_shoulder := Vector2(shoulder_mid.x - 31, shoulder_y + 10)
    var right_shoulder := Vector2(shoulder_mid.x + 31, shoulder_y + 10)
    var leg_angle := sin(t * TAU) * 0.025
    var left_hip := hip_mid + Vector2(-15, 0)
    var right_hip := hip_mid + Vector2(15, 0)
    var left_knee := left_hip + Vector2(-14 + leg_angle * 100.0, 78)
    var right_knee := right_hip + Vector2(14 + leg_angle * 100.0, 78)
    var left_ankle := left_knee + Vector2(-5, 74)
    var right_ankle := right_knee + Vector2(5, 74)

    # Rear limbs first, with layered shadows and highlights.
    _limb(left_shoulder, left_elbow, 28, SKIN_SHADE)
    _limb(right_shoulder, right_elbow, 28, SKIN_SHADE)
    _limb(left_elbow, left_hand + Vector2(0, 7), 22, SKIN)
    _limb(right_elbow, right_hand + Vector2(0, 7), 22, SKIN)
    _limb(left_hip, left_knee, 33, SHORTS)
    _limb(right_hip, right_knee, 33, SHORTS)
    _limb(left_knee, left_ankle, 25, SKIN)
    _limb(right_knee, right_ankle, 25, SKIN)

    # Torso silhouette, shoulder caps, layered shirt and waist.
    var torso := PackedVector2Array([
        Vector2(shoulder_mid.x - 42, shoulder_y + 3),
        Vector2(shoulder_mid.x - 29, shoulder_y - 12),
        Vector2(shoulder_mid.x + 29, shoulder_y - 12),
        Vector2(shoulder_mid.x + 42, shoulder_y + 3),
        Vector2(shoulder_mid.x + 31, shoulder_y + 89),
        Vector2(shoulder_mid.x + 22, shoulder_y + 113),
        Vector2(shoulder_mid.x - 22, shoulder_y + 113),
        Vector2(shoulder_mid.x - 31, shoulder_y + 89)
    ])
    draw_colored_polygon(torso, OUTLINE)
    var shirt := PackedVector2Array([
        Vector2(shoulder_mid.x - 37, shoulder_y + 5),
        Vector2(shoulder_mid.x - 25, shoulder_y - 5),
        Vector2(shoulder_mid.x + 25, shoulder_y - 5),
        Vector2(shoulder_mid.x + 37, shoulder_y + 5),
        Vector2(shoulder_mid.x + 27, shoulder_y + 83),
        Vector2(shoulder_mid.x + 18, shoulder_y + 101),
        Vector2(shoulder_mid.x - 18, shoulder_y + 101),
        Vector2(shoulder_mid.x - 27, shoulder_y + 83)
    ])
    draw_colored_polygon(shirt, TOP)
    draw_line(Vector2(shoulder_mid.x - 20, shoulder_y + 18), Vector2(shoulder_mid.x - 13, shoulder_y + 77), Color("#50766b"), 3.0, true)
    draw_line(Vector2(shoulder_mid.x + 20, shoulder_y + 18), Vector2(shoulder_mid.x + 13, shoulder_y + 77), TOP_SHADE, 4.0, true)
    draw_line(Vector2(shoulder_mid.x - 19, shoulder_y + 99), Vector2(shoulder_mid.x + 19, shoulder_y + 99), Color("#111c1b"), 5.0, true)

    # Head/neck follow shoulder elevation, face points slightly toward camera.
    var head_center := Vector2(360, shoulder_y - 45)
    draw_rect(Rect2(Vector2(348, shoulder_y - 20), Vector2(24, 28)), SKIN_SHADE)
    draw_circle(head_center + Vector2(1, 0), 27, OUTLINE)
    draw_circle(head_center, 24, SKIN)
    draw_arc(head_center + Vector2(-2, -1), 22, PI * 1.05, PI * 1.85, 24, HIGHLIGHT, 2.0, true)
    draw_line(head_center + Vector2(11, -2), head_center + Vector2(18, 0), SKIN_SHADE, 2.0, true)
    draw_circle(head_center + Vector2(12, -6), 2.5, OUTLINE)

    # Shorts panel and waistband.
    draw_rect(Rect2(Vector2(337, hip_mid.y - 3), Vector2(53, 24)), SHORTS)
    draw_line(Vector2(363, hip_mid.y + 2), Vector2(363, hip_mid.y + 20), Color("#4a5360"), 2.0)
    draw_line(Vector2(341, hip_mid.y - 1), Vector2(386, hip_mid.y - 1), Color("#66717d"), 2.0)

    # Palm wraps around bar; fixed coordinates preserve contact through the cycle.
    _draw_hand(left_hand, true)
    _draw_hand(right_hand, false)

func _limb(a: Vector2, b: Vector2, width: float, color: Color) -> void:
    draw_line(a, b, OUTLINE, width + 6.0, true)
    draw_line(a, b, color, width, true)
    var direction := (b - a).normalized()
    var normal := Vector2(-direction.y, direction.x) * width * 0.22
    draw_line(a + normal, b + normal, Color(1, 1, 1, 0.15), maxf(2.0, width * 0.12), true)
    draw_circle(a, width * 0.48, color)
    draw_circle(b, width * 0.48, color)

func _draw_hand(pos: Vector2, left: bool) -> void:
    draw_circle(pos + Vector2(0, 3), 12, OUTLINE)
    draw_circle(pos + Vector2(0, 1), 9, SKIN)
    for i in range(3):
        var x := pos.x + (i - 1) * 4.0
        draw_line(Vector2(x, pos.y - 2), Vector2(x, pos.y + 8), SKIN_SHADE, 2.0, true)

func _draw_hud(t: float) -> void:
    draw_string(ThemeDB.fallback_font, Vector2(42, 52), "FITPULSE  /  MOVEMENT LAB", HORIZONTAL_ALIGNMENT_LEFT, -1, 14, Color("#91a69f"))
    draw_string(ThemeDB.fallback_font, Vector2(42, 82), "PULL-UP  ·  MOTION PROTOTYPE", HORIZONTAL_ALIGNMENT_LEFT, -1, 19, Color("#e8f2ed"))
    draw_string(ThemeDB.fallback_font, Vector2(42, 672), phase_label, HORIZONTAL_ALIGNMENT_LEFT, -1, 13, ACCENT)
    draw_string(ThemeDB.fallback_font, Vector2(490, 672), "SPACE pause  ·  R restart", HORIZONTAL_ALIGNMENT_LEFT, -1, 11, Color("#82928d"))
    draw_rect(Rect2(42, 690, 636, 3), Color("#29383a"))
    draw_rect(Rect2(42, 690, 636.0 * t, 3), ACCENT)
