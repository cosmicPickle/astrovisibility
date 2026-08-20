# Diurnal Visibility Arc Correction

**Timestamp:** 2026-08-20 12:02 +03:00
**Status:** Approved by direct owner instruction on 2026-08-20

## Purpose

Replace the misleading short/disconnected selected-target arc with a
Stellarium-style diurnal track while preserving Astrovisibility's observing
window and obstruction semantics. Selecting a DSO must reveal the celestial
circle it follows, keep the selected target registered to that circle, and
overlay the exact observing-window portion that can later alternate between
visible and blocked through a completed local mask.

This specification supersedes the display-duration sentence in section 6 of
`2026-08-20-1037-equatorial-sky-mount-correction.md`. It does not change the
approved equatorial navigation mount.

## Evidenced defects

- On an ordinary daytime launch, catalogue targets are projected at the current
  instant while the default arc is calculated for the coming Tonight window.
  The selected mark and its arc can therefore appear on opposite sides of the
  sphere.
- Only the astronomical-darkness portion is drawn. In summer this can be a very
  short fraction of a target's diurnal circle and does not communicate the
  Stellarium Mobile visibility-path model shown by the owner.
- Existing circle tests generate directions directly in the mount frame. They
  do not prove that real catalogue coordinates survive the astronomy adapter,
  time sampling, horizon handling, grouping, and rendering path.
- The renderer drops below-horizon samples without always creating a path
  boundary, which can connect disjoint above-horizon intervals.

Official Stellarium Mobile documentation says its visibility feature shows the
path an object has taken and will take over the next hours. The owner-provided
reference demonstrates the complete daily celestial track with the relevant
portion distinguished. Primary reference:
<https://www.stellarium-labs.com/blog/update-1-8-0/>.

## Functional contract

1. Selecting a fixed DSO draws one complete sidereal revolution of its
   time-evaluated apparent horizontal direction. This neutral context track is
   a closed celestial circle except for the physically correct near-horizon
   refraction departure.
2. The selected observing window remains authoritative for visibility results.
   Its above-horizon portion is overlaid on the context track with exact
   one-minute render samples, 30-minute markers, and transition labels.
3. With no completed mask, the observing-window overlay is explicitly
   unassessed. With a completed mask, visible and blocked subsegments retain the
   existing five-minute classification and 30-second/0.05-degree refinement.
   Directions outside partial mask coverage remain blocked.
4. Below-horizon and out-of-window context is neutral and must not be described
   as locally visible. It exists only to make the target's diurnal geometry
   legible.
5. The scene instant and default observing window use one rule:
   - when the current instant lies inside the active night, render the scene at
     that instant;
   - otherwise render the scene at the upcoming observing-window start;
   - custom/list-provided windows render initially at their start.
   The selected target must lie on the displayed diurnal track within the
   numerical projection tolerance.
6. Selection, trajectory arrival, classification, and deselection do not alter
   camera centre, basis, or FOV.
7. A below-horizon gap splits assessed path groups. No line may bridge through
   the hidden hemisphere or projection antipode.

## Numerical and rendering requirements

- Use a sidereal revolution of approximately 86,164.09 SI seconds, not a
  cosmetic screen-space circle and not a 24-hour great-circle interpolation.
- Every orbit and observing-window direction is evaluated from the target's
  equatorial coordinates at its actual timestamp. No spherical chord
  interpolation may replace the small-circle path.
- One-minute orbit sampling is acceptable for v1 and bounds ordinary sidereal
  motion to approximately 0.25 degrees per segment. Work is bounded to at most
  1,500 orbit samples for one selected target.
- All paths, markers, panorama, mask, catalogue targets, guides, and FOV use the
  same equatorial stereographic camera.
- Projection clipping must start a new Skia subpath for non-projectable,
  off-screen discontinuous, or below-horizon gaps rather than drawing a chord
  across the canvas.

## Compatibility, privacy, and non-goals

- No persistence, migration, dependency, permission, network, catalogue, or
  logging change.
- Panorama and mask remain persisted and classified in horizontal
  azimuth/altitude coordinates. Camera and overlay opacity cannot change
  classification.
- No target tracking, automatic camera fit, screen-space fake circle, full
  Stellarium embedding, or change to target-list ranking is introduced.
- Precise locations and user panoramas remain local and absent from fixtures and
  logs.

## Acceptance criteria

- A direct daytime selection uses the upcoming night reference instant; a
  selection during the active night uses the current instant.
- Real IC 1396 and Iris Nebula fixtures at the synthetic Sofia reference
  location project around the celestial pole with the expected declination
  radius and bounded circle residual.
- Their full context tracks span one sidereal revolution and close within
  0.02 degrees, while the highlighted segment spans exactly the selected
  observing window.
- The selected direction lies on the context track and, when its timestamp is
  in the window, on the highlighted segment.
- Circumpolar, rising/setting, never-rising, north-wrap, near-zenith,
  cross-midnight, and projection-antipode cases remain ordered and finite.
- Zero, one, and multiple mask crossings preserve every visibility interval and
  transition; panorama/mask toggle and opacity changes do not alter results.
- Selection and deselection leave camera state byte-identical.
- Root format, typecheck, lint, full tests, build, native release assembly, and
  exact-release Android visual QA pass at representative and constrained phone
  viewports.
