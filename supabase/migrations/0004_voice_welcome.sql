begin;
create or replace function public.save_welcome(p_session uuid,p_turn uuid,p_reply text,p_tokens integer) returns void language plpgsql security definer set search_path=public as $$
begin
if not owns_session(p_session) then raise exception 'Forbidden'; end if;
if p_reply is null or length(trim(p_reply))=0 or length(p_reply)>12000 then raise exception 'Invalid response'; end if;
insert into public.messages(session_id,turn_id,role,content) values(p_session,p_turn,'assistant',p_reply) on conflict(session_id,turn_id,role) do update set content=excluded.content;
insert into public.session_summaries(session_id,summary) values(p_session,p_reply) on conflict(session_id) do update set summary=excluded.summary,created_at=now();
insert into public.usage_events(user_id,session_id,event_type,quantity) values(auth.uid(),p_session,'tokens',greatest(0,p_tokens));
end $$;
revoke all on function public.save_welcome(uuid,uuid,text,integer) from public,anon;
grant execute on function public.save_welcome(uuid,uuid,text,integer) to authenticated;
notify pgrst,'reload schema';
commit;
