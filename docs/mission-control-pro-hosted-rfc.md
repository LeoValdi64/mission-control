# Mission Control Pro Hosted SaaS RFC (Streams 1-8)

Last reviewed: 2026-03-07
Status: Research complete, implementation-ready

## Context

Mission Control remains open-source and fully featured for self-host (`MC_TENANT_MODE=local`).
Mission Control Pro is a hosted SaaS mode (`MC_TENANT_MODE=hosted`) with provisioning, billing, and agent self-service.

This RFC continues research for Streams 1-8 only. Stream 9 (landing/email) is intentionally excluded.

## Baseline Findings from Current Codebase

1. There is already a local super-admin tenancy foundation in SQLite (`tenants`, `provision_jobs`, `provision_events`) via migrations `012` and `013`.
2. Auth currently supports only:
   - cookie session (`mc-session`)
   - single global API key (`API_KEY`)
3. Workspace isolation is mature (migrations `021`-`023` and many APIs using `workspace_id`).
4. There is already hardened request gating in [`src/proxy.ts`](/Users/nyk/work/products/mission-control/src/proxy.ts) (host allowlist, CSRF origin checks, API auth gate).
5. No `src/lib/saas/*` or `src/lib/adapters/*` modules exist yet.

Implication: Hosted Pro should be added as a clean sidecar architecture, not by rewriting current local tenancy internals.

## External Validation (Current)

1. Polar supports webhook signature validation helpers and typed webhook handling in SDK flows.
2. Polar documentation currently positions pricing around `4% + 40¢` and MoR capabilities (verify before go-live if economics change).
3. Neon serverless driver (`@neondatabase/serverless`) is GA and supports serverless/edge connectivity patterns.
4. Upstash supports `@upstash/ratelimit` sliding-window limits and has explicit BullMQ integration guidance.
5. BullMQ depends on Redis/ioredis-style connections and has connection behavior constraints for workers.

## ADR-01: Hosted Control Plane Data Store

### Decision

Use Postgres (Neon) for control-plane entities and keep existing SQLite for tenant runtime data.

### Why

1. Control-plane data is cross-tenant and billing critical.
2. Existing local data model is deeply SQLite-centric and should remain untouched for backward compatibility.
3. This split minimizes blast radius in local mode.

### Proposed Schema (Postgres)

1. `cp_tenants`
   - `id uuid pk`
   - `slug text unique`
   - `status text` (`pending|active|suspended|canceled|error`)
   - `plan text`
   - `workspace_seed jsonb`
   - `runtime_ref jsonb` (container/node identifiers)
   - `created_at timestamptz`, `updated_at timestamptz`
2. `cp_api_keys`
   - `id uuid pk`
   - `tenant_id uuid fk`
   - `key_prefix text`
   - `key_hash text`
   - `kind text` (`platform|tenant|agent`)
   - `scopes jsonb`
   - `rate_limit jsonb`
   - `last_used_at timestamptz`
   - `revoked_at timestamptz`
3. `cp_billing_state`
   - `tenant_id uuid pk`
   - `provider text` (`polar`)
   - `customer_id text`
   - `subscription_id text`
   - `product_id text`
   - `status text`
   - `period_end timestamptz`
4. `cp_usage_records`
   - append-only usage ledger for billing and abuse forensics
5. `cp_webhook_events`
   - `provider_event_id text unique`
   - payload + processed marker for idempotency

## ADR-02: Tenant Resolution and Request Context

### Decision

Implement tenant resolution in middleware-compatible request path, but do not hard-switch existing workspace APIs yet.

### Why

1. Existing APIs rely on `workspace_id` from auth and are stable.
2. Immediate hard switch to slug-based routing risks breaking local mode semantics.

### Implementation Staging

1. Stage A: Introduce `src/lib/saas/tenant-router.ts` with:
   - `resolveTenantFromHost(host)`
   - `withTenant(handler)` for API routes
2. Stage B: Add hosted-only routes under `/api/hosted/*` first.
3. Stage C: Incrementally adopt `withTenant` in existing APIs once coverage exists.

### Host Parsing Rules

