# DSO Colour and Render Performance

**Timestamp:** 2026-08-31 14:57 +03:00 (Europe/Sofia)

## Purpose

Correct the misleading false-colour and channel-coverage artifacts in bundled
DSO imagery, and improve real-time Sky View interaction without reducing
astronomical content or changing existing behavior.

## Diagnosis

- Skia samples each JPEG through an unmodified image shader. It does not apply
  a color matrix, tint, blend mode, or channel conversion.
- The current Pan-STARRS `i/r/g` composite places the r band in the green RGB
  channel and has conspicuous multi-band coverage artifacts in representative
  nebula cutouts. The AllWISE fallback is a scientifically valid infrared
  false-colour composite, not a natural optical presentation.
- Representative CDS DSS2 colour cutouts are consistently optical and remove
  the purple/green channel holes seen in NGC 7000, M42, M31, and Eta Carinae.
- The current native gesture publishes a JS preview for every gesture sample.
  Static star and image-mesh directions are also converted from angles with
  repeated trigonometry during every rendered camera frame.

## Source decision

- Use `CDS/P/DSS2/color` for every registered DSO cutout. The CDS HiPS record
  identifies the product as a full-sky optical colour composition, assigns
  ODbL-1.0 to the HiPS, and supplies the required DSS/STScI acknowledgement.
- Keep deterministic 256 x 256 offline JPEG cutouts, exact catalogue centres,
  existing fields of view, checksums, response bounds, and zero runtime network
  access.
- Update the data registry and in-app licence/attribution copy. Retain source
  provenance in the generated manifest.
- This decision supersedes the DSS deferral in the 2026-08-29 registered-sky
  specification based on the explicit current CDS HiPS licence record and the
  user's standing approval for open, commercially usable, established sources.

## Behavior-preserving performance scope

- The UI-thread camera remains live on every gesture event. JS resident-cache
  previews may be sampled because catalogue and star residents already include
  overscan, and the final camera is always published on gesture end.
- Precompute unit vectors when static horizontal stars and mesh directions are
  created. Use a mathematically equivalent stereographic unit-vector projection
  in frame-critical paths.
- Reuse one camera projection context while combining atlas meshes instead of
  recomputing camera-centre and scale values per tile.
- Preserve coordinates, layer order, opacity, DSO and star thresholds, labels,
  selection, zoom range, constellation behavior, panorama/mask behavior, and
  all target/trajectory functionality.
- Add no runtime dependency, permission, service, persistence, or telemetry.

## Verification

- Test source selection, complete Messier/Caldwell/notable coverage, URL
  determinism, and asset checksums.
- Test that prepared unit-vector projection matches the existing public
  projection within a sub-pixel numerical tolerance across representative
  directions and cameras.
- Test that continuous camera updates remain native while JS previews are
  bounded and a final preview/commit is always delivered.
- Run format, typecheck, lint, focused tests, the complete suite, asset checks,
  and production build in final-state order.
- Inspect representative northern and southern DSOs, wide and close star
  fields, panning, zooming, DSO reveal, panorama/mask overlays, and selected
  target behavior at representative and constrained Android viewports.
- Physical-device 50 fps p95 evidence remains required. Emulator timing is
  diagnostic only.

## Source evidence

- CDS DSS2 HiPS record: `https://alasky.cds.unistra.fr/MocServer/query?ID=CDS/P/DSS2/color&fmt=html&get=record`
- MAST DSS acknowledgement/copyright record:
  `https://archive.stsci.edu/dss/copyright.html`
