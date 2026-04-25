-- King & Angel platform · v2 schema
-- E2E pairing encryption + Shamir Secret Sharing + new task / message board

-- =====================================================
-- 1. Drop legacy tables (no real data to migrate)
-- =====================================================

drop table if exists public.task_submissions cascade;
drop table if exists public.task_assignments cascade;
drop table if exists public.task_rounds cascade;
drop table if exists public.task_templates cascade;
drop table if exists public.anonymous_messages cascade;
drop table if exists public.king_assignments cascade;
drop table if exists public.wishes cascade;

-- activity_settings is no longer used by the new flow; keep it for now but unused.

-- =====================================================
-- 2. Pre-seal wishes (3 per user, plaintext until seal)
-- =====================================================

create table if not exists public.pre_seal_wishes (
  user_id uuid not null references public.profiles(id) on delete cascade,
  wish_index smallint not null check (wish_index between 0 and 2),
  content text not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, wish_index),
  constraint pre_seal_wish_length check (char_length(trim(content)) between 1 and 200)
);

alter table public.pre_seal_wishes enable row level security;

drop policy if exists "read own pre-seal wishes" on public.pre_seal_wishes;
create policy "read own pre-seal wishes"
on public.pre_seal_wishes
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "upsert own pre-seal wishes" on public.pre_seal_wishes;
create policy "upsert own pre-seal wishes"
on public.pre_seal_wishes
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "update own pre-seal wishes" on public.pre_seal_wishes;
create policy "update own pre-seal wishes"
on public.pre_seal_wishes
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

-- =====================================================
-- 3. Seal state (singleton row id=1)
-- =====================================================

create table if not exists public.seal_state (
  id smallint primary key check (id = 1),
  status text not null check (status in ('open', 'published')),
  sealed_at timestamptz
);

insert into public.seal_state (id, status)
values (1, 'open')
on conflict (id) do nothing;

alter table public.seal_state enable row level security;

drop policy if exists "read seal state" on public.seal_state;
create policy "read seal state"
on public.seal_state
for select
to authenticated
using (true);

-- updates to seal_state happen via service-role admin client only; no client policy.

-- =====================================================
-- 4. Angel envelopes (per-user, share-encrypted)
-- =====================================================

create table if not exists public.angel_envelopes (
  angel_user_id uuid primary key references public.profiles(id) on delete cascade,
  ct text not null,            -- base64 ciphertext
  iv text not null,            -- base64 12-byte IV
  created_at timestamptz not null default now()
);

alter table public.angel_envelopes enable row level security;

drop policy if exists "read own angel envelope" on public.angel_envelopes;
create policy "read own angel envelope"
on public.angel_envelopes
for select
to authenticated
using (angel_user_id = auth.uid());

-- inserts done via service-role admin during seal; no client policy.

-- =====================================================
-- 5. Sealed pairing (singleton, ACTIVITY_KEY-encrypted full map)
-- =====================================================

create table if not exists public.sealed_pairing (
  id smallint primary key check (id = 1),
  ct text not null,
  iv text not null,
  manifest_sha256 text not null,
  created_at timestamptz not null default now()
);

alter table public.sealed_pairing enable row level security;

drop policy if exists "read sealed pairing" on public.sealed_pairing;
create policy "read sealed pairing"
on public.sealed_pairing
for select
to authenticated
using (true);

-- =====================================================
-- 6. Public message board (anonymous, plaintext, no sender)
-- =====================================================

create table if not exists public.public_messages (
  id bigint primary key generated always as identity,
  content text not null,
  created_at timestamptz not null default now(),
  constraint public_message_length check (char_length(trim(content)) between 1 and 500)
);

alter table public.public_messages enable row level security;

drop policy if exists "read public messages" on public.public_messages;
create policy "read public messages"
on public.public_messages
for select
to authenticated
using (true);

drop policy if exists "post public messages" on public.public_messages;
create policy "post public messages"
on public.public_messages
for insert
to authenticated
with check (true);

-- =====================================================
-- 7. Task board (anonymous upload, real-name claim)
-- =====================================================

create table if not exists public.tasks (
  id bigint primary key generated always as identity,
  title text not null,
  description text not null,
  created_at timestamptz not null default now(),
  claimed_by uuid references public.profiles(id) on delete set null,
  claimed_at timestamptz,
  completed_at timestamptz,
  constraint task_title_length check (char_length(trim(title)) between 1 and 80),
  constraint task_desc_length check (char_length(trim(description)) between 1 and 500),
  constraint task_completed_requires_claimed check (
    completed_at is null or claimed_by is not null
  )
);

alter table public.tasks enable row level security;

drop policy if exists "read tasks" on public.tasks;
create policy "read tasks"
on public.tasks
for select
to authenticated
using (true);

drop policy if exists "create tasks" on public.tasks;
create policy "create tasks"
on public.tasks
for insert
to authenticated
with check (
  claimed_by is null and claimed_at is null and completed_at is null
);

