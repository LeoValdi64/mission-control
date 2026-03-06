# Mission Control Pro — Finalized Plan (Tenant-First)

Date: March 7, 2026
Status: Updated after codebase validation + web research

## 1) Market & Positioning Research (What changed)

### 1.1 Emerging pattern: "Agent Marketplace + Agent Runtime"
Across active players, the stack is splitting into two product layers:

- Discovery/packaging layer (marketplace/store): agent templates, skills, prompts, teams.
- Execution/governance layer (runtime/control plane): auth, billing, tenancy, isolation, audit.

### 1.2 souls.zip signal (directly relevant)
Souls positions around:

- "production-tested" assets
- mixed free + paid catalog
- low-friction install path via downloadable package + setup instructions
- account/login and creator attribution

This indicates your "shop" idea is directionally correct, but you should avoid becoming only a catalog. The moat is tenant-safe execution and governance.

### 1.3 Adjacent market signal

- Zapier Agents: frames AI as "teammates" and pushes orchestration + app connectivity.
- Agent.ai: positions as professional network/marketplace for agents.
- OpenAI GPT Store: validates distribution/store behavior for agent-like artifacts.
- Stripe docs now explicitly support LLM/agent workflows and agent tool integrations.
- Sandboxing vendors (E2B, Modal, Daytona, Open Agent/sandboxed.sh): strong demand for secure untrusted code execution with snapshots, isolation, and long-running sessions.

## 2) Critical Correction to Prior Plan

The old recommendation "first do migration 028 to link tenant->workspace" is stale for this repo.

Already implemented in this codebase:

- `029_link_workspaces_to_tenants` exists.
- Tenant context is already present in auth/session flows.

Therefore the next bottleneck is not schema linkage; it is **system-wide tenant-boundary enforcement and provisioning gatekeeping**.

## 3) Final Product Thesis (Mission Control Pro)

Two products, one codebase:

- Mission Control OSS (local): free, full-featured self-host.
- Mission Control Pro (hosted): paid managed runtime and governance.

Core value for Pro:

1. Tenant-safe orchestration (billing/account entity)
2. Workspace/project isolation (execution and data boundaries)
3. Agent-native procurement/provisioning ("shop")
4. Secure execution substrate (containers/sandboxes)

## 4) Canonical Domain Model (locked)

- Tenant = account/billing/legal entity.
- Tenant owns 1..N Workspaces.
- Workspace owns 1..N Projects.
- Projects own task queues, agents, adapters, and execution jobs.

Ownership rule:

- Every request touching workspace/project resources must resolve `activeTenantId` and enforce tenant match before access or mutation.

## 5) Finalized Stream Plan (Reordered by true risk)

## Stream A — Tenant Boundary Enforcement (Highest Priority)

Goal: close cross-tenant leakage risk.

Deliverables:

- Central guard helpers:
  - `ensureTenantWorkspaceAccess(tenantId, workspaceId)`
  - `ensureTenantProjectAccess(tenantId, projectId)`
- Replace direct workspace/project lookups with guarded variants across all API routes.
- Add deny-by-default behavior when tenant context is absent.
- Add audit logging for denied cross-tenant attempts.

Definition of done:

- No route can read/write workspace/project data without tenant guard invocation.
- Attempted cross-tenant access returns 403 and emits an audit event.

## Stream B — Provisioning Gatekeeper API (Second)

Goal: enable agent/human provisioning safely inside tenant scope.

Deliverables:

- `POST /api/pro/provision` (idempotent)
- Input: `skill_id`, `workspace_id`, optional budget/config
- Checks:
  - workspace belongs to active tenant
  - tenant subscription/credits valid
  - plan limits allow requested capability
- Output:
  - `provision_id`, status (`queued|running|ready|failed`), resulting capability reference

Definition of done:

- Tenant A cannot provision into Tenant B.
- Repeated request idempotency key returns same job/result.

## Stream C — Billing Control Plane Hardening (Third)

Goal: make billing state authoritative for entitlement checks.

Deliverables:

- Polar webhook processing with signature verification and replay protection.
- Canonical entitlement state per tenant (`trialing`, `active`, `past_due`, `canceled`).
- Unified `checkPlanLimits(tenantId, capability)` consumed by provisioning + runtime rate limiting.

Definition of done:

- Entitlement transitions tested end-to-end from webhook payload -> tenant state -> API authorization behavior.

## Stream D — Execution Isolation Upgrade (Fourth)

Goal: safely run untrusted agent actions.

Deliverables:

