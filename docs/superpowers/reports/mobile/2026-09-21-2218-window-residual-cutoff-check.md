# Remaining cutoff discrepancy

**Timestamp:** 2026-09-21 22:18 +03:00 (Europe/Sofia)

The user reports 02:34 with the pupil/front-wall fix and confirms AltAz with
50 mm offset. Observed shading began at 01:35. The remaining 59 minutes are not
resolved. The earlier comparison was 02:48 at zero offset and 02:44 at 50 mm.

## Bounded comparison

A local diagnostic uses M27, a synthetic observer at 44 N / 25 E, and
2026-09-20 23:48 UTC as a reference cutoff. This approximates the reported region
and night, not the exact saved profile. It uses a 3-by-2-degree AltAz frame,
positive/rightward 50 mm offset and a 35 mm aperture. Those optical values and
offset side still need confirmation against the user's saved optics.

For each 178-degree opening, its yaw is chosen so that the zero-offset point
frame reaches the right edge at the reference cutoff. Top and bottom edges are
placed out of the way to isolate that edge; no panorama mask participates.
The independent measured-rectangle fixture supplies geometry; runtime frame and
pupil routines determine the new cutoff. This is a sensitivity comparison, not
an independent validation of the runtime classifier or a bound on all profiles.

| Width | Position from left | 50 mm advance | Additional pupil advance |
| ----- | ------------------ | ------------- | ------------------------ |
| 1.2 m | 2%                 | 15.38 min     | 5.36 min                 |
| 1.2 m | 50%                | 30.03 min     | 10.38 min                |
| 1.2 m | 90%                | 140.51 min    | 40.90 min                |
| 1.6 m | 2%                 | 11.54 min     | 4.03 min                 |
| 1.6 m | 50%                | 22.56 min     | 7.84 min                 |
| 1.6 m | 90%                | 108.30 min    | 33.77 min                |

The sweep also checked 10%, 25% and 75% positions with results between these
endpoints. The 98% cases reached the five-hour search boundary and are excluded
from conclusions. The diagnostic script is local under
`tmp/window-qa/residual-check.cjs`; no real profile or image data was used.

The four-minute reported offset change is not reproduced by this family. One
possibility is that the zero-offset prediction was limited by the drawn mask
while the displaced prediction was limited by the fitted window, so subtracting
their times understates the actual window-edge movement. This remains a
hypothesis. It is not evidence that the mask, capture, or user placement is wrong.

## Next evidence

Inspect the user's saved window outline against the photographed frame and
mask, particularly the right edge near the target at 01:35. The angular span,
physical width and tracking mode alone do not specify its absolute directions,
perspective or the mask boundary. Those records are not accessible in the local
repository. No production changes or new APK are justified by this comparison.