1. Accept `slug.missioncontrol.app` and custom domain map later.
2. Ignore base domains (`missioncontrol.app`, `www`, `api`) as non-tenant hosts.
3. Honor `x-forwarded-host` first when behind reverse proxies.

## ADR-03: Billing Provider and Event Model

### Decision

Standardize on Polar as billing source of truth; avoid mixed Stripe/Polar abstractions in first release.

### Why

1. Your current stream explicitly moved to Polar MoR.
2. Mixed provider logic early increases failure surface in signup/provision chain.

### Webhook Handling Rules

1. Verify signatures before parsing payload.
2. Persist raw webhook event first (`cp_webhook_events`) with unique provider event ID.
3. Process idempotently and update `cp_billing_state` + `cp_tenants.status`.
4. Emit audit event + SSE signal after successful state transition.

### Event Coverage (minimum)

1. `subscription.created`
2. `subscription.updated`
3. `subscription.canceled`
4. `order.paid` (if needed for one-time add-ons)

## ADR-04: API Key Hierarchy and Auth Integration

### Decision

Extend auth with scoped hashed keys in hosted mode while preserving current `API_KEY` behavior for local mode.

### Key Format

1. `mc_pk_` platform key
2. `mc_sk_` tenant secret key
3. `mc_ak_` agent key

### Validation Flow

1. Extract from `x-api-key` or bearer token (already supported pattern in auth/proxy).
2. Route by prefix.
3. Lookup hashed key in control plane.
4. Enforce scope + rate policy.
5. Return synthetic user context with `workspace_id` + `tenant_id` metadata.

### Security Requirements

1. Hash with strong KDF (argon2id preferred, fallback high-cost scrypt) before storage.
2. Store only prefix + hash + metadata, never raw key.
3. Constant-time compare at final verification step.
4. Revocation should be immediate and cache-aware.

## ADR-05: Framework Adapter Layer

### Decision

Ship adapter interface plus OpenClaw + Generic first, then framework-specific adapters.

### Why

1. OpenClaw is the native system and fastest integration path.
2. Generic adapter provides a low-friction path for unsupported frameworks.
3. CrewAI/LangGraph/AutoGen/Claude adapters can follow once common telemetry contract stabilizes.

### Interface v1

1. `register(agent)`
2. `heartbeat(agentId, status, metrics)`
3. `reportTask(taskId, progress)`
4. `getAssignments(agentId)`

### Data Contract

Normalize to existing internal activity + agent status primitives before writing to DB/event bus.

## ADR-06: Provisioning Runtime and Queueing

### Decision

Retain existing step-plan provisioning logic and add a queue abstraction with BullMQ-compatible backend.

### Why

1. [`src/lib/super-admin.ts`](/Users/nyk/work/products/mission-control/src/lib/super-admin.ts) already has strong step orchestration and two-person safeguards.
2. Reusing plan execution reduces rewrite risk.

### Clarification

1. BullMQ with Upstash is supported.
2. Cost profile can spike due polling/background commands; use fixed Upstash plans or dedicated Redis budget alerts.
3. Keep queue usage behind `MC_TENANT_MODE=hosted`.

### Phased Runtime

1. Phase 1: local Docker/container manager for hosted dev/staging.
2. Phase 2: add Hetzner node provisioner and least-loaded scheduler.
3. Phase 3: suspend/resume automation and garbage collection of idle tenants.

## ADR-07: Rate Limiting and Self-Service APIs

### Decision

Use Upstash sliding-window limiter for API ingress limits and budget checks.

### Plan Limits (starter defaults)

1. Starter: 1000 req/hr
2. Team: 5000 req/hr
3. Enterprise: configurable/unbounded with soft alerts

### API Surface

1. `POST /api/agents/self-service/scale`
2. `POST /api/agents/self-service/budget`
3. Guard all with scoped tenant/agent keys.

## Stream-by-Stream Execution Update (No Stream 9)

### Group A (parallel now)

