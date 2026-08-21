# Astrovisibility Agent Instructions

These instructions apply to every AI agent working in this repository. They are
mandatory unless a human explicitly overrides a rule for a specific task.

## Instruction Priority

1. Follow direct human instructions for the current task.
2. Follow the task's approved specification.
3. Follow `astro-visibility-spec.md` for product and user-experience behavior.
4. Follow this file.
5. Follow established repository conventions.

When instructions conflict or a required decision is unclear, stop and ask a
human. Do not silently choose a materially different scope, architecture,
technology, product behavior, or UX.

This root `AGENTS.md` is a stable, repository-wide operating manual and is an
explicit exception to the timestamp rules for AI-authored task artifacts below.

## Product and UX Source of Truth

Read `astro-visibility-spec.md` completely before product planning, architecture,
implementation, UX design, or review. Do not rely on a summary when the full
specification is available.

The following product invariants are especially easy to accidentally weaken:

- Astrovisibility answers when a target is visible from one exact observing
  position through the user's real local surroundings.
- A profile's obstruction model is a two-dimensional sky mask, not a single
  horizon altitude per azimuth. It must support separate blocked regions, gaps,
  overhangs, window frames, trunks, and narrow branches.
- A panorama may cover a narrow view, a wider view, a full 360 degrees, and/or
  upward-looking regions. Full 360-degree capture is never required for v1.
- Once a mask exists, directions outside its defined visible area are blocked.
  There is no third "unknown" state inside the completed mask model.
- A profile with no mask is different from a profile with a partial completed
  mask. With no mask, sky browsing and trajectories remain available, but the UI
  must not present obstruction-derived visibility results as known.
- The Sky View must support the full relevant sky, including the zenith, and
  remain pannable and zoomable.
- Deep-sky targets appear at correct coordinates, use zoom-dependent density,
  show approximate angular size/shape, and prioritize a well-known human name
  over catalogue-only naming when one exists.
- A selected target's trajectory can cross between visible and blocked any
  number of times. Never assume visibility becomes permanent after a target
  clears one obstruction.
- The trajectory distinguishes visible and blocked segments, labels transitions
  such as `Visible until 01:10` and `Visible after 02:10`, and carries regular
  30-minute time markers.
- Panorama and mask overlays are independently toggleable and independently
  adjustable for opacity, including when shown together.
- The selected telescope/camera configuration shows its field of view. The first
  saved configuration is selected by default. The Sky View remains useful when
  no configuration exists.
- The target list ranks primarily by usable visible duration, shows every
  visibility interval, and filters for optical suitability only when a
  configuration is selected.
- Selecting a target from the list returns to the Sky View with that target and
  its trajectory positioned for inspection.
- Panorama capture and mask drawing are two explicit ordered stages. The user
  marks visible sky; everything else is blocked after mask completion.
- The mask can be edited later. Replacing a panorama requires deleting and
  recreating the panorama/mask pair in v1.
- Keep the Sky View visually focused. Persistent controls are limited to core
  overlay controls and `View All Targets`; infrequent profile operations belong
  in the upper-right profile menu.
- V1 user data is local. Accounts, cloud synchronization, remote storage,
  sharing, social features, telescope control, and hardware integrations are out
  of scope unless separately specified and approved.

Do not resolve the open product questions in section 19 by invention. A decision
that materially affects interaction, data shape, precision, performance, or
architecture requires an approved task specification or direct human direction.

## Core Engineering Priorities

- Build for realistic growth without speculative complexity unsupported by the
  current product requirements.
- Prefer efficient algorithms, bounded work, spatial indexing or batching when
  data volume justifies it, and explicit resource limits. Astronomy calculations,
  target filtering, trajectory sampling, mask intersection, panorama processing,
  and rendering must remain responsive on realistic mobile hardware.
- Keep the dependency surface as small as practical. Prefer platform, language,
  framework, and library capabilities already present or pre-approved.
