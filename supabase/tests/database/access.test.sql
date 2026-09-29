-- Who can read and write what: anon, a host, committee, and the auth hook.
begin;
create extension if not exists pgtap with schema extensions;
select plan(35);

-- Start from no users or sessions so local data (e.g. dev claims) can't clash with fixtures. Rolled back at the end.
delete from auth.users;
delete from public.sessions;

-- Fixtures: alex and sam are hosts, cora is committee.
-- eve is an outsider who got an account anyway, e.g. if the sign-up hook was off.
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'alex@university.example'),
  ('00000000-0000-0000-0000-00000000000b', 'sam@university.example'),
  ('00000000-0000-0000-0000-00000000000c', 'cora@university.example'),
  ('00000000-0000-0000-0000-00000000000e', 'eve@gmail.com');

insert into public.profiles (user_id, display_name) values
  ('00000000-0000-0000-0000-00000000000a', 'Alex'),
  ('00000000-0000-0000-0000-00000000000b', 'Sam'),
  ('00000000-0000-0000-0000-00000000000c', 'Cora'),
  ('00000000-0000-0000-0000-00000000000e', 'Eve');

insert into public.committee (user_id) values ('00000000-0000-0000-0000-00000000000c');

insert into public.sessions (id, session_date, room) values
  ('10000000-0000-0000-0000-000000000001', date_trunc('week', current_date)::date + 7, 'A');

insert into public.signups (session_id, slot_number, owner_id, mode) values
  ('10000000-0000-0000-0000-000000000001', 1, '00000000-0000-0000-0000-00000000000a', 'shared');

-- Schema: rooms carry their PDF position so they can be listed in PDF order.
select col_not_null('public', 'sessions', 'room_position', 'sessions have a room position');

-- Live updates: claim and name changes are broadcast (Realtime still applies each viewer's RLS).
select ok(
  exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'signups'),
  'claim changes are published for live updates'
);
select ok(
  exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'profiles'),
  'name changes are published for live updates'
);

-- Schema: day_type follows the date.
select is(
  (select day_type::text from public.sessions where id = '10000000-0000-0000-0000-000000000001'),
  'monday',
  'day_type is derived from session_date'
);

-- Any weekday can be a session day; its day_type comes from the date.
insert into public.sessions (session_date, room) values (date_trunc('week', current_date)::date + 8, 'A');
select is(
  (select day_type::text from public.sessions where session_date = date_trunc('week', current_date)::date + 8),
  'tuesday',
  'a Tuesday session is accepted and labelled tuesday'
);

-- Anon: nothing readable or callable.
set local role anon;

select throws_ok('select * from public.sessions', '42501', null, 'anon cannot read sessions');
select throws_ok('select * from public.signups', '42501', null, 'anon cannot read signups');
select throws_ok('select * from public.profiles', '42501', null, 'anon cannot read profiles');
select throws_ok(
  $$select public.claim_slot('10000000-0000-0000-0000-000000000001', 'shared')$$,
  '42501', null, 'anon cannot claim'
);
select throws_ok('select public.is_committee()', '42501', null, 'anon cannot call is_committee');

reset role;

-- Alex (Host): reads data, but every signup write must go through the claim functions.
set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000a", "email": "alex@university.example", "role": "authenticated"}';

select isnt_empty('select * from public.sessions', 'Host can read sessions');
select lives_ok('select * from public.signups', 'Host can read signups');
select isnt_empty('select * from public.profiles', 'Host can read display names');

select throws_ok(
  $$insert into public.signups (session_id, slot_number, owner_id, mode)
    values ('10000000-0000-0000-0000-000000000001', 1, '00000000-0000-0000-0000-00000000000a', 'shared')$$,
  '42501', null, 'Host cannot insert signups directly'
);
select throws_ok('delete from public.signups', '42501', null, 'Host cannot delete signups directly');
select throws_ok($$update public.signups set mode = 'quiet'$$, '42501', null, 'Host cannot update signups');
select throws_ok('delete from public.sessions', '42501', null, 'Host cannot delete sessions');

select throws_ok('select * from public.committee', '42501', null, 'Host cannot read committee');
select throws_ok(
  $$insert into public.committee (user_id) values ('00000000-0000-0000-0000-00000000000a')$$,
  '42501', null, 'Host cannot add themselves to committee'
);
select is(public.is_committee(), false, 'Host is not committee');

select throws_ok(
  $$insert into public.profiles (user_id, display_name) values ('00000000-0000-0000-0000-00000000000d', 'Fake')$$,
  '42501', null, 'Host cannot create a profile for someone else'
);

update public.profiles set display_name = 'Hacked' where user_id = '00000000-0000-0000-0000-00000000000b';
select is(
  (select display_name from public.profiles where user_id = '00000000-0000-0000-0000-00000000000b'),
  'Sam',
  'Host cannot rename someone else'
);

update public.profiles set display_name = 'Alexandra' where user_id = '00000000-0000-0000-0000-00000000000a';
select is(
  (select display_name from public.profiles where user_id = '00000000-0000-0000-0000-00000000000a'),
  'Alexandra',
  'Host can rename themselves'
);

select throws_ok(
  $$update public.profiles set display_name = ' sam ' where user_id = '00000000-0000-0000-0000-00000000000a'$$,
  '23505', null, 'display names are unique, ignoring case and spaces'
);

select throws_ok(
  $$select public.hook_restrict_signup_domain('{"user": {"email": "x@university.example"}}')$$,
  '42501', null, 'Host cannot call the auth hook'
);

-- Eve (outside-domain, got past sign-up somehow): sees and claims nothing.
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000e", "email": "eve@gmail.com", "role": "authenticated"}';

select is_empty('select * from public.sessions', 'outsider sees no sessions');
select is_empty('select * from public.signups', 'outsider sees no claims');
select is_empty('select * from public.profiles', 'outsider sees no names');
select throws_ok(
  $$select public.claim_slot('10000000-0000-0000-0000-000000000001', 'shared')$$,
  'P0001', 'email_not_allowed', 'outsider cannot claim'
);
select throws_ok(
  $$select public.claim_series('A', 'monday', 'shared')$$,
  'P0001', 'email_not_allowed', 'outsider cannot multi-book'
);

update public.profiles set display_name = 'Eve 2' where user_id = '00000000-0000-0000-0000-00000000000e';
reset role;
select is(
  (select display_name from public.profiles where user_id = '00000000-0000-0000-0000-00000000000e'),
  'Eve',
  'outsider cannot edit their profile'
);
set local role authenticated;

-- Cora (committee).
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000c", "email": "cora@university.example", "role": "authenticated"}';
select is(public.is_committee(), true, 'committee member is recognised');

reset role;

-- Auth hook: only exact university.example addresses get through.
select is(
  public.hook_restrict_signup_domain('{"user": {"email": "a.student@university.example"}}'),
  '{}'::jsonb,
  'university.example email is allowed'
);
select ok(
  public.hook_restrict_signup_domain('{"user": {"email": "someone@gmail.com"}}') ? 'error',
  'other domain is rejected'
);
select ok(
  public.hook_restrict_signup_domain('{"user": {"email": "x@university.example.evil.com"}}') ? 'error',
  'lookalike domain is rejected'
);

select * from finish();
rollback;
