# Approved Technologies

This document is Astrovisibility's technology approval registry. It separates
permission to use a technology from a decision to use it.

## Approval Policy

The technologies below are pre-approved because they are both approved and in
active use in the Rallypath repository as inspected on 2026-08-19. Agents do not
need to request technology approval again before adopting one of them in
Astrovisibility.

Pre-approval does not mean that a technology is required or suitable. Every
adoption must still:

- solve a concrete Astrovisibility requirement;
- fit the local-first v1 scope in `astro-visibility-spec.md`;
- avoid adding unused architecture or infrastructure;
- use a currently compatible, maintained, and secure version;
- account for native permissions, bundle size, offline behavior, privacy,
  maintenance, licensing, and operations as applicable;
- be recorded under **Adopted by Astrovisibility** below and in a controlling
  architecture/specification document when it materially shapes the app.

The Rallypath version families are evidence baselines, not mandatory pins. A
major-version migration or materially different use still requires explicit
design justification even though the technology itself is pre-approved.

As directly approved by the product owner on 2026-08-19, popular, maintained
astronomy libraries and authoritative astronomy datasets are also pre-approved
when they are necessary to implement the product specification. This domain
pre-approval does not waive compatibility, numerical-validation, provenance,
licence, privacy, security, maintenance, or bundle-size review. Record each
adopted library or dataset below and in its controlling specification.

Companion type packages, official framework adapters, Babel/TypeScript plugins,
and test integrations for an adopted technology are also pre-approved when they
add no separate runtime architecture and are chosen from the same maintained
ecosystem.

## Panorama Prototype Evaluation (2026-09-14)

The product owner authorized evaluating OpenCV for automatic panorama alignment
and blending, explicitly confirming that stitching must use an existing library.
The standalone desktop proof uses `opencv-python-headless` 4.13.0.92 (OpenCV
4.13.0), with the bundled Python 3.12, NumPy 2.3.5, and Pillow runtimes. These
are evaluation tools only; none is added to the mobile runtime or APK.

The headless Python wheel is installed into ignored local storage, with no
manifest or lockfile change to the mobile app. OpenCV supplies feature matching,
camera estimation, exposure compensation, graph-cut seams, and multiband
blending. Existing Skia remains responsible for the shipped rendering workflow.
The proof's adapter only preserves the app's directional projection and coverage
contract. OpenCV's Apache-2.0 licence, the Python wrapper's MIT licence, and
bundled third-party notices must be respected if redistributed. This local
evaluation does not approve a particular Android wrapper, ABI/package layout,
or new app dependency; those decisions require a focused integration spec and
version-specific dependency, memory, and APK-size review.

See `docs/superpowers/specs/mobile/2026-09-14-1020-panorama-stitching-prototype.md`.

## Android Panorama Stitching Adoption (2026-09-14)

The product owner subsequently directed integration into the Android app, using
the library rather than a desktop-only proof. Adopt official OpenCV 4.13.0 via
`org.opencv:opencv:4.13.0` and that release's Android SDK static stitching
archives. A local Expo/Kotlin/JNI module adapts the existing capture, directional
atlas, and persistence contracts. No unofficial wrapper, server, new permission,
Python runtime, or runtime download is introduced. Existing Skia renders the
result; OpenCV supplies registration, exposure compensation, seams, and blending.

The AAR's Prefab headers include stitching, but the shared library omits its
symbols. The build therefore extracts `libopencv_stitching.a` for each existing
ABI from the official 318,235,406-byte Android SDK ZIP, checked against GitHub's
published SHA-256. Other static libraries and example applications are not
adopted. The SDK ZIP stays in Gradle's local dependency cache. All upstream
licence notices are packaged as Android assets and readable offline in About.
OpenCV is Apache-2.0; the SDK's ITT notices include both alternative licences,
with BSD-3-Clause the applicable permissive option. There is no new copyleft
choice or change to application licensing.

The four ABI OpenCV shared libraries add about 143 MB uncompressed before the
small stitching bridge; retain existing device support and report the measured
APK size. The existing NDK 27.1/CMake 3.22.1 and resolved Kotlin runtime are used.
Image decoding is restricted to private, bounded local sources and sampled on
Android before OpenCV decodes them. Matching and composition have explicit
image, feature, candidate-pair, and memory bounds. Upstream's security advisory
page had no published advisories at review; this is not a claim that native
image decoding is risk-free. Keep the pinned dependency under normal updates.

