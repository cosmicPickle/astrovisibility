# Stitching corrections and connected surface selection

Timestamp: 2026-09-15 09:18 +03:00 (Europe/Sofia)

## Requested outcome

Fix heavily overlapping and multi-photo registration. Manual adjustment starts
from the automatically recovered poses, adds roll, and recomputes seams and
blending with the edited poses rather than replacing the panorama with the old
tile compositor. Keep the combined optimization/cubemap branch and main intact.

Improve wand selection of shaded/textured surfaces without changing the accepted
mask UI, full-resolution mask, draw/erase semantics or private offline processing.
This supersedes the fixed seed-colour range in the night-selection specification.
Use existing OpenCV only. This is geometric/edge selection, not semantic building
or tree recognition; invisible boundaries still require manual corrections.

## Implementation and acceptance

- Retain geometrically verified matches between near-identical captures. Test
  duplicates with incorrect sensor poses, three or more overlapping photos,
  upward views and original featureless/cancellation cases.
- Return recovered placement with each preview. On manual entry, preserve all
  recovered placements atomically in the existing capture draft. Captured sensor
  snapshots remain original. Reopen and edit these placements, including roll.
- Re-stitch from reviewed placements without optimizing away manual corrections;
  run the same native coverage, seam and blending pipeline. Acceptance still
  produces one image and transitions to mask creation. Failures retain the draft.
- Use neighbour-relative surface continuity and detected boundaries instead of
  comparing every pixel to one tap's colour. Preserve transparent gaps and thin
  obstructions; no global closing of the final binary mask. Test a daylight
  shaded wall across a large brightness range and low-contrast night fixtures,
  seed stability, wrong-side leakage and original-resolution narrow features.
- Bound input sizes and native work; cache image preparation in the existing
  editing session. Measure first/cached selection on Android at 2048 square.
- Add regressions before production edits, run native checks and format,
  typecheck, lint, affected application tests and build. Inspect real Android UI
  on representative and constrained viewports. Build a fresh release APK with
  the repository skill, preserving existing device data and cleaning owned tasks.

## Compatibility and numerical details

Keep OpenCV's ratio/RANSAC checks and minimum confidence 1, but set its
near-duplicate rejection threshold to 4 (above the confidence formula's maximum).
For up to twelve tiles, match every pair; for larger captures retain six nearest
sensor neighbours plus two chronological neighbours each way. Seed focal lengths
from captured FOV using `HomographyBasedEstimator(true)`; ray bundle adjustment
still refines them and feature geometry determines relative rotations. This avoids
inventing a lens when duplicate images contain no focal-estimation information.

Wand preparation retains original-resolution mean-shift/Canny/short-edge filtering
from the preceding implementation. Growth now uses symmetric floating-range
OpenCV flood fill with Lab neighbour differences at most 6 per channel. The
connected surface can span a wide brightness ramp; Canny and local colour jumps
stop it at boundaries. Remove the previous seed averaging/image mutation.
Keep centre-path seeds, alpha barriers, non-propagating boundary restoration,
4096-seed/512-region/5-second limits and the same cached matrices/bytes.

Automatic recovery can put a horizon photo's centre slightly below zero while
its upper portion still covers sky. Preserve that orientation exactly, rather
than clamping it on manual entry. Forward migration 9 copies the draft-tile table
unchanged while widening its altitude constraint to -90..90, matching existing
panorama tiles and camera geometry. Retain all keys, ownership, ordinals, sensor
snapshots and files; recreate the existing index. Transaction rollback restores
the old table on failure. Prior migrations stay untouched. Test version-eight
rows through migration, restart, negative-centre correction and deletion.
The persisted mask/atlas remains upper-hemisphere only. This does not add
below-horizon visibility. Old binaries reject the newer schema safely.

Recovered rotations are converted to azimuth/altitude/roll and the recovered
horizontal/vertical FOV. The ray adjuster keeps principal points at image centre.
Round-trip tests include zenith, north wrap, below-horizon centres and roll limits.
Recovered float rotation versus angle reconstruction must differ by less than
1e-6 in matrix norm. On the upward fixture, recomposition keeps coverage identical
and mean absolute RGBA difference below .001/255, with maximum 8/255 to allow
OpenCV's quantized interpolation-bin boundaries. This is not a lossless PNG
identity requirement; there is no visible positional change.
Manual roll wraps at +/-180 degrees. Previous/next tile controls make coincident
tiles selectable. Re-stitch recomposes exact reviewed poses, deliberately retaining
manual corrections rather than running registration over them again.

No new dependency, permission or external data. Do not commit user panoramas.
Do not push while the previous automatic approval rejection remains unresolved.

Library evidence: [OpenCV matcher implementation](https://github.com/opencv/opencv/blob/4.13.0/modules/stitching/src/matchers.cpp),
[camera estimation implementation](https://github.com/opencv/opencv/blob/4.13.0/modules/stitching/src/motion_estimators.cpp).
