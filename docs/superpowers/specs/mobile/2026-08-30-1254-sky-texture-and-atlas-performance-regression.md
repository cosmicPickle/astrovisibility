# Sky Texture and Atlas Performance Regression

**Timestamp:** 2026-08-30 12:54 +03:00 (Europe/Sofia)

## Status and authority

Approved for implementation by the product owner's direct regression report.
This correction supplements the registered-sky specifications and supersedes
only the 256 x 128 Gaia atlas, runtime blurred-star halo, and field-of-view-only
DSO fade decisions in `2026-08-30-1034-sky-visuals-and-mask-modes.md`.

## Purpose

Restore a smooth, credible sky and responsive atlas without losing the improved
star intensity or the requirement to show every useful in-frame DSO image.

## Requirements and acceptance criteria

- Replace the still-spotted Gaia flux map with Stellarium's pinned 2048 x 1024
  full-sky Milky Way panorama by Axel Mellinger. It is real registered sky
  imagery, Stellarium records permission to modify and redistribute it with
  attribution, and it is pinned by commit and checksum. Keep linear mipmap
  sampling and do not add a runtime full-canvas blur.
- Keep one batched halo and one batched core per star style, but render the halo
  as a larger translucent path rather than a GPU blur image filter. Project each
  star only once per camera update.
- Gate DSO cutout mounting by approximate on-screen angular diameter: hidden
  below 32 pixels, smoothly fading to 90 percent opacity at 96 pixels. This
  applies equally to selected and unselected objects; no arbitrary object cap is
  allowed.
- Keep all previously approved zoom, constellation, optics-summary, panorama,
  mask-mode, persistence, catalogue, and coordinate behavior unchanged.
- Add pure regression tests for pixel-footprint DSO gating and the inexpensive
  star halo style. Run the full mobile quality gates and inspect representative
  and constrained Android viewports.

## Performance and safety

- Camera motion must not invoke a Skia blur mask over the compound star paths.
- DSO images too small to convey survey detail must not mount or decode.
- The offline atlas may increase compressed APK size back to its prior bounded
  value; there is no runtime network access, new dependency, permission, or user
  data flow.
- Physical-device 50 fps p95 evidence remains tracked separately in
  `docs/superpowers/State.md`; emulator inspection is diagnostic only.
