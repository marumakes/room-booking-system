-- Closing time: after it, hosts can't claim or release; committee can still clear and set the time.
begin;
create extension if not exists pgtap with schema extensions;
select plan(13);

-- Start from no users or sessions so local data can't change the results. Rolled back at the end.
delete from auth.users;
delete from public.sessions;
update public.settings set claims_close_at = null;

-- Fixtures: alex and sam are hosts, cora is committee.
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'alex@university.example'),
  ('00000000-0000-0000-0000-00000000000b', 'sam@university.example'),
  ('00000000-0000-0000-0000-00000000000c', 'cora@university.example');

insert into public.profiles (user_id, display_name) values
  ('00000000-0000-0000-0000-00000000000a', 'Alex'),
  ('00000000-0000-0000-0000-00000000000b', 'Sam'),
  ('00000000-0000-0000-0000-00000000000c', 'Cora');

insert into public.committee (user_id) values ('00000000-0000-0000-0000-00000000000c');

-- Room A on the next two Mondays, room B next Monday only.
insert into public.sessions (id, session_date, room) values
  ('20000000-0000-0000-0000-000000000001', date_trunc('week', current_date)::date + 7,  'A'),
  ('20000000-0000-0000-0000-000000000002', date_trunc('week', current_date)::date + 14, 'A'),
  ('20000000-0000-0000-0000-000000000003', date_trunc('week', current_date)::date + 7,  'B');

set local role authenticated;

-- Before closing: Alex holds A every week, Sam holds B.
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000a", "email": "alex@university.example", "role": "authenticated"}';
select public.claim_series('A', 'monday', 'shared');

set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000b", "email": "sam@university.example", "role": "authenticated"}';
select public.claim_slot('20000000-0000-0000-0000-000000000003', 'shared');

select throws_ok(
  $$select public.set_closing_time(now() - interval '1 minute')$$,
  'P0001', 'not_committee',
  'a host can''t set the closing time'
);

-- Cora closes sign-up a minute ago.
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000c", "email": "cora@university.example", "role": "authenticated"}';
select lives_ok(
  $$select public.set_closing_time(now() - interval '1 minute')$$,
  'committee can set the closing time'
);

select isnt(
  (select claims_close_at from public.settings),
  null,
  'signed-in users can read the closing time'
);

-- After closing, as Sam.
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000b", "email": "sam@university.example", "role": "authenticated"}';

select throws_ok(
  $$select public.claim_slot('20000000-0000-0000-0000-000000000001', 'shared')$$,
  'P0001', 'claims_closed',
  'no claims after closing'
);

select throws_ok(
  $$select public.claim_series('A', 'monday', 'shared')$$,
  'P0001', 'claims_closed',
  'no multi-book after closing'
);

select throws_ok(
  $$select public.release_claim('20000000-0000-0000-0000-000000000003')$$,
  'P0001', 'claims_closed',
  'no release after closing'
);

set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000a", "email": "alex@university.example", "role": "authenticated"}';

select throws_ok(
  $$select public.release_series('A', 'monday')$$,
  'P0001', 'claims_closed',
  'no releasing every week after closing'
);

-- Committee can still fix mistakes.
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000c", "email": "cora@university.example", "role": "authenticated"}';
select is(
  public.clear_claim('20000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-00000000000b'),
  1,
  'committee can still clear a claim after closing'
);

-- A closing time in the future leaves sign-up open.
select public.set_closing_time(now() + interval '1 day');
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000b", "email": "sam@university.example", "role": "authenticated"}';
select lives_ok(
  $$select public.claim_slot('20000000-0000-0000-0000-000000000003', 'shared')$$,
  'claims work before a future closing time'
);

-- Removing the closing time reopens sign-up.
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000c", "email": "cora@university.example", "role": "authenticated"}';
select public.set_closing_time(now() - interval '1 minute');
select public.set_closing_time(null);
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000b", "email": "sam@university.example", "role": "authenticated"}';
select is(
  public.release_claim('20000000-0000-0000-0000-000000000003'),
  1,
  'removing the closing time reopens sign-up'
);

-- The table itself can't be written, even by committee.
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000c", "email": "cora@university.example", "role": "authenticated"}';
select throws_ok(
  $$update public.settings set claims_close_at = null$$,
  '42501',
  null,
  'settings can only be changed through set_closing_time'
);

reset role;

set local role anon;
select throws_ok('select * from public.settings', '42501', null, 'anon can''t read the closing time');
select throws_ok('select public.set_closing_time(null)', '42501', null, 'anon can''t set the closing time');
reset role;

select * from finish();
rollback;
