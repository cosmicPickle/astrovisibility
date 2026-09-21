# Fast approximate catalogue visibility

Timestamp: 2026-09-22 00:00 +03:00 (Europe/Sofia)

Authority: the user explicitly prioritizes fast catalogue ordering/filtering and
authorizes approximate durations using only centre obstruction. This supersedes
the full-frame/window requirements for bulk discovery calculations only.

- Catalogue ranking and shared bulk duration filters check the target centre
  against the original completed sky mask. Do not use the window-corrected
  background raster, physical window, lens displacement, pupil, tracking mode,
  or full imaging frame for these estimates.
- Retain optical size suitability, astronomical darkness, all estimated visible
  intervals, timezone formatting, cancellation and progressive feedback.
  Establish whole-window horizon eligibility cheaply, then perform mask checks
  only in the intersection of above-horizon and astronomical-darkness intervals.
  Daytime-only targets still retain their existing zero-usable-duration status.
- Label masked catalogue durations `Approx. … through local obstructions` and
  interval times `Approx. …`. Briefly explain centre-only estimates and that
  selecting a target checks the full view. No-mask results must still explicitly
  say obstructions are not assessed.
- Selected-target trajectories retain their full-frame/window calculation.
  Catalogue and selected-target cache values must not overwrite or substitute
  for one another. Use a versioned catalogue target-key namespace within the
  existing observing context, keeping both result kinds available across
  navigation. Old summaries may remain until existing cache pruning removes
  them; no user-data or database-schema migration is required.
- Use two-minute centre samples for ranking, refining detected transitions to
  the existing 30-second temporal tolerance. The measured adaptive centre-only
  full-day workload still took 2.7 seconds on desktop. As part of the authorized
  approximation, intervals shorter than two minutes can be missed; selected
  target inspection retains full spatial refinement. Aim for subsecond desktop
  calculation for approximately 1,000 optics-eligible targets over a full day and verify native
  cold-cache behavior; do not claim handset performance from desktop timing.
- Regress original mask use, skipped geometry, cache separation, approximate
  copy and no-mask semantics. Retain detailed geometry tests and tighten the
  catalogue performance guard after measuring. Run required quality gates and
  Android representative/constrained QA; deliver a fresh release APK.

No dependencies, permissions, new calibration, or selected-target accuracy
changes are authorized or needed. The earlier observed cutoff audit stays open.
