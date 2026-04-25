# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # Next.js dev server with hot reload
npm run build      # Production build (validates everything compiles)
npm run preview    # OpenNext local preview (simulates Cloudflare Workers environment)
npm run deploy     # Build + deploy to Cloudflare (requires wrangler auth)
npm run lint       # next lint
node node_modules/typescript/bin/tsc --noEmit   # Type-check only (npx tsc has perms issues here)
```

There are no automated tests. Verify changes by running `tsc --noEmit` and exercising flows in `npm run dev`.

**Build cache gotcha:** Next.js 16 + Turbopack occasionally fails to resolve `next/font/google` modules (`@vercel/turbopack-next/internal/font/google/font` not found). When `npm run deploy` errors on font modules, clear the cache and retry: `rm -rf .next .open-next && npm run deploy`.

**Cloudflare Worker name** is `king-and-angel`. Use `wrangler secret put <NAME> --name king-and-angel` to set runtime env vars (the three Supabase keys are stored as secrets, not committed `[vars]`).

## High-level architecture

This is a 4–15 person "King & Angel" (secret-santa-style) activity site for 北京大学爱心社. The defining property: **pairing data is end-to-end encrypted with Shamir Secret Sharing** so that even the database operator and admins cannot see who is paired with whom until ≥ K participants combine their personal keys at a `/reveal` ceremony.

### The crypto pipeline (the load-bearing concept)

When the admin presses "seal" on `/admin/seal`, **everything happens in the admin's browser**:

1. Generate a random `ACTIVITY_KEY` (256-bit AES-GCM)
2. Build a derangement (random pairing, no self-pairing)
3. Shamir-split `ACTIVITY_KEY` into N shares with threshold K (`shamir-secret-sharing` lib)
4. For each angel `i`: derive `personal_key_i = HKDF(share_i, info="personal-envelope-v1")`, then AES-GCM-encrypt `{king_id, king_name, king_wishes[3]}` under it → `angel_envelopes` row
5. AES-GCM-encrypt the full pairing under `ACTIVITY_KEY` → `sealed_pairing` row (for the group reveal)
6. Submit ciphertexts **and the N (user_id, share) pairs** to the `publish_seal` Postgres RPC (atomic in one transaction: insert envelopes + sealed_pairing + insert pending_shares + flip seal_state to 'published' + TRUNCATE pre_seal_wishes)
7. Show the admin a "delivered" confirmation listing names; **no share strings ever appear on the admin's screen**

After this, every plaintext wish is gone from the database. Only ciphertexts and the per-user `pending_shares` rows remain. Each user later opens their dashboard, sees their own share via `ShareClaim.tsx`, copies it to their own notes, then clicks the destructive button → server DELETEs their `pending_shares` row. The full pairing requires ≥ K shares combined client-side at `/reveal`.

### Share distribution (burn-after-read via pending_shares)

Replaces the older "admin reads shares off-screen face-to-face" flow.

- **Schema**: `public.pending_shares (user_id PK → profiles, share text, created_at)`. RLS lets the user `SELECT` and `DELETE` only their own row. INSERT goes only through `publish_seal` (SECURITY DEFINER, service role).
- **publish_seal RPC takes 3 args** now: `envelopes jsonb, pairing jsonb, shares jsonb`. All four writes (envelopes, sealed_pairing, pending_shares, truncate pre_seal_wishes) happen in one transaction.
- **Server-side cleanup**: a `pg_cron` job named `cleanup-pending-shares` runs daily and deletes rows older than 7 days. Participants who don't claim within 7 days lose their key — the activity then needs to be re-sealed.
- **Client flow**:
  - `lib/dashboard.ts` `getParticipantDashboard` fetches the caller's `pending_shares.share` (RLS-scoped)
  - `app/dashboard/ShareClaim.tsx` displays it inside the 其二·开启信笺 tab, above `KingReveal`. Copy button + required checkbox + destructive "I've saved it" button → `consumeOwnShareAction` (RLS-scoped DELETE) → `router.refresh()` so the card disappears.

### Configuration is centralized

`lib/config.ts` exports `PARTICIPANT_TOTAL` and `REVEAL_THRESHOLD`. **Three places must stay in sync** when changing scale (e.g., 4→15):

1. `lib/config.ts` — used by all client/server TypeScript code
2. `supabase/migrations/20260425000003_pending_shares.sql` — `publish_seal` RPC has `expected_total constant int := N`. Changing the file is not enough; you must re-run `supabase db push --db-url <pooler>` (or paste the `create or replace function` block into the Dashboard SQL Editor) so the live function is replaced.
3. `supabase/migrations/20260425000001_initial_schema.sql` — sample invite codes at the bottom (only matters for fresh installs)

### Schema migrations

- **Canonical source**: `supabase/migrations/*.sql` (versioned, tracked in `supabase_migrations.schema_migrations`)
- The repo's `sql/01_schema.sql` and `sql/02_e2e_schema.sql` are the historical baseline — they were copied into migrations 001/002 and are kept for reference. Don't edit them as a way to change the DB; write a new migration instead.
- **Apply migrations** with `supabase db push --db-url "postgresql://postgres.<REF>:<PASSWORD>@aws-1-us-west-2.pooler.supabase.com:5432/postgres"`. The CLI's default direct-DB connection (`db.<REF>.supabase.co`) gets intercepted by TUN-mode proxies (Clash / Surge / Stash) returning fake IPs in `198.18.0.0/15`. Always use the pooler URL for `db push`.
- **Auth config** (email confirmations, MFA, site_url, etc.) lives in `supabase/config.toml` and is pushed via `supabase config push`. Notable: `enable_confirmations = false` (avoids the default SMTP rate limit during signup) and `site_url` is set to the Cloudflare Workers deploy URL. Don't run `config push` casually — it overwrites the entire auth config in one shot.

### Dashboard layout flips around `sealed`

`app/dashboard/page.tsx` branches on `sealed` (= `seal_state.status === 'published'`):

- **Pre-seal**: 其一·三条心愿 (`WishEditor`) is the headline section, then a 其二·开启信笺 placeholder, then `BoardTabs` (留言墙/任务板) below.
- **Post-seal**: `BoardTabs` moves to the top as the primary surface. `LettersTabs` follows, defaulting to 其二·开启信笺 (KingReveal + ShareClaim if pending_share exists). The 其一 tab becomes a memorial note since `pre_seal_wishes` was truncated. A 群体揭示 card linking to `/reveal` appears at the bottom.

### Server boundaries

- `lib/supabase/admin.ts` — service-role client (bypasses RLS). **Only ever import from server actions or server components.** Never from `"use client"` files.
- `lib/supabase/server.ts` — SSR client with cookie session, used inside server actions / server components for auth checks. RLS-scoped operations (e.g., `consumeOwnShareAction`'s DELETE) go through this client so the policy applies.
- `lib/supabase/client.ts` — browser client (currently only used by `SubmitButton`'s `useFormStatus`).
- `app/admin/seal/SealRunner.tsx` is `"use client"` and **must not** import from `lib/supabase/admin.ts`. The seal flow uploads ciphertext + shares via the `publishSealAction` server action, which is the only path that touches the admin client.

### Anonymity guarantees that depend on what you DON'T add

- `public_messages` table has **no sender column** — anonymity comes from the schema itself, not the application code. Do not add `created_by uuid` here.
- `tasks` table has **no `created_by`** column for the same reason. `claimed_by` is intentional (claiming is real-name).
- `sendMessageAction` and `uploadTaskAction` use the SSR client (so RLS insert policies apply for authenticated-only) but must never write `auth.uid()` to a column.

### pg_safeupdate

Supabase enables the `pg_safeupdate` extension which rejects bare `DELETE` / `UPDATE` without a `WHERE` clause **even inside SECURITY DEFINER PL/pgSQL functions**. Use `TRUNCATE` (e.g., for clearing `pre_seal_wishes` post-seal) or include a meaningful `WHERE` (`where id is not null` works for matching all rows).

### Per-user encryption identity

A user's "key" is a Shamir share string. After they claim it (via ShareClaim's destroy button) they keep it locally — when they later paste it into `KingReveal.tsx`, the derived `personal_key` is cached in **IndexedDB as a non-extractable CryptoKey** (`lib/crypto/keystore.ts`) — survives page reloads, auto-purged after 12h, also cleared on explicit Lock or sign-out. The share itself stays out of the database after the user clicks destroy.

### Server Actions runtime

Server Actions run on **Cloudflare Workers Node runtime** (via `@opennextjs/cloudflare`). No per-file `export const runtime = "edge"` annotations needed. The `wrangler.toml` declares `nodejs_compat` globally. All `lib/crypto/*` code is Web Crypto / `@noble/hashes`-based and fully compatible.

## File map (only the non-obvious bits)

```
lib/config.ts                          # ⭐ Single source of truth for scale
lib/crypto/                            # Web Crypto + @noble/hashes + shamir-secret-sharing wrappers
  ├── aead.ts                          # AES-GCM
  ├── hkdf.ts                          # HKDF(share) → personal AES key
  ├── sss.ts                           # Shamir wrapper, base64url share encoding
  ├── keystore.ts                      # IndexedDB cache for non-extractable CryptoKey
  └── encoding.ts
supabase/migrations/                   # ⭐ Canonical schema; apply via `supabase db push`
  ├── ...001_initial_schema.sql        # profiles + invites + activity_settings
  ├── ...002_e2e_schema.sql            # encrypted-era tables + claim_task/complete_task RPCs
  └── ...003_pending_shares.sql        # pending_shares + 3-arg publish_seal + 7-day pg_cron cleanup
supabase/config.toml                   # Auth config (push via `supabase config push`)
sql/01_schema.sql, sql/02_e2e_schema.sql  # Historical baseline only; do not edit to change schema
app/admin/seal/SealRunner.tsx          # The crypto ceremony, runs entirely client-side; never displays shares
app/dashboard/ShareClaim.tsx           # Burn-after-read share retrieval card
app/dashboard/KingReveal.tsx           # User pastes share → HKDF → decrypt own envelope
app/dashboard/LettersTabs.tsx          # Post-seal tabbed view: 其二 (KingReveal+ShareClaim) / 其一 (memorial)
app/dashboard/BoardTabs.tsx            # 其三 留言墙 / 其四 任务板 tab switcher
app/reveal/RevealClient.tsx            # ≥K participants paste shares → combine → decrypt sealed_pairing
wrangler.toml                          # Cloudflare Workers config (nodejs_compat, assets binding)
open-next.config.ts                    # OpenNext adapter config (currently empty, uses defaults)
```

## Git/commit conventions

**Never include `Co-Authored-By: Claude` or "Generated with Claude Code" footers in commit messages or PR bodies.** The user prefers GitHub Contributors to show only themselves. This was previously enforced by rewriting history + force push.

## Documentation surfaces

- `README.md` — developer/maintainer reference
- `DEPLOY.md` — Cloudflare Workers (via OpenNext) + Supabase deployment
- `USER_GUIDE.md` — non-technical participant walkthrough

When changing user-visible numbers (participant count, threshold), update all three docs to match `lib/config.ts`. The docs may still reference the older face-to-face share distribution — when touching them, also update the share-claim flow description to match the current burn-after-read model.

## Deployment

Uses `@opennextjs/cloudflare` (official Cloudflare adapter for Next.js, 2025). **Not** `@cloudflare/next-on-pages` (deprecated). Deploys to Cloudflare Workers (Node runtime), not Pages Functions (edge runtime). See `DEPLOY.md` for the 2-step quickstart (Supabase migrations + Cloudflare env vars).
