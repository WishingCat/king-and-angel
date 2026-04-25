-- King & Angel platform · v3 schema
-- Add a transient pending_shares table so each participant can claim their
-- Shamir share from their own dashboard (instead of being read off the
-- admin's screen face-to-face). Share lives in the DB only between seal
-- and the user clicking "I've saved it · destroy".

-- =====================================================
-- 1. pending_shares table
-- =====================================================

create table if not exists public.pending_shares (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  share text not null,
  created_at timestamptz not null default now()
);

alter table public.pending_shares enable row level security;

-- Each user reads only their own share row.
drop policy if exists "read own pending share" on public.pending_shares;
create policy "read own pending share"
on public.pending_shares
for select
to authenticated
using (user_id = auth.uid());

-- Each user deletes only their own share row (the burn-after-read button).
drop policy if exists "delete own pending share" on public.pending_shares;
create policy "delete own pending share"
on public.pending_shares
for delete
to authenticated
using (user_id = auth.uid());

-- INSERTs only happen via publish_seal RPC under SECURITY DEFINER + service
-- role. No INSERT policy is needed — RLS will block all client INSERTs.

-- =====================================================
-- 2. Replace publish_seal RPC: add shares parameter
-- =====================================================

-- Drop the old 2-arg signature; the new function has a different argument
-- list, so create-or-replace alone won't suffice.
drop function if exists public.publish_seal(jsonb, jsonb);

create or replace function public.publish_seal(
  envelopes jsonb,
  pairing jsonb,
  shares jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  expected_total constant int := 4;
  participant_count int;
  wish_groups int;
  envelope_count int;
  envelope_distinct int;
  matched int;
  share_count int;
  share_distinct int;
  share_matched int;
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

  -- 6. Shares shape (one share per profile, distinct user_ids, all match a profile)
  select count(*) into share_count from jsonb_array_elements(shares);
  if share_count <> expected_total then
    raise exception 'wrong_share_count: expected %, got %', expected_total, share_count;
  end if;

  select count(distinct (elem->>'user_id')::uuid)
  into share_distinct
  from jsonb_array_elements(shares) elem;
  if share_distinct <> expected_total then
    raise exception 'duplicate_share_recipients';
  end if;

  select count(*) into share_matched
  from jsonb_array_elements(shares) elem
  join public.profiles p on p.id = (elem->>'user_id')::uuid;
  if share_matched <> expected_total then
    raise exception 'share_recipients_not_in_profiles';
  end if;

  -- 7. Insert envelopes
  insert into public.angel_envelopes (angel_user_id, ct, iv)
  select (elem->>'angel_user_id')::uuid,
         elem->>'ct',
         elem->>'iv'
  from jsonb_array_elements(envelopes) elem;

  -- 8. Insert sealed pairing singleton
  insert into public.sealed_pairing (id, ct, iv, manifest_sha256)
  values (1, pairing->>'ct', pairing->>'iv', pairing->>'manifest_sha256');

  -- 9. Insert pending shares (one row per user). Atomic with envelopes/pairing.
  insert into public.pending_shares (user_id, share)
  select (elem->>'user_id')::uuid,
         elem->>'share'
  from jsonb_array_elements(shares) elem;

  -- 10. Burn the plaintext wishes
  truncate table public.pre_seal_wishes;
end;
$$;

revoke all on function public.publish_seal(jsonb, jsonb, jsonb) from public;
-- Only the service role calls this; do not grant to authenticated.

-- =====================================================
-- 3. 7-day TTL cleanup via pg_cron
-- =====================================================

create extension if not exists pg_cron;

-- Re-create the cron job idempotently. cron.schedule errors on duplicate
-- jobname, so unschedule first if it exists.
do $$
begin
  perform cron.unschedule('cleanup-pending-shares');
exception
  when others then null;
end $$;

select cron.schedule(
  'cleanup-pending-shares',
  '17 3 * * *',
  $cleanup$
    delete from public.pending_shares
    where created_at < now() - interval '7 days'
  $cleanup$
);
