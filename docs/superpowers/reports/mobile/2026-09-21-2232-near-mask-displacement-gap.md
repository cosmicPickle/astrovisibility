# Nearby mask geometry is not displaced

**Timestamp:** 2026-09-21 22:32 +03:00 (Europe/Sofia)

**Authority:** User requires investigation of code/model assumptions after a
02:34 prediction with AltAz and 50 mm, against observed shading at 01:35.
Geometry-only investigation. No production behavior is changed here.

## Confirmed gap

`window/windowMask.ts:prepareWindowCorrection` preserves blocked pixels inside
the reference rectangle as background. `astronomy/obstructionVisibility.ts`
checks that background using the target's original sky direction and imaging
frame, with no translation to the lens position. Lens displacement and finite
aperture apply only to the ideal rectangular opening.

Consequently, any nearby frame portion inside the rectangle is classified as a
distant angular obstacle. An actual frame can protrude into the rectangle, have
a stepped edge or contain a divider. Its painted boundary then stays fixed
while the ideal rectangle moves. The source mask has no near/far label, so the
code cannot distinguish such a frame from a distant obstacle at that direction.

This follows the original spec's distant-interior-mask approximation. It is a
physical model limitation, not a new arithmetic error in ray-plane intersection.
The previous geometry and pupil tests predominantly validated the ideal opening
or explicitly expected interior bits to remain fixed, leaving this case uncovered.

## Reproduction

`apps/mobile/src/window/windowNearMaskModelGap.test.ts` constructs a synthetic
1.2 m, 178-degree upright window with a stepped opaque portion at the same plane.
Above 5 mm height, the right clear edge is x = 0.18 m; below that step it remains
x = 0.6 m. The left edge is x = -0.6 m. This deliberately substantial intrusion
makes the assumption measurable; it is not a reconstruction of the photograph.

The original 512-square mask is generated from independent physical ray-plane
intersections. The ideal rectangle is correctly defined around its outer bounds.
Settings are AltAz, +50 mm lateral offset, 35 mm aperture and a 3-by-2-degree frame.

At azimuth 75 degrees and altitude 20 degrees:

- A direct ray from the shifted lens centre intersects the known opaque portion.
- The current shared production classifier returns `visible`.
- Moving the painted obstruction 100 times farther away, with its dimensions
  scaled equally, preserves its original angular silhouette but clears that ray.
  The same source mask therefore supports different physical answers depending
  on obstacle depth. Automatically moving all mask pixels to the window plane
  would be unjustified for the distant version.

A one-second synthetic sweep from azimuth 45 to 89 degrees at fixed altitude
20 degrees uses an explicit 11-degree/hour speed. A ray from the pupil rim is
already obstructed at second 5,920. The model first blocks at second 11,762:
**at least 97 minutes 22 seconds of demonstrated optimism** relative to that
witness. This is neither an M27 ephemeris nor the user's observing night, and
does not claim to explain the exact remaining 59 minutes or earlier four-minute
offset response. It proves the model can omit a large nearby obstruction effect.

## Consequence for a fix

The required distinction is which painted obstructions belong to the nearby
window geometry. Those must participate in lens/pupil ray intersections; distant
background must retain angular-mask behavior. The saved four-corner rectangle
and binary mask alone do not encode that ownership. Connectivity to the outer
blocked region is insufficient: buildings or branches may also touch it.

Do not ship a heuristic that silently assigns every interior/border-connected
mask pixel to the window plane, or merely adds an angular safety margin. That
would trade this false clear for incorrect blocking in other profiles. An
explicit product decision is needed on identifying the nearby portion while
preserving the user's requirement for simple setup. No new input, annotation,
migration, permission, export or calibration flow is introduced by this audit.

## Validation

The characterization test intentionally asserts current false-clear behavior
alongside independently proved physical blockage. Replace that assertion with
the corrected contract once the near-mask representation is approved. It is not
a passing correctness test for the current behavior.

Only synthetic test data and documentation are added. No real panorama, mask or
coordinates are committed, and no release APK is required for these changes.
Final ordered gates passed: `pnpm format`, `pnpm typecheck`, `pnpm lint`, the
new focused characterization test, and `pnpm build` (catalogue/sky asset checks
and Android export). Exported runtime bundle hash remains
`entry-98751495b3fd7f4448ddd680c2e01592.hbc`, matching the preceding release inputs.
`git diff --check` passed. This introduces no runtime attack surface, dependencies,
user-data access or long-running service. The synthetic result is not a timing
claim about a real physical observing setup.
