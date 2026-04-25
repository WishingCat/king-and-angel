# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # Next.js dev server with hot reload
npm run build      # Production build (validates everything compiles)
npm run lint       # next lint
node node_modules/typescript/bin/tsc --noEmit   # Type-check only (npx tsc has perms issues here)
```

There are no automated tests. Verify changes by running `tsc --noEmit` and exercising flows in `npm run dev`.

## High-level architecture

This is a 4–15 person "King & Angel" (secret-santa-style) activity site for 北京大学爱心社. The defining property: **pairing data is end-to-end encrypted with Shamir Secret Sharing** so that even the database operator and admins cannot see who is paired with whom until ≥ K participants combine their personal keys at a `/reveal` ceremony.

### The crypto pipeline (the load-bearing concept)

When the admin presses "seal" on `/admin/seal`, **everything happens in the admin's browser**:

1. Generate a random `ACTIVITY_KEY` (256-bit AES-GCM)
2. Build a derangement (random pairing, no self-pairing)
3. Shamir-split `ACTIVITY_KEY` into N shares with threshold K (`shamir-secret-sharing` lib)
4. For each angel `i`: derive `personal_key_i = HKDF(share_i, info="personal-envelope-v1")`, then AES-GCM-encrypt `{king_id, king_name, king_wishes[3]}` under it → `angel_envelopes` row
5. AES-GCM-encrypt the full pairing under `ACTIVITY_KEY` → `sealed_pairing` row (for the group reveal)
6. Submit only ciphertexts to the server via the `publish_seal` Postgres RPC (atomic: insert envelopes + sealed_pairing + flip seal_state to 'published' + DELETE all pre_seal_wishes)
7. Display the 15 share strings as a one-time distribution table; admin hands them out face-to-face

After this, **every plaintext wish is gone from the database**. Only ciphertexts remain. Each user later pastes their own share into `KingReveal.tsx`, derives their personal key in-browser, decrypts only their own envelope. The full pairing requires ≥ K shares combined client-side at `/reveal`.

### Configuration is centralized

`lib/config.ts` exports `PARTICIPANT_TOTAL` and `REVEAL_THRESHOLD`. **Three places must be kept in sync** when changing scale (e.g., 4→15):
1. `lib/config.ts` — used by all client/server TypeScript code
2. `sql/02_e2e_schema.sql` — `publish_seal` RPC has a hardcoded `expected_total constant int := N`. Changing the file is not enough; the `create or replace function` block must be re-executed in Supabase SQL Editor.
3. `sql/01_schema.sql` — sample invite codes at the bottom

See README §9 / DEPLOY.md Part 8 for the full switch procedure.

### Server boundaries

- `lib/supabase/admin.ts` — service-role client (bypasses RLS). **Only ever import from server actions or server components.** Never from `"use client"` files.
- `lib/supabase/server.ts` — SSR client with cookie session, used inside server actions / server components for auth checks.
- `lib/supabase/client.ts` — browser client (currently only used by `SubmitButton`'s `useFormStatus`).
- `app/admin/seal/SealRunner.tsx` is `"use client"` and **must not** import from `lib/supabase/admin.ts`. The seal flow uploads ciphertext via the `publishSealAction` server action, which is the only path that touches the admin client.

### Anonymity guarantees that depend on what you DON'T add

- `public_messages` table has **no sender column** — anonymity comes from the schema itself, not the application code. Do not add `created_by uuid` here.
- `tasks` table has **no `created_by`** column for the same reason. `claimed_by` is intentional (claiming is real-name).
- `sendMessageAction` and `uploadTaskAction` use the SSR client (so RLS insert policies apply for authenticated-only) but must never write `auth.uid()` to a column.

### Per-user encryption identity

A user's "key" is a Shamir share string they paste into `KingReveal.tsx`. After successful decryption, the derived `personal_key` is cached in **IndexedDB as a non-extractable CryptoKey** (`lib/crypto/keystore.ts`) — survives page reloads, auto-purged after 12h, also cleared on explicit Lock or sign-out. The share itself never enters the database, never reaches the server.

### Server Actions runtime

Server Actions currently use Node runtime (Next.js default). For Cloudflare Pages deployment, every Server Action and Server Component file would need `export const runtime = "edge"`. The supporting code in `lib/crypto/*` is already Web Crypto / `@noble/hashes`-based and edge-compatible.

## File map (only the non-obvious bits)

```
lib/config.ts                    # ⭐ Single source of truth for scale
lib/crypto/                      # Web Crypto + @noble/hashes + shamir-secret-sharing wrappers
  ├── aead.ts                    # AES-GCM
  ├── hkdf.ts                    # HKDF(share) → personal AES key
  ├── sss.ts                     # Shamir wrapper, base64url share encoding
  ├── keystore.ts                # IndexedDB cache for non-extractable CryptoKey
  └── encoding.ts
sql/01_schema.sql                # profiles + invites only
sql/02_e2e_schema.sql            # all encrypted-era tables + publish_seal RPC + claim_task/complete_task RPCs
app/admin/seal/SealRunner.tsx    # The crypto ceremony, runs entirely client-side
app/dashboard/KingReveal.tsx     # User pastes share → HKDF → decrypt own envelope
app/reveal/RevealClient.tsx      # ≥K participants paste shares → combine → decrypt sealed_pairing
```

## Git/commit conventions

**Never include `Co-Authored-By: Claude` or "Generated with Claude Code" footers in commit messages or PR bodies.** The user prefers GitHub Contributors to show only themselves. This was previously enforced by rewriting history + force push.

## Documentation surfaces

- `README.md` — developer/maintainer reference (architecture, SQL migrations, debugging, scale-switch §9)
- `DEPLOY.md` — Cloudflare Pages + Supabase deployment (Part 8 covers the test↔production switch)
- `USER_GUIDE.md` — non-technical participant walkthrough (currently written for 4-person test deployment)

When changing user-visible numbers (participant count, threshold), update all three docs to match `lib/config.ts`.
