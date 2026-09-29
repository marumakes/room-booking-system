-- Internal helpers. Not exposed through the API.
create schema private;
revoke all on schema private from public;

-- The organisation's time zone. To reuse the app elsewhere, change it here and SITE.timeZone in src/config.ts.
create function private.site_time_zone()
returns text
language sql
immutable
set search_path = ''
as $$
  select 'Europe/London';
$$;

-- Today in the site's time zone, so "past session" matches the local calendar.
create function private.site_today()
returns date
language sql
stable
set search_path = ''
as $$
  select (now() at time zone private.site_time_zone())::date;
$$;

-- The signed-in caller, who must have set a display name before claiming.
create function private.require_claimant()
returns uuid
language plpgsql
stable
set search_path = ''
as $$
declare
  v_owner uuid := auth.uid();
begin
  if v_owner is null then
    raise exception using message = 'not_authenticated';
  end if;

  if not exists (select 1 from public.profiles where user_id = v_owner) then
    raise exception using message = 'profile_missing';
  end if;

  return v_owner;
end;
$$;

-- Locks one session row so concurrent claims on it run one at a time.
create function private.lock_session(p_session_id uuid)
returns public.sessions
language plpgsql
set search_path = ''
as $$
declare
  v_session public.sessions;
begin
  select * into v_session from public.sessions where id = p_session_id for update;

  if not found then
    raise exception using message = 'session_not_found';
  end if;

  return v_session;
end;
$$;

-- Why this host can't claim this session in this mode, or null if they can.
-- Caller must hold the session's row lock.
create function private.claim_blocker(
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

-- Writes the claim rows: both slots for quiet, the lowest free slot for shared.
create function private.insert_claim(
  p_session_id uuid,
  p_owner uuid,
  p_mode public.claim_mode
)
returns void
language plpgsql
set search_path = ''
as $$
begin
  if p_mode = 'quiet' then
    insert into public.signups (session_id, slot_number, owner_id, mode)
    values (p_session_id, 1, p_owner, p_mode),
           (p_session_id, 2, p_owner, p_mode);
    return;
  end if;

  insert into public.signups (session_id, slot_number, owner_id, mode)
  select p_session_id, min(slot), p_owner, p_mode
    from generate_series(1, 2) as slot
   where not exists (
     select 1 from public.signups
      where session_id = p_session_id and slot_number = slot
   );
end;
$$;

-- True when the room is booked on every session date of that day, i.e. can be multi-booked.
create function private.room_is_full_term(p_room text, p_day public.day_type)
returns boolean
language sql
stable
set search_path = ''
as $$
  select count(*) = (
           select count(distinct session_date)
             from public.sessions
            where day_type = p_day
         )
    from public.sessions
   where room = p_room and day_type = p_day;
$$;

-- Claims one session for the caller. Raises with a reason code if it can't.
create function public.claim_slot(p_session_id uuid, p_mode public.claim_mode)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid := private.require_claimant();
  v_session public.sessions := private.lock_session(p_session_id);
  v_blocker text;
begin
  v_blocker := private.claim_blocker(v_session, v_owner, p_mode);

  if v_blocker is not null then
    raise exception using message = v_blocker;
  end if;

  perform private.insert_claim(v_session.id, v_owner, p_mode);
end;
$$;

-- Claims every future week of a full-term room, all or nothing.
-- Returns the conflicting dates (nothing claimed), or an empty array on success.
-- Weeks the caller already holds are skipped, not treated as conflicts.
create function public.claim_series(
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

-- Releases the caller's claim on one session (both rows if quiet). Returns rows removed.
create function public.release_claim(p_session_id uuid)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_removed int;
begin
  delete from public.signups
   where session_id = p_session_id and owner_id = auth.uid();

  get diagnostics v_removed = row_count;
  return v_removed;
end;
$$;

-- Releases the caller's claims on all future weeks of a room. Returns rows removed.
create function public.release_series(p_room text, p_day public.day_type)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_removed int;
begin
  delete from public.signups su
   using public.sessions se
   where su.session_id = se.id
     and su.owner_id = auth.uid()
     and se.room = p_room
     and se.day_type = p_day
     and se.session_date >= private.site_today();

  get diagnostics v_removed = row_count;
  return v_removed;
end;
$$;

-- Committee only: removes one host's claim on a session. Returns rows removed.
create function public.clear_claim(p_session_id uuid, p_owner_id uuid)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_removed int;
begin
  if not public.is_committee() then
    raise exception using message = 'not_committee';
  end if;

  delete from public.signups
   where session_id = p_session_id and owner_id = p_owner_id;

  get diagnostics v_removed = row_count;
  return v_removed;
end;
$$;

-- Only signed-in users may call the claim API.
revoke execute on function
  public.claim_slot(uuid, public.claim_mode),
  public.claim_series(text, public.day_type, public.claim_mode),
  public.release_claim(uuid),
  public.release_series(text, public.day_type),
  public.clear_claim(uuid, uuid)
  from public, anon;

grant execute on function
  public.claim_slot(uuid, public.claim_mode),
  public.claim_series(text, public.day_type, public.claim_mode),
  public.release_claim(uuid),
  public.release_series(text, public.day_type),
  public.clear_claim(uuid, uuid)
  to authenticated;
