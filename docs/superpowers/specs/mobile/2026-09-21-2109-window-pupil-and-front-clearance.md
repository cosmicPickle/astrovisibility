# Physical aperture and front-of-window clearance

**Timestamp:** 2026-09-21 21:09 +03:00 (Europe/Sofia)

**Authority:** User requests both confirmed geometry gaps fixed. "Sensor width"
refers to the lens/entrance-aperture width identified in the preceding discussion;
sensor dimensions already govern field of view. Extends the original window and
full-frame specifications and supersedes the sill specification's rear-cone
complement rule. No new setup, dependencies, permissions or persisted format.

## Acceptance and model

- Pass existing equipment aperture diameter, in millimetres, into the shared
  frame visibility settings. Missing diameter means the legacy point pupil;
  no optics means centre evaluation. No window retains ordinary mask semantics.
- Approximate the entrance pupil as a circular disc centred at the existing
  moving lens position, normal to the target direction. Every field direction
  must clear from the entire disc. First geometric aperture shading is blocked.
- Preserve the behind/flush convention: a point on the room side must point
  outward through the opening. For a pupil straddling the plane, every room-side
  part must do so. Tangent rays from the room side/contact are blocked.
- In front, outward/parallel rays do not hit this wall. Inward rays are blocked
  when their forward wall intersection is outside the opening; they clear this
  window when the intersection lies inside. Existing mask/coverage still govern
  room/background obstacles; wall clearance does not assert a clear room.
- Exact contact with an opaque edge is blocked using the existing 1e-7 m contact
  tolerance. Entirely front-facing pupils may not bypass a wall hit in a frame
  interior simply because its corners are clear.
- Preserve original masks and window records. Mask preparation uses the corrected
  reference predicate; no destructive reinterpretation or migration is required.
  Increment calculation version and include aperture in the existing settings key.
- The yellow outline remains the physical window viewed from the lens centre;
  trajectory colours/intervals incorporate pupil clearance. No new overlay or UI.

## Geometry and performance

Keep east/up/north metre vectors and existing mount displacement. Compute exact
linear extrema over the pupil disc projected to the wall. If the disc crosses
the plane, constrain extrema to its room-side portion for outward rays. Use the
closed-form minimum of a linear function over a disc cut by one half-plane;
do not sample a dense aperture mesh or inflate field of view by a fixed angle.

For frames wholly facing one side of the wall, convexity permits four field
corners with full-disc extrema. Reject frames spanning a tangent direction and
an incoming wall direction, since those contain rays hitting the finite opening's
surrounding wall. Room-side pupils require every frame ray outward.

Refinement may prove clear using the outward/returning opening cone or the
away-from-wall hemisphere, with bounds for lens travel AND aperture radius.
Blocked proofs may use the central ray because it is part of the pupil. Keep
static aperture radius separate from the temporal motion stopping tolerance;
retain 30-second/0.05-degree transition targets and near-pole bounds. Work stays
constant per frame, bounded during trajectory refinement, with the existing
five-second local catalogue guardrail and separate physical-device perf check.

## Completion checklist

- Reproduce failing finite-aperture and front-wall tests before production changes.
- Replace invalid rear-cone test expectations with physical intersection oracles;
  retain behind/flush, wraparound, editing, mask lifecycle and scale coverage.
- Test zero/missing diameter, signed offsets, all mount modes, lens/pupil plane
  crossing, grazing/contact and a blocked interior with clear frame corners.
- Compare pupil checks with independent sampled rays, and transitions with dense
  physical references; verify list/trajectory/count and cache/equipment wiring.
- Run format, typecheck, lint, relevant suites including catalogue performance,
  build, proportionate rendered review, and build/share a current release APK.
- Preserve user attachments; update active task state, record evidence and limits,
  commit and push to main. Do not claim the reported night is reproduced.
