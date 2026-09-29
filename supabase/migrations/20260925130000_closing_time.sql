-- Closing time: after it, hosts can no longer claim or release, so the committee's export is final.
-- Committee can still clear claims, to fix mistakes before exporting.

-- One row holding the closing time; null = no closing time set (sign-up open).
create table public.settings (
  id boolean primary key default true check (id),
  claims_close_at timestamptz
);

insert into public.settings default values;

alter table public.settings enable row level security;
revoke all on public.settings from anon, authenticated;
grant select on public.settings to authenticated;

create policy settings_select on public.settings
  for select to authenticated
  using (true);

-- Open apps lock as soon as the committee sets or changes the time.
alter publication supabase_realtime add table public.settings;

-- Raises claims_closed once the closing time has passed.
create function private.require_open()
returns void
language plpgsql
stable
set search_path = ''
as $$
begin
  if exists (select 1 from public.settings where claims_close_at <= now()) then
    raise exception using message = 'claims_closed';
  end if;
end;
$$;

-- Committee only: sets the closing time, or clears it with null.
create function public.set_closing_time(p_close_at timestamptz)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_committee() then
    raise exception using message = 'not_committee';
  end if;

  -- The API rejects UPDATE without WHERE (safeupdate), even on a one-row table.
  update public.settings set claims_close_at = p_close_at where id;
end;
$$;

revoke execute on function public.set_closing_time(timestamptz) from public, anon;
grant execute on function public.set_closing_time(timestamptz) to authenticated;

-- Checks the closing time first; otherwise unchanged.
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
  perform private.require_open();
  perform private.lock_owner(v_owner);
  v_session := private.lock_session(p_session_id);
  v_blocker := private.claim_blocker(v_session, v_owner, p_mode);

  if v_blocker is not null then
    raise exception using message = v_blocker;
  end if;

  perform private.insert_claim(v_session.id, v_owner, p_mode);
end;
$$;

-- Checks the closing time first; otherwise unchanged.
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
  perform private.require_open();

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

-- Checks the closing time first; otherwise unchanged.
create or replace function public.release_claim(p_session_id uuid)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_removed int;
begin
  perform private.require_open();

  delete from public.signups
   where session_id = p_session_id and owner_id = auth.uid();

  get diagnostics v_removed = row_count;
  return v_removed;
end;
$$;

-- Checks the closing time first; otherwise unchanged.
create or replace function public.release_series(p_room text, p_day public.day_type)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_removed int;
begin
  perform private.require_open();

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