Sources: [official release](https://github.com/opencv/opencv/releases/tag/4.13.0),
[official Android usage](https://opencv.org/opencv4android-usage-models/),
[upstream advisories](https://github.com/opencv/opencv/security/advisories).
Controlling implementation:
`docs/superpowers/specs/mobile/2026-09-14-1051-android-panorama-stitching.md`.

## Android Mask Selection Reuse (2026-09-14)

### MediaPipe object silhouettes (2026-09-15)

The owner approved MediaPipe for whole-object magic painting after a research
comparison, explicitly preferring solid canopies/buildings over fine internal
holes. Adopt `com.google.mediapipe:tasks-vision:1.0.0` and its matching core,
with Google's `interactive_segmenter_v2/magic_touch/int8/1` model. The model is
30,525,312 bytes, downloaded at build time, verified with SHA-256
`38431bc66b883404e8397f74c3579404315b9b52b04a46c6346fe906a7309b03`, and bundled
for offline inference. Runtime and model attribution/Apache-2.0 notices are
available in About. The AAR supports Android API 24 and all four existing ABIs.

The selected stateful JNI API runs on the existing native worker and caches one
perspective image embedding. It does not use TaskRunner's remote statistics
client; exclude `com.google.android.datatransport` from the MediaPipe dependency edge.
Existing Expo camera/ML Kit dependencies still bring their older transport libraries.
There is no new permission, image upload, runtime model download or migration.
Manual painting retains its existing geometry and precision. OpenCV fills holes
and simplifies the selected object's exterior before applying the bitset.

Override old transitive Guava with `33.7.1-android` and protobuf-javalite with
`4.36.1`: the published defaults are affected by GHSA-5mg8-w23w-74h3,
GHSA-7g45-4rm6-3mm3 and GHSA-735f-pc8j-v9w8. OSV queries on 2026-09-15 returned
no advisories for the selected patched versions, MediaPipe core/vision 1.0.0
or its Flogger 0.6 components. Actual Android inference uses the stateful JNI API
without adding MediaPipe's transport dependencies. Upstream issue 6364 concerns other graph-builder Any APIs; no vendor
binary is patched and no linkage/build failure is waived.

Source/API: https://developers.google.com/edge/mediapipe/solutions/vision/interactive_segmenter/android
Controlling spec: `docs/superpowers/specs/mobile/2026-09-15-1415-mediapipe-object-mask.md`.

Continuous capture (2026-09-15) also reuses this approved OpenCV module for ORB,
RANSAC and rotation fitting. A native view uses Android Camera2 and the existing
camera permission, with the already installed React Android library explicitly
linked for view lifecycle callbacks. No new library version, permission or
persisted format is introduced. The experimental mode is selected in
`apps/mobile/src/capture/panoramaCaptureMode.ts` and is enabled for owner testing.
See `docs/superpowers/specs/mobile/2026-09-15-1046-continuous-panorama-capture.md`.

The mask editor also reuses the adopted OpenCV 4.13.0 Android library for
offline, connected colour selection. A local Expo/Kotlin module owns ephemeral
selection sessions; no dependency, permission, model download or persisted
format is added. Skia and the existing directional camera render the editor.
See `docs/superpowers/specs/mobile/2026-09-14-1502-mask-selection-editor.md`.
Night-image refinement reuses OpenCV mean-shift filtering, Canny boundaries and
connected-component filtering without another dependency or model. See
`docs/superpowers/specs/mobile/2026-09-14-1629-night-mask-selection.md`.
Daylight refinement replaces fixed seed-colour growth with neighbour-relative
OpenCV flood fill constrained by those boundaries. Stitching also retains
near-duplicate matches and reuses recovered poses for manual recomposition. See
`docs/superpowers/specs/mobile/2026-09-15-0918-stitching-and-connected-surfaces.md`.

## Best-Fit Starting Candidates for This Product

These technologies are pre-approved and align most directly with a mobile,
local-first Astrovisibility v1. This is a shortlist for architecture evaluation,
not an architecture decision:

- TypeScript and Node.js tooling
- pnpm
- Expo and React Native
- Expo Router and React Navigation
- React Native Gesture Handler, Reanimated, Screens, Safe Area Context, SVG, and
  Worklets
- Expo Camera, Sensors, Location, FileSystem, SQLite, Image Picker, Secure Store,
  Constants, Status Bar, and Build Properties
- Zod
- Astronomy Engine and a pinned, transformed OpenNGC catalogue
- Jest, Jest Expo, React Native Testing Library, and Maestro
- ESLint and Prettier
- Docker only when a reproducible tool or test service genuinely needs it

The staged v1 specification adopts specific astronomy, device, and local-data
technologies below. Other astronomy packages and data follow the domain
pre-approval policy above; unrelated candidates still follow the new-technology
approval rule in `AGENTS.md`.

## Pre-Approved Foundation and Repository Tooling

| Technology                     | Rallypath evidence baseline   | Approved use                                                        |
| ------------------------------ | ----------------------------- | ------------------------------------------------------------------- |
| TypeScript                     | 6.x                           | Application, package, native-bridge, build, and test code           |
| Node.js                        | 24.x (24.16 in CI)            | Local tooling, scripts, services, and test runners                  |
| ECMAScript modules             | `type: module`                | Package and tooling module format                                   |
| pnpm                           | 11.x                          | Package management, workspaces, overrides, and script orchestration |
| pnpm workspaces                | `apps/*`, `packages/*`        | Monorepo layout when multiple deliverables justify it               |
| Turborepo                      | 2.x                           | Monorepo task graph and caching                                     |
| Docker and Docker Compose      | Compose v2 workflow           | Reproducible local infrastructure and test dependencies             |
| ESLint                         | 10.x                          | Static analysis                                                     |
| typescript-eslint              | 8.x                           | TypeScript lint integration                                         |
| Prettier                       | 3.x                           | Formatting                                                          |
| `globals`                      | 17.x                          | ESLint environment globals                                          |
| `tsx`                          | 4.x                           | TypeScript script/CLI execution                                     |
| `ts-node`                      | 10.x                          | TypeScript execution where the adopted toolchain requires it        |
| `ts-loader`                    | 9.x                           | TypeScript/Webpack integration where needed                         |
| `tsconfig-paths`               | 4.x                           | TypeScript path resolution for runtime tooling                      |
| SWC (`@swc/core`, `@swc/jest`) | 1.x / 0.2.x                   | Fast transforms and Jest integration                                |
| GitHub Actions                 | Ubuntu 24.04 runner           | Pull-request, push, and manual quality workflows                    |
| `actions/checkout`             | Commit-pinned official action | Reproducible CI checkout                                            |
| `actions/setup-node`           | Commit-pinned official action | Reproducible Node and package-cache setup                           |
| `pnpm/action-setup`            | Commit-pinned official action | Reproducible pnpm CI setup                                          |

## Pre-Approved Mobile Application Stack

| Technology or package family       | Rallypath evidence baseline | Approved use                                                        |
| ---------------------------------- | --------------------------- | ------------------------------------------------------------------- |
| React                              | 19.x                        | Component/runtime model                                             |
| React Native                       | 0.86.x                      | Native mobile application                                           |
| Expo                               | 57.x                        | React Native application platform and native build integration      |
| Expo Router                        | 57.x                        | File-based mobile navigation                                        |
| React Navigation                   | 7.x                         | Native, native-stack, and bottom-tab navigation                     |
| Expo HTML Elements                 | 0.12.x                      | Semantic primitives where cross-platform behavior benefits          |
| Expo Vector Icons                  | 15.x                        | Mobile icons                                                        |
| Expo Background Task               | 57.x                        | Approved background work when platform policy and UX justify it     |
| Expo Build Properties              | 57.x                        | Native build property configuration                                 |
| Expo Camera                        | Current compatible SDK      | User-driven direction-aware panorama tile capture                    |
| Expo Clipboard                     | 57.x                        | Explicit user-requested clipboard operations                        |
| Expo Constants                     | 57.x                        | App/runtime configuration access                                    |
| Expo FileSystem                    | Current compatible SDK      | Durable app-local panorama, mask-cache, and generated-file storage   |
| Expo Image Picker                  | 57.x                        | User-driven camera/photo selection with permission handling         |
| Expo Linear Gradient               | 57.x                        | Native gradient rendering                                           |
| Expo Linking                       | 57.x                        | Deep links and external links with validation                       |
| Expo Location                      | Current compatible SDK      | Foreground profile location and heading assistance                   |
| Expo Notifications                 | 57.x                        | Notifications when separately in product scope                      |
| Expo Secure Store                  | 57.x                        | Small sensitive local values; not large panorama/mask data          |
| Expo Sensors                       | Current compatible SDK      | Device attitude and motion samples during guided capture             |
| Expo SQLite                        | Current compatible SDK      | Structured local data, catalogue records, settings, and migrations   |
| Expo Status Bar                    | 57.x                        | System status-bar integration                                       |
| Expo Task Manager                  | 57.x                        | Registered background task support                                  |
| Babel Preset Expo                  | 57.x                        | Expo transforms                                                     |
| gluestack-ui core/utils            | 5.x                         | Mobile UI primitives                                                |
| NativeWind                         | 5 preview used in Rallypath | React Native utility styling; preview-version risk must be reviewed |
| Tailwind CSS and Tailwind Variants | 4.x / 0.1.x                 | Utility styling and typed variants                                  |
| React Native CSS                   | 3.x                         | CSS interop in the adopted NativeWind stack                         |
| Legend Motion                      | 2.x                         | Declarative animation                                               |
| React Native Gesture Handler       | 3.x                         | Touch and gesture handling                                          |
| React Native Reanimated            | 4.x                         | UI-thread animation and gestures                                    |
| React Native Worklets              | 0.10.x                      | Worklet execution required by adopted animation/gesture stack       |
| React Native Screens               | 4.x                         | Native navigation screen primitives                                 |
| React Native Safe Area Context     | 5.x                         | Safe-area handling                                                  |
| React Native Skia                  | 2.6.2                       | GPU-rendered spherical Sky View and projected local overlays        |
| React Native SVG                   | 15.x                        | Vector rendering, diagrams, overlays, masks, and charts             |
| React Native QR Code SVG           | 6.x                         | QR rendering if a future approved feature needs it                  |
| React Aria and React Stately       | 3.x                         | Accessible behavior/state primitives where compatible               |
| TanStack Query                     | 5.x                         | Async/server state; only when such state exists                     |
| Socket.IO client                   | 4.x                         | Real-time server communication if later in scope                    |

The Rallypath-local `rallypath-health-connect` module is not transferred as an
approved reusable technology because it is product-specific source code rather
than an independent technology. Building a focused Astrovisibility native module
is allowed as an architectural pattern, but its platform APIs, permissions, and
maintenance boundary must be specified.

Astrovisibility adopts the local Android-only `astrovisibility-device-pose`
Expo module for panorama capture. It uses the platform rotation-vector,
geomagnetic-declination, and Camera2 characteristics APIs to provide one
true-north camera basis and the normal rear-camera field of view. It adds no
runtime service, network path, storage, analytics, or permission beyond the
already approved camera/location capture flow; its native maintenance boundary
is specified in
`docs/superpowers/specs/mobile/2026-08-20-2256-pose-driven-planetarium-capture.md`.

Astrovisibility adopts `@vvo/tzdb` 6.198.0 for its offline observing-profile
timezone selector. The zero-runtime-dependency MIT package supplies grouped IANA
timezone identifiers and aliases for a bounded local dropdown; platform `Intl`
remains authoritative for validation and civil-time calculations. It adds no
service, permission, analytics, or runtime network path. The adoption and bundle
boundary are specified in
`docs/superpowers/specs/mobile/2026-08-28-0954-atlas-focus-profile-optics-controls.md`.

Astrovisibility adopts `reanimated-color-picker` 5.1.2 for the Sky View mask
color control. The MIT-licensed, pure-JavaScript package has no runtime
dependencies and uses the already adopted React Native Gesture Handler and
Reanimated peers. It is confined to the Mask appearance sheet and adds no
native permission, service, analytics, storage, or runtime network path. The
adoption and interaction-performance boundary are specified in
`docs/superpowers/specs/mobile/2026-08-30-1034-sky-visuals-and-mask-modes.md`.

## Pre-Approved Astronomy Libraries and Data

The product-owner domain approval covers additional popular, maintained
astronomy packages and authoritative datasets when a concrete astronomy feature
needs them. Adoption still requires an explicit registry record and source
validation.

| Technology or dataset | Approval/adoption status | Approved use |
| --- | --- | --- |
| Astronomy Engine (`astronomy-engine`) 2.1.x | Adopted for v1; lock exact version | Offline time, solar-altitude search, and coordinate calculations behind a fixture-tested adapter |
| OpenNGC `v20260501` | Adopted for v1 as pinned build input | NGC/IC records, Messier membership, aliases, names, coordinates, angular dimensions, magnitudes, and object types |
| Astronomical League Caldwell catalogue, snapshot 2026-08-19 | Adopted for v1 as reviewed mapping input | Complete 109-object Caldwell membership cross-reference and provenance |
| HYG Database v4.4, commit `53e3df311869e813ace5f1ad2ec4ce909f13256c` | Adopted as pinned CC BY-SA 4.0 build input | Offline magnitude-limited real-star layer; only normalized generated data enters the runtime |
| d3-celestial constellation data, commit `7e720a3de062059d4c5400a379146a601d9010e0` | Adopted as pinned BSD-3-Clause build input | Western constellation chart figures and names; no d3-celestial runtime code is bundled |
| Stellarium full-sky Milky Way panorama by Axel Mellinger | Adopted as a pinned, attributed static image input; modification and redistribution are permitted with proper credit | One offline 2048×1024 equatorial context atlas from Stellarium commit `e6d38fe5e71e2c591c975fb068f2daf0b89d59b0`; display opacity is bounded in-app |
| CDS DSS2 colour HiPS `CDS/P/DSS2/color` | Adopted as the all-sky optical ODbL-1.0 image input | 289 deterministic 256×256 optical cutouts for required targets; replaces artifact-prone Pan-STARRS/AllWISE false-colour composites; bundled only, with no runtime service |

OpenNGC-derived output must retain the required CC BY-SA 4.0 attribution and
provenance. Astronomy source data is imported and normalized at build time; v1
does not rely on a network astronomy service at runtime.

The registered-sky adoption is controlled by
`docs/superpowers/specs/mobile/2026-08-29-1851-registered-sky-background.md`.
It adds no runtime package, permission, remote cache, or network path. Pinned
inputs, fixed image requests, generated membership, byte sizes, and SHA-256
checksums are recorded in the repository and shown through About and licences.

## Pre-Approved Web and Administrative UI Stack

These are available if Astrovisibility later gains a website, catalogue tooling,
or another approved web surface. They are not a reason to add one to v1.

| Technology or package family    | Rallypath evidence baseline | Approved use                              |
| ------------------------------- | --------------------------- | ----------------------------------------- |
| React DOM                       | 19.x                        | Browser rendering                         |
| Vite and `@vitejs/plugin-react` | 8.x / 6.x                   | Browser development and production builds |
| React Router DOM                | 7.x                         | Browser routing                           |
| Mantine Core/Form/Hooks/Charts  | 9.x                         | Web UI, form, hook, and chart primitives  |
| Lucide React                    | 1.x                         | Web iconography                           |
| Recharts                        | 3.x                         | Web charts                                |
| TanStack Query                  | 5.x                         | Browser async/server state                |
| Tailwind Vite integration       | 4.x                         | Tailwind CSS integration for Vite         |

## Pre-Approved Validation and Shared Contracts

| Technology                  | Rallypath evidence baseline | Approved use                                                                                 |
| --------------------------- | --------------------------- | -------------------------------------------------------------------------------------------- |
| Zod                         | 4.x                         | Runtime validation, configuration parsing, persistence/import boundaries, and inferred types |
| Workspace contract packages | Internal pattern            | Framework-neutral shared schemas and types when multiple consumers justify them              |

Shared contract packages should remain framework-neutral. Do not pull server or
UI frameworks into a shared schema package merely for convenience.

## Pre-Approved Backend and API Stack

These technologies are approved for a separately specified server-side scope.
They do not override Astrovisibility v1's local-only requirements.

| Technology or package family             | Rallypath evidence baseline | Approved use                                                |
| ---------------------------------------- | --------------------------- | ----------------------------------------------------------- |
| NestJS core/common/config/CLI/testing    | 11.x                        | Modular TypeScript backend                                  |
| NestJS Express platform                  | 11.x                        | HTTP runtime                                                |
| NestJS Swagger                           | 11.x                        | Development OpenAPI generation                              |
| NestJS WebSockets and Socket.IO platform | 11.x                        | Real-time gateways                                          |
| NestJS BullMQ                            | 11.x                        | Queue integration                                           |
| NestJS Throttler                         | 6.x                         | Request throttling                                          |
| `nestjs-zod`                             | 5.x                         | Zod DTO, validation, serialization, and OpenAPI integration |
| `nestjs-pino`, Pino, and Pino HTTP       | 4.x / 10.x / 11.x           | Structured application and request logging                  |
| `pino-pretty`                            | 13.x                        | Development-only log formatting                             |
| Helmet                                   | 8.x                         | HTTP security headers                                       |
| `cookie`                                 | 1.x                         | Focused RFC cookie parsing/serialization                    |
| Argon2                                   | 0.44.x                      | Password hashing                                            |
| RxJS                                     | 7.x                         | Reactive primitives in the NestJS ecosystem                 |
| Reflect Metadata                         | 0.2.x                       | Decorator metadata required by adopted frameworks           |
| Supertest                                | 7.x                         | HTTP integration/E2E testing                                |
| Source Map Support                       | 0.5.x                       | Server stack trace mapping                                  |

If a backend is later introduced, keep a modular monolith by default. A separate
service or microservice requires its own justification even when its framework is
pre-approved.

## Pre-Approved Persistence, Queue, and Infrastructure Stack

| Technology or package family    | Rallypath evidence baseline | Approved use                                            |
| ------------------------------- | --------------------------- | ------------------------------------------------------- |
| PostgreSQL                      | 16.x                        | Authoritative relational server data                    |
| `pg`                            | 8.x                         | PostgreSQL driver                                       |
| Drizzle ORM                     | 0.45.x                      | Type-safe SQL-oriented data access                      |
| Drizzle Kit                     | 0.31.x                      | PostgreSQL schema and migrations                        |
| Redis                           | 8.x                         | Explicitly justified ephemeral/shared coordination data |
| ioredis                         | 5.x                         | Redis client                                            |
| BullMQ                          | 5.x                         | Redis-backed durable background jobs                    |
| NestLab Throttler Redis Storage | 1.x                         | Shared NestJS rate-limit state                          |
| MinIO                           | 2025 release family         | Local S3-compatible object storage                      |
| AWS SDK S3 client               | 3.x                         | S3-compatible object storage access                     |
| Sharp                           | 0.35.x                      | Server-side image validation and processing             |

PostgreSQL remains authoritative when Redis/BullMQ are adopted. Redis is not
pre-approved as a silent source of truth, general-purpose cache, distributed lock,
or pub/sub layer; each concrete use still needs design justification.

## Pre-Approved Testing and Quality Stack

| Technology or package family | Rallypath evidence baseline | Approved use                                               |
| ---------------------------- | --------------------------- | ---------------------------------------------------------- |
| Vitest                       | 4.x                         | TypeScript unit/component tests                            |
| Jest                         | 29/30.x                     | Unit/integration tests where framework support favors Jest |
| Jest Expo                    | 57.x                        | Expo/React Native Jest environment                         |
| React Native Testing Library | 14.x                        | Mobile component and interaction tests                     |
| React Test Renderer          | 19.x                        | React test support where required                          |
| Supertest                    | 7.x                         | HTTP integration/E2E tests                                 |
| Testcontainers PostgreSQL    | 12.x                        | Isolated real PostgreSQL integration tests                 |
| Testcontainers Redis         | 12.x                        | Isolated real Redis integration tests                      |
| Node built-in test runner    | Modern Node                 | Focused script/tooling tests                               |
| Maestro                      | Rallypath mobile workflow   | Android mobile E2E automation                              |
| Android Gradle build tooling | Expo native project         | Debug and release Android builds                           |

Use the test runner that best matches the adopted application/package. Do not add
multiple runners to one package without a concrete compatibility reason.

## Pre-Approved Architecture and Operational Patterns

The following patterns are approved because they are intentionally used in
Rallypath. They remain optional and must fit the actual scope:

- TypeScript-first monorepo with `apps/` and `packages/`
- framework-neutral shared Zod contracts
- local Docker Compose infrastructure bound to loopback
- modular-monolith backend with separate API and worker entrypoints
- PostgreSQL transactional outbox with at-least-once idempotent workers
- structured JSON logs with safe development pretty-printing
- request, correlation, and causation identifiers for distributed work
- S3-compatible object storage behind a narrow adapter
- test-first development and real-service integration tests through
  Testcontainers
- environment validation at startup
- forward-only migrations after release/deployment
- root format/typecheck/lint/test/build quality gates
- real browser/device visual QA at feature checkpoints

Patterns are not blanket approval to change product scope. For example, the
outbox/worker pattern is approved if a backend and durable async work are later
needed, but it is inappropriate for a local-only v1 without such a requirement.

## Explicitly Not Transferred as Technologies

The following Rallypath assets are domain-specific and are not automatically
approved as reusable Astrovisibility dependencies:

- `@rallypath/*` workspace packages
- `rallypath-health-connect`
- Rallypath seed data, media, business documents, authentication contracts, QR
  formats, and database schemas
- Rallypath local service-management and reset scripts
- Rallypath package names, application identifiers, credentials, ports, branch
  names, and deployment assumptions

Their engineering patterns may be studied, but copying source or contracts needs
a concrete Astrovisibility requirement and license/ownership review.

## Adopted by Astrovisibility

The repository adopts a pnpm 11 monorepo with a modern Node.js 24 ESM root:

- `apps/mobile` for the mobile application;
- `apps/api` reserved for a future server if later product scope requires one;
- `packages/*` for code with concrete shared consumers;
- root workspace orchestration through `package.json` and
  `pnpm-workspace.yaml`.

The monorepo decision does not adopt a server, database, queue, cloud service, or
server framework. Those remain pre-approved options until selected by a
controlling implementation decision.

The Astrovisibility v1 staged-development specification adopts for `apps/mobile`:

- Expo, React Native, Expo Router, and native-stack navigation;
- gluestack-ui with NativeWind-compatible styling;
- React Native Gesture Handler, Reanimated, and SVG;
- Zod for persisted/imported boundaries;
- Expo Camera, Sensors, Location, FileSystem, SQLite, and Image Picker;
- Astronomy Engine behind an Astrovisibility-owned validation adapter;
- a pinned, deterministic OpenNGC-derived offline catalogue with a reviewed
  Astronomical League Caldwell cross-reference;
- Jest/Jest Expo, React Native Testing Library, and Maestro for the matching test
  layers.

Stage 1 pins Expo FileSystem `57.0.0` and Expo SQLite `57.0.0` as direct mobile
dependencies. FileSystem owns app-private durable panorama assets through
validated relative paths; SQLite owns schema versioning, structured local data,
and the idempotent offline catalogue import. Node.js 24's built-in SQLite module
is used only by host-side persistence integration tests and is not bundled in
the mobile runtime.

Stage 5 pins Expo Image Picker `57.0.2` as a direct mobile dependency for the
user-driven image-import/manual-placement fallback when camera permission or
usable live capture is unavailable. Imported images enter the same app-private
draft lifecycle as camera captures; no sharing, upload, background photo access,
or unrestricted media scan is introduced.

The controlling decision is
`docs/superpowers/specs/mobile/2026-08-19-1217-astrovisibility-v1-development-stages.md`.
It constrains device permissions to foreground user actions and retains v1 data
locally on the device.

The agent/tooling bootstrap adopts:

- the Rallypath Prettier style (`semi`, single quotes, and trailing commas);
- repository-local Codex skills for product context, visual QA, Android release
  artifact emission, and GitHub CI inspection;
- Context7 as a repository-local MCP source for current library documentation;
- GitHub as repository hosting, with `cosmicPickle/astrovisibility` as the
  configured origin.
- the GitHub Releases REST API through Node.js built-in HTTPS facilities for
  explicit local Android release publication; the publisher requires a
  GitHub CLI credential, falling back to repository-scoped `GH_TOKEN` only when
  the CLI is unavailable, validates the exact pushed commit and unique version
  tag, and uploads the APK plus checksum through a draft-first flow;
- GitHub CLI as the preferred local publisher authentication source, using its
  operating-system credential-store integration after one interactive login;
  it is invoked only for an in-memory token and is not an application runtime or
  package dependency.

When adopting a technology, add an entry with:

- technology and version/range;
- purpose and owning app/package;
- controlling spec or decision;
- important constraints, permissions, or platform boundaries.

## New Approval Record Template

```markdown
### Technology name

- Status: Approved | Adopted | Superseded
- Decision date and owner:
- Problem solved:
- Intended scope:
- Alternatives considered:
- Security/privacy/native/bundle/operations impact:
- Version policy:
- Controlling spec or decision:
```

Do not overwrite historical approvals silently. Mark a decision superseded and
link its replacement.
