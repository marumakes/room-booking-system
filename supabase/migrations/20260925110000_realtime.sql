-- Broadcast claim and display-name changes so every open app updates live.
-- Realtime applies each viewer's RLS, so signed-out users and anyone outside the allowed domain receive nothing.
alter publication supabase_realtime add table public.signups, public.profiles;
