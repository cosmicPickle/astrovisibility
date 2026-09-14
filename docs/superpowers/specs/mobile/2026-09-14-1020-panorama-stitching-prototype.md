# OpenCV panorama stitching prototype

**Timestamp:** 2026-09-14 10:20 +03:00 (Europe/Sofia)
**Status:** Prototype authorized by the user's instruction to proceed with the
recommended library-based proof; Android product integration is a later stage.

## Outcome and boundary

Prove that OpenCV can automatically align and blend photographs and produce one
2048 by 2048 RGBA panorama in Astrovisibility's existing
azimuthal-equidistant upper-hemisphere projection. Keep capture, mask editing,
existing saved data, Android dependencies, and active product UI unchanged in
this evaluation. This is an offline desktop engineering tool, not a shipped
capture feature or proof of mobile performance.

The controlling product document is `astro-visibility-spec.md`; the current
image contract is in
`docs/superpowers/specs/2026-08-21-1613-single-panorama-alignment-and-raster-mask.md`.
The user confirmed upward views and a single final image and explicitly expects
an existing library to perform stitching.

## Implementation and acceptance checklist

- [x] Use OpenCV's feature matching and camera estimation, not custom matching.
- [x] Use OpenCV exposure compensation, seam finding, and multiband blending.
- [x] Map recovered cameras into the current atlas with a supplied sensor anchor.
- [x] Keep absolute sensor anchoring distinct from relative visual alignment.
- [x] Preserve binary capture coverage independently of color blending; no
      fabricated pixels, opaque uncaptured sky, or extrapolated visible areas.
- [x] Support a single tile, partial coverage, north wraparound, roll, and zenith.
- [x] Reject incomplete matches explicitly instead of silently dropping images.
- [x] Test deterministic geometry and synthetic known camera rotations before
      interpreting photographic results. No product accuracy claim is inferred
      from synthetic acceptance tolerances.
- [x] Produce and visually inspect one single-image photographic result and
      an upward-view directional result, with measured desktop time and memory.
- [x] Record sample limitations and the remaining Android integration work.

## Scope of the proof

Compare graph-cut and dynamic-programming seam finders supplied by OpenCV;
retain six-band multiband blending for both. Use at most 12 images, decode at
most 40 MP per image (12,000 pixels per edge),
downsample each input to at most 1024 pixels per edge, and cap composition at
2048 square. Those are prototype resource limits, not a reduction of the app's
200-tile contract. Registration is capped at 0.6 MP. Camera parameters and all
image coordinates must use the same downsampled resolution.

Camera convention: source image x points right, y points down, z forward.
World directions follow the app: x east, y up, z north; azimuth increases east
from north. The reference tile supplies azimuth, altitude, and roll. OpenCV
supplies relative camera rotations and intrinsics. One rigid frame transform
anchors the recovered cameras to the reference; it cannot remove absolute
compass error. Disable automatic panorama leveling, since it can discard the
intentional upward orientation. Source lens distortion and camera motion must
be evaluated with real device captures before shipping.

OpenCV's built-in `Stitcher` estimates relative cameras. The prototype converts
those cameras to atlas sampling maps, then calls library compensation, seam,
and blending components. This adapter is needed because the app's projection
is not the default rectangular panorama output. Python and NumPy are available
in the bundled desktop runtime; `opencv-python-headless==4.13.0.92` is installed
only into ignored local tooling storage. No Python runtime enters the APK.

Use public OpenCV photographic test inputs and deterministic generated geometry
fixtures. Existing local JPEG test files are synthetic graphics and attached
images inspected so far are app screenshots, not usable camera captures. Do not
claim a real balcony/window or device trial has passed without those inputs.
Do not commit private images, EXIF, local paths, profile coordinates, or output
panoramas. Never upload captures. Only public fixture provenance and aggregate
diagnostics belong in the committed report.

## Dependencies and validation

The user authorized the OpenCV evaluation after its use and native integration
cost were explained. Existing Skia can project images but does not provide
image-feature alignment. Full 3D reconstruction is unnecessary for this proof.
OpenCV is Apache-2.0 from 4.5 onward; the Python wrapper has its own MIT licensing
and third-party notices. A version-specific Android dependency, APK-size,
codec/advisory, ABI, cancellation, progress, and memory review is required when
proposing product integration. Initial review: OpenCV's GitHub security page
lists no published advisories; this is not a guarantee that its dependencies
are vulnerability-free.

Sources:

- https://docs.opencv.org/4.13.0/d8/d19/tutorial_stitcher.html
- https://docs.opencv.org/4.13.0/d9/d46/group__stitching__blend.html
- https://pypi.org/project/opencv-python-headless/4.13.0.92/
- https://opencv.org/license/
- https://github.com/opencv/opencv/security

Run Python unittest regression/geometry checks, then repository format,
typecheck, lint, the prototype test suite, and build against the final state.
Inspect saved outputs directly. No mobile UI changes means no app visual QA or
APK build is part of this stage. A failed or limited proof remains useful
evidence and must be reported as such, rather than relabeled production-ready.
