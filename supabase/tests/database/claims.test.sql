-- Claim, multi-book, release and committee clear, through the public functions.
begin;
create extension if not exists pgtap with schema extensions;
select plan(32);

-- Start from no users or sessions so seed and dev data can't change the results. Rolled back at the end.
delete from auth.users;
delete from public.sessions;

-- Fixtures: alex, sam, erin, finn and cora (committee) have profiles; dora has none.
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'alex@university.example'),
  ('00000000-0000-0000-0000-00000000000b', 'sam@university.example'),
  ('00000000-0000-0000-0000-00000000000c', 'cora@university.example'),
  ('00000000-0000-0000-0000-00000000000d', 'dora@university.example'),
  ('00000000-0000-0000-0000-00000000000e', 'erin@university.example'),
  ('00000000-0000-0000-0000-00000000000f', 'finn@university.example');

insert into public.profiles (user_id, display_name) values
  ('00000000-0000-0000-0000-00000000000a', 'Alex'),
  ('00000000-0000-0000-0000-00000000000b', 'Sam'),
  ('00000000-0000-0000-0000-00000000000c', 'Cora'),
  ('00000000-0000-0000-0000-00000000000e', 'Erin'),
  ('00000000-0000-0000-0000-00000000000f', 'Finn');

insert into public.committee (user_id) values ('00000000-0000-0000-0000-00000000000c');

-- Three Mondays: last week (past), next week, the week after.
-- A: every week. B: next week only (part-term). C: every week, but cancelled the week after next.
insert into public.sessions (id, session_date, room, available) values
  ('10000000-0000-0000-0000-000000000001', date_trunc('week', current_date)::date - 7,  'A', true),
  ('10000000-0000-0000-0000-000000000002', date_trunc('week', current_date)::date + 7,  'A', true),
  ('10000000-0000-0000-0000-000000000003', date_trunc('week', current_date)::date + 14, 'A', true),
  ('10000000-0000-0000-0000-000000000004', date_trunc('week', current_date)::date + 7,  'B', true),
  ('10000000-0000-0000-0000-000000000005', date_trunc('week', current_date)::date - 7,  'C', true),
  ('10000000-0000-0000-0000-000000000006', date_trunc('week', current_date)::date + 7,  'C', true),
  ('10000000-0000-0000-0000-000000000007', date_trunc('week', current_date)::date + 14, 'C', false);

set local role authenticated;

-- Single claims: shared fills slot 1 then slot 2, then the room is full.
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000a", "email": "alex@university.example", "role": "authenticated"}';

select lives_ok(
  $$select public.claim_slot('10000000-0000-0000-0000-000000000002', 'shared')$$,
  'alex claims a shared slot'
);
select results_eq(
  $$select slot_number, mode::text, owner_id from public.signups
     where session_id = '10000000-0000-0000-0000-000000000002'$$,
  $$values (1, 'shared', '00000000-0000-0000-0000-00000000000a'::uuid)$$,
  'first shared claim takes slot 1'
);
select throws_ok(
  $$select public.claim_slot('10000000-0000-0000-0000-000000000002', 'shared')$$,
  'P0001', 'already_claimed', 'alex cannot take a second slot in the same room'
);
select throws_ok(
  $$select public.claim_slot('10000000-0000-0000-0000-000000000001', 'shared')$$,
  'P0001', 'session_past', 'past sessions cannot be claimed'
);
select throws_ok(
  $$select public.claim_slot('10000000-0000-0000-0000-000000000007', 'shared')$$,
  'P0001', 'session_unavailable', 'cancelled sessions cannot be claimed'
);
select throws_ok(
  $$select public.claim_slot('10000000-0000-0000-0000-0000000000ff', 'shared')$$,
  'P0001', 'session_not_found', 'unknown session is rejected'
);

set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000b", "email": "sam@university.example", "role": "authenticated"}';

select lives_ok(
  $$select public.claim_slot('10000000-0000-0000-0000-000000000002', 'shared')$$,
  'sam claims the other shared slot'
);
select results_eq(
  $$select slot_number, owner_id from public.signups
     where session_id = '10000000-0000-0000-0000-000000000002' order by slot_number$$,
  $$values (1, '00000000-0000-0000-0000-00000000000a'::uuid), (2, '00000000-0000-0000-0000-00000000000b'::uuid)$$,
  'second shared claim takes slot 2'
);

set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000c", "email": "cora@university.example", "role": "authenticated"}';

select throws_ok(
  $$select public.claim_slot('10000000-0000-0000-0000-000000000002', 'shared')$$,
  'P0001', 'room_full', 'third host is turned away'
);

-- Quiet mode: takes both slots, only when the room is empty.
select lives_ok(
  $$select public.claim_slot('10000000-0000-0000-0000-000000000004', 'quiet')$$,
  'cora claims an empty room as quiet'
);
select results_eq(
  $$select slot_number, mode::text from public.signups
     where session_id = '10000000-0000-0000-0000-000000000004' order by slot_number$$,
  $$values (1, 'quiet'), (2, 'quiet')$$,
  'quiet claim holds both slots'
);

