# Window model gap: finite entrance aperture

**Timestamp:** 2026-09-21 20:28 +03:00 (Europe/Sofia)

**Authority:** User asks to find the gap in the model, not merely verify the
existing equations. Geometry-only investigation; the front-of-plane defect
remains deferred. No production code is changed by this report.

## Confirmed omission

The window classifier models a point lens. Whole-frame evaluation changes ray
directions but starts every ray at the same lens-centre position. It never checks
whether the nearby frame shades part of the telescope's light-collecting aperture.
Thus a clear centre ray for every image corner does not establish an unvignetted
image: other parallel rays feeding those pixels can hit the window frame.

Evidence in current code:

- `equipment/imagingFrameSettings.ts` does not pass the saved aperture to visibility.
- `astronomy/imagingFrame.ts` has no aperture in `ImagingFrameSettings`.
- `window/windowFrame.ts` accepts one lens position and tests rays from it.
- `window/windowRefinement.ts` bounds the field of view and lens-centre movement,
  with no finite-aperture margin.

This was explicitly excluded as "finite-aperture vignetting" in the original
window specification. That makes it a deliberate approximation which misses a
real geometric obstruction, not a floating-point or intersection implementation
error. The earlier audit's independent wall intersections also used point rays,
so they could not detect this omitted physical dimension.

DWARFLAB specifies a 35 mm telephoto aperture for DWARF 3:
[official quick setup](https://help.dwarflab.com/en/docs/DWARF-3-Unboxing-and-Quick-Setup).
This supplies the illustrative 17.5 mm radius below; the test does not claim
to reconstruct the exact internal entrance-pupil position of that instrument.

## Reproducible false-clear case

`apps/mobile/src/window/windowApertureModelGap.test.ts` fixes a synthetic upright
opening at 1.2 m width and 178-degree reference span, with bottom/top heights
-0.25/+1.1 m. The capture point is horizontally centred. Pointing is azimuth
82 degrees, altitude 20 degrees, with a 50 mm rightward AltAz lens offset and
a 3-by-2-degree frame. All lengths are in the same synthetic local frame.

- The lens and its entire 35 mm pupil remain behind the plane.
- Production `windowContainsFrame` returns clear.
- Independent ray-plane intersections from the lens centre confirm every corner clear.
- The same corner rays from the pupil's right edge hit outside the physical opening.

This demonstrates an optimistic result without the greater-than-180-degree defect,
panorama misalignment, time handling, or a misplaced capture point.

## Magnitude check

A second test uses M27 catalogue coordinates, a synthetic 44 N/0 E observer,
a south-facing 178-degree, 1.2 m window, 50 mm AltAz offset and 3-by-2-degree frame.
It samples at one-second intervals from 2026-09-20 21:00 UTC. For each corner ray,
it computes the exact bounds of a circular pupil projected onto the wall.
It asserts the entire pupil remains behind the plane throughout the checked arc.

| Capture position along opening | First pupil shading before point-frame cutoff |
| ------------------------------ | --------------------------------------------: |
| 10% from left                  |                                     5 min 6 s |
| Centre                         |                                    8 min 43 s |
| 90% from left                  |                                   29 min 10 s |

These are synthetic demonstrations, not bounds over every configuration and not
a reproduction of the user's night. They establish that the missing aperture
can cause material optimism. They do **not** establish that it explains the
reported 90 minutes. The observed four-minute response to a 50 mm offset remains
a constraint any proposed explanation must reproduce; it must not be ignored.

## Correct model and bounded implementation direction

Use the saved aperture diameter to approximate the entrance pupil as a disc
perpendicular to the optical axis. Check the light bundle from the whole disc
for every field direction, instead of one ray per direction. No new user input
is needed for the diameter; the optics form already has it.

For a wall in local `z = D`, ray `r`, pupil centre `L`, optical axis `q` and radius
`R`, the central intersection is `L + ((D - L.z) / r.z) r`. Horizontal changes
caused by a pupil displacement `u` are `u.x - (r.x / r.z) u.z`. Define
`v = (1, 0, -r.x / r.z)`. Their exact extreme magnitude over the pupil disc is

```text
R * sqrt(dot(v, v) - dot(v, q)^2)
```

Use the analogous vertical expression to check physical opening bounds. This is
a fixed amount of vector arithmetic per edge/corner, not an aperture-pixel sweep.
For an entirely behind-plane pupil, convexity permits testing field corners with
these exact pupil bounds: each fixed pupil point has linear ray-side constraints,
and their intersection remains convex. Temporal refinement, cache identity,
selected-target rendering semantics and the at/front-plane cases need a coherent
implementation and tests. Runtime performance has not been measured for a fix.

Do not substitute a constant angular padding or simply add radius to the signed
lateral offset: both would get some edges, elevations and mount modes wrong.
The location of the true entrance pupil, wall depth and more general mount-axis
offsets remain separate approximations; none was established as the 90-minute
cause here. A translation exactly along a central ray does not change its line,
so an omitted forward distance alone is not automatically an explanation either.

## Validation and remaining work

The new tests intentionally document current false-clear behavior and independent
physical blockage; replace that current-behavior assertion when implementing the
fix. No user data, production inputs or dependencies changed. Existing audit and
deferred correction entries remain in `docs/superpowers/State.md`.

The original 90-minute discrepancy remains open. This finding invalidates any
claim that passing point-ray tests alone clears the physical geometry model.
No investigation of non-geometric causes is authorized by these results.

Validation passed: root format, typecheck, lint, four focused geometry audit suites
(15 tests), and root build including catalogue/assets and Android export. This
test/documentation change does not require a new APK. Existing runtime behavior
is unchanged; the finite-aperture correction has not been implemented.