- Make the smallest coherent change that completely satisfies the specification.
  Do not modify unrelated behavior merely because broad refactoring is possible.
- Do not undertake a large refactor without explaining why it is required and
  receiving human approval.
- Do not create monolithic files or functions. Keep responsibilities cohesive,
  but do not fragment straightforward logic into trivial two-line abstractions.
- Do not edit `.ini` files unless a human directly requests it.
- Preserve numerical units explicitly. Do not mix degrees/radians, hours/degrees,
  UTC/local time, sensor millimetres/pixels, or focal length/aperture units
  through naming or implicit conversions.

Performance or accuracy claims must be supported by the expected workload, data
shape, numerical tolerance, or measurements. Do not trade away correctness or
clarity for an unproven micro-optimization.

## Repository Layout

This repository is a pnpm monorepo.

- `apps/mobile` owns the Astrovisibility mobile application.
- `apps/api` is reserved for a future server application only when an approved
  product requirement needs one. Do not create server infrastructure merely to
  fill the directory structure.
- `packages/*` contains genuinely shared, framework-neutral code when more than
  one app or tool has a concrete need for it.
- Root files own workspace orchestration, shared quality tooling, repository
  documentation, and agent infrastructure.

Keep mobile-only behavior in the mobile app. If a server is later introduced,
keep server-only implementation in `apps/api` and move code into `packages/*`
only when its ownership and consumers are truly shared. Do not turn the monorepo
layout into speculative packages or empty architectural layers.

## Technology and Dependency Approval

`docs/engineering/approved-technologies.md` is the repository's technology
approval registry.

Technologies that are both approved and actively used in Rallypath are
pre-approved for Astrovisibility. An agent may adopt them without requesting a
second technology-approval decision, subject to all of these conditions:

1. Pre-approval means permission to use the technology; it does not mean the
   technology is selected, required, or appropriate for every feature.
2. The agent must still explain the fit in the controlling architecture or
   implementation specification when adoption materially shapes the app.
3. Prefer the smallest subset that solves the current problem. Do not import a
   backend, datastore, queue, web stack, or cloud service merely because it is
   pre-approved.
4. Respect the v1 local-only product boundary. A pre-approved remote or server
   technology does not override the explicit absence of accounts, sync, and
   remote storage from v1.
5. Use a currently compatible and secure version. The Rallypath version is an
   evidence baseline, not a requirement to install a stale version.
6. Review advisories, licenses, native-platform impact, maintenance health,
   bundle size, permissions, privacy impact, offline behavior, and operational
   cost as applicable before adoption.
7. Record adopted technologies in the registry and the relevant decision/spec.

Do not introduce a technology absent from the approval registry silently. Before
introducing one:

1. Explain the concrete problem it solves.
2. Explain why existing or pre-approved capabilities are insufficient.
3. Describe operational, security, privacy, performance, maintenance, native
   build, and bundle-size costs where applicable.
4. Present reasonable alternatives, including using existing technology.
5. Obtain explicit human approval.
6. Add the approved decision to the registry.

A package installation, external service, permission, native module, or
infrastructure component must never be hidden inside an implementation task.
Approval of a feature is not automatic approval of an unregistered technology.

## Functional Completeness and Extension Consistency

Do not hand off product functionality containing stubs, placeholders, temporary
behavior, partially wired flows, no-op controls, settings that do not govern real
behavior, fake persistence, or missing lifecycle, error, privacy, and edge-case
handling required for the feature to work as presented.

An explicitly approved staged delivery may be incomplete only at the boundary the
human approved. The delivered stage must be fully functional within that boundary.
Keep deferred behavior out of active product surfaces and record the deferral in
the controlling specification.

When extending an existing workflow, document and reuse its applicable rules:
ownership, creation/editing/deletion, validation, persistence, failure recovery,
privacy, offline behavior, migration, observability, and test coverage. Do not
create a parallel abstraction or special-case path when the established model can
support the new requirement.

