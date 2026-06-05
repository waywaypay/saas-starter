# SocialOS — Build & Deploy Plan (v2, revised)

> Multi-tenant social media analytics platform. Greenfield rebuild — **start from 0**, do
> not recover the old repo.
>
> **DONE** = a real person can open the **deployed URL**, sign up, and immediately see their
> analytics dashboard populated with data. "Build passed" and "works locally" are NOT done.
> Every phase is verified by actually running it and observing the result. Never report
> success that was not personally observed.

---

## 0. What changed in v2 (review → amendment map)

This revision keeps the v1 architecture (it was sound) and fixes the items surfaced in
review. The old repo died from **build-time crashes** (`Lazily initialize Stripe client to
avoid build-time failure`, `Fix build failure when POSTGRES_URL is not set at build time`,
`prevent pricing page prerender crash when STRIPE_SECRET_KEY is absent`). Two parts of the
v1 plan walked back into that fire; one auth decision was internally contradictory. All
fixed below.

| ID | Severity | Issue in v1 | Resolution in v2 | Section |
|----|----------|-------------|------------------|---------|
| B1 | 🔴 Blocking | `lib/env.ts` "throws at startup" re-creates the build-time crash that killed the old repo (Next.js evaluates modules during `next build`). | Validation is **runtime-only and build-skippable**. `server-only` guard + `SKIP_ENV_VALIDATION` for the build step. Split build-required vs runtime-required vars. | §7 |
| B2 | 🔴 Blocking | Auth.js v5 **Credentials is incompatible with database sessions** the data model assumed. | Set `session.strategy: "jwt"` explicitly. `sessions` table kept for adapter compat only (OAuth), not the credential session store. `userId`/`activeTeamId` go in the JWT. | §4, D3 |
| B3 | 🔴 Blocking | Render config had a hidden manual step (`AUTH_URL sync:false`) and ran migrations in the wrong phase (`build`). | Migrations → `preDeployCommand`. `AUTH_URL` derived from `RENDER_EXTERNAL_URL` + `trustHost`. Cron `APP_URL` via `fromService` host. | §8 |
| B4 | 🔴 Blocking | Deploy DoD cannot be self-verified in-session without Render access. | Explicit **gate at step 7**: user connects Blueprint to Render (or provides API key) + confirms live URL. Steps 1–6 + CI are fully achievable without it. | §11, §13 |
| B5 | 🔴 Blocking | Two DoD items (tenant isolation, smoke signup) had no automated path. | Tenant-isolation **integration test** (A requests B's workspace → 403) in CI. Add `POST /api/auth/register` so smoke.sh/Playwright create users programmatically. | §10, §6 |
| S1 | 🟡 | Stripe at build time caused the old crashes. | **Zero Stripe SDK import in Phase 1.** Billing is a static empty state. `teams.stripe_*` columns stay (cheap, nullable). | D6 |
| S2 | 🟡 | `/api/health` shape implied always-200; a DB-down deploy would go live green. | Health returns **503 when `db:'down'`** (same JSON shape) so Render gates the deploy on it. | §6 |
| S3 | 🟡 | "Same id ⇒ same numbers" is non-reproducible if the seed mints random UUIDs. | Demo workspace/connection ids are **pinned constants**, not random. | §5, §3 |
| S4 | 🟡 | `engagementRate` denominator unspecified. | One shared named constant + formula, imported by server **and** client. | §5 |
| S5 | 🟡 | 90-day delta compares vs prior 90 → needs ≥180 days seeded. | Seed **≥180 days** of history; insufficient-history deltas return `null` + empty state. | §5 |
| S6 | 🟡 | No "active team" selection though a user can be in many. | `activeTeamId` on the JWT; `getWorkspaceForRequest()` has a deterministic default. | D4, §4 |
| S7 | 🟡 | `/demo` reads a known slug → looks like a tenancy-rule violation. | Explicit single allowlisted **read-only** demo slug; carved out in code + docs. | §6 |
| S8 | 🟡 | Playwright in stack but absent from CI. | Wire signup→dashboard e2e + the two-tenant 403 into CI. | §10 |
| S9 | 🟡 | Schema drift could fail in prod `preDeploy` instead of in CI. | `drizzle-kit` generate `--check` (migration-drift gate) in CI. | §10 |
| S10 | 🟡 | `ENCRYPTION_KEY` optional contradicts "tokens encrypted at rest". | Optional in Phase 1 (mock has no tokens); **required when any real provider enabled**. Scheme pinned: AES-256-GCM, per-row IV. | D7, §7 |
| N1–N5 | 🟢 | Node pin, pnpm cache, `'use client'` + `initialData`, `next-auth.d.ts`, `activity_logs` writes, `respondError()` helper. | All folded into §9–§10. | §9, §10 |

---

## 1. Mission & non-negotiables

Build and **deploy** SocialOS. You are the lead engineer and owner of the outcome. Verify
every phase by running it. The four original production failure modes are designed out, not
patched:

1. **No DB on host → every server action 500'd.** → Postgres provisioned by Blueprint;
   migrations run in `preDeployCommand`; `/api/health` gates the deploy on DB reachability.
2. **Hardcoded `secure:true` cookies dropped over http.** → Never hand-set cookie `secure`.
   Auth.js derives it from URL scheme + `trustHost`. `secure` is on only because prod is
   https, off automatically in local http.
3. **Dashboard read a hardcoded demo workspace.** → `getWorkspaceForRequest()` resolves
   workspace from **session + param**, 403 if the caller's team doesn't own it. No hardcoded
   tenant/workspace id anywhere except the one allowlisted public `/demo` slug.
4. **No sync layer, no CI → "it builds" ≠ "it runs."** → Sync service + `/api/cron/sync`;
   CI runs typecheck/lint/unit/integration/e2e/build against a real Postgres and asserts
   non-empty totals + tenant isolation before merge.

---

## 2. Decisions (defaults — already chosen, do not re-ask)

- **D1 — Data source.** Phase 1 ships a deterministic `MockProvider` behind an
  `AnalyticsProvider` interface. Real integrations (Instagram Graph, TikTok, LinkedIn,
  YouTube Data, Facebook Graph) are added later as adapters **without changing the UI or API
  layer**. Do not fake real APIs.
- **D2 — Deploy.** Render via Blueprint (`render.yaml`) + Render Postgres + Render Cron.
- **D3 — Auth.** Auth.js v5 (Credentials + optional Google OAuth) with the Drizzle adapter.
  **Session strategy is `jwt`** (required for Credentials — see B2). **Never hand-set cookie
  `secure`**; rely on `trustHost: true` + a correct `AUTH_URL`. Cookies end up secure only
  because production is https.
- **D4 — Tenancy.** `User → Team → Workspace → Connection`. **Every** query is scoped to the
  caller's team via `getWorkspaceForRequest()`. No hardcoded tenant/workspace ids. The
  session JWT carries `userId` + `activeTeamId`; the default workspace is the first workspace
  of the active team when `?workspace=` is absent.
- **D5 — Env validation (new).** Validation is **runtime-only and skippable during build**
  (`SKIP_ENV_VALIDATION=1`). Fail loud at first server use, never during `next build`.
- **D6 — No Stripe in Phase 1 (new).** Zero `stripe` SDK import in Phase 1 code. Billing UI
  is a static "coming soon" empty state. `teams.stripe_*` columns exist but are unused.
- **D7 — Encryption (new).** Token encryption is AES-256-GCM with a per-row random IV,
  keyed by `ENCRYPTION_KEY`. Optional in Phase 1 (mock has no tokens); **required** once any
  real provider is enabled.

---

## 3. Tech stack

Next.js 15 (App Router, RSC, Route Handlers) · TypeScript **strict** · Tailwind + shadcn/ui
· PostgreSQL + Drizzle ORM · Auth.js v5 · Zod (all input + env validation) · TanStack Query
(client data) · Recharts (charts) · Vitest (unit/integration) + Playwright (e2e smoke) ·
GitHub Actions (CI) · **pnpm**.

- Pin `packageManager` in `package.json` **and** Node via `engines` + `.nvmrc` + Render
  `runtime` (N1). One Node version everywhere.
- Demo seed ids are pinned constants in `lib/constants.ts` (S3).

---

## 4. Architecture (strict layering — no cross-layer shortcuts)

```
UI (RSC pages + 'use client' chart components)
  -> API route handlers (thin: auth, validate, call service, return typed JSON)
    -> services (lib/services: business logic, period math, recommendations)
      -> repositories (lib/db: typed Drizzle queries, ALWAYS tenant-scoped)
        -> Postgres
Providers (lib/providers): AnalyticsProvider interface + MockProvider (Phase 1)
                           + RealProviders (Phase 2)
Sync service: the ONLY caller of providers. Normalizes provider output into
              daily_metrics + posts (UPSERTs). UI/API never touch providers.
```

Swapping mock → real must touch **zero** UI/API code.

**Cross-cutting helpers**
- `getWorkspaceForRequest(req)` — resolves `{ workspace, team }` from session JWT
  (`activeTeamId`) + `?workspace=` param. Returns 403 if the caller's team doesn't own the
  workspace. The single chokepoint that enforces D4. (S6)
- `respondError(err, status)` — every route handler's `catch` returns the identical typed
  `ApiError` body (`{ error: { code, message } }`) + correct status; logs the real error
  server-side; never leaks a stack trace. (N5)
- `next-auth.d.ts` module augmentation adds `session.user.id` + `activeTeamId` so we hit
  "no `any`" with Auth.js. (N4)

**Auth specifics (B2).** `session: { strategy: "jwt" }`. `callbacks.jwt` stamps `userId` +
`activeTeamId`; `callbacks.session` exposes them. The adapter's `sessions` table stays for
OAuth/adapter compatibility but is **not** the credential session store. `trustHost: true`.

---

## 5. Provider interface, data model, seed

### Provider interface
```ts
interface AnalyticsProvider {
  platform: Platform
  getAccount(conn): Promise<AccountDTO>          // name, avatar, followers
  getDailyMetrics(conn, range): Promise<DailyMetricDTO[]>
  getPosts(conn, range): Promise<PostDTO[]>
}
```
`MockProvider` is **seeded deterministically by connection id** (same id ⇒ same numbers) so
demo data is stable and tests are reproducible. Because of that, demo connection ids are
**pinned constants** (S3) — a fresh seed in CI or a new deploy reproduces identical numbers.

### Data model (Drizzle / Postgres — exact tables)
- **users**: id, email (unique), password_hash, name, image, role, created_at, updated_at,
  deleted_at
- **accounts, sessions, verification_tokens**: per Auth.js Drizzle adapter. *(sessions is
  adapter-compat only; credential logins use JWT — B2.)*
- **teams**: id, name, plan_name, stripe_customer_id (nullable, unique),
  stripe_subscription_id (nullable, unique), subscription_status, created_at *(stripe_* unused
  in Phase 1 — D6)*
- **team_members**: id, user_id, team_id, role (owner|admin|member), joined_at; unique
  (user_id, team_id)
- **workspaces**: id, team_id, name, slug, created_at; unique (team_id, slug)
- **platform_connections**: id, workspace_id, platform
  (instagram|tiktok|linkedin|facebook|youtube), account_name, avatar_url, access_token
  (encrypted via D7, nullable for mock), is_active, connected_at, last_sync_at
- **daily_metrics**: id, connection_id, workspace_id, platform, date (date), followers,
  impressions, reach, engagements, profile_views; **UNIQUE (connection_id, date)**; index
  (workspace_id, date)
- **posts**: id, connection_id, workspace_id, platform, external_id, caption, content_type,
  posted_at, reach, impressions, likes, comments, shares, saves, link_clicks,
  engagement_rate, thumbnail_url, follower_count_at_post_time, discovery_score; **UNIQUE
  (connection_id, external_id)**; index (workspace_id, posted_at)
- **activity_logs**: id, team_id, user_id, action, ip_address, created_at

All metric writes are **UPSERTs** on their unique key ⇒ sync is idempotent.

### Shared metric math (S4)
`lib/metrics.ts` exports one `ENGAGEMENT_RATE` definition used by server **and** client:
`engagementRate = engagements / reach` (reach as denominator; if reach is 0 ⇒ rate is 0, not
NaN). No magic numbers; all such constants are named.

### Seed (`seed:demo`) — idempotent + reproducible
- Guarded by the unique demo workspace slug ⇒ safe to run on **every** deploy.
- Uses **pinned ids** for the demo team/workspace/connections (S3).
- Seeds **≥180 days** of `daily_metrics` history (S5) so the 90-day toggle has a full prior
  period to diff against. Across all five platforms.
- Running it twice does **not** duplicate (proven in step 3).

---

## 6. Pages, routes, API

**Public**
- `/` — branded SocialOS marketing page (real product story + CTAs; not a template).
- `/sign-in`, `/sign-up`
- `/demo` — read-only dashboard on the **single allowlisted** demo workspace slug. This is the
  one deliberate exception to D4: a public, read-only, hardcoded demo slug. Carved out
  explicitly so it is clearly intentional, not a tenancy leak. (S7)

**App (auth-gated under `/app`)**
- `/app` — overview (KPIs + reach/engagement time series + per-platform breakdown +
  7/30/90-day toggle)
- `/app/posts` — sortable/filterable post table + top performers
- `/app/discovery` — best time/day to post, best content types
- `/app/reports` — period report, CSV/PDF export
- `/app/connections` — connect/disconnect platforms, sync status
- `/app/settings` — team, members, **billing (static empty state — D6)**

**API (Route Handlers — all return typed JSON, all Zod-validated, all in try/catch +
`respondError`)**
- `GET  /api/health` → `{ ok, db: 'up'|'down', ts }`. **Returns 503 when `db:'down'`** so
  Render gates the deploy on it (S2).
- `GET  /api/overview?workspace=&days=7|30|90`
- `GET  /api/posts?workspace=&platform=&sort=&limit=`
- `GET  /api/discovery?workspace=&days=`
- `GET  /api/reports?workspace=&days=`
- `POST /api/connections` — connect/disconnect
- `POST /api/auth/register` — **new (B5)**: Zod-validated JSON signup so smoke.sh + Playwright
  create users without scraping CSRF tokens. Creates user → team → workspace → demo
  connections in one transaction, then the dashboard is populated on first load.
- `POST /api/cron/sync` — header `x-cron-secret: CRON_SECRET`

**Auth rule.** Resolve workspace from **session + param** via `getWorkspaceForRequest()`;
403 if the caller's team does not own it. `/api/health`, `/api/auth/register`, and
`/api/cron/sync` are the only non-session routes (cron uses the secret; register creates the
session).

### API contract — `/api/overview` (exact shape)
```ts
{
  totals: { reach, impressions, engagements, engagementRate, followers },
  deltas: {                       // vs prior equal period; null when insufficient history (S5)
    reachPct, engagementsPct, engagementRatePct, followersPct
  } | { reachPct: null, ... },
  perPlatform: [{ platform, followers, reach, engagementRate, wowChangePct }],
  timeSeries: [{ date, reach, engagements,
                 instagram, tiktok, linkedin, facebook, youtube }]
}
```
All endpoint response types are defined the same way and exported as **shared TS types** used
by both server and client.

---

## 7. Env / config (fail fast — but never at build, B1)

`lib/env.ts`:
- Guarded by `import 'server-only'` so a server env var can never leak into a client bundle.
- Zod-parses `process.env` and, on failure, throws **one** clear error listing every
  missing/invalid var.
- **Skips validation when `SKIP_ENV_VALIDATION` is set** — the build step sets it, so
  `next build` never throws on absent runtime secrets (this is the exact fix for the old
  build-time crash). Recommended: `@t3-oss/env-nextjs`, which enforces the server/client
  boundary and supports `skipValidation` natively; hand-rolling with `server-only` +
  `skipValidation` is acceptable.
- Imported everywhere; **never** read `process.env` directly in app code.

**Vars**
- *Build-required:* none. (`next build` runs with `SKIP_ENV_VALIDATION=1`.)
- *Runtime-required:* `DATABASE_URL`, `AUTH_SECRET`, `AUTH_URL`, `CRON_SECRET`.
- *Optional:* `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `ENCRYPTION_KEY` (becomes required
  when a real provider is enabled — D7/S10), platform creds.

---

## 8. Deploy (turnkey + self-verifying) — `render.yaml`

**databases:** one Postgres. *(Use a paid instance for anything the DoD calls "a real person
can open" — free Postgres expires and free web services cold-start ~50s, which makes
`curl -fsS` in cron/smoke flake.)*

**web service**
```yaml
runtime: node
buildCommand: pnpm install --frozen-lockfile && SKIP_ENV_VALIDATION=1 pnpm build
preDeployCommand: pnpm db:migrate && pnpm db:seed:demo     # B3: migrations here, not in build
startCommand: pnpm start
healthCheckPath: /api/health                                # 503 on db down fails the deploy (S2)
envVars:
  - key: DATABASE_URL
    fromDatabase: { name: socialos-db, property: connectionString }
  - key: AUTH_SECRET
    generateValue: true
  - key: CRON_SECRET
    generateValue: true
  - key: AUTH_URL
    fromService: { type: web, name: socialos-web, property: host }   # B3: no manual paste
  # trustHost:true in auth config; AUTH_URL derived from RENDER_EXTERNAL_URL host
```

**cron job:** daily —
```yaml
envVars:
  - key: APP_URL
    fromService: { type: web, name: socialos-web, property: host }   # RENDER_EXTERNAL_URL is web-only (B3)
  - key: CRON_SECRET
    fromService: { type: web, name: socialos-web, envVarKey: CRON_SECRET }
schedule: "0 6 * * *"
command: curl -fsS --max-time 30 --retry 3 -H "x-cron-secret: $CRON_SECRET" "$APP_URL/api/cron/sync"
```

- `seed:demo` is idempotent (unique slug guard) ⇒ safe on every deploy (B3 + S3).
- **`scripts/smoke.sh <BASE_URL>`:** (1) `GET /api/health` == 200; (2) `POST /api/auth/register`
  a random `smoke+<ts>@…` user (B5 — namespaced to avoid junk-user collisions); (3)
  `GET /api/overview` for their workspace == 200 with **non-empty totals**. Exit non-zero on
  any failure.

---

## 9. Quality bars

- TypeScript strict; **no `any`**, no non-null `!` to dodge types. `next-auth.d.ts`
  augmentation for `session.user.id`/`activeTeamId` (N4).
- Every route handler in try/catch → `respondError()`: log the real error server-side, return
  a typed `ApiError` body + correct status. Never leak stack traces (N5).
- Every page has explicit **loading, empty, and error** states.
- No hardcoded ids (except the one allowlisted demo slug), no magic numbers without a named
  const (engagement-rate denominator, day windows, etc.).
- Charts have accessible labels; tables are keyboard-navigable. Chart components are
  `'use client'`; server-fetched data is passed as TanStack Query `initialData` so the first
  paint shows seeded numbers with **no loading flash** (N3) — directly serves the DoD's
  "lands on a populated dashboard."
- `activity_logs` gets write paths in the service layer on login / connect / disconnect (N5b).

---

## 10. CI (`.github/workflows/ci.yml`) — block merge on red

On `pull_request`:
1. checkout · setup-node (pinned) · **`pnpm install --frozen-lockfile` with pnpm store cache**
   (N1/N2)
2. typecheck (`tsc --noEmit`)
3. eslint
4. **migration-drift gate** — `drizzle-kit generate --check` (or diff) fails the PR if
   `schema.ts` changed without a generated migration (S9). Catches drift in CI, not in prod
   `preDeploy`.
5. Start a **Postgres service container**, run migrations, then:
   - **vitest** unit
   - **integration**: seed + call the overview **service** → assert non-empty totals.
   - **tenant-isolation integration (B5)**: user A requests user B's workspace → **403**.
     This is failure-mode #3 and the highest regression risk — it lives in CI, not a manual
     two-browser check.
6. **Playwright e2e (S8)**: signup → populated dashboard renders seeded numbers; plus the
   two-tenant 403 path.
7. `next build` (with `SKIP_ENV_VALIDATION=1`).

All must pass to merge.

---

## 11. Build order — after EACH step, RUN IT and paste the evidence

1. **Scaffold + `lib/env.ts` (runtime, build-skippable) + DB + migrations.**
   *Prove:* `GET /api/health` → 200, `db:'up'`; `next build` succeeds with no runtime secrets
   present (proves B1).
2. **Auth (sign-up/in/out + `register` API + middleware), JWT strategy, `trustHost`.**
   *Prove:* a user row persists; `/app` while logged out redirects to `/sign-in`; logged in it
   renders; a login over local http keeps its cookie (proves failure-mode #2 fix).
3. **Data model + MockProvider + `seed:demo` (pinned ids, ≥180 days).**
   *Prove:* seed populates the demo workspace; running it **twice** does NOT duplicate
   (idempotent); same connection id ⇒ identical numbers (deterministic).
4. **Overview service + API + dashboard.**
   *Prove:* dashboard renders seeded numbers with no loading flash; 7/30/90 toggle changes
   them; deltas compute vs prior equal period (and show `null`/empty state when history is
   short).
5. **Posts / Discovery / Reports pages + APIs.**
6. **Connections UI + Sync service + `/api/cron/sync` + cron.**
   *Prove:* calling sync updates `last_sync_at` and writes/updates metric rows (idempotent).
7. **Deploy via Blueprint.** ⚠️ **Gate B4** — needs your Render connection (see §13). Then run
   `scripts/smoke.sh` against the **LIVE** url. Paste output.
8. **CI green on a PR** (incl. tenant-isolation + e2e).

---

## 12. Definition of Done — each item must be demonstrably TRUE on the DEPLOYED URL, backed by the command/output used to verify it

- [ ] A fresh visitor sees a branded SocialOS marketing page (not a template).
      → open `/`.
- [ ] Sign-up succeeds and lands on a **populated** dashboard; refresh keeps you in.
      → `POST /api/auth/register` + browser; refresh.
- [ ] Two separate accounts **cannot** see each other's data.
      → automated tenant-isolation test (A→B = 403) **+** two-browser manual spot check.
- [ ] `GET /api/overview` → 200 with totals + per-platform + 30-day series.
      → `curl` the live endpoint with a real session.
- [ ] Cron sync updates `last_sync_at` and metric rows.
      → trigger `/api/cron/sync`, diff the rows before/after.
- [ ] CI is green and `scripts/smoke.sh` passes against production.
      → CI run link + smoke output.

**If any item cannot be verified, STOP and say so explicitly. Do not claim done.**

---

## 13. The one thing only you (max) can unblock — B4

The deploy DoD items require connecting the Blueprint to Render, which is a dashboard/OAuth
action this agent **cannot** perform in-session. Pick one and tell me:

- **(a)** You connect `waywaypay/saas-starter` to Render via the Blueprint, then hand me the
  live URL. `AUTH_URL` auto-derives, so no manual paste. *(recommended)*
- **(b)** You provide a Render API key and I drive it.

Until then: **steps 1–6 + CI (step 8) are fully achievable and verifiable in-session.** Only
step 7 and the three deploy-dependent DoD checkboxes block on B4. Knowing this at step 0 (not
step 7) is the point.

---

## 14. Guardrails

- Do not invent platform APIs. When adding a real provider, cite its official docs and note
  the OAuth scopes + app-review steps required.
- Do not claim a deploy works without curling the live URL **in this session**.
- Keep all secrets out of the repo; `.env` is gitignored; tokens encrypted at rest (D7).
- **Never let app code throw at build time** for a missing runtime secret. Build with
  `SKIP_ENV_VALIDATION=1`; validate at first runtime use. This is the #1 lesson from the
  deleted history.
- **Never hand-set cookie `secure`.** Let Auth.js derive it from scheme + `trustHost`.
- **No `stripe` SDK import in Phase 1.**