-- updates only via SECURITY DEFINER RPCs below — no direct UPDATE policy.

-- =====================================================
-- 8. Race-safe claim / complete RPCs
-- =====================================================

create or replace function public.claim_task(task_id bigint)
returns public.tasks
language plpgsql
security definer
set search_path = public
as $$
declare
  updated public.tasks;
begin
  update public.tasks
  set claimed_by = auth.uid(),
      claimed_at = now()
  where id = task_id
    and claimed_by is null
  returning * into updated;

  if updated.id is null then
    raise exception 'task_unavailable';
  end if;

  return updated;
end;
$$;

revoke all on function public.claim_task(bigint) from public;
grant execute on function public.claim_task(bigint) to authenticated;

create or replace function public.complete_task(task_id bigint)
returns public.tasks
language plpgsql
security definer
set search_path = public
as $$
declare
  updated public.tasks;
begin
  update public.tasks
  set completed_at = now()
  where id = task_id
    and claimed_by = auth.uid()
    and completed_at is null
  returning * into updated;

  if updated.id is null then
    raise exception 'task_not_completable';
  end if;

  return updated;
end;
$$;

revoke all on function public.complete_task(bigint) from public;
grant execute on function public.complete_task(bigint) to authenticated;

-- =====================================================
-- 9. Atomic seal publication
-- Inputs:
--   envelopes: jsonb array [{ angel_user_id uuid, ct text, iv text }, ...]
--   pairing:   jsonb       { ct text, iv text, manifest_sha256 text }
-- Behavior:
--   * Asserts seal_state.status = 'open' (race-safe via RETURNING)
--   * Asserts the expected number of profiles exist (set via expected_total below)
--   * Asserts each profile has 3 pre_seal_wishes rows
--   * Asserts envelopes covers exactly that many distinct profile ids
--   * Inserts envelopes + sealed_pairing + flips seal_state to 'published'
--   * Deletes pre_seal_wishes (so plaintext wishes stop existing in DB)
-- All in one transaction. Designed to be invoked with the service-role key
-- (the server action does the admin auth check before calling).
-- =====================================================

create or replace function public.publish_seal(envelopes jsonb, pairing jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  -- 活动总人数。4 人测试版用 4；切回正式版改成 15，并同步修改 lib/config.ts
  expected_total constant int := 4;
  participant_count int;
  wish_groups int;
  envelope_count int;
  envelope_distinct int;
  matched int;
  updated_status text;
begin
  -- 1. Atomic seal-state guard
  update public.seal_state
  set status = 'published',
      sealed_at = now()
  where id = 1
    and status = 'open'
  returning status into updated_status;

  if updated_status is null then
    raise exception 'seal_already_published';
  end if;

  -- 2. Headcount
  select count(*) into participant_count from public.profiles;
  if participant_count <> expected_total then
    raise exception 'wrong_participant_count: expected %, got %', expected_total, participant_count;
  end if;

  -- 3. Each profile has 3 wishes
  select count(*) into wish_groups
  from (
    select user_id
    from public.pre_seal_wishes
    group by user_id
    having count(*) = 3
  ) t;
  if wish_groups <> expected_total then
    raise exception 'incomplete_wishes: % users have full 3 wishes', wish_groups;
  end if;

  -- 4. Envelopes shape
  select count(*) into envelope_count from jsonb_array_elements(envelopes);
  if envelope_count <> expected_total then
    raise exception 'wrong_envelope_count: expected %, got %', expected_total, envelope_count;
  end if;

  select count(distinct (elem->>'angel_user_id')::uuid)
  into envelope_distinct
  from jsonb_array_elements(envelopes) elem;
  if envelope_distinct <> expected_total then
    raise exception 'duplicate_envelope_recipients';
  end if;

  -- 5. Each envelope's angel_user_id must correspond to an existing profile
  select count(*) into matched
  from jsonb_array_elements(envelopes) elem
  join public.profiles p on p.id = (elem->>'angel_user_id')::uuid;
  if matched <> expected_total then
    raise exception 'envelope_recipients_not_in_profiles';
  end if;

  -- 6. Insert envelopes
  insert into public.angel_envelopes (angel_user_id, ct, iv)
  select (elem->>'angel_user_id')::uuid,
         elem->>'ct',
         elem->>'iv'
  from jsonb_array_elements(envelopes) elem;

  -- 7. Insert sealed pairing singleton
  insert into public.sealed_pairing (id, ct, iv, manifest_sha256)
  values (1, pairing->>'ct', pairing->>'iv', pairing->>'manifest_sha256');

  -- 8. Burn the plaintext wishes
  delete from public.pre_seal_wishes;
end;
$$;

revoke all on function public.publish_seal(jsonb, jsonb) from public;
-- Only the service role calls this; do not grant to authenticated.