If implementation review reveals incomplete pre-existing behavior that the task
would expose, extend, depend on, or describe as working, report it and obtain a
decision to complete it, remove it, or approve a precisely bounded deferral.

## Local-First Data and Privacy

- Keep v1 profile, panorama, mask, telescope/camera, and user-edit data on the
  device unless a later approved specification changes the product boundary.
- Request only platform permissions needed for a concrete user action. Explain
  why camera, location, photos, motion/orientation, or storage access is needed
  at the point of use.
- Design denial, revocation, limited-permission, and unavailable-sensor states.
  Do not dead-end the user after a denied permission.
- Treat precise observing locations and captured home surroundings as sensitive
  data. Avoid logs, analytics, crash reports, screenshots, fixtures, and exports
  that disclose them.
- Never commit real user panoramas, coordinates, local database contents,
  credentials, tokens, signing material, or device identifiers.
- Persist related profile metadata, panorama references, directional alignment,
  and mask data coherently. A partial write must not leave an apparently valid
  but misaligned profile.
- Define migrations and recovery behavior before changing a persisted local data
  format. Preserve user-created data unless destructive migration is explicitly
  approved.
- Do not silently upload local data or require a network connection for behavior
  specified as local in v1.

## Astronomy, Geometry, and Time Correctness

Astronomical and geometric correctness is product behavior, not an implementation
detail.

- Keep coordinate frames explicit at module and API boundaries: equatorial,
  horizontal/alt-azimuth, panorama/image space, device orientation, and mask
  space must not be interchangeable types.
- Record longitude/latitude sign convention, altitude reference, azimuth origin
  and direction, epoch/equinox assumptions, refraction assumptions, and time
  scale where relevant.
- Store instants in an unambiguous representation. Apply the observing location's
  civil timezone only for user-facing calendar/date/time behavior and account for
  daylight-saving transitions.
- Test wraparound at 0/360 degrees, horizon/zenith behavior, polar or near-polar
  coordinates when supported, rise/set boundary cases, targets that never rise or
  never set, and observing periods that cross midnight.
- Define trajectory sampling/intersection tolerances from the required transition
  time and narrow-obstruction precision. Do not choose a coarse interval merely
  because it is convenient.
- Avoid fragile equality comparisons for floating-point geometry. Centralize
  tolerances that represent a product-level accuracy decision.
- Keep catalogue aliases and deduplication deterministic so the same astronomical
  object is not treated as separate targets only because it appears in multiple
  catalogues.
- Separate authoritative calculation data from presentation strings. Localized or
  formatted values must not feed calculations.

For core coordinate transforms, visibility interval derivation, mask sampling,
field-of-view calculations, and catalogue identity, prefer pure deterministic
modules with strong test coverage and fixture provenance.

## Local Environment Synchronization

When implementation introduces a committed environment example or configuration
contract, update corresponding local ignored files in the same task when doing so
is safe and necessary for local startup. Preserve existing local secrets and
overrides, change only required keys, never commit ignored environment files, and
verify that required keys are present.

Document first-time setup, normal startup, native prerequisites, local data reset,
build, and troubleshooting in the repository's chosen installation guide as soon
as those workflows exist. Keep the guide synchronized with script and
configuration changes.

Agents must track operating-system processes they start. Clean up short-lived and
orphaned descendants before hand-off. Do not stop user-owned processes merely
because they occupy an expected port. When the user asks to leave a development
service running, verify readiness and report the service set and URLs/device
target.

## Android Build Artifact Emission

Use the repository `build-share-android-app` skill whenever a human asks to
build, emit, produce, generate, share, or send the Astrovisibility mobile app or
APK. This applies even when the human says only "the app" without naming Android,
a release build, an APK, or the skill.

