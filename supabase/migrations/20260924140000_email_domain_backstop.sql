-- Backstop for the sign-up hook (a Supabase beta feature): even if it's off,
-- a signed-in user from outside the allowed domain can read and claim nothing.

-- Single source for the allowed email domain, shared by the hook and the access checks.
create function private.is_allowed_email(p_email text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select split_part(lower(coalesce(p_email, '')), '@', 2) = private.allowed_email_domain();
$$;

-- Whether the caller's token carries an email from the allowed domain.
create function private.is_allowed_user()
returns boolean
language sql
stable
set search_path = ''
as $$
  select private.is_allowed_email(auth.jwt() ->> 'email');
$$;

-- Policies and the hook need these two helpers; every other private function stays uncallable.
revoke execute on all functions in schema private from public;
alter default privileges in schema private revoke execute on functions from public;
grant usage on schema private to authenticated, supabase_auth_admin;
grant execute on function private.is_allowed_email(text), private.is_allowed_user(), private.allowed_email_domain() to authenticated;
grant execute on function private.is_allowed_email(text), private.allowed_email_domain() to supabase_auth_admin;

-- Reads and profile writes require an email from the allowed domain.
alter policy sessions_select on public.sessions
  using (private.is_allowed_user());

alter policy signups_select on public.signups
  using (private.is_allowed_user());

alter policy profiles_select on public.profiles
  using (private.is_allowed_user());

alter policy profiles_insert_own on public.profiles
  with check (user_id = (select auth.uid()) and private.is_allowed_user());

alter policy profiles_update_own on public.profiles
  using (user_id = (select auth.uid()) and private.is_allowed_user())
  with check (user_id = (select auth.uid()) and private.is_allowed_user());

-- Claims require an email from the allowed domain as well as a display name.
create or replace function private.require_claimant()
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

  if not private.is_allowed_user() then
    raise exception using message = 'email_not_allowed';
  end if;

  if not exists (select 1 from public.profiles where user_id = v_owner) then
    raise exception using message = 'profile_missing';
  end if;

  return v_owner;
end;
$$;

-- Hook now uses the shared domain check.
create or replace function public.hook_restrict_signup_domain(event jsonb)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  c_http_forbidden constant int := 403;
begin
  if private.is_allowed_email(event -> 'user' ->> 'email') then
    return '{}'::jsonb;
  end if;

  return jsonb_build_object(
    'error', jsonb_build_object(
      'message', format('Only @%s email addresses can sign up.', private.allowed_email_domain()),
      'http_code', c_http_forbidden
    )
  );
end;
$$;