- Abstract runtime provider interface:
  - `ContainerRuntimeProvider` (today)
  - `SandboxRuntimeProvider` (phase-in)
- Start with existing Docker path + strict limits.
- Add pluggable backend for stronger isolation (Open Agent/sandboxed.sh, E2B, or Modal-based secure runner depending on deployment constraints).

Definition of done:

- Runtime choice is config-driven and tenant-scoped.
- Command/audit logs map runtime instance -> tenant/workspace/project.

## Stream E — Shop/Skills UX on top of secure backend (Fifth)

Goal: package and discover capabilities with safe activation.

Deliverables:

- Skill catalog metadata model.
- Install flow always routed through provisioning gatekeeper.
- Local mode keeps file-backed skill editing UX; hosted mode adds entitlement checks.

Definition of done:

- No direct "install and execute" bypasses gatekeeper.

## 6) What to Keep / Drop from Earlier Drafts

Keep:

- SaaS code isolation under `src/lib/saas` and `src/lib/adapters`.
- Adapter strategy for OpenClaw + external frameworks.
- Redis-based rate limiting.

Drop or revise:

- "Do tenant-workspace migration first" (already done).
- Any route that checks only `workspace_id` without tenant guard.
- Any provisioning path that can run before billing/entitlement checks.

## 7) Verification Matrix (Updated)

Must-pass checks before announcing Pro alpha:

1. Tenant boundary tests:
   - same user/session cannot access foreign-tenant workspace/project by ID guessing.
2. Provisioning authorization tests:
   - valid tenant + active plan succeeds.
   - inactive/canceled tenant blocked.
3. Webhook integrity tests:
   - invalid signature rejected.
   - replayed event ignored.
4. Runtime traceability tests:
   - every run has tenant/workspace/project correlation IDs.
5. Local mode regression:
   - `MC_TENANT_MODE=local` behavior unchanged for existing users.

## 8) First Handoff Prompt (Most Important Part)

Use this exact prompt for the next coding agent:

---

**HANDOFF PROMPT — Tenant Boundary Enforcement Sweep (Priority 0)**

You are implementing a security-critical tenant isolation sweep in Mission Control.

### Objective
Enforce strict Tenant -> Workspace -> Project access boundaries across all API routes and data helpers.

### Context
- The schema link already exists (`workspaces.tenant_id` linked to `tenants.id`; migration `029_link_workspaces_to_tenants`).
- Existing auth/session already carries tenant context in many paths.
- Remaining risk is inconsistent guard usage in route handlers and DB helpers.

### Tasks
1. Create central guard helpers in `src/lib/auth.ts` or `src/lib/workspaces.ts`:
   - `ensureTenantWorkspaceAccess(db, tenantId, workspaceId)`
   - `ensureTenantProjectAccess(db, tenantId, projectId)`
   - Throw typed `ForbiddenError` on mismatch.

2. Perform route sweep and patch all workspace/project APIs:
   - Every route that accepts `workspaceId` or `projectId` must call guard helper before read/write.
   - Replace any direct `WHERE id = ?` lookups with tenant-scoped variants.

3. Add audit logging for denied access attempts:
   - Event type: `tenant_access_denied`
   - Payload includes: `tenantId`, `workspaceId|projectId`, `route`, `actorId`.

4. Add regression tests:
   - Positive case: tenant can access own workspace/project.
   - Negative case: tenant cannot access foreign workspace/project by crafted ID.
   - Verify HTTP 403 and audit event emission.

5. Do not change local-mode UX or feature surface.

### Constraints
- Backward compatibility for `MC_TENANT_MODE=local` is mandatory.
- No broad refactor unrelated to tenant guards.
- Use parameterized queries only.

### Acceptance Criteria
- All workspace/project routes are tenant-guarded.
- Cross-tenant access blocked consistently with 403.
- Tests added and passing for both allow/deny cases.
- `pnpm typecheck` passes.

---

## 9) Decision on sandboxed.sh integration right now

Recommendation: integrate via abstraction, not hard-couple immediately.

- Add runtime provider interface now.
- Keep current Docker backend as default.
- Pilot `sandboxed.sh`/Open Agent path as optional provider behind feature flag for hosted tenants.

Reason: preserves delivery speed while enabling stronger isolation without architectural rework.

## 10) Suggested immediate sequence (next 2 handoffs)

1. Handoff #1 (above): Tenant Boundary Enforcement Sweep.
2. Handoff #2: Provisioning Gatekeeper (`POST /api/pro/provision`) with billing + idempotency + queue.

