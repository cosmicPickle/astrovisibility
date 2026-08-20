# Panorama Capture Footprint Geometry

**Timestamp:** 2026-08-20 22:27 +03:00 (Europe/Sofia)
**Status:** Approved by direct owner correction

## Purpose

Make the live panorama-capture ghost and accepted green footprints use one
stable, geometrically consistent camera frame. Correct the remaining sensor
jitter, screen-space tilt direction, edge clipping, and altitude-limit model.

This specification supersedes the centre-based altitude-limit and stretched
guide assumptions in the 2026-08-20 21:11 capture-stability specification.

## Coordinate and field-of-view model

- The unfolded guide remains equirectangular: azimuth increases left-to-right
  from true north and altitude increases bottom-to-top.
- The guide uses equal screen scale per angular degree on both axes. A 62° by
  46.5° camera footprint therefore appears at its true 4:3 angular aspect ratio
  before rotation.
- The v1 approximate capture camera model is one shared 62° horizontal by 46.5°
  vertical field of view. Live guidance and newly accepted camera/import tiles
  use these exact constants; image pixel orientation or aspect ratio does not
  invent a different optical field of view.
- Android/Expo positive roll is converted to the opposite SVG screen-space sign
  because SVG's Y axis points down. Live and accepted guide footprints use the
  same conversion.
- The guide reserves internal angular padding equal to half the camera-frame
  diagonal above the zenith and below the horizon. The 0°–90° sky grid remains
  explicit, while the complete rotated ghost remains visible instead of being
  cropped into a changing shape.

## Capture limits

The valid capture band is 20°–80° altitude, inclusively, for the entire rotated
camera footprint—not its centre.

For a footprint with horizontal field `w`, vertical field `h`, and roll `r`, its
vertical half-extent in the unfolded guide is:

`abs(cos(r)) * h / 2 + abs(sin(r)) * w / 2`

Capture is allowed only when:

- `centre altitude - vertical half-extent >= 20°`; and
- `centre altitude + vertical half-extent <= 80°`.

Otherwise the ghost and camera reticle are red, the message asks the user to aim
higher or lower, and the camera shutter remains disabled. Import remains
available.

## Stability

- Preserve circular north-wrap and 180° axial roll handling.
- Reduce the low-pass interpolation factor and increase small-motion deadbands
  so a stationary device does not visibly drift or twitch.
- Sample device motion at 50 ms while capture is active so intentional movement
  remains visually smooth despite the stronger filter.
- Do not persist or log additional sensor data.

## Acceptance criteria

1. A 62° × 46.5° zero-roll ghost has the same angular scale on X and Y and keeps
   the same full dimensions at the horizon, middle sky, and zenith.
2. A positive Android roll produces the correct opposite SVG rotation direction.
3. A newly accepted green footprint has the same width, height, and rotation as
   the live ghost for the same orientation, including portrait source images.
4. The complete ghost stays visible throughout the sensor's 0°–90° centre range
   and does not become square through boundary clipping.
5. Limits use the rotated footprint's lowest and highest edges; equality at 20°
   and 80° is valid.
6. Low/high error copy explicitly says the whole camera frame must remain within
   20°–80°.
7. Stationary heading/altitude/roll noise is less visible without making
   intentional physical movement discontinuous.
8. Existing seam splitting, durable drafts, review, imports, save, panorama, and
   mask behavior remain intact.

## Verification

- Add failing-first pure tests for equal-scale/unclipped geometry, screen roll
  sign, rotated edge limits, shared FOV, and stronger smoothing.
- Add component coverage proving a portrait source persists the shared FOV and
  edge-invalid capture remains blocked.
- Run focused capture/panorama tests and repository quality gates.
- Build and install a release APK; visually inspect representative and
  constrained Android phone viewports. Physical sensor smoothness and tilt
  direction require final owner confirmation because the emulator cannot
  reproduce a held phone pose.

## Privacy, security, and compatibility

No dependency, permission, schema, migration, network, or logging change is
required. Existing saved revisions remain readable. Newly captured tiles use
the corrected shared FOV; no destructive rewrite of completed user panoramas is
performed.