set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000f", "email": "finn@university.example", "role": "authenticated"}';

select throws_ok(
  $$select public.claim_slot('10000000-0000-0000-0000-000000000004', 'shared')$$,
  'P0001', 'room_full', 'nobody can join a quiet room'
);

set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000a", "email": "alex@university.example", "role": "authenticated"}';

-- One room per host per night: alex already has A next week.
select throws_ok(
  $$select public.claim_slot('10000000-0000-0000-0000-000000000006', 'shared')$$,
  'P0001', 'already_booked_tonight', 'a host cannot hold two rooms on the same night'
);

set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000e", "email": "erin@university.example", "role": "authenticated"}';

select lives_ok(
  $$select public.claim_slot('10000000-0000-0000-0000-000000000006', 'shared')$$,
  'erin claims C next week'
);

set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000f", "email": "finn@university.example", "role": "authenticated"}';

select throws_ok(
  $$select public.claim_slot('10000000-0000-0000-0000-000000000006', 'quiet')$$,
  'P0001', 'room_taken', 'quiet claim fails when someone is already in the room'
);

-- Dora has no display name yet.
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000d", "email": "dora@university.example", "role": "authenticated"}';

select throws_ok(
  $$select public.claim_slot('10000000-0000-0000-0000-000000000003', 'shared')$$,
  'P0001', 'profile_missing', 'claiming requires a display name'
);

-- Multi-book.
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000b", "email": "sam@university.example", "role": "authenticated"}';

select throws_ok(
  $$select public.claim_series('B', 'monday', 'shared')$$,
  'P0001', 'room_not_every_week', 'part-term room cannot be multi-booked'
);
select is(
  public.claim_series('C', 'monday', 'shared'),
  array[date_trunc('week', current_date)::date + 7, date_trunc('week', current_date)::date + 14],
  'series conflicts on a night sam already has another room, and on the cancelled week'
);
select is(
  (select count(*)::int from public.signups su join public.sessions se on se.id = su.session_id
    where se.room = 'C' and su.owner_id = '00000000-0000-0000-0000-00000000000b'),
  0,
  'a conflicting series claims nothing'
);
select is(
  public.claim_series('A', 'monday', 'shared'),
  '{}'::date[],
  'series succeeds when every future week is free'
);
select results_eq(
  $$select se.session_date from public.signups su join public.sessions se on se.id = su.session_id
     where se.room = 'A' and su.owner_id = '00000000-0000-0000-0000-00000000000b'
     order by se.session_date$$,
  $$values (date_trunc('week', current_date)::date + 7), (date_trunc('week', current_date)::date + 14)$$,
  'series holds every future week once, skipping the past and the week already held'
);

set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000c", "email": "cora@university.example", "role": "authenticated"}';

select is(
  public.claim_series('A', 'monday', 'quiet'),
  array[date_trunc('week', current_date)::date + 7, date_trunc('week', current_date)::date + 14],
  'quiet series conflicts on every week someone is in'
);

-- Release.
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000a", "email": "alex@university.example", "role": "authenticated"}';

select is(
  public.release_claim('10000000-0000-0000-0000-000000000004'),
  0,
  'alex cannot release cora''s claim'
);
select is(
  (select count(*)::int from public.signups where session_id = '10000000-0000-0000-0000-000000000004'),
  2,
  'cora''s quiet claim is untouched'
);

set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000c", "email": "cora@university.example", "role": "authenticated"}';

select is(
  public.release_claim('10000000-0000-0000-0000-000000000004'),
  2,
  'releasing a quiet claim frees both slots'
);

set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000b", "email": "sam@university.example", "role": "authenticated"}';

select is(public.release_series('A', 'monday'), 2, 'release_series frees every future week');
select is(
  (select count(*)::int from public.signups su join public.sessions se on se.id = su.session_id
    where se.room = 'A' and su.owner_id = '00000000-0000-0000-0000-00000000000b'),
  0,
  'sam holds nothing in A after release_series'
);

-- Committee clear.
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000b", "email": "sam@university.example", "role": "authenticated"}';

select throws_ok(
  $$select public.clear_claim('10000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-00000000000e')$$,
  'P0001', 'not_committee', 'a host cannot clear someone else''s claim'
);

set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000c", "email": "cora@university.example", "role": "authenticated"}';

select is(
  public.clear_claim('10000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-00000000000e'),
  1,
  'committee clears a claim'
);
select is_empty(
  $$select 1 from public.signups where session_id = '10000000-0000-0000-0000-000000000006'$$,
  'cleared room is empty'
);

-- A freed slot can be claimed again.
select lives_ok(
  $$select public.claim_slot('10000000-0000-0000-0000-000000000006', 'quiet')$$,
  'freed room can be claimed again'
);

reset role;

-- The claim functions are the only write path; the helpers stay private.
select ok(
  not has_function_privilege('authenticated', 'private.insert_claim(uuid, uuid, public.claim_mode)', 'execute'),
  'signed-in users cannot call private helpers'
);

select * from finish();
rollback;
