# OpenCV panorama stitching proof

**Timestamp:** 2026-09-14 10:40 +03:00 (Europe/Sofia)
**Scope:** Authorized desktop prototype; no Android capture-flow change.

## Result

OpenCV automatically aligned six public photographs and composed them into one
2048 by 2048 RGBA panorama in the app's existing directional atlas projection.
No manual per-photo placement was used. A separate three-photo synthetic test
crossing zenith recovered known camera orientations with maximum rotation error
0.14103 degrees. This establishes feasibility of the library/projection adapter,
not real-world obstruction accuracy, Android performance, or readiness to ship.

All feature detection, matching, camera estimation, exposure compensation, seam
selection, and multiband blending come from OpenCV. New code only orchestrates
the library, converts its cameras to the existing app coordinate frame, samples
the app's atlas, validates bounds, and preserves capture coverage.

## Measurements and visual inspection

Windows x64; Python 3.12.14; OpenCV 4.13.0 from
`opencv-python-headless==4.13.0.92`; NumPy 2.3.5; Pillow 12.3.0; two OpenCV
threads; maximum source working edge 1024; registration at most 0.6 MP; seam
resolution 512 square; atlas 2048 square; six multiband pyramid bands.

| Input and library seam method             | Registration | Composition | Processing before PNG encoding | Peak process working set before encoding |
| ----------------------------------------- | -----------: | ----------: | -----------------------------: | ---------------------------------------: |
| Six public boat photographs, graph cut    |      0.938 s |    25.524 s |                       26.657 s |                                423.1 MiB |
| Same six photographs, dynamic programming |      0.909 s |     1.761 s |                        2.864 s |                                401.5 MiB |

These are single diagnostic runs, not statistically established latency budgets.
The memory figures include Python, NumPy, OpenCV, decoded inputs, and temporary
composition arrays. They must not be interpreted as native Android memory or
as a bound covering 200 captures. PNG encoding and disk writes are excluded
from the reported processing time.

Both photographic results contain 604,040 captured atlas pixels. The adapter
restored 69 (graph cut) / 77 (dynamic programming) real source pixels whose very
thin coverage disappeared at the lower seam-finding resolution. Restoration
selects an actual covering photo; it never extrapolates coverage or synthesizes
sky. The output alpha is exactly the union of source coverage and stays binary.

Direct image inspection found a coherent continuous photographic panorama.
Graph-cut seams hide joins better in this sample. The faster dynamic-programming
result retains more visible sky/exposure joins, including toward the right-hand
photographs. Neither result establishes perfect alignment of every cloud, moving
water detail, or nearby obstacle. The single-atlas representation curves the
photo strip around the hemisphere; this is the app's projection, not a claim
that a flat photograph should look undistorted in that storage format.

The photographic anchor was a deliberately supplied demonstration orientation,
not measured true north/altitude for the public images. It proves that an anchor
can be retained while composing. Absolute sky registration still depends on a
real sensor or user calibration.

The generated upward test uses independent Rodrigues camera rotations,
overlapping poses, roll changes, and exposure changes. Measured rotation errors
were 0.02754, 0.09704, and 0.14103 degrees. The test acceptance threshold is one
degree for this artificial fixture only. It does not set a product precision
requirement for branches. Zenith remained covered; uncaptured areas remained
transparent; genuine black image pixels retained their coverage.

## Files and reproduction

The maintained proof sources are under `apps/mobile/scripts/panorama-proof/`:

- `stitching.py`: OpenCV camera estimation, compensation, seam, and blending calls.
- `directional_atlas.py`: existing app coordinate-frame/projection adapter.
- `run_proof.py`: bounded local JPEG/PNG input and single PNG output.
- `synthetic_capture.py`: generated upward-view camera fixtures.
- `test_panorama.py`: geometry, matching failure, coverage, and input-boundary tests.

Use Python 3.12 with the evaluated packages in an isolated local tooling folder:

```powershell
python -m pip install --target tmp/panorama-proof-deps opencv-python-headless==4.13.0.92 numpy==2.3.5 Pillow==12.3.0
$env:PYTHONPATH = (Resolve-Path tmp/panorama-proof-deps).Path
python -m unittest discover -s apps/mobile/scripts/panorama-proof -v
python apps/mobile/scripts/panorama-proof/run_proof.py --anchor 0 40 0 --seam graphcut --output tmp/panorama-proof-result tmp/samples/boat1.jpg tmp/samples/boat2.jpg tmp/samples/boat3.jpg tmp/samples/boat4.jpg tmp/samples/boat5.jpg tmp/samples/boat6.jpg
```

