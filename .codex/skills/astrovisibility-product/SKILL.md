---
name: astrovisibility-product
description: Apply Astrovisibility's product model and v1 UX constraints when planning, designing, implementing, or reviewing app behavior. Use for product, UX, astronomy visibility, panorama, mask, profile, telescope configuration, sky view, or target-list work.
---

# Astrovisibility Product Context

Read the repository-root `astro-visibility-spec.md` completely before acting.
Treat it as authoritative; this skill is routing guidance, not a substitute for
the specification.

## Preserve the Model

- A profile is one exact observing position.
- Visibility is a two-dimensional mask over sky directions, not a horizon line.
- A completed mask is binary: visible or blocked. Everything outside its defined
  visible region is blocked.
- A profile with no mask is a distinct state: sky browsing works, but local
  obstruction visibility is not known and must not be presented as known.
- Partial and upward panorama captures are valid. Full 360-degree capture is not
  required.
- A trajectory may alternate between visible and blocked any number of times.
- Keep coordinates, time, units, projection, mask alignment, and telescope field
  of view explicit.

## Preserve the UX

- Keep the Sky View central, full-screen, pannable, zoomable, and uncluttered.
- Reveal target density with zoom; prefer common names with catalogue aliases.
- Show visible/blocked trajectory segments, all transition times, and 30-minute
  markers.
- Keep panorama and mask toggles/opacity independent.
- Put infrequent profile and imagery operations in the profile menu.
- Rank the target list by usable duration and show every interval.
- Apply telescope suitability only when a configuration is selected.
- Return list selection to the positioned, selected target in Sky View.
- Keep target details behind a compact More Info affordance.

## Decision Boundary

Before implementation, identify whether the request touches a section 19 open
question or introduces architecture, local persistence, native permissions,
astronomy data, numerical precision, or a new technology. If so, create or update
a focused specification/decision under `docs/superpowers/` and obtain human input
for any materially open choice.

Do not add accounts, sync, cloud storage, social behavior, hardware control, a
commercial equipment database, mandatory 360 capture, or photorealistic DSO
rendering to v1 without explicit scope approval.

## Review Checklist

Evaluate the result against:

- correct no-mask versus completed-partial-mask behavior;
- arbitrary obstruction geometry and multiple visibility intervals;
- correct coordinate/time/unit handling and stated numerical tolerances;
- local data coherence, privacy, permission denial, and restart recovery;
- usable small-screen navigation and uncluttered controls;
- realistic target density, panorama/mask size, and mobile performance;
- the acceptance criteria and non-goals in the controlling spec.
