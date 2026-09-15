# MediaPipe object silhouettes for the magic brush

Timestamp: 2026-09-15 14:15 +03:00 (Europe/Sofia).

## Approved outcome

The owner approved trying MediaPipe after the research comparison. Magic paint
and erase should select a whole object, including windows and small holes within
a tree canopy. This directly overrides fine-hole preservation for magic
selection. Manual painting remains precise. Work stays on the existing
`feature/cubemap-background-renderer` branch; no merge or push is authorized.

## Implementation and acceptance

- Replace the native magic selection path with MediaPipe Tasks Vision 1.0.0 and
  Google's versioned interactive_segmenter_v2 MagicTouch int8/1 model. Keep the
  native session, UI gestures, ordered bitset application and persistence.
- Bundle the model offline through a checksum-verified build asset, using the
  existing OpenCV SDK download/cache convention. No runtime download or upload.
  Model SHA-256: `38431bc66b883404e8397f74c3579404315b9b52b04a46c6346fe906a7309b03`.
- Reconstruct a bounded ordinary perspective image from the hemisphere atlas.
  Crop transparent outer padding before inference so a partial photograph is not
  treated as a framed object. Retain its input image until replaced or closed.
  Cache one image embedding and projection per editor session; reuse it for
  strokes in that view. Map output back to original atlas texels with explicit
  east/up/north basis. Support north wrap, horizon and zenith.
- Each completed stroke identifies the desired object; draw adds its silhouette
  and erase removes it, preserving the established controls. A new stroke does
  not inherit unrelated object prompts. Users can draw through more of an object
  to guide selection. No new pending-selection mode or hidden edit history.
- Fill interior holes and close small gaps in the selected object before
  applying it. Do not apply cleanup to the accumulated mask or fill uncaptured
  directions. Keep the object's exterior concavities; do not use a convex hull.
- Bound model input to 768 square pixels, at most one operation at a time, one
  model/session and one cached perspective patch. Expand a clipped patch once
  when useful, with a finite field-of-view limit. Release native resources on
  editor closure and invalidate failed preparations. No silent old-wand fallback.
- Use the existing processing/error surface. Keep manual editing and all prior
  edits recoverable after initialization/inference/cancellation failures.

## Dependencies and privacy

MediaPipe is explicitly approved by the owner for this task. Its Apache-2.0
runtime and model add about 30.5 MB model data plus native/runtime libraries.
No permission or data schema changes. Exclude unused Android data-transport
telemetry dependencies from the new dependency edge. Existing camera/ML Kit
dependencies retain their previously present transport libraries. Upgrade
transitive Guava and protobuf-javalite to patched compatible versions and query
OSV for the final resolved additions. Review merged Android manifests and
release packaging. Do not waive vendor linkage errors or patch vendor binaries.
Bundle licence notices and record final versions in the technology registry.

## Verification

Test-first native cases cover silhouette hole filling, concavity, small gaps,
uncovered pixels, projection round trips at north/zenith/horizon, invalid input,
and cancellation. Exercise the actual bundled model on Android, repeated
selections and cleanup. Retain old-wand tests as the existing comparison baseline.
Run format, typecheck, lint, relevant mask/licence tests and build, native
instrumentation, a fresh release APK, and normal/constrained Android visual QA.
Inspect real photographic object selections separately from synthetic geometry
tests. Report measured device/emulator conditions without claiming S24 quality
or latency from other hardware. Existing panorama/mask data must remain usable.

## Sources

- https://developers.google.com/edge/mediapipe/solutions/vision/interactive_segmenter/android
- https://research.google/blog/introducing-interactive-on-device-segmentation-in-snapseed/
- https://github.com/google-ai-edge/mediapipe/issues/6364
- https://osv.dev/vulnerability/GHSA-735f-pc8j-v9w8
- https://osv.dev/vulnerability/GHSA-5mg8-w23w-74h3
- https://osv.dev/vulnerability/GHSA-7g45-4rm6-3mm3
