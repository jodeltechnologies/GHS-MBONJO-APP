-- Run once in Supabase SQL Editor. Existing school records are preserved.
BEGIN;
ALTER TABLE public.school_records DROP CONSTRAINT IF EXISTS school_records_kind_check;
ALTER TABLE public.school_records ADD CONSTRAINT school_records_kind_check CHECK (kind IN ('profile','student','assignment','resource','submission','attendance','mark','event','post','gallery','textbook','document','timetable','document_request','classroom','subject','exam_attempt'));
CREATE UNIQUE INDEX IF NOT EXISTS one_issued_document_per_request ON public.school_records ((data->>'requestId')) WHERE kind='document' AND data->>'status'='issued' AND data->>'requestId' IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS unique_classroom ON public.school_records ((data->>'name')) WHERE kind='classroom';
CREATE UNIQUE INDEX IF NOT EXISTS unique_subject ON public.school_records ((data->>'name')) WHERE kind='subject';
CREATE UNIQUE INDEX IF NOT EXISTS unique_exam_attempt ON public.school_records ((data->>'studentId'),(data->>'resourceId')) WHERE kind='exam_attempt';
create or replace function public.school_save_record(record_kind text, record_data jsonb, actor_id text, record_id uuid default null, expected_version integer default null)
returns setof public.school_records language plpgsql security definer set search_path=public as $$
declare saved public.school_records; request_row public.school_records;
begin
 if record_kind='document' and record_id is null and record_data->>'requestId' is not null then
  select * into request_row from school_records where id=(record_data->>'requestId')::uuid and kind='document_request' for update;
  if not found or request_row.data->>'status'<>'pending' then raise exception 'Request no longer pending.' using errcode='40001'; end if;
 end if;
 if record_kind='document_request' and record_id is not null then
  perform 1 from school_records where id=record_id for update;
  if exists(select 1 from school_records where kind='document' and data->>'requestId'=record_id::text and data->>'status'='issued') then raise exception 'Request already issued.' using errcode='40001'; end if;
 end if;
 if record_id is null then
  insert into school_records(kind,data) values(record_kind,record_data) returning * into saved;
 else
  update school_records set data=record_data,version=version+1 where id=record_id and kind=record_kind and version=expected_version returning * into saved;
  if not found then raise exception 'Record changed. Refresh before saving.' using errcode='40001'; end if;
 end if;
 insert into school_audit(actor,action,record_id) values(actor_id,case when record_id is null then 'create ' else 'update ' end||record_kind,saved.id::text);
 return next saved;
end;$$;

COMMIT;
