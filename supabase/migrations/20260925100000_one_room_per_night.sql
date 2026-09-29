-- A host may hold at most one room per night. In a multi-book, a night where the host already
-- has a different room counts as a conflict (so nothing is booked).

-- Serialises one host's claims. The session row lock only covers one room, so without this
-- two simultaneous claims for different rooms on the same night could both succeed.
create function private.lock_owner(p_owner uuid)
returns void
language sql
set search_path = ''
as $$
  select pg_advisory_xact_lock(hashtextextended(p_owner::text, 0));
$$;

revoke execute on function private.lock_owner(uuid) from public;

-- Adds the one-room-per-night rule; otherwise unchanged.
create or replace function private.claim_blocker(
  p_session public.sessions,
  p_owner uuid,
  p_mode public.claim_mode
)
returns text
language plpgsql
stable
set search_path = ''
as $$
declare
  v_taken int;
  v_own int;
  v_quiet int;
begin
  if not p_session.available then
    return 'session_unavailable';
  end if;

  if p_session.session_date < private.site_today() then
    return 'session_past';
  end if;

  select count(*),
         count(*) filter (where owner_id = p_owner),
         count(*) filter (where mode = 'quiet')
    into v_taken, v_own, v_quiet
    from public.signups
   where session_id = p_session.id;

  if v_own > 0 then
    return 'already_claimed';
  end if;

  -- Already in a different room that night.
  if exists (
    select 1
      from public.signups su
      join public.sessions se on se.id = su.session_id
     where su.owner_id = p_owner
       and se.session_date = p_session.session_date
       and se.id <> p_session.id
  ) then
    return 'already_booked_tonight';
  end if;

  if p_mode = 'quiet' and v_taken > 0 then
    return 'room_taken';
  end if;

  -- Full when quiet-booked or both slots are held.
  if v_quiet > 0 or v_taken >= 2 then
    return 'room_full';
  end if;

  return null;
end;
$$;

-- Takes the host lock before checking; otherwise unchanged.
create or replace function public.claim_slot(p_session_id uuid, p_mode public.claim_mode)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid := private.require_claimant();
  v_session public.sessions;
  v_blocker text;
begin
  perform private.lock_owner(v_owner);
  v_session := private.lock_session(p_session_id);
  v_blocker := private.claim_blocker(v_session, v_owner, p_mode);

  if v_blocker is not null then
    raise exception using message = v_blocker;
  end if;

  perform private.insert_claim(v_session.id, v_owner, p_mode);
end;
$$;

-- Takes the host lock before checking; otherwise unchanged.
create or replace function public.claim_series(
  p_room text,
  p_day public.day_type,
  p_mode public.claim_mode
)
returns date[]
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid := private.require_claimant();
  v_session public.sessions;
  v_blocker text;
  v_conflicts date[] := '{}';
  v_to_claim uuid[] := '{}';
  v_session_id uuid;
begin
  if not private.room_is_full_term(p_room, p_day) then
    raise exception using message = 'room_not_every_week';
  end if;

  perform private.lock_owner(v_owner);

  -- Lock in date order so overlapping series claims can't deadlock.
  for v_session in
    select * from public.sessions
     where room = p_room
       and day_type = p_day
       and session_date >= private.site_today()
     order by session_date
       for update
  loop
    v_blocker := private.claim_blocker(v_session, v_owner, p_mode);

    if v_blocker = 'already_claimed' then
      continue;
    end if;

    if v_blocker is not null then
      v_conflicts := v_conflicts || v_session.session_date;
      continue;
    end if;

    v_to_claim := v_to_claim || v_session.id;
  end loop;

  if cardinality(v_conflicts) > 0 then
    return v_conflicts;
  end if;

  if cardinality(v_to_claim) = 0 then
    raise exception using message = 'nothing_to_claim';
  end if;

  foreach v_session_id in array v_to_claim loop
    perform private.insert_claim(v_session_id, v_owner, p_mode);
  end loop;

  return v_conflicts;
end;
$$;
