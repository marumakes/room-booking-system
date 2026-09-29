-- Deny everything by default; anon gets nothing at all.
alter table public.sessions enable row level security;
alter table public.profiles enable row level security;
alter table public.signups enable row level security;
alter table public.committee enable row level security;

revoke all on public.sessions, public.profiles, public.signups, public.committee
  from anon, authenticated;

-- Signed-in users read sessions, names and claims. Claims are written only via functions.
grant select on public.sessions, public.profiles, public.signups to authenticated;
grant insert (user_id, display_name), update (display_name) on public.profiles to authenticated;

create policy sessions_select on public.sessions
  for select to authenticated
  using (true);

create policy signups_select on public.signups
  for select to authenticated
  using (true);

create policy profiles_select on public.profiles
  for select to authenticated
  using (true);

create policy profiles_insert_own on public.profiles
  for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy profiles_update_own on public.profiles
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Whether the caller is on committee. Definer rights so the committee table stays unreadable.
create function public.is_committee()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.committee where user_id = (select auth.uid())
  );
$$;

revoke execute on function public.is_committee() from public, anon;
grant execute on function public.is_committee() to authenticated;
