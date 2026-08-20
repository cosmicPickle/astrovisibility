# Sky Navigation Stabilization Verification

**Timestamp:** 2026-08-20 16:36 +03:00

## Outcome

The Sky View now opens in a practical local-horizontal view centred on north at
35 degrees altitude and 100 degrees stereographic FOV. The north-to-zenith
meridian is straight, the zenith remains visible, and the horizon is below the
view centre rather than presented as a maximum all-sky disk.

Ground occlusion no longer closes a sampled horizon path. It uses the analytic
stereographic projection of the local horizon: a circle away from the horizon
and a clipped half-plane when the camera lies on it. This removes wrong-side
fills, closure chords, and viewport-spanning black flashes while looking above,
along, or below the horizon.

One-finger pan now derives every frame from the gesture-start camera and pointer
instead of accumulating event-to-event error. A bounded 3D grab-and-move solve
avoids azimuth singularities at the zenith/nadir, re-levels in the retained
mount frame, never changes FOV, and commits exactly the final held preview. The
pan recognizer is limited to one pointer so two-pointer pinch cannot leak zoom
or residual pan into release.

## Automated verification

- New regressions were observed failing before production changes for the
  initial camera, analytic ground clip, event-rate-independent pan, single
  release commit, unchanged FOV, and zenith pole escape.
- `pnpm format`: passed.
- `pnpm typecheck`: passed.
- `pnpm lint`: passed.
- `pnpm test`: 53 suites and 257 tests passed.
- `pnpm build`: production Android Expo export passed.
- Native `assembleRelease`: passed, 669 actionable tasks.
- `git diff --check`: passed after final documentation cleanup.

## Visual QA

Visual QA passed with the exact release APK on the API 36 Pixel 8 emulator at:

- 1080 x 2400 at 420 dpi;
- constrained 720 x 1600 at 320 dpi.

The pass covered cold Sky View entry, north-facing initial framing, repeated
horizontal pan/release, pan into the zenith, pan back out of the coordinate pole,
above-horizon and horizon-adjacent ground states, and constrained-screen layout.
The projected ground remained coherent and no release snap or accidental zoom
was observed. Logcat contained no fatal exception, ANR, or React Native error.

The headless software-rendered emulator diagnostic over the dense gesture pass
was p50 27 ms and p95 46 ms, with no frame above 61 ms. This is diagnostic rather
than a physical-device performance claim; the correction targets the reported
random state jumps and release discontinuity rather than claiming that a
headless emulator represents device frame pacing.

## Artifact

- Path: `tmp/artifacts/android/app-release.apk`
- Size: 184,931,174 bytes
- SHA-256: `2ED4014E65676AF58D128D05CFD7630A1133E33BB5DA50A801AFDB3AED1B8029`

## Security and compatibility review

No dependency, permission, persistence schema, import boundary, remote service,
or sensitive-data logging changed. Ground and pan calculations are bounded pure
numeric work; the pan correction uses at most four small vector iterations per
gesture update. Existing panorama, mask, trajectory, catalogue, and FOV data
continue through the shared horizontal projection without data migration.
