# Magic selection for noisy night panoramas

Timestamp: 2026-09-14 16:29 +03:00 (Europe/Sofia)

## Outcome and scope

The owner reports inconsistent region size, noise-shaped boundaries and selection
leaking from a dark tree into sky. Improve the existing magic brush on the combined
cubemap branch. Retain the accepted compact UI, manual brush, draw/erase semantics,
original-resolution mask, coverage, persistence and offline native session lifecycle.
This extends `2026-09-14-1502-mask-selection-editor.md`; no new dependency,
permission, data format, large refactor or merge into main is required.

## Selection contract

Magic uses positions along the centre of the stroke to express the intended
surface. The outer brush disc must no longer independently seed neighbouring
surfaces. Dragging the centre into another region can intentionally select it.
Sample the centre path densely enough to include narrow source-image features;
retain bounded work and reject oversized strokes without partial edits.

Prepare a cached, edge-preserving denoised colour image and a boundary map using
the already bundled OpenCV. Region growth must respect coverage and detected
boundaries, tolerate small local noise and gentle shading, and retain a bounded
seed-relative colour difference so gradients cannot grow without limit. Retain
source resolution. Do not globally close/dilate the resulting binary mask: that
can remove genuine narrow branches and sky gaps. Ambiguous, invisible boundaries
still require manual corrections; do not claim semantic tree/sky recognition.

## Implemented parameters and resource bounds

Use OpenCV mean-shift filtering with spatial radius 4, RGB colour radius 12,
maximum pyramid level 0 (no downsampling), and OpenCV's bounded five-iteration
default termination. Convert the filtered image to 8-bit Lab. Canny on lightness uses
thresholds 8/20 and L2 gradients. Discard isolated edge components shorter than
64 source pixels, using
eight-connected labels. Fixed seed-relative lightness tolerance is
`clamp(4 + 0.12 * L, 6, 18)`, with 8 per chroma channel. Estimate the reference
colour from a 5-by-5 neighbourhood, admitting only pixels within 4 per Lab channel
of the centre colour. This reduces seed noise without averaging in a differently
coloured neighbouring surface. Temporarily supply that reference at the seed to
OpenCV's fixed-range fill and restore the cached pixel in a finally block; all
selection runs on the existing serial worker. These constants are
covered by separate deterministic noise-level fixtures rather than a claim that
one threshold can distinguish every night scene. Short high-contrast features
still stop growth through the colour limit even when their edge contour is
discarded; weak tiny features can need manual correction.

Boundary pixels may be restored on the selected side only when an immediate
four-connected selected neighbour differs by at most 2 in every Lab channel.
Restored pixels do not propagate growth. Transparent coverage stays blocked.
Cache the Lab bytes as well as the native matrices to avoid per-pixel JNI calls;
this adds at most 12 MiB at 2048 square. Release native matrices on session exit.
Connected-component labels exist only during preparation (16 MiB at 2048 square),
with bounded component-count and row buffers, and are released immediately.

Sample centre strokes with the existing inverse stereographic transform and the
conservative atlas stretch bound, at most one source texel between samples.
Deduplicate while retaining stroke order. Cap at 4096 distinct seed pixels and
65536 sample attempts, retaining the existing 512-region/5-second worker limits.
Manual brush geometry is unchanged and reuses the extracted inverse transform.

## Acceptance and verification

- Native deterministic cases reproduce the old weak-edge leakage, noisy holes
  and nearby-tap instability. Include dark sky with noise and shading, a dark
  tree, narrow contrasting branches, transparent gaps and bright/daylight cases.
- Compare selected-area coverage, wrong-side leakage and nearby-tap overlap
  against known synthetic ground truth, excluding at most a two-texel boundary
  band for the region-quality metrics. Separately test narrow features.
- Test centre-path projection at zenith/north wrap and sparse stroke events;
  retain existing manual geometry checks. Selection failures remain atomic.
- Measure cold preparation and cached selection for a 2048-square image on
  Android, including a noisy scene rather than only a uniform colour.
- Run format, typecheck, lint, affected tests, build and native checks. Inspect
  actual Android selection behaviour on synthetic dark imagery. Use the supplied
  screenshot only locally as a qualitative reference; never commit or upload it.
- Stage a fresh Android release using the repository build skill. Record results
  and limitations in a timestamped report and leave main unchanged.

OpenCV references: [filtering](https://docs.opencv.org/4.13.0/d4/d86/group__imgproc__filter.html),
[flood fill](https://docs.opencv.org/4.13.0/d7/d1b/group__imgproc__misc.html),
[Canny](https://docs.opencv.org/4.13.0/dd/d1a/group__imgproc__feature.html).
