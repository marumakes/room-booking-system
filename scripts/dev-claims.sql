-- LOCAL DEVELOPMENT ONLY: fake hosts and claims so the room views can be checked with realistic states.
-- Run with `npm run dev:claims` (targets the local Docker database only). Never run against the hosted project.
-- Re-runnable: clears previous fake hosts first.

delete from auth.users where email like 'fake-host-%@university.example';

-- Six fake hosts.
insert into auth.users (id, email)
select gen_random_uuid(), format('fake-host-%s@university.example', n)
from generate_series(1, 6) as n;

insert into public.profiles (user_id, display_name)
select id, (array['Alex', 'Sam', 'Priya', 'Tom', 'Jess', 'Omar'])[substring(email from 'fake-host-(\d)')::int]
from auth.users
where email like 'fake-host-%@university.example';

-- A spread of states: roughly a third of rooms get one host, a sixth get two, and one room per night is quiet.
with numbered as (
  select s.id, s.room_position, row_number() over (order by s.session_date, s.room_position) as n
  from public.sessions s
),
hosts as (
  select user_id, row_number() over (order by display_name) as k
  from public.profiles p
  join auth.users u on u.id = p.user_id
  where u.email like 'fake-host-%@university.example'
)
insert into public.signups (session_id, slot_number, owner_id, mode)
select n.id, slot, d.user_id, case when n.room_position = 3 then 'quiet'::public.claim_mode else 'shared' end
from numbered n
cross join generate_series(1, 2) as slot
-- Quiet rooms use the same host for both slots, as the claim functions would.
join hosts d on d.k = ((n.n + case when n.room_position = 3 then 1 else slot end) % 6) + 1
where (n.room_position = 3)
   or (n.n % 3 = 0 and slot = 1)
   or (n.n % 6 = 0 and slot = 2);
