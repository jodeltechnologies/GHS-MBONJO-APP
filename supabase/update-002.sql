-- Existing installations: run this once in Supabase SQL Editor.
-- No uniqueness constraint is applied to VP, SDM, DM or HOD posts.
-- This index handles simultaneous requests as well as ordinary form validation.
create unique index if not exists one_active_bursar
on public.school_records ((data->>'role'))
where kind='profile' and data->>'role'='bursar' and coalesce(data->>'active','true')<>'false';