An unqualified app build/share request means a fresh Android release APK staged
at `tmp/artifacts/android/app-release.apk`. Do not substitute a debug APK, Expo
export, development build, or Gradle intermediate output. Use a different
platform or variant only when the human explicitly requests it.

The expected native Gradle project path is `apps/mobile/android`. Until that
project exists, report the missing scaffold plainly; do not stage a stale or
placeholder artifact.

## Spec-Driven Development

Product implementation work requires a task-specific specification. The root
`astro-visibility-spec.md` is the controlling v1 product specification, but a
focused implementation spec is still required when work introduces material
architecture, persistence, permissions, native integration, numerical accuracy,
or unresolved UX decisions.

Routine chores do not require a separate spec when the human request completely
defines the outcome and introduces no material product behavior, architecture,
dependency, data model, permission, security, or accuracy decision. If a chore
uncovers a material decision, stop and request a focused spec or direct human
direction.

A usable implementation specification should define, as relevant:

- purpose and user outcome;
- scope and non-goals;
- functional requirements and acceptance criteria;
- affected screens, gestures, navigation, persistence, permissions, and failure
  behavior;
- coordinate systems, units, time behavior, precision, and performance budgets;
- security, privacy, offline, and observability expectations;
- migration and compatibility behavior;
- required automated tests and visual/device checks;
- unresolved decisions requiring human approval.

Do not invent missing product behavior. Record ambiguity and ask a human to
resolve choices that could materially alter product behavior or architecture.

## Specification and AI Artifact Storage

Store AI-created task artifacts under a suitable directory beneath
`docs/superpowers/`, using categories such as:

- `docs/superpowers/specs/`
- `docs/superpowers/plans/`
- `docs/superpowers/reports/`
- `docs/superpowers/decisions/`

Every task-specific artifact must be timestamped in its filename and content.
Use local project time and filename format
`YYYY-MM-DD-HHmm-descriptive-name.md`; include an explicit timestamp with time
zone near the top.

The stable exceptions are the root `AGENTS.md`,
`docs/engineering/approved-technologies.md`, repository/user-authored product
documents, and `docs/superpowers/State.md`.

## Task Checklist and Interruption State

Before multi-step implementation, create a concrete completion checklist. Put it
in `docs/superpowers/State.md` when work is long-running, interruption-prone,
expected to span multiple turns or commits, or expensive to rediscover. A short,
self-contained task expected to finish in the current turn does not need a state
entry.

Each active task entry must include:

- controlling specifications;
- objective and acceptance criteria;
- implementation and verification checklist;
- current and completed steps;
- blockers, open questions, and material decisions;
- enough context to resume without guessing.

`State.md` is only for incomplete work. Update it as work progresses and remove a
task entry immediately when the task is fully complete. Do not use it as history,
a changelog, completion report, scratchpad, or repository overview.

## Test-First Workflow

Develop functional behavior test-first, especially astronomy calculations,
geometry, data migration, persistence, permission handling, and native bridges.

For each behavior:

1. Derive test cases from the specification and acceptance criteria.
2. Add or update tests before production functionality.
3. Run focused tests and confirm new tests fail for the expected reason.
4. Implement the smallest production change satisfying the tests and spec.
5. Rerun focused tests.
6. Run the relevant package/application suite.
7. Run repository quality gates against the final intended state.

Include success, validation, permission denial, failure recovery, important edge
cases, numerical boundaries, and persistence restart behavior. For bug fixes,
first add a regression test reproducing the defect.

Never weaken, delete, skip, or rewrite a valid test merely to make the suite pass.
Determine whether the test or production code is wrong, fix the root cause, and
rerun the affected suite.

## Persistence Migration Discipline

Before any released app or shared test fixture depends on a migration history,
development schema changes may be folded into an initial migration when the
chosen persistence tooling supports it and doing so keeps setup reproducible.

