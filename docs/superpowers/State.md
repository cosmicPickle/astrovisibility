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
stars, Western constellation figures, and real offline survey imagery for at
least all 110 Messier objects plus a documented curated set of the most notable
non-Messier objects, especially famous named nebulae, galaxies, and clusters,
behind the existing panorama/mask. Preserve complete vector target and
trajectory behavior above it. Pan-STARRS may supply objects inside its
footprint; any required-object coverage gap needs another owner-approved open,
free-for-commercial-use, established, safe, and attributed source rather than
silently falling back to vector-only rendering.

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
      typecheck, lint, all 362 tests, asset validation, and build pass.
- [x] Perform representative and constrained Android visual QA.
- [x] Build and inspect the 192,161,865-byte release APK and record emulator
      diagnostics.
- [x] Review security, privacy, attribution, and the final diff.
- [x] Correct the 12-hour d3-celestial constellation registration error, verify
      Cygnus against Deneb, and bundle a selected NGC 7000 survey cutout.
- [x] Expand real offline DSO imagery from the 14-object proof set to at least
      all 110 Messier objects and a curated set of the most notable named
      non-Messier DSOs, including famous nebulae, galaxies, and clusters.
      Document the prominence criteria and exact membership, common-name and
      catalogue identity mapping, source coverage, licences, download
      validation, and total asset/APK cost.
- [x] Repeat automated checks and Android visual QA for the registration fix.
- [ ] Validate the 50 fps p95 performance target on a representative physical
      Android device, then remove this task entry.

**Current step**

The focused specification, deterministic selection tests, generated runtime
asset map, and manifests cover 289 physical targets: all 110 Messier
designations across 109 physical records, all 109 Caldwell targets, and 71
additional notable named DSOs. Asset validation passes for 223 Pan-STARRS and 66
AllWISE cutouts totalling 4,847,515 bytes. Final automated gates pass all 362
tests, the refreshed release APK is 192,161,865 bytes, and representative plus
constrained Android inspection confirms the corrected Cygnus figure and a
registered NGC 7000 survey cutout.
The remaining step is the physical-device frame-rate measurement.

**Blockers and decisions**

- Physical-device performance evidence depends on a suitable connected device;
  only the headless emulator was available. Its software-rendered frame timing is
  diagnostic and does not substitute for the required physical-device result.
- Pan-STARRS does not cover every required object. The official all-sky AllWISE
  colour HiPS, ODbL-1.0 and derived from NASA/IPAC WISE Atlas imagery, is the
  approved deterministic fallback. Non-selected catalogue objects continue to
  use complete vector behavior.
