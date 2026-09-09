-- Run once in the Supabase SQL Editor. No command line required.
create table public.school_records (
 id uuid primary key default gen_random_uuid(),
 kind text not null check(kind in ('profile','student','assignment','resource','submission','attendance','mark','event','post','gallery','textbook','document','timetable','document_request','classroom','subject','exam_attempt')),
 data jsonb not null,
 version integer not null default 1,
 created_at timestamptz not null default now()
);
create index school_records_kind on public.school_records(kind);
create index school_records_data on public.school_records using gin(data);
create unique index unique_matricule on public.school_records ((data->>'matricule')) where kind='student';
create unique index unique_profile on public.school_records ((data->>'authId')) where kind='profile' and data->>'authId' is not null;
create unique index unique_attendance on public.school_records ((data->>'studentId'),(data->>'date'),(data->>'assignmentId')) where kind='attendance';
create unique index unique_mark on public.school_records ((data->>'studentId'),(data->>'subject'),(data->>'assessment'),(data->>'year')) where kind='mark';
create unique index unique_reference on public.school_records ((data->>'reference')) where kind='document';
create table public.school_secrets (id text primary key, value text not null);
create table public.school_audit (id bigint generated always as identity primary key, actor text not null, action text not null, record_id text, created_at timestamptz not null default now());
create table public.school_rate_limits (id text primary key, hits integer not null, expires_at timestamptz not null);
alter table public.school_records enable row level security;
alter table public.school_secrets enable row level security;
alter table public.school_audit enable row level security;
alter table public.school_rate_limits enable row level security;
-- Deny direct browser database access. All access passes the authenticated server gateway.
revoke all on public.school_records,public.school_secrets,public.school_audit,public.school_rate_limits from anon,authenticated;
create function public.school_rate_limit(bucket text) returns integer language plpgsql security definer set search_path=public as $$
declare n integer;
begin
 insert into school_rate_limits(id,hits,expires_at) values(bucket,1,now()+interval '15 minutes')
 on conflict(id) do update set hits=case when school_rate_limits.expires_at<now() then 1 else school_rate_limits.hits+1 end,
 expires_at=case when school_rate_limits.expires_at<now() then now()+interval '15 minutes' else school_rate_limits.expires_at end returning hits into n;
 return n;
end;$$;
revoke execute on function public.school_rate_limit(text) from public,anon,authenticated;
grant execute on function public.school_rate_limit(text) to service_role;
-- Save the record and its audit entry in one transaction.
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
revoke execute on function public.school_save_record(text,jsonb,text,uuid,integer) from public,anon,authenticated;
grant execute on function public.school_save_record(text,jsonb,text,uuid,integer) to service_role;
-- BOOTSTRAP AFTER creating the principal's email/password in Authentication > Users:
-- insert into public.school_records(kind,data) values ('profile',jsonb_build_object(
-- 'authId','PASTE_AUTH_USER_UUID','name','David Moki Ndive','role','principal','active',true));

-- Existing installations: run this once in Supabase SQL Editor.
-- No uniqueness constraint is applied to VP, SDM, DM or HOD posts.
-- This index handles simultaneous requests as well as ordinary form validation.
create unique index if not exists one_active_bursar
on public.school_records ((data->>'role'))
where kind='profile' and data->>'role'='bursar' and coalesce(data->>'active','true')<>'false';

CREATE UNIQUE INDEX IF NOT EXISTS one_issued_document_per_request ON public.school_records ((data->>'requestId')) WHERE kind='document' AND data->>'status'='issued' AND data->>'requestId' IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS unique_classroom ON public.school_records ((data->>'name')) WHERE kind='classroom';
CREATE UNIQUE INDEX IF NOT EXISTS unique_subject ON public.school_records ((data->>'name')) WHERE kind='subject';
CREATE UNIQUE INDEX IF NOT EXISTS unique_exam_attempt ON public.school_records ((data->>'studentId'),(data->>'resourceId')) WHERE kind='exam_attempt';
