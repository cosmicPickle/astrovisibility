# Atlas Focus, Profile Setup, and Optics Controls Specification

Timestamp: 2026-08-28 09:54 +03:00 (Europe/Sofia)

## Purpose

Make target selection immediately useful in the Sky View, move optical-frame
orientation to its correct atlas-level ownership, and simplify observing-profile
and optics setup without weakening local-first location and time correctness.

## Scope and decisions

### One-shot target focus

1. Tapping a rendered target, or selecting one in View All Targets, issues one
   camera-focus request after the target's horizontal position is known.
2. The target is placed at the centre of the Sky View. Because the selected
   optics frame is screen-centred, this also centres the target in that frame
   when an optics profile is selected.
3. The current atlas zoom is retained. Selection does not track the target or
   reapply focus when time, trajectory calculation, or unrelated state changes.
4. Panning and pinch zoom remain immediately available after the focus action.

### Sky View optics controls

1. A telescope icon is placed immediately to the right of the existing eye icon
   at the bottom-left of the Sky View.
2. It opens an Optics menu containing:
   - a labelled current-optics dropdown backed by the saved configurations;
   - an Orientation action displaying the current angle.
3. Orientation opens a commit-on-release slider over 0–180 degrees. A rectangle
   is visually identical at 0 and 180 degrees, so this range exposes every unique
   frame orientation without duplicate endpoints.
4. Orientation is dynamic Sky View state, defaults to 0 degrees on each screen
   mount, and is not stored in an equipment configuration or profile.
5. Optics selection remains persisted per observing profile. The optics selector
   is removed from the eye/view-options menu.

### Observing-profile setup

1. Placeholder text is removed from all observing-profile fields.
2. Profile name remains the first field.
3. Location uses a single-select `Current | Custom` segmented control:
   - New-profile setup starts on Current and requests foreground location on
     mount.
   - Granted location fills latitude, longitude, elevation, and accuracy while
     keeping those fields hidden.
   - Denial or an unavailable position switches to Custom and reveals the three
     coordinate fields.
   - Pressing Current always performs a fresh foreground-location request; a
     failed request returns to Custom.
   - Editing an existing profile starts in Custom because historical records do
     not retain whether coordinates came from the device and must not be silently
     overwritten.
4. The old location-helper card and button are removed.
5. Timezone uses a separate `Current | Custom` segmented control:
   - Current uses the phone clock's valid IANA timezone and hides the field.
   - Custom reveals an offline dropdown of packaged IANA timezone identifiers.
   - Existing profiles start on Current only when their saved timezone matches
     the current device timezone; otherwise they start on Custom.
6. Permission denial, location failure, invalid manual coordinates, and save
   failure remain recoverable without losing entered values.

### Optics setup and data migration

1. Optics fields use compact inline suffixes: focal length `mm`, aperture `mm`,
   and pixel size `µm`.
2. Physical sensor width/height inputs are replaced by integer pixel resolution:
   `width × height px`.
3. Field of view derives physical sensor dimensions from resolution multiplied by
   pixel size; existing suitability and preview calculations consume that same
   authoritative derivation.
4. Frame rotation is removed from create/edit forms and from the domain equipment
   record.
5. A forward SQLite migration adds resolution columns and backfills existing
   configurations by rounding `sensor millimetres × 1000 / pixel size µm`.
   Existing physical-dimension and rotation columns remain as legacy storage
   columns required by the original table contract, but new domain reads ignore
   rotation and writes store derived dimensions with legacy rotation zero.
6. No existing observing profiles, optics configurations, panorama, or masks are
   deleted.

### Timezone dependency

Adopt `@vvo/tzdb` 6.198.0 for the offline timezone selector. It is a focused,
zero-dependency, MIT-licensed package designed for timezone select menus and
contains grouped IANA identifiers and aliases. JavaScript `Intl` remains the
authority for validating and applying the selected timezone; no runtime network
access is introduced. The larger legacy `moment-timezone` package is not adopted
because the app does not need a second date/time engine.

## Non-goals

- No target tracking or camera lock.
- No motorized telescope control, sensor-derived camera orientation, or
  persistence of atlas orientation.
- No automatic location refresh after profile creation.
- No change to target ranking, mask calculations, panorama geometry, or the
  observing-time model.

## Acceptance criteria

- Regression tests prove one focus request per selection and ordinary gesture
  navigation afterward, including list-selection handoff.
- Optics selection and orientation controls are reachable from the new telescope
  icon; orientation changes the rendered frame without changing stored optics.
- New-profile permission grant and denial flows, Current/Custom toggles, hidden
  fields, timezone dropdown, and absence of placeholders are tested.
- Equipment form/parser and migration tests cover resolution derivation,
  validation, existing-record conversion, and absence of frame rotation.
- Format, typecheck, lint, affected tests, full tests, Android build, and
  representative plus constrained-phone visual QA are completed.
- Work is committed and pushed directly to `main` in focused commits.

## Privacy, performance, and security

- Location is requested only on the new-profile screen or a direct Current tap;
  it is stored only when the user saves the profile and is never logged.
- Timezone data is bundled read-only and requires no permission, service, or
  network request. Dropdown filtering is local and bounded by the packaged list.
- Programmatic focus updates the existing camera shared value once and does not
  introduce per-frame React state work.
- Resolution inputs are finite, positive, bounded integers before persistence or
  field-of-view calculation.
