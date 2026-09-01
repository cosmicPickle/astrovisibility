# Compact Observing Controls

**Timestamp:** 2026-09-01 12:47 +03:00 (Europe/Sofia)

**Status:** Approved from direct product direction

**Controlling specifications:** `astro-visibility-spec.md` and
`docs/superpowers/specs/mobile/2026-09-01-1201-observing-controls-layout-refinement.md`

## Outcome

Make the observing-window controls materially more compact while keeping their
interaction clear and preserving accessible touch targets.

## Requirements

- Show the selected local time as `DD/MM/YYYY HH:MM (Condition)` on one centred
  line. Day and month are zero-padded and use the observing location's civil
  timezone.
- The combined date/time line remains the calendar toggle. The parenthesized
  condition is informational and is no longer the shooting-conditions toggle.
- Render the centred control row in this order: previous day, reset to now,
  shooting conditions, next day.
- Use a generic sliders/settings-style icon for shooting conditions so future
  condition types are not represented as Moon-only.
- The shooting-conditions icon toggles the existing expandable conditions panel.
- Reduce vertical space between the date/time, icon row, optional panel, slider,
  and marker lines. Reduce visual spacing between icons to 8 points.
- Compact visual controls must retain at least a 44-point effective touch area
  through their bounds and/or hit slop.

## Performance and compatibility

- Add no dependency, permission, persistence, network, or astronomy calculation.
- Preserve the existing condition-track memoization and day-navigation behavior.
- Preserve screen-reader labels for calendar, time navigation, conditions, and
  the slider.

## Verification

- Add component coverage for exact date/time formatting, parenthesized condition,
  control order, and conditions-panel toggling.
- Run format, typecheck, lint, all tests, and build.
- Perform representative and constrained Android visual QA with the panel closed
  and open.
- Build and stage a fresh Android release APK for testing.
