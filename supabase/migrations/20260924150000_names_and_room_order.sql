-- Display names identify hosts in the grid and the export, so no two may match ("Alex" = " alex ").
create unique index profiles_display_name_unique
  on public.profiles (lower(btrim(display_name)));

-- Where the room appears in the venue PDF, so rooms list in the same order (South East first).
-- Set by the seed script from the CSV row order.
alter table public.sessions add column room_position int not null default 0;
