# Shared Celestial Time Transform Implementation Plan

**Timestamp:** 2026-09-01 14:45 +03:00 (Europe/Sofia)  
**Branch:** `feature/atlas-shared-time-transform`  
**Specification:**
`docs/superpowers/specs/mobile/2026-09-01-1445-shared-celestial-time-transform.md`

## Delivery sequence

### 1. Mathematical foundation

- Add pure test fixtures comparing the new worklet-safe transform with
  `equatorialJ2000ToHorizontal` over ordinary and 25-hour windows.
- Cover forward J2000-to-horizontal vectors, inverse horizontal-to-J2000
  directions, normal refraction, seams, poles, zenith, and horizon.
- Implement the smallest typed transform module that passes those fixtures.
- Benchmark transform creation and per-vector projection.

### 2. Fixed celestial geometry

- Add reusable J2000 vector preparation for catalogue targets.
- Change generated/runtime star and constellation preparation to retain fixed
  vectors.
- Retain Milky Way and DSO mesh geometry in J2000 and cache DSO mesh creation.
- Verify asset counts, identities, indices, and texture coordinates are
  unchanged.

### 3. Shared render timestamp

- Add a shared UTC-milliseconds value beside the shared camera.
- Pass one immutable window transform to the Skia scene.
- Introduce J2000 projection primitives with camera-context reuse.
- Migrate Milky Way, constellations, stars, and registered DSO image meshes one
  layer at a time, running focused tests and frame samples after each.

### 4. Stable catalogue pipeline

- Build/query catalogue residency in fixed J2000 space.
- Batch moving target marks/outlines while retaining sampled labels.
- Update inverse hit testing and target focus for the shared timestamp.
- Keep visible-target count and exact information on the coalesced JavaScript
  path.

### 5. Live slider

- Publish UI-thread/shared-value time during movement.
- Sample text, conditions, labels, and counts without queuing stale work.
- Commit the exact timestamp on release and preserve window/DST ownership.
- Verify selected trajectory stability and current-marker movement.

### 6. Verification and handoff

- Run `pnpm format`, `pnpm typecheck`, `pnpm lint`, focused/full tests, and
  `pnpm build` against the final branch state.
- Use the Android build skill for every requested test APK, without leaving the
  feature branch.
- Complete representative, constrained, and physical-device visual/performance
  QA.
- Present measured before/after results and remaining risks for owner approval;
  do not merge or return to `main` without explicit direction.
