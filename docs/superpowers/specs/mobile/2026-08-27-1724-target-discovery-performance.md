# Target discovery and visibility-cache performance

Timestamp: 2026-08-27 17:24 +03:00 (Europe/Sofia)

## Purpose

Reduce avoidable mobile rendering and calculation work while making target
discovery consistent between Sky View and View All Targets. Preserve complete
offline catalogue access through direct search without treating unsuitable,
star-like, unclassified, or size-less rows as normal astrophotography targets.

## Scope

- Commit panorama and mask opacity only when a touch gesture ends.
- Make zero opacity easy to select and remove a zero-opacity overlay from the
  renderer entirely.
- Define default-discoverable versus search-only catalogue targets.
- Search catalogue identifiers, preferred names, and aliases.
- Share search and category state between Sky View and View All Targets.
- Apply the selected imaging setup's minimum-size suitability rule to both the
  target list and atlas.
- Replace the atlas above-horizon count with a filtered current-sky count.
- Persist selected-target trajectories and target-list visibility summaries in
  SQLite with correctness-preserving invalidation and bounded storage.

## Non-goals

- Removing search-only rows from the bundled catalogue or catalogue database.
- Adding new catalogue sources, remote search, accounts, or synchronization.
- Changing the obstruction sampling precision or mask geometry model.
- Adding full-frame obstruction calculations.
- Persisting cosmetic overlay opacity or discovery controls across app restarts.

## Catalogue discovery policy

A target is default-discoverable only when all of the following hold:

1. Its object type belongs to Galaxies, Nebulae, or Star Clusters.
2. Its major angular axis is finite and greater than zero. When the minor axis
   is unavailable, the existing circular fallback to the major axis remains.
3. When an imaging setup is selected, its calculated minor axis is at least 60
   sensor pixels.

The category mapping is:

- Galaxies: `G`, `GPair`, `GTrpl`, `GGroup`, `Galaxy`.
- Nebulae: `PN`, `Neb`, `HII`, `RfN`, `SNR`, `EmN`, `DrkN`, `Nebula`.
- Star Clusters: `OCl`, `GCl`, `Cl+N`, `*Ass`, `Star Cluster`.

Rows outside these rules remain in local catalogue storage but are search-only.
They must not be projected, spatially indexed, laid out, counted, ranked, or
visibility-calculated during normal discovery. A non-empty direct search may
return them. Selecting one adds only that target to the atlas and permits its
trajectory calculation; closing/deselecting it removes it again.

A selected target remains rendered even when the current category, search, or
equipment filter would otherwise exclude it. This preserves the explicit user
selection and is the sole atlas bypass.

## Search and shared controls

- One profile-scoped in-memory discovery state owns the search string and the
  three selected categories. All categories start selected.
- Sky View and View All Targets read and update that same state, including after
  navigation remounts during the current app process.
- A reusable control renders the search field and contiguous category segments
  in both screens.
- Search input is debounced by 250 milliseconds before it affects projection,
  filtering, or direct-search results. The text field itself updates immediately.
- Search is case-insensitive and punctuation/spacing-insensitive across target
  IDs, Messier/NGC/IC/Caldwell memberships, preferred names, and every alias.
  Thus `M31` and `Andromeda` resolve the same target.
- With an empty query, View All Targets contains only ranked
  default-discoverable targets. With a query, matching search-only rows appear
  as lightweight direct-search results and can be selected without precomputing
  visibility for the rest of the search-only catalogue.
- Category filters apply to classified normal targets. Search-only matches are
  shown for an explicit query regardless of category, because they have no
  dependable discovery classification.

## Sky filtering and count

- Catalogue rows are filtered for default discovery, selected equipment,
  categories, and debounced search before horizontal-coordinate projection and
  spatial-index construction.
- The Sky View header count is calculated from the resulting projected targets
  at the displayed instant.
- With a completed mask it reports targets whose centers are above the horizon
  and classified visible by the mask.
- Without a completed mask it reports suitable targets above the horizon and
  labels local visibility as unassessed; it must not imply known obstruction
  visibility.
- The selected-target exception is not included in the discovery count when it
  only appears because it bypasses the current filters.

## Opacity interaction

- During a touch drag, the slider thumb, fill, and percentage update locally.
- The parent opacity value commits once on gesture release or gesture
  termination, not on every move.
- Accessibility increment/decrement actions remain immediate commits.
- The left edge has an explicit zero snap zone large enough for reliable touch
  selection; values from normal dragging otherwise retain one-percent precision.
- At zero, Sky View passes neither panorama imagery/tiles nor mask geometry to
  the renderer. Restoring a positive value re-enables the corresponding overlay.

## Persistent visibility cache

Add a forward-only SQLite migration and repository for a bounded local cache.
Each entry stores:

- profile ID;
- context key;
- target ID;
- result kind: compact `summary` or full `trajectory`;
- versioned JSON result;
- last-used UTC timestamp.

The context key includes calculation/astronomy adapter versions, observing
location, timezone, exact UTC observing-window bounds, panorama revision, and
mask revision/alignment. The target ID and J2000 coordinates identify a result
inside that context.

Correctness and invalidation rules:

- Opening a different observing window, loading a different mask revision, or
  changing profile coordinates creates a different context and deletes older
  contexts for that profile.
- Equipment selection, opacity, category filters, search text, panning, and
  zooming do not invalidate visibility results.
- A selected full trajectory first checks memory, then SQLite, then calculates.
- View All Targets bulk-loads cached summaries for the active context before
  calculating. Newly computed summaries are written in bounded batches rather
  than one transaction/query per catalogue row.
- Corrupt, unparseable, version-mismatched, or structurally invalid cache JSON is
  deleted and treated as a miss.
- Keep at most 20,000 summary rows and 64 full trajectories globally, pruning
  least-recently-used entries after writes. The cache is derived local data and
  may be discarded without affecting profiles, masks, panoramas, or catalogue
  data.

## Performance expectations

- Search-only rows perform no projection, spatial indexing, atlas layout,
  visibility calculation, or result counting while search is empty.
- Equipment/category/search filtering happens before projection.
- Opacity drags cause no parent overlay rerender until release.
- A warm target-list context performs one bulk summary-cache read and calculates
  only misses.
- A warm selected target performs one keyed cache read and no obstruction
  recomputation.
- All cache work remains local and must not log profile coordinates, mask data,
  or result payloads.

## Failure behavior

- Cache read/write/pruning failure must not make Sky View or target discovery
  unusable. Fall back to calculation and report the existing user-facing
  calculation error only when calculation itself fails.
- Cancelling target-list calculation keeps already published partial results;
  summaries from completed batches may remain cached.
- Zero categories yields no normal discovery targets, while an explicit direct
  search may still return search-only rows.

## Test and QA acceptance criteria

- Slider tests prove move-only local updates, one release commit, zero snapping,
  termination commit, and accessibility behavior.
- Discovery tests prove classification, `M31`/`Andromeda` alias search,
  search-only exclusion, direct-search inclusion, shared state, and debounce.
- Ranking tests prove search-only rows do not affect candidates, progress, or
  counts and unknown sizes are equipment-ineligible by default.
- Sky tests prove pre-projection filtering, selected-target exception, optics
  filtering, header count semantics, shared controls, and zero-overlay removal.
- Migration/repository tests prove round trips, bulk summary loading, context
  invalidation, corrupt-entry recovery, and pruning bounds.
- Full format, typecheck, lint, affected tests, and build gates run in order.
- Exact release APK is inspected on a representative Android phone and a
  constrained phone for slider release behavior, zero overlays, search/name
  matching, shared state, category controls, counts, and selected search-only
  handoff.
