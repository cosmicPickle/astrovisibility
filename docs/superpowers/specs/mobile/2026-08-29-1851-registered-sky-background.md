# Registered Sky Background Specification

**Timestamp:** 2026-08-29 18:51 +03:00 (Europe/Sofia)
**Status:** Approved for implementation by direct product-owner instruction on
2026-08-29

## 1. Purpose and user outcome

Make the Sky View recognisably astronomical even before a target is selected,
without introducing decorative or screen-fixed space art. The background shall
show measured sky structure, real stars, conventional constellation figures,
and bounded deep-sky survey imagery registered to the same celestial sphere as
the existing catalogue, trajectory, panorama, and visibility mask.

The result must remain responsive on realistic Android hardware, work without a
runtime network connection, and preserve Astrovisibility's local-first profile
and mask model.

## 2. Approved scope

The owner approves technologies and datasets used by this feature only when
they are open or openly licensed, free for commercial use, established in the
astronomy or open-source ecosystem, and safe to bundle after provenance and
integrity validation.

This implementation adopts no new runtime package. It adds pinned static data
and generated image assets consumed by the existing React Native Skia renderer:

- HYG v4.4 star data, under CC BY-SA 4.0, as a pinned build input;
- the d3-celestial Western constellation line dataset, under BSD-3-Clause, as a
  pinned build input;
- the Gaia DR3 colour flux map, based on ESA/Gaia/DPAC data under CC BY-SA 3.0
  IGO, converted once into a bounded offline ICRS atlas;
- Pan-STARRS DR1 public survey cutouts obtained through the established MAST/CDS
  astronomy services for a deterministic Messier subset inside the survey
  footprint.

Every adopted input shall record its source URL, pinned revision or immutable
request parameters, licence, attribution, byte size, and SHA-256 checksum. A
generated manifest shall be visible through the existing About and licences
screen.

## 3. Explicit non-goals

- No Stellarium, Aladin, WorldWide Telescope, WebView, WebGL, or second
  planetarium engine is embedded.
- No runtime astronomy download, tile service, remote cache, account, analytics,
  or new permission is added.
- The feature does not promise a photographic image for every OpenNGC target.
- Pan-STARRS coverage gaps, particularly in the southern sky, remain valid
  vector-only targets rather than being filled with decorative imagery.
- No DSS asset is used because its commercial redistribution requires separate
  permission.
- Constellation artwork and mythological illustrations are excluded.
- The feature does not change obstruction classification, target ranking,
  profile persistence, panorama alignment, or telescope suitability.

## 4. Authoritative coordinate and time model

All source astronomy uses ICRS/J2000 right ascension and declination at the app
boundary. The existing fixture-tested `equatorialJ2000ToHorizontal` adapter
converts source positions into the profile's topocentric observed horizontal
frame at the selected scene UTC instant, using the profile's latitude,
east-positive longitude, elevation, and the app's normal refraction model.

The sky background is never screen-fixed. Changing the scene instant or profile
location rebuilds its horizontal geometry. Camera pan and zoom then project the
fixed horizontal directions through the existing stereographic projector on the
render thread.

The Gaia atlas and DSO image meshes use an explicitly documented image
projection and longitude direction. Tests shall cover right-ascension wrap,
declination limits, texture orientation, centre registration, and scene-time
rotation.

## 5. Data products

### 5.1 Bright-star catalogue

The build pipeline shall transform the pinned HYG v4.4 CSV into a compact
runtime catalogue containing only finite records with:

- stable source identity;
- ICRS/J2000 right ascension and declination;
- apparent visual magnitude no fainter than 7.0;
- B-V colour index when finite;
- a proper name when supplied by the source.

The generated catalogue shall be deterministic, sorted by magnitude and stable
identity, deduplicated, bounded, and verified against a manifest count and
checksum. Star names are secondary context; the DSO naming requirements remain
owned by OpenNGC.

### 5.2 Constellation figures

Only Western constellation line geometry is imported from the pinned
d3-celestial data snapshot. Lines connect real sky coordinates. They are a
conventional chart figure and shall not be represented as official physical
boundaries or structures.

The app shall render a bounded line batch and collision-managed constellation
names. Official IAU three-letter identities and names shall be retained where
available. Constellation boundaries may be added later as a separate, default-off
layer; they are not part of this implementation.

### 5.3 Gaia diffuse atlas

The Gaia DR3 colour flux HiPS dataset
`CDS/P/DM/flux-color-Rp-G-Bp/I/355/gaiadr3` shall be converted at build time to
one bounded ICRS plate-carree atlas. The asset is a low-opacity context layer,
not a photometric analysis surface.

The atlas shall be visible at broad and medium fields of view and fade before
its finite resolution becomes distracting at close target scale. It shall not
replace individual star points or DSO catalogue identity.

### 5.4 DSO survey cutouts

Pan-STARRS DR1 colour `(i, r, g)` cutouts shall be generated deterministically
for physical Messier targets that:

- fall inside the documented Pan-STARRS footprint;
- have usable finite catalogue coordinates and angular dimensions; and
- return a valid non-placeholder survey image.

Each square cutout uses a documented ICRS projection centred on the OpenNGC
coordinate. Its field of view is derived from the target's largest angular
dimension with bounded margin, and its pixel dimensions are capped at 256 by
256. The exact generated membership and asset budget are recorded in the
manifest rather than asserted in source code.

