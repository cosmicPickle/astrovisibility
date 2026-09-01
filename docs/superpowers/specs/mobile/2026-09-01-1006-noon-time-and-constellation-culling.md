# Noon-Centred Time Controls and Constellation Culling

**Timestamp:** 2026-09-01 10:06 +03:00 (Europe/Sofia)

**Status:** Approved from direct product direction
**Controlling product specification:** `astro-visibility-spec.md`

## Purpose

Make constellation figures useful and cheap to render, and replace the generic
midnight-to-midnight time slider with a Stellarium-style observing-day control
that communicates daylight, twilight, astronomical darkness, and moonlight.

## Constellation requirements

- A constellation figure is eligible only when every figure vertex projects
  inside the drawable sky canvas and its projected bounding rectangle covers at
  least 10% of the canvas area.
- The initial 10% threshold is a named constant so it can be tuned later.
- Labels are selected only from eligible figures and retain the existing
  edge/collision rules.
- Ineligible constellations are removed before the Skia scene is built. Their
  line vectors and paths must not be mounted or recomputed while the camera
  moves.
- Eligibility is refreshed from the existing sampled camera-preview path and
  exactly on gesture completion. Do not add a per-frame JS bridge call.
- The opacity setting continues to govern both eligible figures and labels.

The 10% measurement uses the figure's projected bounding rectangle, not the
total ink area of its thin strokes. Empty figures are never eligible.

## Noon-centred observing day

- A date selected as `2026-05-01` owns the local-civil interval from 12:00 on
  1 May through 12:00 on 2 May, with the end exclusive. The last selectable
  minute is 11:59 on 2 May and midnight is exactly at the slider midpoint.
- This is a 24-hour wall-clock track, not a 36-hour interval. This interpretation
  is required for midnight to remain centred.
- The time label includes the actual local day and time, so crossing midnight
  visibly changes from 1 May to 2 May while the date button remains the owning
  observing date.
- Selecting another date preserves the same wall-clock slider position.
- Returning to the current instant chooses the owning observing date: before
  local noon, the date is the previous civil date; from noon onward, it is the
  current civil date.
- The track exposes 1-minute selection and 15-minute accessibility increments.
  Its right edge maps to 11:59, never to the exclusive window end.
- On daylight-saving transitions, the track remains 1,440 local-civil minutes
  with midnight at 50%. A nonexistent wall-clock minute advances to the first
  valid minute; an ambiguous minute uses its earlier occurrence. The underlying
  observing interval may therefore span 23 or 25 elapsed hours, and astronomy
  calculation guards must accept up to 25 hours.

## Track appearance and annotations

- Increase only the visible track thickness; retain the current thumb size.
- Render a smooth horizontal sky-condition gradient. Daylight is light blue,
  twilight blends toward very dark blue, and astronomical night is almost
  black.
- Moonlight lifts the night colour according to the Moon's illuminated fraction
  and altitude. A Moon below the horizon contributes no light.
- Precompute 30-minute samples when the observing date, location, or window
  changes. Slider drags reuse these samples and must not run astronomy-engine
  calculations per pointer event.
- Replace `00:00`/`24:00` end labels with exact astronomical-darkness start and
  end times positioned under their corresponding track locations. Each label is
  a quiet underlined button with a generous hit area and selects that instant.
- When astronomical darkness does not occur, show a concise non-clickable
  `No astronomical darkness` note. When it spans the whole window, show
  `Astronomical darkness all day`.
- Above the track, show the actual local date/time and a smaller parenthesized
  condition: `Daylight`, `Dusk`, `Dark night`, `Moonlight`, or `Dawn`.
- Remove the `Now` and `Tonight` buttons. When the selected instant is not within
  one minute of the real clock, show a compact accessible rollback icon beside
  the time; it returns to the current instant.

Astronomical darkness remains Sun altitude at or below -18 degrees and is
independent of Moon phase.

## Shooting conditions

- Put a compact moon-and-star shooting-conditions icon beside the narrower date
  button.
- Tapping it toggles a section between the date row and time slider.
- The initial section contains a phase icon, conventional phase name, rounded
  illuminated percentage, and the first Moon rise and set inside the active
  noon-to-noon window.
- Missing rise or set events are stated plainly. Times use the observing
  profile's civil timezone.
- Phase and illumination describe the currently selected slider instant;
  rise/set describe the active observing day.

## Technology and performance

- Use the existing pinned `astronomy-engine`, `react-native-svg`, React Native,
  and Skia dependencies. Add no package.
- Moon phase uses `MoonPhase`/`Illumination`; rise and set use `SearchRiseSet`;
  Sun/Moon altitudes use the existing observer conventions.
- Keep location, time zone, UTC instants, local dates, degrees, percentages, and
  pixel areas explicit in names and module boundaries.
- Constellation selection is bounded by the 88 bundled figures and occurs only
  on sampled preview/commit state. Hidden figures incur no Skia path work.

## Acceptance and verification

- Pure tests cover the 10%/fully-in-frame culling boundary and ensure hidden
  figures are not passed to the rendered layer.
- Time tests cover ordinary noon/midnight/end mapping, date changes, current-time
  rollback, spring-forward gaps, and fall-back 25-hour windows.
- Astronomy tests cover darkness markers, day/dusk/dark/moonlight/dawn labels,
  moon phase naming/fullness, rise/set bounding, and gradient moon influence.
- Component tests cover removal of Now/Tonight, clickable darkness labels,
  thicker track, conditions toggle, phase data, and accessible rollback.
- Run format, typecheck, lint, the focused tests, all mobile tests, and build.
- Perform visual QA on a representative Android phone and a constrained phone
  viewport, checking track readability, hit targets, calendar/conditions layout,
  midnight crossing, and constellation culling while panning/zooming.

## Non-goals

- Weather, clouds, seeing, transparency, light-pollution forecasts, and imaging
  recommendations are not added.
- Moon obstruction by the user's panorama/mask does not alter sky brightness.
- The 10% constellation threshold is not user-configurable in this iteration.
