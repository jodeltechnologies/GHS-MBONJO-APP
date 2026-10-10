-- Service-only transaction, called after principal authorization and preview validation.
CREATE OR REPLACE FUNCTION public.school_advance_year(actor_id text,control_id uuid,expected_version integer,from_year text,to_year text,changes jsonb,expected_snapshot jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE control_row public.school_records; item record; affected integer; total integer:=0; next_data jsonb;
BEGIN
 -- Take the table lock first, then rows, to keep a consistent lock order.
 LOCK TABLE public.school_records IN SHARE ROW EXCLUSIVE MODE;
 SELECT * INTO control_row FROM public.school_records WHERE id=control_id AND kind='school_control' FOR UPDATE;
 IF NOT FOUND OR control_row.version<>expected_version OR control_row.data->>'activeYear'<>from_year THEN RAISE EXCEPTION 'Year changed. Refresh and preview again.' USING ERRCODE='40001'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.school_records WHERE id::text=actor_id AND kind='profile' AND data->>'role'='principal' AND coalesce((data->>'active')::boolean,true)) THEN RAISE EXCEPTION 'Principal access required.' USING ERRCODE='42501'; END IF;
 IF to_year !~ '^[0-9]{4}/[0-9]{4}$' OR split_part(to_year,'/',1)::integer<>split_part(from_year,'/',1)::integer+1 OR split_part(to_year,'/',2)::integer<>split_part(to_year,'/',1)::integer+1 THEN RAISE EXCEPTION 'Advance one year at a time.'; END IF;
 IF coalesce(control_row.data->'rollovers','{}'::jsonb) ? to_year THEN RAISE EXCEPTION 'This year was already advanced.' USING ERRCODE='40001'; END IF;
 IF (SELECT count(*) FROM public.school_records WHERE kind IN ('student','classroom'))<>jsonb_array_length(expected_snapshot) OR EXISTS(SELECT 1 FROM jsonb_to_recordset(expected_snapshot) x(id uuid,version integer) LEFT JOIN public.school_records r ON r.id=x.id AND r.kind IN ('student','classroom') WHERE r.id IS NULL OR r.version<>x.version) THEN RAISE EXCEPTION 'Student or class records changed. Preview again.' USING ERRCODE='40001'; END IF;
 IF (SELECT count(DISTINCT x.id) FROM jsonb_to_recordset(changes) x(id uuid))<>jsonb_array_length(changes) THEN RAISE EXCEPTION 'Duplicate student update.'; END IF;
 FOR item IN SELECT * FROM jsonb_to_recordset(changes) x(id uuid,version integer,data jsonb) LOOP
  UPDATE public.school_records SET data=item.data,version=version+1 WHERE id=item.id AND kind='student' AND version=item.version;
  GET DIAGNOSTICS affected=ROW_COUNT;
  IF affected<>1 THEN RAISE EXCEPTION 'Student changed. Preview again.' USING ERRCODE='40001'; END IF;
  INSERT INTO public.school_audit(actor,action,record_id) VALUES(actor_id,'annual advancement '||from_year||' to '||to_year,item.id::text);
  total:=total+1;
 END LOOP;
 next_data:=control_row.data||jsonb_build_object('activeYear',to_year,'rollovers',coalesce(control_row.data->'rollovers','{}'::jsonb)||jsonb_build_object(to_year,jsonb_build_object('fromYear',from_year,'changedBy',actor_id,'changedAt',now())),'markWindows',coalesce(control_row.data->'markWindows','{}'::jsonb)||jsonb_build_object(to_year,jsonb_build_object('status','closed','assessment','all')));
 UPDATE public.school_records SET data=next_data,version=version+1 WHERE id=control_id;
 INSERT INTO public.school_audit(actor,action,record_id) VALUES(actor_id,'advance academic year to '||to_year,control_id::text);
 RETURN jsonb_build_object('updated',total,'activeYear',to_year);
END; $$;
REVOKE ALL ON FUNCTION public.school_advance_year(text,uuid,integer,text,text,jsonb,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.school_advance_year(text,uuid,integer,text,text,jsonb,jsonb) TO service_role;
