-- The one email domain allowed to sign up, e.g. name@university.example. To reuse the app elsewhere,
-- change it here and SITE.emailDomain in src/config.ts (which the sign-in form checks first).
create function private.allowed_email_domain()
returns text
language sql
immutable
set search_path = ''
as $$
  select 'university.example';
$$;

grant usage on schema private to authenticated, supabase_auth_admin;
grant execute on function private.allowed_email_domain() to authenticated, supabase_auth_admin;

-- Before User Created auth hook: rejects sign-ups from outside the allowed domain.
-- The client checks too, but only this check can't be bypassed.
create function public.hook_restrict_signup_domain(event jsonb)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  c_http_forbidden constant int := 403;
  v_email text := lower(event -> 'user' ->> 'email');
begin
  if split_part(v_email, '@', 2) = private.allowed_email_domain() then
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

-- Only Supabase Auth may call the hook.
revoke execute on function public.hook_restrict_signup_domain(jsonb) from public, anon, authenticated;
grant execute on function public.hook_restrict_signup_domain(jsonb) to supabase_auth_admin;
