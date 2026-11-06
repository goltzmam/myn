begin;
create table if not exists public.agent_tasks (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users on delete cascade,
 session_id uuid not null references public.sessions on delete cascade, objective text not null check(length(objective) between 1 and 4000),
 mode text not null default 'together' check(mode in ('guide','do','together')),
 state text not null default 'CREATED' check(state in ('CREATED','PLANNING','WAITING_FOR_PERMISSION','RUNNING','WAITING_FOR_USER','VERIFYING','COMPLETED','FAILED','CANCELLED')),
 summary text not null default '', plan jsonb not null default '[]', domains jsonb not null default '[]', step_index integer not null default 0,
 version integer not null default 0, pending_action jsonb, execution_id uuid, run_id uuid, lease_until timestamptz,
 observation_hash text, attempts integer not null default 0, error text, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table public.agent_tasks add column if not exists observation_hash text;
create index if not exists agent_tasks_session on public.agent_tasks(session_id,created_at desc);
create index if not exists agent_tasks_owner on public.agent_tasks(user_id,updated_at desc);
create table if not exists public.agent_execution_sessions (
 id uuid primary key, task_id uuid not null references public.agent_tasks on delete cascade, status text not null default 'active',
 created_at timestamptz not null default now(), closed_at timestamptz
);
create table if not exists public.agent_permissions (
 id uuid primary key default gen_random_uuid(), task_id uuid not null references public.agent_tasks on delete cascade,
 domains jsonb not null, expires_at timestamptz not null, revoked_at timestamptz, created_at timestamptz not null default now()
);
create table if not exists public.agent_tool_executions (
 id uuid primary key default gen_random_uuid(), task_id uuid not null references public.agent_tasks on delete cascade,
 tool text not null, outcome text not null, duration_ms integer not null default 0, created_at timestamptz not null default now()
);
create table if not exists public.agent_verifications (
 id uuid primary key default gen_random_uuid(), task_id uuid not null references public.agent_tasks on delete cascade,
 step_index integer not null, source text not null check(source in ('user','browser','screen')), evidence text not null check(length(evidence) between 3 and 1000), created_at timestamptz not null default now()
);
create table if not exists public.agent_events (
 id uuid primary key default gen_random_uuid(), task_id uuid not null references public.agent_tasks on delete cascade,
 event text not null, state text not null, mode text not null, created_at timestamptz not null default now()
);
create table if not exists public.agent_usage_metrics (
 id uuid primary key default gen_random_uuid(), task_id uuid not null references public.agent_tasks on delete cascade,
 operation text not null, tokens integer not null default 0, duration_ms integer not null default 0,
 cost_usd numeric(14,8), created_at timestamptz not null default now()
);
create or replace function public.owns_agent_task(p_id uuid) returns boolean language sql stable security definer set search_path=public as $$select exists(select 1 from agent_tasks where id=p_id and user_id=auth.uid())$$;
do $$declare n text;begin
 foreach n in array array['agent_tasks','agent_execution_sessions','agent_permissions','agent_tool_executions','agent_verifications','agent_events','agent_usage_metrics'] loop
 execute format('alter table public.%I enable row level security',n);
 execute format('drop policy if exists owner_read on public.%I',n);
 if n='agent_tasks' then
 execute format('create policy owner_read on public.%I for select to authenticated using(user_id=auth.uid())',n);
 else
 execute format('create policy owner_read on public.%I for select to authenticated using(owns_agent_task(task_id))',n);
 end if;
 execute format('revoke all on public.%I from anon,authenticated',n);
 execute format('grant select on public.%I to authenticated',n);
 end loop;
end$$;
-- All mutations take the row lock and expected version. An interrupted runner cannot overwrite pause/revoke/mode changes.
create or replace function public.agent_create(p_session uuid,p_objective text,p_mode text) returns jsonb language plpgsql security definer set search_path=public as $$
declare t agent_tasks;begin
 if not owns_session(p_session) then raise exception 'Forbidden'; end if;
 if (select count(*) from agent_tasks where user_id=auth.uid() and created_at>now()-interval '1 hour')>=30 then raise exception 'Task rate limit'; end if;
 insert into agent_tasks(user_id,session_id,objective,mode) values(auth.uid(),p_session,p_objective,p_mode) returning * into t;
 insert into agent_events(task_id,event,state,mode) values(t.id,'created',t.state,t.mode);
 return to_jsonb(t);
end$$;
create or replace function public.agent_update(p_id uuid,p_version integer,p_patch jsonb,p_event text) returns jsonb language plpgsql security definer set search_path=public as $$
declare t agent_tasks; nxt text; allowed text[]; step jsonb;begin
 select * into t from agent_tasks where id=p_id and user_id=auth.uid() for update;
 if not found then raise exception 'Forbidden'; end if;
 if t.version<>p_version then raise exception 'Task version conflict'; end if;
 nxt=coalesce(p_patch->>'state',t.state);
 allowed=case t.state
 when 'CREATED' then array['PLANNING','CANCELLED'] when 'PLANNING' then array['WAITING_FOR_USER','WAITING_FOR_PERMISSION','FAILED','CANCELLED']
 when 'WAITING_FOR_PERMISSION' then array['RUNNING','WAITING_FOR_USER','FAILED','CANCELLED']
 when 'RUNNING' then array['WAITING_FOR_PERMISSION','WAITING_FOR_USER','VERIFYING','FAILED','CANCELLED']
 when 'WAITING_FOR_USER' then array['PLANNING','WAITING_FOR_PERMISSION','RUNNING','VERIFYING','CANCELLED']
 when 'VERIFYING' then array['RUNNING','WAITING_FOR_USER','WAITING_FOR_PERMISSION','COMPLETED','FAILED','CANCELLED']
 when 'FAILED' then array['PLANNING','WAITING_FOR_USER','WAITING_FOR_PERMISSION','CANCELLED'] else array[]::text[] end;
 if nxt<>t.state and not(nxt=any(allowed)) then raise exception 'Invalid task transition'; end if;
 if t.state in ('COMPLETED','CANCELLED') then raise exception 'Task is terminal'; end if;
 if p_patch ? 'plan' and (jsonb_typeof(p_patch->'plan')<>'array' or jsonb_array_length(p_patch->'plan')>8) then raise exception 'Invalid plan';end if;
 if nxt='COMPLETED' then
 if jsonb_array_length(coalesce(p_patch->'plan',t.plan))=0 then raise exception 'Verification required';end if;
 for step in select value from jsonb_array_elements(coalesce(p_patch->'plan',t.plan)) loop
 if step->>'status' is distinct from 'completed' or coalesce(length(trim(step->>'evidence')),0)<3 then raise exception 'Verification required';end if;
 end loop;
 end if;
 update agent_tasks set state=nxt,mode=coalesce(p_patch->>'mode',mode),plan=coalesce(p_patch->'plan',plan),
 domains=coalesce(p_patch->'domains',domains),summary=coalesce(p_patch->>'summary',summary),
 step_index=coalesce((p_patch->>'step_index')::integer,step_index),
 pending_action=case when p_patch ? 'pending_action' then nullif(p_patch->'pending_action','null'::jsonb) else pending_action end,
 execution_id=case when p_patch ? 'execution_id' then (p_patch->>'execution_id')::uuid else execution_id end,
 run_id=case when p_patch ? 'run_id' then (p_patch->>'run_id')::uuid else run_id end,
 lease_until=case when p_patch ? 'lease_until' then (p_patch->>'lease_until')::timestamptz else lease_until end,
 observation_hash=case when p_patch ? 'observation_hash' then p_patch->>'observation_hash' else observation_hash end,
 attempts=coalesce((p_patch->>'attempts')::integer,attempts),
 error=case when p_patch ? 'error' then left(p_patch->>'error',500) else error end,
 version=version+1,updated_at=now() where id=t.id returning * into t;
 insert into agent_events(task_id,event,state,mode) values(t.id,left(p_event,60),t.state,t.mode);
 return to_jsonb(t);
end$$;
create or replace function public.agent_grant(p_id uuid,p_version integer,p_domains jsonb) returns jsonb language plpgsql security definer set search_path=public as $$
declare t agent_tasks; d text;begin
 select * into t from agent_tasks where id=p_id and user_id=auth.uid() for update;
 if not found then raise exception 'Forbidden'; end if;
 if t.version<>p_version or t.state in ('COMPLETED','CANCELLED') then raise exception 'Task version conflict';end if;
 if jsonb_typeof(p_domains)<>'array' or jsonb_array_length(p_domains) not between 1 and 8 then raise exception 'Invalid domains';end if;
 for d in select jsonb_array_elements_text(p_domains) loop
 if d !~ '^[a-z0-9]([a-z0-9.-]*[a-z0-9])?\.[a-z]{2,}$' or d like '%..%' then raise exception 'Invalid domain';end if;
 end loop;
 update agent_permissions set revoked_at=now() where task_id=t.id and revoked_at is null;
 insert into agent_permissions(task_id,domains,expires_at) values(t.id,p_domains,now()+interval '30 minutes');
 return public.agent_update(t.id,t.version,jsonb_build_object('domains',p_domains,'pending_action',null,'execution_id',null,'observation_hash',null),'permission_granted');
end$$;
create or replace function public.agent_revoke(p_id uuid) returns void language plpgsql security definer set search_path=public as $$begin
 if not owns_agent_task(p_id) then raise exception 'Forbidden';end if;
 update agent_permissions set revoked_at=now() where task_id=p_id and revoked_at is null;
 update agent_execution_sessions set status='closed',closed_at=now() where task_id=p_id and status='active';
end$$;
create or replace function public.agent_record(p_id uuid,p_kind text,p_data jsonb) returns void language plpgsql security definer set search_path=public as $$begin
 if not owns_agent_task(p_id) then raise exception 'Forbidden';end if;
 if p_kind='verification' then
 insert into agent_verifications(task_id,step_index,source,evidence) values(p_id,(p_data->>'step_index')::integer,p_data->>'source',left(p_data->>'evidence',1000));
 elsif p_kind='tool' then
 insert into agent_tool_executions(task_id,tool,outcome,duration_ms) values(p_id,left(p_data->>'tool',30),left(p_data->>'outcome',40),greatest(0,(p_data->>'duration_ms')::integer));
 elsif p_kind='usage' then
 insert into agent_usage_metrics(task_id,operation,tokens,duration_ms) values(p_id,left(p_data->>'operation',30),greatest(0,(p_data->>'tokens')::integer),greatest(0,(p_data->>'duration_ms')::integer));
 elsif p_kind='execution' then
 insert into agent_execution_sessions(id,task_id) values((p_data->>'id')::uuid,p_id) on conflict do nothing;
 else raise exception 'Invalid event';end if;
end$$;
create or replace function public.agent_delete(p_id uuid) returns void language plpgsql security definer set search_path=public as $$begin
 if not owns_agent_task(p_id) then raise exception 'Forbidden';end if;
 if exists(select 1 from agent_tasks where id=p_id and state not in ('COMPLETED','CANCELLED','FAILED')) then raise exception 'Cancel the task before deleting';end if;
 delete from agent_tasks where id=p_id and user_id=auth.uid();
end$$;
revoke all on function public.owns_agent_task(uuid),public.agent_create(uuid,text,text),public.agent_update(uuid,integer,jsonb,text),public.agent_grant(uuid,integer,jsonb),public.agent_revoke(uuid),public.agent_record(uuid,text,jsonb),public.agent_delete(uuid) from public,anon;
grant execute on function public.owns_agent_task(uuid),public.agent_create(uuid,text,text),public.agent_update(uuid,integer,jsonb,text),public.agent_grant(uuid,integer,jsonb),public.agent_revoke(uuid),public.agent_record(uuid,text,jsonb),public.agent_delete(uuid) to authenticated;
notify pgrst,'reload schema';
commit;