`--output` must be a new directory. `--anchor` is the first input's azimuth,
altitude, and roll in degrees; the example values are for demonstration only.
For one image, provide its measured `--horizontal-fov`. For multiple images,
intrinsics come from OpenCV. This version does not constrain focal estimates
with sensor intrinsics or use all sensor poses as matching priors.

The tool emits `panorama.png` plus local aggregate `metrics.json`. It rejects
empty input, more than 12 inputs, oversized images/output, featureless or
disconnected sets, and output-directory reuse. It leaves input files unchanged.
This rejection behavior is an explicit prototype boundary, not the proposed
final app fallback for otherwise valid disconnected partial captures.

Local run outputs in the original workspace (ignored; not committed):

- `tmp/panorama-stitching/boat-graphcut-final/panorama.png`
- `tmp/panorama-stitching/boat-dp-final/panorama.png`
- `tmp/panorama-stitching/upward-proof/panorama.png`

The upward preview was generated before the final change from four to six blend
bands; the final automated suite verifies coverage with both seam methods and
the final six-band setting. Its registration result is unaffected by blending.

Public photographic input provenance: OpenCV's `opencv_extra` tag `4.13.0`,
`testdata/stitching/boat1.jpg` through `boat6.jpg`, downloaded directly from
`raw.githubusercontent.com/opencv/opencv_extra/4.13.0/testdata/stitching/`.
The [official stitching tutorial](https://docs.opencv.org/4.13.0/d8/d19/tutorial_stitcher.html)
uses the same boat test set. No public or private source photographs are added
to the repository or app.

SHA-256, in input order:

```text
c084dab5e87d0c7a018fc6ab75e847621f0809b20a968c42bfb5d58b81303f2e
3bb4e222a5879d2555c3f1109e6b77284b418f378db02e6e86cc414f46fb33ad
dd3c5c15bff43782039aeeff19361251ab9d60b3fb6d1195df6b7dc357e33e65
be8392f53a624426de2ce918dd803e55236e79cf7bb573338d7b684ba950848f
076fcf028c3078e9f7b612c380a6c75d6e08109e74835ac5147a5a1960e5fc68
48f20d18f28c9156bf516e7f8726fe3ea60ac378fa1b198c71bc2d4edf5c4e34
```

## Remaining work before product integration

1. Test real captures from the observing position, including close window frames,
   roofs, moving branches, plain sky, dim light, roll, and multi-row/zenith views.
   No suitable physical-device capture set was available in this workspace.
2. Specify a native Android module using the library's C++ stitching components,
   with camera pose/intrinsic priors, no silent dropped tiles, and a clear review
   or recapture path when matching confidence is insufficient.
3. Define real angular error acceptance criteria and whole-panorama calibration.
   Visually matched photographs alone cannot determine true north.
4. Bound memory through cropped tile regions, lower-resolution registration and
   seam analysis, and controlled source decoding. Benchmark the supported capture
   counts on representative phones; the desktop prototype is deliberately capped
   at 12 and keeps all working images/atlas tiles in memory.
5. Compare seam quality and timing on real captures before selecting graph cut,
   dynamic programming, or another existing OpenCV option for the app.
6. Add background execution, progress/cancellation, interruption recovery, draft
   persistence, native tests, and device QA while retaining the current single
   panorama plus independently created binary mask contract.

## Security and validation

The evaluation adds no mobile dependency, permission, migration, service, or
network path. Processing stays local; no image contents, EXIF, coordinates,
poses, or personal paths are logged. Input count, compressed size, decoded
dimensions, working size, and atlas allocation are bounded. PNG preserves
binary capture alpha independently of blending. Outputs never overwrite source
files or an existing result directory. Tests cover oversize rejection before
allocation/decoding, failed matching, disconnected sets, and source preservation.

OpenCV's upstream security page lists no published advisories. This limited
evaluation is not a transitive codec vulnerability audit. Native Android
adoption still needs a version-specific dependency and third-party licence
review. Public fixtures and generated data were used; private imagery is not
redistributed.

Final validation: `pnpm format`, `pnpm typecheck`, `pnpm lint`, all 16 Python
tests, and `pnpm build` passed in the required order. Build includes catalogue
and registered-sky-asset validation plus the Android Expo export. Python tests
are the focused executable test gate for the only changed code, the standalone
proof scripts. No app runtime files or dependencies changed. Final diff and
internal references were reviewed; `git diff --check` passed. The proof task
entry was removed from `State.md`; unrelated active tasks remain intact.