1. Stream 1: config + control plane module scaffold
2. Stream 2: Polar integration skeleton + webhook endpoint + idempotency table
3. Stream 4: adapter interface + OpenClaw + Generic adapters
4. Stream 5: container manager interface + queue abstraction
5. Stream 7: SQLite migration `029_saas_local_extensions` (see note below)
6. Stream 8: knowledge notes (external)

### Group B (after A)

1. Stream 3: signup + hierarchical keys + hosted-mode auth extension

### Group C (after B)

1. Stream 6: rate-limiter + self-service APIs

## Plan Corrections to Apply Before Coding

1. Billing provider naming must be consistent:
   - Original plan mixes Stripe and Polar.
   - Use Polar-only naming in env vars, modules, and route docs for v1.
2. Migration numbering must be updated:
   - Existing repo already has `027` and `028`.
   - Start SaaS-local migrations at `029+`.
3. Hosted/self-hosted behavior boundary:
   - All hosted-only routes and modules must short-circuit when `MC_TENANT_MODE !== 'hosted'`.
   - No changes to local super-admin behavior unless explicitly host-mode gated.
4. Workspace vs tenant identity:
   - Hosted control plane should own `tenant_id`.
   - SQLite runtime continues to use `workspace_id`; map once at entry boundary.

## MVP Execution Packets (Implementation-Ready)

### Packet A1: Config and Feature Gates

1. Extend [`src/lib/config.ts`](/Users/nyk/work/products/mission-control/src/lib/config.ts) with:
   - `tenantMode: 'local' | 'hosted'`
   - `saas.enabled` boolean derived from mode
   - Hosted-only env buckets (control plane DB, Polar, Redis, queue, domain)
2. Add config validation helpers that fail-fast only in hosted mode.
3. Keep default behavior unchanged (`local` when env missing).

### Packet A2: Control Plane DB Module

1. Create `src/lib/saas/control-plane-db.ts`.
2. Export hosted-safe accessors:
   - `getControlPlane()`
   - `withControlPlaneTx(fn)`
   - CRUD methods for `cp_tenants`, `cp_api_keys`, `cp_billing_state`.
3. Include no-op stubs or explicit errors when called in local mode.

### Packet A3: Tenant Router

1. Create `src/lib/saas/tenant-router.ts` with:
   - `extractTenantSlugFromHost(host)`
   - `resolveTenantFromRequest(request)`
   - `withTenant(handler)`
2. Add unit tests for host parsing:
   - valid subdomain
   - root domain
   - localhost/dev hostnames
   - malformed host header

### Packet A4: Polar Billing Skeleton

1. Create `src/lib/saas/billing.ts`.
2. Create [`src/app/api/webhooks/polar/route.ts`](/Users/nyk/work/products/mission-control/src/app/api/webhooks/polar/route.ts).
3. Implement:
   - signature verification
   - event dedupe write (`cp_webhook_events`)
   - tenant/billing state update
4. Emit audit + SSE event after successful transition.

### Packet B1: API Key Hierarchy + Auth Extension

1. Create `src/lib/saas/api-keys.ts`.
2. Extend [`src/lib/auth.ts`](/Users/nyk/work/products/mission-control/src/lib/auth.ts):
   - preserve current global `API_KEY` path
   - add hosted-mode prefixed key validation (`mc_pk_`, `mc_sk_`, `mc_ak_`)
3. Return enriched synthetic auth context with tenant metadata/scopes.
4. Add tests for:
   - valid/invalid prefix handling
   - revoked key
   - scope denial

### Packet B2: Signup Flows

1. Create:
   - `src/lib/saas/agent-signup.ts`
   - [`src/app/api/signup/route.ts`](/Users/nyk/work/products/mission-control/src/app/api/signup/route.ts)
   - [`src/app/api/signup/agent/route.ts`](/Users/nyk/work/products/mission-control/src/app/api/signup/agent/route.ts)
2. Flow:
   - validate payload
   - create checkout/session
   - persist pending tenant
   - enqueue provisioning job

### Packet C1: Rate Limits + Self-Service

