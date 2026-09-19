-- GHS Mbonjo Limbe — update 004: department dashboard, documents, inventory,
-- staff messaging and progression tracking.
-- Run once in the Supabase SQL Editor. Keep the existing database; do not rerun schema.sql.

-- Four new record kinds. Everything else about the table is unchanged.
alter table public.school_records drop constraint school_records_kind_check;
alter table public.school_records add constraint school_records_kind_check
 check(kind in ('profile','student','assignment','resource','submission','attendance','mark',
                'event','post','gallery','textbook','document','timetable','document_request',
                'classroom','subject','exam_attempt',
                'dept_document','dept_item','message','progression'));

-- Messages are read by thread and by time, and a department's papers are read by
-- department. Without these, every chat refresh scans the whole table.
create index if not exists school_records_thread on public.school_records ((data->>'threadId')) where kind='message';
create index if not exists school_records_department on public.school_records ((data->>'department'))
 where kind in ('dept_document','dept_item','progression');

-- One progression record per department, subject, class and year.
create unique index if not exists unique_progression on public.school_records
 ((data->>'department'),(data->>'subject'),(data->>'class'),(data->>'year')) where kind='progression';
