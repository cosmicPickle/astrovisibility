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

OpenNGC-derived output must retain the required CC BY-SA 4.0 attribution and
provenance. Astronomy source data is imported and normalized at build time; v1
does not rely on a network astronomy service at runtime.

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
