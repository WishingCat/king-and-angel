-- King & Angel platform · scale switch from 4 → 15
-- The publish_seal RPC's expected_total guard is hardcoded; updating it
-- requires re-creating the function with the new constant.

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
  expected_total constant int := 15;
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
