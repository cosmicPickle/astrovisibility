# Sky visibility and target-discovery polish

Timestamp: 2026-08-21 21:58 +03:00

Status: Approved by direct human instruction in the current task.

## Purpose

Make Sky View controls quieter, distinguish photographically dark trajectory
segments, and make the all-target list searchable, filterable, and ranked by
usable dark observing time.

## Scope

This task changes selected-target trajectory presentation, overlay/equipment
controls, target-list ranking and filtering, and the existing equipment
suitability rule. It does not change persistence, the observing-window picker,
mask geometry, panorama alignment, catalogue data, or centre-point obstruction
classification.

## Astronomical-darkness semantics

- Astronomical darkness means the apparent centre of the Sun is at or below
  altitude -18 degrees for the profile observer.
- Darkness boundaries use the existing Astronomy Engine adapter and are clipped
  to the selected observing window. Polar/no-crossing windows are classified by
  the Sun's altitude inside the window.
- A trajectory segment's display priority is:
  1. locally obstructed: existing neutral gray;
  2. locally clear or obstruction-unassessed during astronomical darkness: dark
     blue;
  3. locally clear or obstruction-unassessed outside astronomical darkness:
     existing light blue.
- Dark and light clear segments are solid. Obstructed segments retain their
  existing dashed treatment.
- “Visible through local obstructions” totals and intervals are the intersection
  of locally visible intervals with astronomical-darkness intervals.
- When no completed mask exists, list ranking uses the intersection of
  above-horizon intervals with astronomical darkness, while continuing to state
  that local obstructions are unassessed.
- Darkness intervals are calculated once per observer/window and reused across
  the selected trajectory and all ranked targets.

## Sky View controls and selected-target summary

- Remove the separate top-of-sky imaging setup, panorama opacity, and mask
  opacity controls.
- Add one 44-pixel-minimum eye icon control at bottom-left. It opens a “Sky
  controls” sheet containing imaging setup, panorama opacity, and mask opacity
  actions when those resources exist.
- Selecting one of those actions opens its existing dedicated sheet.
- Panorama and mask opacity sheets contain only their title, close action, and
  slider. Remove explanatory copy and show/hide actions. Opacity zero is the
  hidden state; no separate visibility state is retained.
- Replace the bottom-right `View All Targets` label with a search icon while
  retaining the full accessible name.
- Place a small information icon beside the selected target name; it opens the
  existing detailed information sheet. Remove the separate `More Info` button.
- For a profile with a mask, the compact summary contains:
  - the dark-time duration visible through local obstructions;
  - one line formatted `Visibility: HH:mm–HH:mm; HH:mm–HH:mm` using the existing
    emphasized transition-text styling.
- Remove compact-summary transition prose (`Visible before`, `Visible until`,
  and similar), total above-horizon time, and selected equipment name.
- Preserve truthful no-mask messaging without claiming obstruction visibility.

## Target ranking and equipment suitability

- Remove the 90-percent frame-fit rejection. Large targets remain eligible
  because mosaics are valid.
- With selected equipment, reject only known-size targets whose angular minor
  axis spans fewer than 60 sensor pixels. Unknown-size targets remain eligible.
- The equipment-filter summary contains its title and exactly
  `min. minor axis: 60px`; remove the remaining explanatory and rejection-count
  prose from that section.
- Targets with unknown angular size sort after every known-size target regardless
  of duration.
- Known-size targets sort by total usable dark duration descending, then by
  apparent angular area (`major axis × minor axis`, using the major axis for a
  missing minor axis) descending. Remaining ties use deterministic prominence,
  name, and ID order.
- Unknown-size targets sort among themselves by total usable dark duration and
  then deterministic prominence, name, and ID order.
- Target rows retain the visible-through-local-obstructions duration, now based
  only on astronomical-darkness overlap, and display the corresponding dark
  intervals.

## Target search and category filter

- Add an inline search field above the target rows. It matches catalogue numbers
  case-insensitively and ignores spaces, so inputs such as `M31`, `M 31`,
  `NGC224`, `IC 10`, and `C14` match the target's catalogue memberships/ID.
- Add one contiguous segmented multi-select with `Galaxies`, `Nebula`, and
  `Star Clusters`. The left and right segments own the outer rounded corners;
  there is no gap between segments.
- All three segments are pressed by default. Pressing a segment toggles it
  independently; zero selected categories yields an empty filtered list rather
  than silently restoring all.
- Catalogue type mapping:
  - Galaxies: `G`, `GPair`, `GTrpl`, `GGroup`;
  - Nebula: `PN`, `Neb`, `HII`, `RfN`, `SNR`, `EmN`;
  - Star Clusters: `OCl`, `GCl`, `Cl+N`, `*Ass`.
- To preserve the current default list, catalogue types outside these mappings
  remain visible only while all three categories are selected. Narrowing the
  category selection excludes those other types.
- Search/category filtering is local and immediate over progressively available
  ranked results; it does not restart astronomy calculations.

## Accessibility, performance, and failure behavior

- Icon-only controls retain explicit accessible labels and at least 44 × 44
  touch targets.
- Segments expose button role and selected/pressed state. Search exposes a clear
  catalogue-search label and appropriate text-input behavior.
- Existing calculation progress, cancellation, retry, selection handoff, and
  local-only behavior remain intact.
- Darkness calculation and interval intersection are bounded by the existing
  maximum 24-hour observing window. No dependency or storage migration is
  introduced.

## Acceptance and verification

- Unit tests cover darkness boundaries/intersection, three-way trajectory
  grouping, dark-time ranking, unknown-size ordering, mosaic eligibility,
  catalogue-number matching, and category mapping.
- Screen tests cover the eye menu, simplified opacity sheets, icon actions,
  compact target summary, search, segmented multi-select, and equipment copy.
- Root format/typecheck/lint/test/build gates pass for the intended state.
- Exact-release Android QA covers representative and constrained phone
  viewports, menu/sheet navigation, sliders at zero, selected-target summary,
  trajectory colors, target search, category combinations, and list selection
  handoff.
