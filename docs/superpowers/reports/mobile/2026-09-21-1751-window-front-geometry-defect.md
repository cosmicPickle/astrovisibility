# Window geometry investigation

**Timestamp:** 2026-09-21 17:51 +03:00 (Europe/Sofia)

**Status:** A front-of-window classification defect is reproduced. No app code
has been changed. This does not reproduce the user's exact saved profile.

## Finding

The signed-distance extension in `apps/mobile/src/window/windowGeometry.ts`
changes the opening test from an intersection of four edge half-spaces to their
union when the lens is in front of the opening plane. This represents the
complement of a rear rectangular cone. It does not represent a wall containing
a rectangular opening: it accepts rays that intersect the opaque wall beside
the opening and rejects rays directed back through the opening itself.

`apps/mobile/src/window/windowFrame.ts` implements the same complement by
clipping the imaging frame against the rear cone. It therefore also reports
fully clear frames whose rays hit the wall. `windowRefinement.ts` uses the same
union assumption to prove entire intervals clear. This is a model defect, not
an offset conversion or cache-invalidation defect.

The previous sill specification explicitly selected this angular approximation.
That approximation cannot substantiate physical wall clearance. Merely replacing
OR with AND is not a fix: a lens in front can point away from the wall without
any forward wall intersection. Forward intersections, the aperture, and the
unmodeled room/other boundaries must be distinguished.

## Independent reproduction

All positions below use east/up/north metre coordinates. The synthetic wall is
the plane `z = 0.1`; its clear opening is `-0.6 < x < 0.6` and
`-0.6 < y < 0.6`. This is a 1.2 m square window. Compare the current source
functions against the independent intersection:

```text
travel = (0.1 - lens.z) / ray.z
intersection = lens + travel * ray
wallHit = travel > 0 and
          (abs(intersection.x) >= 0.6 or abs(intersection.y) >= 0.6)
```

With the lens at `(0, 0, 0.2)`, 10 cm in front of the plane, and a horizontal
ray at azimuth 95 degrees, the forward intersection is approximately
`(1.143, 0, 0.1)`. It is outside the opening and hits the wall. The current
`windowContainsRay` returns **true**. At 105 degrees the intersection is
approximately `(0.373, 0, 0.1)`, inside the opening, but that function returns
**false**. Passing through the opening says nothing about subsequent room
obstructions; it simply does not hit this wall.

The probe transpiled and executed the repository's actual TypeScript modules,
including `createImagingFrame` and `windowContainsFrame`. For both 1.2 m and
1.6 m widths, it swept azimuth 0 through 120 degrees in 0.1-degree steps at
20-degree altitude, with a 1-by-1-degree AltAz imaging frame. Lens positions
were 10 cm behind, exactly at, and 10 cm in front of the fixed plane.

| Width | Lens position | Centre falsely clear | Whole frame falsely clear |
| ----- | ------------- | -------------------: | ------------------------: |
| 1.2 m | Behind        |                    0 |                         0 |
| 1.2 m | At            |                    0 |                         0 |
| 1.2 m | In front      |                   94 |                        95 |
| 1.6 m | Behind        |                    0 |                         0 |
| 1.6 m | At            |                    0 |                         0 |
| 1.6 m | In front      |                   71 |                        71 |

The first falsely clear centre in each front case was at 90.1 degrees. The
exact-plane branch retains an outward-hemisphere convention; the probe does
not validate wall thickness, aperture contact, or visibility into a room.
Earlier direct intersection checks covered 78,648 behind-plane centre rays
with no mismatches. Neither result validates the model for every real setup.

## Why existing tests missed it

The sill tests use a directed angular limit greater than 180 degrees as their
oracle. That repeats the approximation instead of intersecting rays with an
opaque wall and aperture. The focused command still passes all 28 tests:

```powershell
pnpm --filter @astrovisibility/mobile test --runTestsByPath src/window/windowSillGeometry.test.ts src/window/windowSillVisibility.test.ts
```

## Relation to the reported night

The user reports right-edge intrusion at 01:35, with predictions of 02:48 at
zero offset and 02:44 at 50 mm. The phone was at the mount's turning axis and
the fitted edges are the outer edges that obstruct first. Those facts are
accepted; no further user calibration experiment is needed to demonstrate the
defect above.

The screenshot does not contain the saved window parameters, mask, equipment
settings, or signed lens/plane distance along the trajectory. No physical device
is connected. Consequently the demonstrated defect is not yet proven to account
for the exact 69-minute residual in that profile. Do not manufacture that claim,
change a fitted width to force the reported time, or silently reinterpret all
existing greater-than-180-degree definitions as physically validated openings.

The yellow outline extending below the horizon is separately explained by the
outline renderer's lack of horizon clipping; drawing does not change the
classifier. No new release APK is required for this investigation-only report.
