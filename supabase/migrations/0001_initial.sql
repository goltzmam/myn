create table public.profiles(id uuid primary key references auth.users on delete cascade, full_name text not null default '',avatar_url text,language text not null default 'en',created_at timestamptz not null default now());
create table public.plans(id text primary key,name text not null,price_monthly numeric not null check(price_monthly>=0),included_minutes integer not null,analysis_limit integer not null,audio_limit integer not null,features jsonb not null default '[]',active boolean not null default true);
insert into public.plans values ('free','Free',0,10,30,30,'["Basic history"]',true),('pro','Pro',10,120,500,500,'["Specialized agents","Full history"]',true),('max','Max',19,300,1200,1200,'["Extended sessions"]',true),('teams','Teams',29,500,2000,2000,'["Per-seat billing; workspace sharing pending"]',true);
create table public.subscriptions(id uuid primary key default gen_random_uuid(),user_id uuid not null unique references auth.users on delete cascade,plan_id text not null references plans,provider_customer_id text,provider_subscription_id text unique,status text not null,current_period_end timestamptz);
create table public.agents(id uuid primary key default gen_random_uuid(),owner_id uuid references auth.users on delete cascade,name text not null check(length(name)<=80),description text not null default '',instructions text not null check(length(instructions)<=4000),specialty text not null default 'general',language text not null default 'en',visibility text not null default 'private' check(visibility in ('private','public')),created_at timestamptz not null default now());
insert into public.agents(name,description,instructions,specialty,visibility) values ('Coding Expert','Build, debug, and ship.','Assist with programming, APIs, debugging and deployment.','coding','public'),('Marketing Expert','Find your next growth opportunity.','Assist with ethical marketing, campaigns and analytics.','marketing','public'),('Spreadsheet Expert','Make your data work for you.','Assist with formulas, spreadsheets and reporting.','spreadsheets','public'),('E-commerce Expert','Build a better buying experience.','Assist with store configuration, products and checkout.','commerce','public'),('Productivity Expert','Less friction. More flow.','Assist with software, planning and productivity.','productivity','public');
create table public.sessions(id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users on delete cascade,agent_id uuid references agents on delete set null,mode text not null check(mode in ('wake','guide','live')),title text not null default 'Untitled session' check(length(title)<=200),objective text not null default '' check(length(objective)<=4000),status text not null default 'active' check(status in ('active','completed')),started_at timestamptz not null default now(),resumed_at timestamptz not null default now(),ended_at timestamptz);
create table public.messages(id uuid primary key default gen_random_uuid(),session_id uuid not null references sessions on delete cascade,role text not null check(role in ('user','assistant')),content text not null,created_at timestamptz not null default now());
create table public.session_steps(id uuid primary key default gen_random_uuid(),session_id uuid not null references sessions on delete cascade,title text not null,description text not null default '',status text not null check(status in ('pending','active','completed')),position integer not null,verified_at timestamptz);
create table public.session_summaries(id uuid primary key default gen_random_uuid(),session_id uuid not null unique references sessions on delete cascade,summary text not null,completed_tasks jsonb not null default '[]',pending_tasks jsonb not null default '[]',created_at timestamptz not null default now());
create table public.usage_events(id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users on delete cascade,session_id uuid references sessions on delete set null,event_type text not null,quantity integer not null default 1 check(quantity>=0),estimated_cost numeric,created_at timestamptz not null default now());
create table public.user_preferences(user_id uuid primary key references auth.users on delete cascade,language text not null default 'en',voice_settings jsonb not null default '{}',privacy_settings jsonb not null default '{"retention_days":null}');
create table public.billing_events(id uuid primary key default gen_random_uuid(),user_id uuid references auth.users on delete set null,provider_event_id text unique not null,event_type text not null,processed_at timestamptz not null default now());
create table public.audit_logs(id uuid primary key default gen_random_uuid(),actor_id uuid references auth.users on delete set null,action text not null,metadata jsonb not null default '{}',created_at timestamptz not null default now());
create index sessions_owner_time on sessions(user_id,started_at desc);
create index messages_session_time on messages(session_id,created_at);
create index steps_session on session_steps(session_id);
create index usage_owner_time on usage_events(user_id,created_at);
create index agents_owner on agents(owner_id);
create function public.owns_session(s uuid) returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from sessions where id=s and user_id=auth.uid()); $$;
create function public.is_admin() returns boolean language sql stable as $$ select coalesce(auth.jwt()->'app_metadata'->>'role','')='admin'; $$;
do $$ declare t text; begin foreach t in array array['profiles','plans','subscriptions','sessions','messages','session_steps','session_summaries','agents','usage_events','user_preferences','billing_events','audit_logs'] loop execute format('alter table public.%I enable row level security',t); end loop; end $$;
create policy profiles_own on profiles for all to authenticated using(id=auth.uid()) with check(id=auth.uid());
create policy plans_read on plans for select using(active);
create policy subscriptions_read on subscriptions for select to authenticated using(user_id=auth.uid());
create policy sessions_own on sessions for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid() and (agent_id is null or exists(select 1 from agents where id=agent_id and (owner_id=auth.uid() or visibility='public'))));
create policy messages_read on messages for select to authenticated using(owns_session(session_id));
create policy steps_read on session_steps for select to authenticated using(owns_session(session_id));
create policy summaries_read on session_summaries for select to authenticated using(owns_session(session_id));
create policy agents_read on agents for select to authenticated using(owner_id=auth.uid() or visibility='public');
create policy agents_write on agents for insert to authenticated with check(owner_id=auth.uid() and visibility='private');
create policy agents_update on agents for update to authenticated using(owner_id=auth.uid()) with check(owner_id=auth.uid() and visibility='private');
create policy agents_delete on agents for delete to authenticated using(owner_id=auth.uid());
create policy usage_read on usage_events for select to authenticated using(user_id=auth.uid());
create policy preferences_own on user_preferences for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
create policy billing_read on billing_events for select to authenticated using(user_id=auth.uid());
create policy audit_admin on audit_logs for select to authenticated using(is_admin());
create function public.reserve_usage(p_session uuid,p_kind text) returns void language plpgsql security definer set search_path=public as $$
declare uid uuid:=auth.uid(); max_count integer; used integer; begin
if uid is null then raise exception 'Unauthorized'; end if;
if p_kind not in ('analysis','audio','billing') then raise exception 'Invalid usage'; end if;
if p_session is not null and not owns_session(p_session) then raise exception 'Forbidden'; end if;
perform pg_advisory_xact_lock(hashtextextended(uid::text,0));
select case when p_kind='analysis' then p.analysis_limit when p_kind='audio' then p.audio_limit else 100 end into max_count from plans p where p.id=coalesce((select plan_id from subscriptions where user_id=uid and status in ('active','trialing') and current_period_end>now()),'free');
select count(*) into used from usage_events where user_id=uid and event_type=p_kind and created_at>=date_trunc('month',now());
if used>=coalesce(max_count,0) then raise exception 'Monthly limit'; end if;
if (select count(*) from usage_events where user_id=uid and created_at>now()-interval '1 minute' and event_type in ('analysis','audio','billing'))>=10 then raise exception 'Rate limit'; end if;
insert into usage_events(user_id,session_id,event_type) values(uid,p_session,p_kind);
end $$;
create function public.save_exchange(p_session uuid,p_question text,p_reply text,p_steps jsonb,p_summary text,p_tokens integer) returns void language plpgsql security definer set search_path=public as $$
declare step jsonb; pos integer:=0; begin
if not owns_session(p_session) then raise exception 'Forbidden'; end if;
insert into messages(session_id,role,content) values(p_session,'user',p_question),(p_session,'assistant',p_reply);
delete from session_steps where session_id=p_session;
for step in select * from jsonb_array_elements(p_steps) loop
insert into session_steps(session_id,title,description,status,position,verified_at) values(p_session,step->>'title',step->>'evidence',case when step->>'status'='completed' and coalesce(step->>'evidence','')='' then 'pending' else step->>'status' end,pos,case when step->>'status'='completed' and coalesce(step->>'evidence','')<>'' then now() end);pos:=pos+1;end loop;
insert into session_summaries(session_id,summary) values(p_session,p_summary) on conflict(session_id) do update set summary=excluded.summary,created_at=now();
insert into usage_events(user_id,session_id,event_type,quantity) values(auth.uid(),p_session,'tokens',greatest(0,p_tokens));
end $$;
-- The user may save their own conversation context. Usage reservations are independently enforced.
revoke all on function public.save_exchange(uuid,text,text,jsonb,text,integer) from public,anon,authenticated;
-- Ownership is verified again inside this atomic history write.
grant execute on function public.save_exchange(uuid,text,text,jsonb,text,integer) to authenticated;
-- Client-submitted token counts are estimates, never used for entitlements.
revoke all on function public.reserve_usage(uuid,text) from public,anon;
grant execute on function public.reserve_usage(uuid,text) to authenticated;
create function public.new_profile() returns trigger language plpgsql security definer set search_path=public as $$ begin insert into profiles(id,full_name) values(new.id,coalesce(new.raw_user_meta_data->>'full_name',''));return new;end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.new_profile();
alter table subscriptions add column provider_updated_at bigint not null default 0;
create function public.apply_billing_event(p_event text,p_event_type text,p_created bigint,p_user uuid,p_plan text,p_customer text,p_subscription text,p_status text,p_period timestamptz) returns void language plpgsql security definer set search_path=public as $$
begin
insert into billing_events(user_id,provider_event_id,event_type) values(p_user,p_event,p_event_type) on conflict(provider_event_id) do nothing;
if not found then return; end if;
insert into subscriptions(user_id,plan_id,provider_customer_id,provider_subscription_id,status,current_period_end,provider_updated_at) values(p_user,p_plan,p_customer,p_subscription,p_status,p_period,p_created) on conflict(user_id) do update set plan_id=excluded.plan_id,provider_customer_id=excluded.provider_customer_id,provider_subscription_id=excluded.provider_subscription_id,status=excluded.status,current_period_end=excluded.current_period_end,provider_updated_at=excluded.provider_updated_at where subscriptions.provider_updated_at<=excluded.provider_updated_at;
end $$;
revoke all on function public.apply_billing_event(text,text,bigint,uuid,text,text,text,text,timestamptz) from public,anon,authenticated;
grant execute on function public.apply_billing_event(text,text,bigint,uuid,text,text,text,text,timestamptz) to service_role;
