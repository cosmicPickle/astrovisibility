# Window-sill geometry correction

**Timestamp:** 2026-09-21 16:20 +03:00 (Europe/Sofia)

**Authority:** User instruction to correct the 160-degree restriction, support
behind/flush/in-front observing positions, and fix the verified corner-drag issue.
Extends `2026-09-21-0955-window-displacement-correction.md` and supersedes its
front-only geometry, convex-only frame check and hard angular-width guards.

## Behavior and numerical contract

- Preserve the panorama/mask, optics, four handles, width field and schema.
- Allow the directed left-to-right angular opening to pass continuously through
  180 degrees. Retain signed distance to the window plane: positive behind,
  zero flush, negative in front. No 160-degree or relative plane-distance cutoff.
- Use the user's requested edge-boundary approximation: behind the window the
  visible region is its spherical interior; in front it is the exterior of the
  rear-facing boundary. At the plane, an origin inside the clear rectangle sees
  the outward hemisphere. The rear sector remains blocked. This models the
  window's angular boundary, not an infinite opaque wall-plane or reconstructed
  room. Existing mask/coverage rules and wall-depth limitations remain explicit.
- Derive boundary planes directly from signed distance and distances to the four
  edges, avoiding normalization of a zero center vector at 180 degrees.
- Full-frame evaluation behind/flush remains convex. In front the visible region
  is nonconvex: clip the complete frame against the blocked rear cone, including
  edge crossings and blocked regions inside a frame whose corners are clear.
- A physical edge may pass through the viewing position at exact plane contact.
  Such a point has no sky direction: break the drawn outline at contact rather
  than normalizing a zero vector. Apply this to both editor and Sky View outlines.
- Refinement must support both interior and exterior predicates and never prune
  a segment merely because the lens is in front. Plane crossings retain the
  existing 30-second / 0.05-degree refinement tolerances.
  Bound angular movement using distance to physical edges, not distance to the
  window plane, which vanishes at the sill. A bound that proves all four margins
  positive or negative remains valid through a change of side.
- Right-corner dragging must resize its row and adjust perspective smoothly,
  including at zero altitude. Replace division by tangent with a bounded
  least-squares update of row height and range. Keep the linked rectangle and
  exact dragged-corner direction; reject only crossed/collapsed/invalid geometry.
- Preserve version-1 records and migration history. Bump calculation identity;
  no new permissions, dependencies, remote data, or setup measurements.
- Reject nonfinite/collapsed geometry only at numerical boundaries: angular
  separation from 0/360 at least 1e-7 degrees; slopes/range ratios bounded by
  1e6 (positive ratio at least 1e-6), slope height at least 1e-9. Existing physical
  width and lens-offset input limits remain. Contact is blocked.

## Acceptance checklist

- Tests fail first for 160.01/170/179.9/180/200-degree saved definitions;
  analytic 1-metre opening behind, flush and in front; north wrap and obliquity;
  all four handles and right-corner horizon crossing; finite zero-distance planes.
- Exterior full-frame tests include all-clear corners surrounding a blocked
  interior and edge crossings. Independent angular/reference trajectory cases
  verify both sides of 180 degrees, lens-plane crossings and summary agreement.
- Existing narrow-window, no-window, migration, mask preservation and catalogue
  performance tests continue to pass. Record wide-window performance separately.
- Verify editing, pan/zoom and reopen on representative and constrained Android
  viewports; build/stage the current release APK, review and push main.
- Physical-phone frame timing remains pending if no phone is connected.
