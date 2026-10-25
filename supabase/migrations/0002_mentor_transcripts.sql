begin;
alter table public.messages add column if not exists turn_id uuid;
create unique index if not exists message_turn_role on public.messages(session_id,turn_id,role);
create or replace function public.save_question(p_session uuid,p_turn uuid,p_question text) returns void language plpgsql security definer set search_path=public as $$
begin
if not owns_session(p_session) then raise exception 'Forbidden'; end if;
if not exists(select 1 from sessions where id=p_session and status='active') then raise exception 'Session ended'; end if;
if p_turn is null or p_question is null or length(trim(p_question))=0 or length(p_question)>4000 then raise exception 'Invalid question'; end if;
insert into messages(session_id,turn_id,role,content) values(p_session,p_turn,'user',p_question) on conflict(session_id,turn_id,role) do nothing;
end $$;
revoke all on function public.save_question(uuid,uuid,text) from public,anon;
grant execute on function public.save_question(uuid,uuid,text) to authenticated;
create or replace function public.save_exchange(p_session uuid,p_question text,p_reply text,p_steps jsonb,p_summary text,p_tokens integer,p_turn uuid) returns void language plpgsql security definer set search_path=public as $$
declare step jsonb; pos integer:=0; begin
if not owns_session(p_session) then raise exception 'Forbidden'; end if;
if p_reply is null or length(p_reply)>20000 or p_summary is null or length(p_summary)>12000 or jsonb_typeof(p_steps)<>'array' or jsonb_array_length(p_steps)>12 then raise exception 'Invalid response'; end if;
perform save_question(p_session,p_turn,p_question);
insert into messages(session_id,turn_id,role,content) values(p_session,p_turn,'assistant',p_reply) on conflict(session_id,turn_id,role) do update set content=excluded.content;
delete from session_steps where session_id=p_session;
for step in select * from jsonb_array_elements(p_steps) loop
insert into session_steps(session_id,title,description,status,position,verified_at) values(p_session,step->>'title',step->>'evidence',case when step->>'status'='completed' and coalesce(step->>'evidence','')='' then 'pending' else step->>'status' end,pos,case when step->>'status'='completed' and coalesce(step->>'evidence','')<>'' then now() end);pos:=pos+1;end loop;
insert into session_summaries(session_id,summary,completed_tasks,pending_tasks) values(p_session,p_summary,coalesce((select jsonb_agg(value->>'title') from jsonb_array_elements(p_steps) where value->>'status'='completed' and coalesce(value->>'evidence','')<>''),'[]'::jsonb),coalesce((select jsonb_agg(value->>'title') from jsonb_array_elements(p_steps) where value->>'status'<>'completed' or coalesce(value->>'evidence','')=''),'[]'::jsonb)) on conflict(session_id) do update set summary=excluded.summary,completed_tasks=excluded.completed_tasks,pending_tasks=excluded.pending_tasks,created_at=now();
insert into usage_events(user_id,session_id,event_type,quantity) values(auth.uid(),p_session,'tokens',greatest(0,p_tokens));
end $$;
revoke all on function public.save_exchange(uuid,text,text,jsonb,text,integer,uuid) from public,anon;
grant execute on function public.save_exchange(uuid,text,text,jsonb,text,integer,uuid) to authenticated;
-- Explicit grants complement RLS; no client writes are allowed without an ownership policy.
grant usage on schema public to authenticated;
grant select,insert,update,delete on public.profiles,public.sessions,public.agents,public.user_preferences to authenticated;
grant select on public.plans,public.subscriptions,public.messages,public.session_steps,public.session_summaries,public.usage_events,public.billing_events,public.audit_logs to authenticated;
create or replace function public.reserve_usage(p_session uuid,p_kind text) returns void language plpgsql security definer set search_path=public as $$
declare uid uuid:=auth.uid(); max_count integer; used integer; begin
if uid is null then raise exception 'Unauthorized'; end if;
if p_kind not in ('analysis','audio','billing') then raise exception 'Invalid usage'; end if;
if p_session is not null and not owns_session(p_session) then raise exception 'Forbidden'; end if;
perform pg_advisory_xact_lock(hashtextextended(uid::text,0));
select case when p_kind='analysis' then p.analysis_limit when p_kind='audio' then p.audio_limit else 100 end into max_count from plans p where p.id=coalesce((select plan_id from subscriptions where user_id=uid and status in ('active','trialing') and current_period_end>now()),'free');
select count(*) into used from usage_events where user_id=uid and event_type=p_kind and created_at>=date_trunc('month',now());
if used>=coalesce(max_count,0) then raise exception 'Monthly limit'; end if;
if (select count(*) from usage_events where user_id=uid and created_at>now()-interval '1 minute' and event_type=p_kind)>=(case when p_kind='analysis' then 20 when p_kind='audio' then 60 else 5 end) then raise exception 'Rate limit'; end if;
insert into usage_events(user_id,session_id,event_type) values(uid,p_session,p_kind);
end $$;

notify pgrst, 'reload schema';
commit;
