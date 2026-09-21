# 178-degree window geometry audit

**Timestamp:** 2026-09-21 18:29 +03:00 (Europe/Sofia)

**Scope:** Geometry only, as requested. The front-of-plane defect is deferred.
No production behavior, calibration, saved data or dependencies were changed.
The actual reported night is not reproduced; no alternative origin was investigated.

## Findings

No additional defect was found in the reconstructed rectangle, signed lateral
lens motion, behind-plane centre/frame intersections, mask composition, cache
identity or right-edge transition timing tested here. This is evidence about
the implemented ideal rectangle/lateral-offset model, not a guarantee that the
user's fitted geometry or physical setup is represented exactly.

The known [front-of-plane defect](2026-09-21-1751-window-front-geometry-defect.md)
remains unfixed and explicitly deferred in `docs/superpowers/State.md`. Its centre,
frame and temporal-refinement branches require a coordinated correction.
Existing greater-than-180-degree tests encode the faulty angular approximation;
their passing does not validate physical wall clearance.

**178 degrees does not exclude that branch after displacement.** For a rectangular
opening with horizontal angular span `s`, width `w`, and right/left horizontal
range ratio `r`, perpendicular capture-point distance is

```text
d = w r sin(s) / (1 + r² - 2 r cos(s))
```

At 178 degrees, its maximum over positive `r` is `(w / 2) tan(1 degree)`.
That is 10.47 mm for 1.2 m, or 13.96 mm for 1.6 m. A 50 mm lateral offset can
therefore move the lens across the plane during tracking. This establishes a
possibility, not the cause of the user's right-edge failure. In the synthetic
south-facing, positive-offset right-edge cases below the lens remained behind
the plane at every sampled instant; their timing checks passed.

The zero-offset case stays behind for a 178-degree definition, so the deferred
front branch cannot explain that case's reported 02:48 prediction.

## Independent checks

New test fixture `apps/mobile/src/window/__fixtures__/physicalWindow.ts` starts
with a measured upright wall opening. It solves capture depth by bisection from
angular span, then derives the saved corner representation. Its visibility
oracle intersects a ray with the physical plane and compares the intersection
with measured rectangle bounds; it does not call production window half-spaces.
All fixtures are synthetic and contain no private profile data.

| Check                                                 | Coverage                                                                                                                                                                                       | Result                                                                              |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Rectangle reconstruction and unchanged corner editing | 150 combinations: 1.2/1.6 m, 30/90/160/178/179.99 degrees, five lateral positions, three yaw angles including wraparound                                                                       | Corner error below 1 nm; height/depth agree to ten decimal places                   |
| Signed lateral lens motion                            | 252 rigid rotations per tracking mode, including -50/0/+50 mm and four observer latitudes                                                                                                      | Position error below 1 pm against independent Rodrigues rotations                   |
| Behind-plane centre and complete-frame intersections  | 111,720 positions, each checked for centre and frame; three tracking modes, two widths, near-180 spans, oblique/off-centre positions, signed offsets, small/large frames and two sensor angles | No mismatches                                                                       |
| Right-edge trajectory and catalogue summary           | 36 six-hour M27 scenarios at a synthetic 44 N, 0 E observer; 1-second physical intersection oracle; 178 degrees, both widths, three lateral positions, 0/+50 mm, three modes                   | Maximum endpoint error 6.437 seconds; all within the existing 30-second requirement |
| Mask composition at zero offset                       | Six 178-degree definitions; every valid pixel centre of a 128-square atlas with mixed blocked pixels and partial photographic coverage                                                         | Matches source mask AND coverage AND physical opening; source bits unchanged        |
| Cache identity                                        | Change each of the six saved geometric parameters separately                                                                                                                                   | Every change invalidates the calculation key                                        |

The trajectory test uses catalogue M27 coordinates but not the user's date/time
window or precise location. It reuses the astronomy transform and imaging-frame
corner generator, isolating window intersection and transition refinement.
The lens-motion test separately checks production motion against rigid rotations.
The broad intersection sweep explicitly excludes effective lens distances at or
in front of the plane; it cannot accidentally certify the deferred branch.

## Why the behind-plane intersection is correct

Let `d > 0` be lens-to-plane distance, `a` the lens position measured along the
window from its left edge, `w` the opening width, `f` the ray component towards
the plane and `r` the component along the opening. The unnormalized left and
right margins used by the code are

```text
left  = d r + a f
right = -d r + (w - a) f
```

Their sum is `w f`. Both positive therefore require a forward ray, `f > 0`.
Dividing by `f` gives precisely `0 < a + d r / f < w`: the ray-plane
intersection is inside the horizontal opening. The vertical pair gives the
same result for height. Normalization preserves these signs. Existing tiny
grazing/contact tolerances are separate from this exact-arithmetic argument.

For a convex rectangular imaging frame, these are linear constraints on its
unnormalized tangent-plane rays. If all four corners satisfy every constraint,
the complete frame does too. This justifies the behind-plane corner test,
including arbitrary frame rotation. It does not justify the front-plane branch.

## Integration review and limits

- The shared classifier always applies the physical window after a clear mask
  centre; a blocked mask centre remains blocked. Full-frame checking follows.
- The derived background raster preserves blocked regions inside the original
  opening and uncaptured coverage. The zero-offset identity test confirms it
  cannot silently clear the source mask at the sampled pixel centres.
- The cache context includes the complete saved window definition, frame/mount
  settings and signed offset, observer, interval, and panorama/mask revisions.
- Temporal refinement bounds lens motion and edge rotation; the new physical
  oracle tests exercise its actual trajectory and summary paths. No sampling
  error approaching 90 minutes appeared in these fixtures.
- The yellow boundary's below-horizon rendering does not feed the visibility
  classifier; it is not evidence of a numerical window-plane tilt.
- A single width/span and a screenshot do not recover saved azimuth endpoints,
  vertical slopes or distance ratio, nor the selected signed offset/mount/frame
  settings. No physical phone or exact saved profile is available here.

The remaining geometry task is replaying the exact saved window, optics and
observing interval to establish lens/plane side and individual blocking margins
around 01:35, 02:44 and 02:48. Until then, do not claim the 90-minute error is
explained, certify geometry 100 percent, or move to other-origin investigation.

## Validation

Root format, typecheck and lint passed. Nine focused window/editor suites passed
all 57 tests, including 13 new audit tests. Root build passed, including catalogue
and sky-asset validation and Android export. No runtime inputs changed, so this test/documentation
task does not require a new release APK or visual pass. The existing delivered
APK remains unchanged. Review found no added runtime, privacy or dependency
surface; test output reports only synthetic counts and errors.