After any released build, external test environment, or real user data depends on
a migration, never edit, squash, reorder, or replace that migration. Every
subsequent correction must be forward-only with an appropriate compatibility,
rollback/recovery, and data-preservation plan. When deployment status is unclear,
stop and ask a human.

Test migrations from representative prior data, not only empty storage. For
panorama/mask schema changes, verify directional alignment and profile coherence
after migration.

## Mandatory Quality Gates

As soon as executable tooling exists, expose repository-root scripts for format,
typecheck, lint, test, and build. Prefer the same root command names used in
Rallypath when compatible:

```powershell
pnpm format
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

Run format, typecheck, and lint in that order, then the smallest test gate or
union of gates covering every changed file, followed by build. Run
feature-specific integration, device, E2E, numerical fixture, or migration suites
required by the changed area.

Do not run an unrelated slow gate merely because it exists, and do not omit a
gate whose behavior or dependencies changed. A prior successful run does not
cover changes made afterward.

If a command fails:

1. Inspect and understand the failure.
2. Fix the valid test, code, configuration, or environment issue responsible.
3. Rerun the focused failing check while iterating.
4. Rerun the complete required sequence after the final change.

Do not describe executable work as complete with unexplained or ignored failures.
If an external or environmental blocker prevents a required gate, report the
exact command and blocker.

### Documentation and Agent-Configuration Exception

Do not run typecheck, lint, tests, or build when every changed file is
non-executable documentation or agent/editor configuration that cannot affect
runtime, build, tests, dependencies, generated artifacts, or CI. For qualifying
changes:

- validate changed configuration with a targeted tool when available;
- validate internal references;
- run `git diff --check`;
- review the final diff for contradictions and unrelated edits.

Package manifests, lockfiles, environment files, native project files, schemas,
migrations, CI workflows, and build/test configuration do not qualify.

## Security Review

Before hand-off, review the changed attack surface as applicable:

- unsafe input, command, SQL, template, path, URL, or deserialization handling;
- cross-site scripting and unsafe HTML for any web surface;
- secrets, tokens, precise locations, panoramas, device data, and sensitive logs;
- path traversal, file import/export, image decoding, decompression bombs, and
  oversized panorama/mask inputs;
- native permissions, intent/deep-link handling, exported Android components,
  secure storage, backups, and clipboard exposure;
- authentication, authorization, CSRF/CORS/session handling if server or account
  functionality is later approved;
- resource exhaustion from catalogues, rendering, geometry, image processing,
  background tasks, or malformed inputs;
- dependency and supply-chain vulnerabilities;
- errors that expose internal paths, data, or sensitive context.

Use safe APIs and parameterized operations. Validate at trust boundaries, bound
input sizes and work, and return/log only what the consumer may access.

Review dependency advisories before dependency changes. Investigate relevant
findings rather than dismissing them by count or severity. Record accepted risks,
impact, and mitigation in the task spec or a timestamped decision, and obtain
human approval.

## Logging and Observability

Reuse a consistent structured logging facility before inventing custom logging.
Logs should use stable machine-filterable event names/fields and configurable
levels. Capture enough safe context to diagnose lifecycle failures, calculation
errors, migrations, native permission failures, and imports without logging
sensitive user data.

Never log precise observing coordinates, raw panoramas or masks, secrets,
credentials, tokens, unrestricted payloads, device identifiers, or personal
filesystem paths. Redact or coarsen data before crash/telemetry reporting.

If a server/API is later introduced, log safe request metadata, request or
correlation ID, route template, status, duration, operation, and internal error
context. Do not expose stacks, queries, or private metadata in external errors.

## Reuse, Abstraction, and Duplication

Before creating a helper, component, service, repository, hook, or utility:

1. Search the repository and approved libraries for an existing implementation.
2. Do not wrap or rename framework/library functionality unless the wrapper adds
   a concrete Astrovisibility contract, policy, coordinate/unit boundary,
   security/privacy boundary, or stable shared behavior.
3. Reuse or extend an appropriate abstraction when ownership remains clear.
4. Abstract only behavior that is genuinely shared and stable.
5. Keep feature-specific logic local when a shared abstraction would be forced or
   harder to understand.

Avoid copy-pasted logic and premature abstraction. After a feature, inspect the
changed area for clear duplication introduced by the work. Consolidate it when
safe and in scope; ask before expanding into a broad refactor.

## Naming, Style, and Readability

- Match established naming, organization, formatting, and code style.
- Use descriptive names as short as clarity permits. Do not use single-letter
  identifiers outside conventional mathematical expressions with tightly scoped,
  explicitly documented meaning.
- Encode units and coordinate frames in names or types where confusion is
  possible, for example `azimuthDegrees`, `timestampUtc`, or
  `panoramaPointPixels`.
- Prefer `const`. Use `let` only for necessary reassignment with narrow scope.
- Avoid nested or chained ternaries for non-trivial control flow.
- Keep functions focused and files cohesive. Split at meaningful domain or
  responsibility boundaries, not arbitrary line counts.
- Keep control flow, transformations, and side effects easy to review.
- Comment intent, constraints, derivations, or non-obvious tradeoffs; do not
  merely restate code.
- Cite the source and license of imported astronomical catalogue or algorithmic
  data where applicable.
- Remove dead code, debugging output, and obsolete TODOs introduced by the task.

Human readability is a delivery requirement. Cleverness is not a substitute for
clear structure.

## Mobile UX and Visual Review

For meaningful visual or interaction changes, inspect the rendered application
before hand-off. Use the repository's `astrovisibility-visual-qa` skill.

At natural checkpoints, review the affected flow on at least one representative
Android phone viewport and one small or otherwise constrained phone viewport.
Add iOS review when iOS is in the supported delivery scope. Exercise landscape
or tablet only when the affected screen claims to support them or the change is
likely to break there.

Inspect actual behavior, not only source or snapshots:

- safe areas, system bars, keyboard avoidance, touch targets, gestures, and back
  navigation;
- clipped/overlapping text, dynamic type, contrast, loading, empty, error,
  permission-denied, and no-data states;
- panning, zooming, target selection, overlays, opacity controls, trajectory
  labels, and dense sky-map behavior;
- performance and visual stability with realistic catalogue, panorama, mask, and
  trajectory data;
- the distinction between no mask and a completed partial mask;
- interruption/restart persistence for creation and editing flows when in scope.

Tiny copy or non-visual wiring changes do not require a full visual pass unless
they credibly risk layout or interaction regressions.

## Git and Commit Discipline

- Preserve unrelated user changes and inspect the worktree before editing.
- Keep implementation on a non-default branch unless a human explicitly directs
  otherwise. Use the `codex/` prefix for agent-created branches by default.
- Commit and push completed work by default unless a human explicitly instructs
  otherwise.
- Create clear, concise, focused commits when the task includes committing or
  publishing work. Do not mix unrelated cleanup into a feature commit.
- Never commit code that failed a required gate, contains secrets, or knowingly
  violates the controlling spec.
- Never force-push or rewrite published history unless a human explicitly asks
  and the exact target and risk are confirmed.
- Opening, updating, merging, or pushing a pull request is a separate external
  action unless directly requested or already established by an approved
  repository workflow.

## Definition of Done

A task is complete only when:

- the human request and applicable specifications are satisfied;
- no presented functionality is a stub or misleading partial implementation;
- relevant automated checks and visual/device review pass;
- privacy, security, numerical correctness, performance, migration, and failure
  behavior have been reviewed in proportion to the change;
- documentation and the technology registry are updated when required;
- any active `State.md` entry is removed;
- the final diff contains no accidental unrelated edits;
- remaining risks, deferred work, or blockers are reported plainly.

Do not claim completion merely because the code compiles or a happy-path test
passes.
