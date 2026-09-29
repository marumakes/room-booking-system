-- Claim history: an append-only record of every claim, release and committee clear,
-- for settling disputes and for the export. Filled by triggers, readable by committee only.

-- claimed/released/cleared: by a host or committee. removed: by deleting the user (no actor).
create type public.claim_action as enum ('claimed', 'released', 'cleared', 'removed');

-- Snapshot columns, not foreign keys, so entries stay readable after sessions or users are deleted
-- and later renames don't rewrite the past.
create table public.claim_history (
  id bigint generated always as identity primary key,
  occurred_at timestamptz not null default now(),
  action public.claim_action not null,
  session_id uuid not null,
  session_date date not null,
  room text not null,
  mode public.claim_mode not null,
  owner_id uuid not null,
  owner_name text not null,
  actor_id uuid,
  actor_name text
);

create index claim_history_occurred_at_idx on public.claim_history (occurred_at desc);

alter table public.claim_history enable row level security;
revoke all on public.claim_history from anon, authenticated;
grant select on public.claim_history to authenticated;

create policy claim_history_select_committee on public.claim_history
  for select to authenticated
  using (public.is_committee());

-- The host's current display name, or the last one recorded if their profile is already gone
-- (e.g. deleting a user removes the profile before its claims).
create function private.display_name_for(p_user uuid)
returns text
language sql
stable
set search_path = ''
as $$
  select coalesce(
    (select display_name from public.profiles where user_id = p_user),
    (select owner_name from public.claim_history where owner_id = p_user order by id desc limit 1),
    'Unknown host'
  );
$$;

-- One entry per claim per night: a quiet claim's two slots count once.
-- Claims on sessions that no longer exist (sessions being deleted) aren't recorded.
create function private.record_claims()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
begin
  insert into public.claim_history
    (action, session_id, session_date, room, mode, owner_id, owner_name, actor_id, actor_name)
  select distinct
    'claimed'::public.claim_action, c.session_id, s.session_date, s.room, c.mode, c.owner_id,
    private.display_name_for(c.owner_id), v_actor,
    case when v_actor is null then null else private.display_name_for(v_actor) end
  from added c
  join public.sessions s on s.id = c.session_id;

  return null;
end;
$$;

-- released: the host gave it up. cleared: someone else (committee) removed it. removed: no signed-in actor.
create function private.record_releases()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
begin
  insert into public.claim_history
    (action, session_id, session_date, room, mode, owner_id, owner_name, actor_id, actor_name)
  select distinct
    case
      when v_actor is null then 'removed'::public.claim_action
      when v_actor = c.owner_id then 'released'::public.claim_action
      else 'cleared'::public.claim_action
    end,
    c.session_id, s.session_date, s.room, c.mode, c.owner_id,
    private.display_name_for(c.owner_id), v_actor,
    case when v_actor is null then null else private.display_name_for(v_actor) end
  from removed c
  join public.sessions s on s.id = c.session_id;

  return null;
end;
$$;

create trigger signups_record_claims
  after insert on public.signups
  referencing new table as added
  for each statement execute function private.record_claims();

create trigger signups_record_releases
  after delete on public.signups
  referencing old table as removed
  for each statement execute function private.record_releases();
