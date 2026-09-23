---
name: creator-ops-engineering
description: "Use when changing this TypeScript-first Creator Operations Platform: require a change proposal and explicit user approval before edits, preserve modular boundaries and development/production parity, add tests for every API and pipeline, and verify repository-wide compatibility after updates."
user-invocable: true
---

# Creator Operations Engineering

Use this skill for every implementation, bug fix, refactor, migration, API change, pipeline change, and dependency update in this project.

## Required platform and toolchain

- Use TypeScript for application code, workers, scripts, infrastructure helpers, and shared contracts. Introduce another runtime only when an approved requirement cannot be met safely in the Node.js ecosystem.
- Use the current active Node.js LTS release, pinned in `.nvmrc`, `package.json` `engines`, container images, and CI.
- Use npm workspaces with one root `package-lock.json`. Do not introduce pnpm, Yarn, or independently locked workspace packages.
- Use NestJS with the Fastify adapter for API and worker composition, Drizzle ORM and Drizzle Kit for PostgreSQL, BullMQ for Redis-backed jobs, Zod for runtime validation and shared contracts, Vitest for tests, and Testcontainers for infrastructure integration tests.
- Use strict TypeScript. Keep `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, and `useUnknownInCatchVariables` enabled. Do not use `any` to bypass a contract; narrow `unknown` explicitly.
- Use OpenTelemetry-compatible tracing, structured JSON logs, and Prometheus-compatible metrics in the API, scheduler, and workers.
- Prefer platform-neutral interfaces for object storage, secrets, email, notifications, and LLM providers. Production implementations may use managed services, while development uses contract-compatible local services.

## Non-negotiable workflow

### 1. Inspect before proposing

Before changing any file:

- Read the relevant code, tests, configuration, contracts, and nearby call sites.
- Identify the owning module or deployable, its public interfaces, data ownership, and downstream consumers.
- Check the current test commands and run the narrowest relevant existing test when practical.
- Do not edit files while gathering this context.

### 2. Propose and obtain approval

Before the first edit, show the user a concise change proposal and wait for explicit approval. The proposal must include:

- The behavior or defect being addressed.
- The exact files, module boundaries, and deployable roles expected to change.
- The intended implementation and why it preserves loose coupling.
- API, event, schema, migration, configuration, and compatibility impacts.
- Tests to add or update for each changed API and pipeline.
- Validation commands and the regression checks that will be run afterward.
- Any assumptions, risks, or changes requiring a migration or rollout plan.

Do not infer approval from the original request alone. If the user has not approved the proposal, ask for approval instead of editing.

### 3. Implement in small, reversible slices

- Keep each edit focused on one module or one explicit contract change.
- Preserve existing behavior unless the approved proposal changes it.
- Never modify unrelated files or hide unrelated formatting churn.
- After the first substantive edit, immediately run the narrowest relevant test, type check, lint check, or contract check before making more edits.
- Repair failures in the same slice and rerun that focused check before expanding scope.

## Architecture rules

- Begin as a modular monolith organized around bounded modules such as identity, connections, media, content, publishing, analytics, alerts, AI operations, webhooks, providers, and audit. Do not create a network service merely to enforce a source-code boundary.
- Each module owns its domain logic, tables, repositories, migrations, configuration, events, and tests. Other modules use exported application interfaces or versioned asynchronous events rather than importing repositories or querying owned tables.
- Keep module interfaces small and explicit. Define shared HTTP and event contracts once with Zod, infer TypeScript types from those schemas, and generate OpenAPI from the same source where practical.
- Use asynchronous events or jobs for long-running work, retries, provider calls, notifications, analytics ingestion, and other pipeline stages. Consumers must be idempotent and safe to retry.
- Use an outbox/inbox or equivalent durable delivery pattern for important cross-service events. Handle duplicate delivery, ordering assumptions, dead letters, and poison messages explicitly.
- Do not introduce a shared utility that couples domain behavior across modules. Shared packages may contain contracts, transport, observability, security, testing helpers, or primitives only; domain rules stay with the owning module.
- Prefer backward-compatible contract evolution: add fields before removing them, support old consumers during rollout, version breaking API/event changes, and document deprecation windows.
- Keep the API, scheduler, and workers independently runnable and scalable from the same repository and application image. Extract a module into a service only when measured scaling, reliability, security, or team-ownership needs justify it.

## Development-to-production parity

- Build one immutable OCI image and run it with different entry points for API, scheduler, and worker roles. Promote the same image digest through staging and production; never rebuild per environment.
- Keep application code environment-neutral. Differences between development, test, staging, and production must be expressed through validated configuration or injected provider implementations, not environment conditionals scattered through domain logic.
- Validate all environment variables at startup with Zod. Fail fast on missing, malformed, insecure, or mutually incompatible production configuration.
- Use Docker Compose locally for PostgreSQL, Redis, S3-compatible object storage, email capture, and observability dependencies. Local dependencies must implement the same protocols used by managed production equivalents.
- Run PostgreSQL and Redis integration tests against real ephemeral containers. Do not use SQLite, in-memory Redis replacements, or behaviorally incompatible queue fakes for integration coverage.
- Keep database migrations forward-compatible with the currently deployed and immediately previous application version. Use expand/migrate/contract changes for zero-downtime releases.
- Never run schema migration automatically in every API or worker replica. Run it as a dedicated, observable release job before starting code that depends on the new schema.
- Keep feature flags, provider API versions, queue names, bucket names, and external endpoints in typed configuration. Secrets come from environment injection or a secret manager and must never have production fallbacks.
- Development may use local credentials and emulators, but code paths, serialization, retry logic, queue topology, storage APIs, and health checks must match production.
- CI must use `npm ci`; deployments must use the committed root `package-lock.json` and a production-only dependency install or pruned workspace artifact.

## TypeScript package and dependency rules

- Use npm workspaces under `apps/*` and `packages/*`. Recommended deployable apps are `api`, `worker`, `scheduler`, and `web`; recommended shared packages are `contracts`, `database`, `config`, `observability`, `providers`, and `testing`.
- Avoid barrel exports across domain modules when they make ownership unclear or create dependency cycles. Enforce boundaries with ESLint rules or dependency-cruiser.
- Do not expose Drizzle row types as public API or event contracts. Map persistence records to domain objects and Zod-defined transport schemas.
- Use `AbortSignal` and explicit connect/request timeouts for outbound calls. Classify errors at provider boundaries and never branch domain logic on raw SDK error shapes.
- Pin provider API versions and wrap third-party SDKs behind project-owned adapters. Keep SDK types out of domain interfaces.
- Queue payloads contain identifiers and immutable operation metadata, not OAuth tokens, large media, or complete database records. Validate every consumed payload with Zod before processing.
- Use npm `overrides` for urgent transitive dependency remediation and document why each override exists and when it can be removed.

## API and pipeline testing requirements

Every API endpoint or externally consumed event must have tests covering:

- Valid input and the expected response or emitted event.
- Authentication, authorization, tenant isolation, and validation failures.
- Idempotency, retry behavior, and stable error responses where applicable.
- Compatibility of the public schema or event contract.

Every pipeline, worker, scheduler, webhook flow, or event consumer must have tests covering:

- The happy path from input to observable result.
- Retry, timeout, duplicate, partial-failure, and dead-letter behavior as relevant.
- State transitions, persistence boundaries, and emitted downstream events.
- Provider or external-system failures using fakes or contract fixtures, never live services in unit tests.

Use unit tests for domain logic and pipeline stages, contract tests for module and deployable boundaries, integration tests for persistence and queues, and a small number of end-to-end tests for critical user journeys. New behavior is incomplete until its tests are present and passing.

## Change propagation and regression safety

When changing a type, endpoint, event, database schema, configuration key, shared interface, or domain rule:

1. Find all definitions, references, producers, consumers, serializers, fixtures, documentation, migrations, and deployment configuration.
2. Update every affected module, deployable, and test in the same change, or clearly record a staged compatibility plan.
3. Run formatting, linting, static/type checks, unit tests, contract tests, integration tests, and relevant end-to-end tests using the project's npm commands.
4. Verify database migrations forward and backward compatibility as required, including rollback or expand/contract behavior.
5. Review the final diff for accidental coupling, missing tenant boundaries, secrets, breaking contracts, untested branches, and unrelated changes.

Do not declare work complete if a known regression remains. Report blocked or unavailable checks explicitly, including the reason and the next safest validation.

## Completion report

After implementation, report:

- What changed and which module or deployable owns it.
- APIs, events, schemas, migrations, and configuration affected.
- Tests added or updated.
- Validation commands and their results.
- Compatibility, rollout, migration, or follow-up risks.

Unless the repository defines stricter equivalents, the expected root validation sequence is `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm test`, `npm run test:integration`, `npm run test:contract`, and the relevant end-to-end suite.