Only the selected target's available DSO image is mounted in v1. It appears at
close field of view, below the panorama and mask. The existing angular outline,
label, hit target, and trajectory remain authoritative and visible even when an
image is unavailable or fails to decode.

## 6. Rendering order

Back to front, the Skia scene shall render:

1. solid night-sky fill;
2. Gaia diffuse atlas;
3. batched real stars;
4. constellation lines and bounded labels;
5. horizontal grid, celestial equator, and existing celestial guides;
6. selected-target DSO survey image, when available and close enough;
7. profile panorama;
8. profile visibility mask;
9. target trajectory, target angular outlines, selection, and labels;
10. ground, horizon/cardinals, and telescope field-of-view frame.

The astronomical imagery therefore sits behind the user's local surroundings
and mask, while planning information remains readable above them. A profile
with no mask continues to show the sky normally and remains explicitly
unassessed for local obstruction visibility.

## 7. Density and performance behavior

- Star points are spatially culled and rendered in bounded Skia batches; there
  shall be no React component per catalogue star.
- Star radius and opacity are deterministic functions of apparent magnitude.
- Constellation line geometry is batched and labels are suppressed at fields of
  view where they would clutter the map.
- Only one DSO survey image is decoded/mounted at a time.
- Atlas and cutout meshes have fixed maximum row, column, vertex, and triangle
  counts. Malformed data cannot trigger unbounded tessellation.
- Camera gestures remain render-thread driven. Static catalogue or asset work
  may not write camera state or cause a release-time snap.
- The final asset manifest reports source and generated byte totals. The release
  APK and representative interaction shall be measured before hand-off.

The accepted release performance target remains at least 50 fps at p95 with no
stall over 100 ms on the documented representative physical Android device.
Emulator evidence may be reported only as diagnostic.

## 8. Offline, failure, privacy, and security behavior

- Runtime rendering reads only bundled immutable assets.
- Build-time download tooling accepts only fixed HTTPS origins and exact
  request shapes, applies response-size limits, rejects HTML/error payloads,
  validates decoded dimensions and formats, and records SHA-256 checksums.
- Generated source inputs and licences are reviewed before update; the normal
  app build never silently refreshes the network.
- A missing, corrupt, or undecodable atlas, star catalogue, constellation file,
  or DSO image degrades to the remaining layers without crashing Sky View.
- No profile coordinates, scene time, panorama, mask, device information, or
  local path is sent to a service or logged. DSO assets are generated only from
  public catalogue coordinates during repository maintenance.
- Credits belong in About and licences, not persistent Sky View chrome.

## 9. Test-first implementation sequence

1. Add failing pure tests for star validation/filtering, colour/magnitude bins,
   constellation normalization, celestial atlas meshes, DSO cutout meshes, seam
   behavior, and bounded asset selection.
2. Implement deterministic build-time data transforms and manifest validation.
3. Add pinned inputs and generated runtime assets, then verify every byte.
4. Project star, constellation, atlas, and selected DSO geometry at the scene
   instant through the existing coordinate adapter.
5. Integrate layers into the established Skia scene in the specified order.
6. Extend About and licences with complete source and attribution records.
7. Run format, typecheck, lint, focused tests, the mobile/application suite, and
   build in the mandatory order.
8. Use the Astrovisibility visual-QA workflow on representative and constrained
   Android viewports, including no-mask, partial-mask, panorama+mask, dense sky,
   wide FOV, close DSO, seam, zenith, time change, and restart cases.
9. Build and inspect the exact release APK, record asset/APK sizes and frame
   diagnostics, and complete physical-device review when hardware is available.

## 10. Acceptance criteria

- The broad Sky View contains recognisable measured Milky Way structure and
  real magnitude-scaled stars at correct directions for the profile and time.
- Constellation figures stay registered to their actual stars during pan, zoom,
  time changes, north wrap, and zenith views.
- A selected Messier target with a bundled Pan-STARRS cutout shows the correct
  survey image at its catalogue centre, orientation, and documented field of
  view when sufficiently zoomed in.
- Targets without imagery retain the existing complete vector behavior without
  placeholders, fake art, broken-image chrome, or altered selection.
- Panorama and mask remain independently toggleable/adjustable and visually sit
  above astronomical imagery without changing classification.
- Target outlines, labels, FOV, and trajectory remain readable above the mask.
- No-mask and completed-partial-mask semantics remain unchanged.
- Runtime operation is offline, deterministic, and introduces no permission,
  persistence migration, or sensitive logging change.
- All adopted assets satisfy the owner's licence conditions, appear in About
  and licences, and pass manifest/checksum validation.
- Required automated, visual, build, security, and performance checks pass with
  no unexplained failure.

## 11. Sources and attribution boundary

- HYG database: <https://codeberg.org/astronexus/hyg>
- d3-celestial: <https://github.com/ofrohn/d3-celestial>
- Gaia DR3 archive/data credit: <https://www.cosmos.esa.int/web/gaia-users/archive>
- CDS HiPS registry and HiPS2FITS service:
  <https://aladin.cds.unistra.fr/hips/> and
  <https://alasky.cds.unistra.fr/hips-image-services/hips2fits>
- Pan-STARRS public archive and cutout documentation:
  <https://outerspace.stsci.edu/spaces/PANSTARRS/>
- MAST data-use policy: <https://archive.stsci.edu/publishing/data-use>

The build may use standard coordinate/projection mathematics and
Astrovisibility-owned transforms. It shall not copy GPL/AGPL planetarium engine
code or mix a survey viewer's licence with the application runtime.
