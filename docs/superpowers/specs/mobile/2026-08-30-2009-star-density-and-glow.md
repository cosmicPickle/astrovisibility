# Star Density and Glow Refinement

**Timestamp:** 2026-08-30 20:09 +03:00 (Europe/Sofia)

## Purpose

Make the registered stars read as luminous points instead of flat painted dots,
while reducing wide-view clutter and preserving responsive mobile navigation.

## Scope and acceptance

- Use the existing offline HYG-derived registered star catalogue and Skia
  renderer; add no dependency, network access, or new user data.
- Replace hard zoom magnitude thresholds with fixed magnitude bands whose
  opacity changes continuously with the live camera field of view.
- At the initial 100-degree field of view, render the magnitude 4-and-brighter
  foundation at full intensity and only begin revealing magnitude 4.0-4.8
  stars. Progressively reveal fainter bands down to magnitude 6.7 at close
  fields of view.
- Prefetch at most the next entering magnitude band so a pinch does not expose
  an unloaded band, without projecting the complete 15,598-star catalogue in
  wide views.
- Reduce solid core radii. Render a near-white core over a wider, low-opacity
  colour halo; the brightest bands may receive one additional batched outer
  halo. Do not use blur filters, off-screen layers, per-star React components,
  or animations that run independently of camera movement.
- Keep a fixed, bounded number of compound Skia paths per colour/magnitude
  band and project each star only once per frame.
- Preserve true star coordinates and broad B-V colour character.

## Verification

- Pure tests cover the stronger wide-view density, continuous opacity curve,
  close-view reveal ceiling, smaller core sizes, and halo layering.
- Run format, typecheck, lint, the focused tests, the complete relevant test
  suite, and build in the required order.
- Inspect a representative and constrained Android viewport while panning and
  zooming, checking density, fade continuity, glow, and interaction stability.
- Treat emulator timing as diagnostic only. The existing physical-device 50 fps
  p95 validation remains open.

## Performance budget

- Wide-view resident source limit: magnitude 4.8 (1,296 catalogue stars before
  spatial culling), versus the previous magnitude 5.5 limit (2,866 stars).
- Absolute close-view source ceiling: magnitude 6.7 (11,228 catalogue stars
  before spatial culling), with the small view cone providing the dominant
  bound.
- No image filters or per-star scene nodes. Batch count is bounded by the fixed
  colour and magnitude-style tables.
