# Sky View Major UX Verification

**Verified:** 2026-08-20 13:25 +03:00 (Europe/Sofia)

## Outcome

The Sky View now keeps the accepted smooth stereographic navigation while
rendering the complete celestial sphere behind an opaque black local ground
plane. A selected imaging setup is always drawn as its real spherical
tangent-plane sensor footprint, trajectories use exact hourly labels, and the
observing-window sheet is a direct date/time controller for a fixed 24-hour day.

## Projection and geometry

- Catalogue positions are retained for the complete sphere. Below-horizon
  targets remain non-interactive and are hidden by the projected ground plane.
- The default view is centred on the zenith at 180 degrees so the complete
  horizon dome is visible. Panning below the horizon correctly moves the opaque
  ground through the viewport instead of discarding the other hemisphere.
- North, east, south, and west are rendered in fixed 20 px bold red text after
  the ground layer, independent of atlas zoom.
- The imaging footprint is formed in the gnomonic sensor plane using the setup's
  horizontal and vertical angular field of view and camera rotation, then mapped
  back to unit sky directions and through the active planetarium projection.
  This replaces the former screen-space rotated ellipse approximation.
- The footprint follows the live view centre without a selected target and the
  selected target when one exists. It remains available independently of the
  trajectory calculation.
- Existing panorama and mask paths keep their horizontal spherical coordinates
  and active projection; the ground is a separate render layer, so their
  alignment and obstruction classifications are unchanged.

The projection decisions were checked against Stellarium's official source,
including its separate stereographic/fisheye projector selection and projected
rectangular field-of-view behavior:

- <https://github.com/Stellarium/stellarium/blob/master/src/core/StelCore.cpp>
- <https://github.com/Stellarium/stellarium/blob/master/ChangeLog>

## Date, time, and trajectories

- The selected local date owns a fixed 24 elapsed-hour calculation window from
  resolved local midnight. Midnight DST gaps and repeated civil times use the
  existing explicit timezone resolver.
- The time-of-day slider updates the atlas immediately without reloading local
  persistence or restarting an unchanged trajectory calculation.
- The date opens an in-sheet calendar. `Now` reads the system clock at press
  time; `Tonight` derives the current local astronomical-night fallback at press
  time.
- Trajectory markers are emitted and labelled only at exact local clock hours.
  DST repeats and skipped hours retain their correct UTC instants.

## Automated verification

Final repository gates, run after the last source change:

- `pnpm format`
- `pnpm typecheck`
- `pnpm lint`
- `pnpm test`: 53 suites, 244 tests
- `pnpm build`: catalogue integrity check and Expo Android production export
- Native Android `assembleRelease`: 669 actionable tasks, successful

Regression coverage includes tangent-plane FOV dimensions/rotation/zenith,
complete-sphere catalogue retention, ground/cardinal contracts, projection edge
visibility, exact hourly markers across ordinary and DST days, fixed 24-hour
windows, calendar selection, live slider updates, fresh-clock Now/Tonight, and
Sky View reprojection without storage reload.

## Release visual verification

The exact staged release was installed on the API 36 Pixel 8 emulator and
exercised at both 1080x2400/420 dpi and 720x1600/320 dpi.

Passed checks:

- full zenith-centred horizon dome and opaque below-horizon ground;
- panning from zenith through the horizon and below the ground plane;
- all four fixed-size red cardinal labels at wide and panned views;
- persistent selected `SkyFOV` footprint without a selected target;
- selected target with a correctly projected trajectory and hourly labels;
- live slider reprojection, calendar date change, and fixed-period copy;
- constrained sheet layout, scrolling, controls, and Android back dismissal;
- no fatal, ANR, Android runtime, or React Native error in the inspected log.

## Artifact

- Path: `tmp/artifacts/android/app-release.apk`
- Size: 184,927,686 bytes
- SHA-256: `E91F8E46DDFBBFDEB2D1C7BF2A81C9FA85BDA78C9D821DB77D72D9BDEFF496F2`

No dependency, permission, schema, network, or sensitive-data surface changed.