1. Create:
   - `src/lib/saas/rate-limiter.ts`
   - `src/lib/saas/agent-self-service.ts`
   - [`src/app/api/agents/self-service/scale/route.ts`](/Users/nyk/work/products/mission-control/src/app/api/agents/self-service/scale/route.ts)
   - [`src/app/api/agents/self-service/budget/route.ts`](/Users/nyk/work/products/mission-control/src/app/api/agents/self-service/budget/route.ts)
2. Require scoped tenant/agent keys.
3. Log all quota denials and scale requests.

## Test Matrix (Required Before Merge)

1. Unit:
   - tenant host parser and mode gates
   - key hashing/verification/scope checks
   - plan limit decisions
2. Integration:
   - webhook signature pass/fail
   - webhook idempotency replay
   - signup creates pending tenant + enqueue side effects
3. Backward-compat:
   - `MC_TENANT_MODE=local` smoke test on existing auth routes
   - super-admin local routes unchanged
4. Type/build:
   - `pnpm typecheck`
   - `pnpm lint`
   - targeted test runs for new modules

## Operational Risks and Guardrails

1. Webhook replay/race conditions:
   - guard with unique provider event IDs and transaction boundaries.
2. Cross-tenant leakage:
   - require tenant resolution at API boundary, never from client body.
3. Provisioning deadlocks:
   - queue job timeout + retry cap + dead-letter queue.
4. Cost overruns (Redis/queue):
   - add hosted-mode metrics and alert thresholds early.
5. Key compromise:
   - short key display windows and immediate revocation path.

## Migration Note (Important)

The initial plan proposed `027_saas_api_keys`, but migration IDs `027` and `028` already exist.

Use:

1. `029_saas_api_keys_local`
2. `030_saas_usage_snapshots_local`
3. `031_adapter_configs_local`

and keep these tables optional/local-supporting only. Primary hosted source of truth remains Postgres control plane.

## Dependency Risk Review

Proposed additions:

1. `@neondatabase/serverless`
2. `@polar-sh/sdk`
3. `@upstash/redis`
4. `@upstash/ratelimit`
5. `bullmq`
6. `ioredis`

Risk controls:

1. Add only when stream starts (not all at once).
2. Pin minor versions initially.
3. Add feature flags around each integration.
4. Add integration tests with mocked webhooks and hosted-mode env matrix.

## Open Questions (Need Decision Before Build)

1. Canonical tenant identity mapping: `tenant_id` UUID only, or UUID + slug immutable pair?
2. Hosted auth bootstrap: should first human admin be created during successful billing webhook or immediately after checkout creation?
3. Provisioning failure policy: auto-refund/cancel, or suspend + retry window?
4. Data residency: any requirement beyond single-region initially?

## Acceptance Criteria Refinement

1. `MC_TENANT_MODE=local`: zero behavior diff in API auth and UI panels.
2. `MC_TENANT_MODE=hosted`: hosted-only routes available and local-only super-admin routes optionally hidden.
3. Polar webhook replay is idempotent.
4. Prefixed key creation + revocation + scope enforcement are test-covered.
5. Adapter factory returns deterministic adapter instances for supported frameworks.
6. Queue retries and dead-letter behavior are observable via events/audit.
7. New migrations apply cleanly on existing SQLite datasets.

## Source Links

1. Polar webhooks setup: https://docs.polar.sh/developers/webhooks
2. Polar webhook delivery/verification: https://docs.polar.sh/integrate/webhooks/delivery
3. Polar webhook endpoint API: https://docs.polar.sh/api-reference/webhooks/endpoints/create
4. Polar overview/pricing positioning: https://docs.polar.sh/webhooks
5. Neon connectivity guide (updated 2026): https://neon.com/docs/get-started-with-neon/connect-neon
6. Neon serverless driver GA note: https://neon.com/docs/changelog/2025-03-28
7. Upstash rate limit getting started: https://upstash.com/docs/redis/overall/ratelimit
8. Upstash rate limit algorithms: https://upstash.com/docs/redis/sdks/ratelimit-ts/algorithms
9. Upstash BullMQ integration: https://upstash.com/docs/redis/integrations/bullmq
10. BullMQ connection requirements: https://docs.bullmq.io/guide/connections
