-- Weekday of a session, derived from sessions.session_date. Any day can be a session day.
create type public.day_type as enum ('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday');

-- shared = up to 2 hosts in a room; quiet = one host takes both slots.
create type public.claim_mode as enum ('shared', 'quiet');

-- One booked room on one session night. Seeded from the venue PDFs.
create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  session_date date not null,
  day_type public.day_type not null generated always as (
    case extract(isodow from session_date)
      when 1 then 'monday'::public.day_type
      when 2 then 'tuesday'::public.day_type
      when 3 then 'wednesday'::public.day_type
      when 4 then 'thursday'::public.day_type
      when 5 then 'friday'::public.day_type
      when 6 then 'saturday'::public.day_type
      when 7 then 'sunday'::public.day_type
    end
  ) stored,
  room text not null check (char_length(room) > 0),
  available boolean not null default true,  -- false = booking cancelled mid-term
  unique (session_date, room)
);

-- Display name shown on claims, so emails are never exposed.
create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(btrim(display_name)) between 1 and 40)
);

-- One host's hold on one slot. A quiet claim is two rows (slots 1 and 2) with the same owner.
create table public.signups (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions (id) on delete cascade,
  slot_number int not null check (slot_number in (1, 2)),
  owner_id uuid not null references public.profiles (user_id) on delete cascade,
  mode public.claim_mode not null,
  claimed_at timestamptz not null default now(),
  unique (session_id, slot_number)
);

-- A host can't take both slots of a room in shared mode.
create unique index signups_one_shared_per_owner
  on public.signups (owner_id, session_id)
  where mode = 'shared';

create index signups_owner_id_idx on public.signups (owner_id);

-- Users allowed to clear anyone's claim. Populated by hand in the SQL editor.
create table public.committee (
  user_id uuid primary key references auth.users (id) on delete cascade
);
