# Observing Controls Layout Refinement

**Timestamp:** 2026-09-01 12:01 +03:00 (Europe/Sofia)

**Status:** Approved from direct product direction

**Controlling specifications:** `astro-visibility-spec.md` and
`docs/superpowers/specs/mobile/2026-09-01-1006-noon-time-and-constellation-culling.md`

## Outcome

Make useful constellation figures appear sooner and turn the observing-window
sheet into one compact, centred date/time navigation surface without adding
gesture-time astronomy work.

## Constellation culling

- Reduce the named projected bounding-area eligibility threshold from 10% to 5%
  of the sky canvas.
- Preserve the fully-inside-canvas requirement and pre-Skia pruning behavior.

## Observing-window layout and interaction

Below the existing sheet title and close action, render these controls in order:

1. An optional calendar, when open.
2. One centred, bold-blue selected local date/time button without a label,
   border, or filled button surface.
3. A centred icon row for previous day, return to current time, and next day.
4. One subtle grey astronomical-condition button.
5. The expanded Moon conditions panel, when open.
6. The existing noon-centred gradient slider and darkness markers.

The selected date/time button toggles the calendar. The calendar appears above
the date/time rather than below it. The previous/next controls use skip-style
icons and move the owning observing date by exactly one local calendar day while
preserving the current wall-clock slider minute. The reset icon is always
present and reads the clock when pressed.

The astronomical condition is the only shooting-conditions toggle. It has a
subtle grey, underlined text treatment like the darkness times and expands the
Moon panel directly below itself. All icon and text controls retain at least a
44-point effective hit area and explicit accessibility labels.

## Darkness markers

- Visible marker text contains only the local time, with no `Starts` or `Ends`
  prefix.
- Both labels begin at their marker line and extend toward the right.
- Accessibility labels continue to identify darkness start versus end.

## Meaningful moonlight classification

The condition label becomes `Moonlight` only during astronomical night when all
of these initial, named thresholds are met:

- illuminated fraction is at least 35%;
- Moon altitude is at least 10 degrees;
- `illuminatedFraction * sin(altitude)` is at least 0.15.

Otherwise astronomical night is `Dark night`. These thresholds are a practical
display classification, not an exposure or limiting-magnitude forecast. The
gradient remains continuous and Moon-aware below the label threshold.

## Performance and compatibility

- Add no dependency, permission, network use, or persisted-data change.
- Reuse the existing 49-sample condition track. Do not calculate Sun/Moon state
  during slider gestures.
- Reuse the existing civil-time resolver for day changes, DST gaps, and
  ambiguous local times.
- Preserve selected time, owning date, trajectory, and target-list updates
  through the existing `ObservingWindowChange` contract.

## Verification

- Unit tests cover the 5% threshold and the meaningful-moonlight boundaries.
- Component tests cover unified date/time calendar opening, previous/reset/next
  day behavior, condition-panel toggling, control order, and time-only markers.
- Run format, typecheck, lint, all tests, and build.
- Perform Android visual QA at representative and constrained phone viewports,
  including calendar-open, conditions-open, previous/next/reset, marker
  alignment, and constellation visibility while zooming.
- Build and stage a fresh release APK for user testing.
