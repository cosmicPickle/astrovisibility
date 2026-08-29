# Active Tasks

## Registered sky background

**Started:** 2026-08-29 18:51 +03:00 (Europe/Sofia)

**Controlling specifications**

- `astro-visibility-spec.md`
- `docs/superpowers/specs/mobile/2026-08-29-1851-registered-sky-background.md`
- `docs/superpowers/specs/mobile/2026-08-20-0942-stellarium-sky-engine-rewrite.md`
- `docs/superpowers/decisions/mobile/2026-08-19-2221-planetarium-renderer.md`

**Objective and acceptance**

Implement the approved offline registered-sky stack: Gaia diffuse atlas, real
stars, Western constellation figures, and bounded selected-target Pan-STARRS
imagery behind the existing panorama/mask, while preserving complete vector
target and trajectory behavior above it. Every source must satisfy the owner's
open, free-commercial-use, established, safe, and attributed boundary.

**Checklist**

- [x] Record the approved focused specification and exact layer order.
- [x] Validate and pin data-source revisions, licences, request parameters, and
      checksums; reject any source that fails the approval boundary.
- [x] Add failing pure tests for deterministic data transforms and celestial
      image/star/constellation geometry.
- [x] Implement and verify the offline asset generation/check pipeline.
- [x] Integrate Gaia, stars, constellations, and selected DSO imagery into Skia
      in the approved render order.
- [x] Extend About and licences plus the technology/data registry.
- [x] Run the mandatory automated quality gates in final-state order. Format,
      typecheck, lint, all 353 tests, asset validation, and build pass.
- [x] Perform representative and constrained Android visual QA.
- [x] Build and inspect the 187,219,713-byte release APK and record emulator
      diagnostics.
- [x] Review security, privacy, attribution, and the final diff.
- [ ] Validate the 50 fps p95 performance target on a representative physical
      Android device, then remove this task entry.

**Current step**

Connect a representative physical Android device and run the registered-sky pan,
zoom, selection, and overlay performance acceptance pass.

**Blockers and decisions**

- Physical-device performance evidence depends on a suitable connected device;
  only the headless emulator was available. Its software-rendered frame timing is
  diagnostic and does not substitute for the required physical-device result.
- Pan-STARRS coverage gaps intentionally fall back to existing vector targets.
