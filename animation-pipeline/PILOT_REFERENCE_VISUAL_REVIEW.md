# Pilot Reference Contact Sheet — Visual Review

## Scope

This review is based on the generated dark contact sheet from workflow run [39547837461](https://github.com/simaklaw/fitpulse-godot-animation-studio/actions/runs/39547837461). It is a visual screening of the supplied three-pose source sets only. It is not a biomechanics certification and does not approve the source art for shipping.

## Results

| Exercise | Pose readability | Frame/style consistency | Equipment/contact | Decision |
|---|---|---|---|---|
| Pull-up | PASS — recognizable hang and top position | REJECT — the middle frame has much heavier/rougher line weight; first two poses are near-duplicates while the hang is a different phase | REVIEW — bar contact is readable, but the three poses do not form a balanced loop | REFERENCE ONLY |
| Hanging knee raise | PASS — hanging setup and knee raise are recognizable | REVIEW — three poses are visually related but are not a smooth or clearly ordered cycle | PASS — pull-up bar and hand contact are visible | REFERENCE ONLY |
| Incline dumbbell curl | PASS — incline bench and curl motion are recognizable | REVIEW — poses and visible dumbbell positions do not read as a consistent three-frame cycle at contact-sheet scale | REVIEW — verify bilateral dumbbell visibility and hand-to-weight contact in full-size frames | REFERENCE ONLY |
| Front squat | PASS — upright, partial squat, and deeper squat are distinguishable | REVIEW — likely usable as pose references, but frame spacing and bar position need a full-size review | PASS — barbell is visible across the poses | REFERENCE ONLY |
| One-arm dumbbell row | PASS — bench-supported row is recognizable | REVIEW — first two poses are too similar to establish clear motion spacing; third pose reads as the lowered position | PASS — bench and dumbbell are visible | REFERENCE ONLY |

## Overall finding

The source is useful for exercise recognition, equipment cues, and rough key-pose planning. It is **not production-ready animation**: it supplies only three static images per exercise, has uneven line quality in at least the pull-up set, and does not provide a consistent male/female character system. Do not interpolate these images blindly and present the result as premium animation.

## Next production gate

1. Create or select a consistent rigged character pair (male and female as separate designs, not recolors).
2. Author a pull-up cycle with at least dead hang, scapular initiation, ascent, controlled top, descent, and return-to-hang phases.
3. Validate hand-to-bar contact, shoulder/elbow paths, body swing, loop seam, and phone-scale readability in a real preview.
4. Export and inspect a rendered contact sheet and video before expanding to the other four exercises.
5. Keep these upstream CC BY-SA 4.0 assets as reference-only until redistribution and adaptation obligations are reviewed.

## Evidence boundary

CI confirms download, SVG parsing, 512×512 source dimensions, PNG rendering, non-empty alpha, and SHA-256 reporting. It does not verify anatomy, motion continuity, male/female variants, Godot runtime behavior, or Android performance.
