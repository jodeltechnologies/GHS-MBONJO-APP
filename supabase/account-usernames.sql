-- Protect assigned usernames across staff and student records, including
-- simultaneous account provisioning. No API grants or RLS changes are needed.
CREATE UNIQUE INDEX IF NOT EXISTS unique_school_account_username
ON public.school_records (lower(data->>'username'))
WHERE kind IN ('profile','student') AND data->>'username' IS NOT NULL;
