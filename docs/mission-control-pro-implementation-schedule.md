# Mission Control Pro Implementation Schedule (Streams 1-8)

Last reviewed: 2026-03-07
Scope: Streams 1-8 only (landing/email excluded)
Cadence: 10 working days, 8 PRs, backward compatibility required

## Delivery Rules

1. `MC_TENANT_MODE=local` must stay behavior-identical.
2. Hosted code lives under `src/lib/saas/*`, `src/lib/adapters/*`, and hosted routes.
3. Every PR must pass: `pnpm typecheck`, `pnpm lint`, targeted tests.
4. Billing implementation is Polar-only in v1.

## PR Plan

1. PR-1: Hosted config and mode gates
2. PR-2: Control plane DB + tenant router
3. PR-3: Polar billing webhook core
4. PR-4: Adapter layer (OpenClaw + Generic first)
5. PR-5: Provisioning runtime scaffolding + queue abstraction
6. PR-6: API keys + hosted auth extension
7. PR-7: Signup flows + provisioning enqueue
8. PR-8: Rate limits + self-service APIs + final hardening

## Day-by-Day Schedule

### Day 1

1. Create hosted feature flags and env parsing in [`src/lib/config.ts`](/Users/nyk/work/products/mission-control/src/lib/config.ts).
2. Add hosted guard helper (`isHostedMode`) in `src/lib/saas/guards.ts`.
3. Add initial unit tests for mode parsing and defaults.
4. Open PR-1.

Exit criteria:
1. Local mode default unchanged.
2. Hosted env validation only triggers when hosted mode enabled.

### Day 2

1. Create `src/lib/saas/control-plane-db.ts` with connection singleton and typed accessors.
2. Create `src/lib/saas/tenant-router.ts` with host parsing + `withTenant(handler)`.
3. Add tests for host parsing edge cases and local short-circuit behavior.
4. Open PR-2.

Exit criteria:
1. Tenant slug resolution deterministic for subdomains.
2. No route behavior changes in local mode.

### Day 3

1. Create `src/lib/saas/billing.ts` (Polar client wrapper + event mapper).
2. Add [`src/app/api/webhooks/polar/route.ts`](/Users/nyk/work/products/mission-control/src/app/api/webhooks/polar/route.ts) with signature verification and idempotency.
3. Add control-plane webhook event persistence contract.
4. Open PR-3.

Exit criteria:
1. Webhook replay is idempotent.
2. Invalid signature returns non-2xx.

### Day 4

1. Create adapter contract files in `src/lib/adapters/`.
2. Implement `openclaw` and `generic` adapters first.
3. Add adapter registry/factory and unit tests.
4. Open PR-4.

Exit criteria:
1. `getAdapter(framework)` deterministic for supported values.
2. Existing heartbeat route can call adapter abstraction without regressions.

### Day 5

1. Create `src/lib/saas/container-manager.ts` command builder and health interfaces.
2. Create `src/lib/saas/node-provisioner.ts` interface + stub Hetzner provider.
3. Introduce queue abstraction with BullMQ wiring behind hosted mode.
4. Open PR-5.

Exit criteria:
1. Command generation tests cover resource/security flags.
2. Queue retries and dead-letter path are testable.

### Day 6

1. Create `src/lib/saas/api-keys.ts` (generate, hash, verify, revoke).
2. Extend [`src/lib/auth.ts`](/Users/nyk/work/products/mission-control/src/lib/auth.ts) for hosted prefixed keys.
3. Keep legacy `API_KEY` auth path untouched.
4. Open PR-6.

Exit criteria:
1. `mc_pk_`/`mc_sk_`/`mc_ak_` auth works in hosted mode.
2. Local API key behavior unchanged.

### Day 7

1. Create `src/lib/saas/agent-signup.ts` orchestration service.
2. Add signup routes:
   - [`src/app/api/signup/route.ts`](/Users/nyk/work/products/mission-control/src/app/api/signup/route.ts)
   - [`src/app/api/signup/agent/route.ts`](/Users/nyk/work/products/mission-control/src/app/api/signup/agent/route.ts)
3. Add pending-tenant + provisioning enqueue integration.
4. Open PR-7.

Exit criteria:
1. Signup response shape stable and documented.
2. Billing and provisioning linkage captured with audit events.

### Day 8

1. Create `src/lib/saas/rate-limiter.ts` and `src/lib/saas/agent-self-service.ts`.
2. Add self-service routes:
   - [`src/app/api/agents/self-service/scale/route.ts`](/Users/nyk/work/products/mission-control/src/app/api/agents/self-service/scale/route.ts)
   - [`src/app/api/agents/self-service/budget/route.ts`](/Users/nyk/work/products/mission-control/src/app/api/agents/self-service/budget/route.ts)
3. Enforce per-plan limits and scope checks.
4. Start PR-8.

Exit criteria:
1. Rate limits enforced per key + plan.
2. Unauthorized scope requests rejected with clear errors.

### Day 9

1. Add SQLite support migrations in [`src/lib/migrations.ts`](/Users/nyk/work/products/mission-control/src/lib/migrations.ts):
   - `029_saas_api_keys_local`
   - `030_saas_usage_snapshots_local`
   - `031_adapter_configs_local`
2. Complete PR-8 with migration and observability hooks.
3. Add regression tests for local DB upgrade path.

Exit criteria:
1. Existing databases migrate cleanly.
2. No breakage to prior migration chain.

### Day 10

1. Full verification sweep:
   - `pnpm typecheck`
   - `pnpm lint`
   - `pnpm test`
2. Hosted/local smoke runbook checks.
3. Final docs sync in RFC/schedule notes.
4. Merge and tag release candidate.

Exit criteria:
1. All checks green.
2. Local compatibility and hosted activation both verified.

## Parallelization Guidance

1. Team A: PR-1/2/3 (config, control plane, billing).
2. Team B: PR-4/5 (adapters, provisioning).
3. Team C: PR-6/7/8 (auth keys, signup, self-service) after A dependencies are stable.

## Definition of Done

1. Hosted mode fully functional behind env flag.
2. Local mode parity maintained.
3. Billing webhook idempotency verified.
4. API key hierarchy validated end-to-end.
5. Adapter factory and self-service limits test-covered.
