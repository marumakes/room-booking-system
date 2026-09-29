-- Claim history: every claim, release and committee clear is recorded, readable only by committee.
begin;
create extension if not exists pgtap with schema extensions;
select plan(13);

-- Start from no users or sessions so local data can't change the results. Rolled back at the end.
delete from auth.users;
delete from public.sessions;
delete from public.claim_history;

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

-- Two Mondays. A every week; B next week only.
insert into public.sessions (id, session_date, room) values
  ('20000000-0000-0000-0000-000000000001', date_trunc('week', current_date)::date + 7,  'A'),
  ('20000000-0000-0000-0000-000000000002', date_trunc('week', current_date)::date + 14, 'A'),
  ('20000000-0000-0000-0000-000000000003', date_trunc('week', current_date)::date + 7,  'B');

-- Entries so far, oldest first, as (action, host, done by, room, mode).
create temporary view entries as
  select action::text, owner_name, actor_name, room, mode::text
    from public.claim_history
   order by id;

set local role authenticated;

-- Alex claims A next week.
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000a", "email": "alex@university.example", "role": "authenticated"}';
select public.claim_slot('20000000-0000-0000-0000-000000000001', 'shared');

-- Sam takes B as quiet (two slots), releases it, then multi-books A (two nights).
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000b", "email": "sam@university.example", "role": "authenticated"}';
select public.claim_slot('20000000-0000-0000-0000-000000000003', 'quiet');
select public.release_claim('20000000-0000-0000-0000-000000000003');
select public.claim_series('A', 'monday', 'shared');

-- Cora (committee) clears Sam from A next week.
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000c", "email": "cora@university.example", "role": "authenticated"}';
select public.clear_claim('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000b');

reset role;

select results_eq(
  'select * from entries',
  $$values
    ('claimed',  'Alex', 'Alex', 'A', 'shared'),
    ('claimed',  'Sam',  'Sam',  'B', 'quiet'),
    ('released', 'Sam',  'Sam',  'B', 'quiet'),
    ('claimed',  'Sam',  'Sam',  'A', 'shared'),
    ('claimed',  'Sam',  'Sam',  'A', 'shared'),
    ('cleared',  'Sam',  'Cora', 'A', 'shared')$$,
  'claims, a quiet claim (once), a release, a multi-book (per night) and a committee clear are all recorded'
);

select is(
  (select count(distinct session_date)::int from public.claim_history where action = 'claimed' and owner_name = 'Sam' and room = 'A'),
  2,
  'a multi-book records each night'
);

select is(
  (select session_date from public.claim_history where action = 'cleared'),
  date_trunc('week', current_date)::date + 7,
  'the entry records which night'
);

select ok(
  (select bool_and(occurred_at is not null) from public.claim_history),
  'every entry has a time'
);

-- Names are kept as they were at the time.
update public.profiles set display_name = 'Alexandra' where user_id = '00000000-0000-0000-0000-00000000000a';
select is(
  (select owner_name from public.claim_history order by id limit 1),
  'Alex',
  'a later rename doesn''t rewrite history'
);

-- Removing a user (e.g. end-of-semester clean-up, from the dashboard: nobody signed in) is recorded
-- without an actor. The profile is deleted first, so the last recorded name is used.
set local request.jwt.claims to '';
delete from auth.users where id = '00000000-0000-0000-0000-00000000000a';
select results_eq(
  $$select action::text, owner_name, actor_name from public.claim_history order by id desc limit 1$$,
  $$values ('removed', 'Alex', null::text)$$,
  'claims removed by deleting the user are recorded as removed'
);

-- Access: committee reads it; nobody else can, and nobody can write it.
set local role anon;
select throws_ok('select * from public.claim_history', '42501', null, 'anon cannot read history');

set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000b", "email": "sam@university.example", "role": "authenticated"}';
select is_empty('select * from public.claim_history', 'a host sees no history');
select throws_ok(
  $$insert into public.claim_history (action, session_id, session_date, room, mode, owner_id, owner_name)
    values ('claimed', '20000000-0000-0000-0000-000000000002', current_date, 'A', 'shared', '00000000-0000-0000-0000-00000000000b', 'Sam')$$,
  '42501', null, 'a host cannot add history'
);
select throws_ok('delete from public.claim_history', '42501', null, 'a host cannot delete history');

set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000c", "email": "cora@university.example", "role": "authenticated"}';
select isnt_empty('select * from public.claim_history', 'committee can read history');
select throws_ok('delete from public.claim_history', '42501', null, 'committee cannot delete history');
select throws_ok($$update public.claim_history set owner_name = 'x'$$, '42501', null, 'committee cannot edit history');

select * from finish();
rollback;
