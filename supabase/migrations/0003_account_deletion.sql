begin;
create or replace function public.delete_own_account() returns void language plpgsql security definer set search_path=pg_catalog,public as $$
declare uid uuid:=auth.uid(); begin
if uid is null then raise exception 'Unauthorized'; end if;
if exists(select 1 from public.subscriptions where user_id=uid and status in ('active','trialing','past_due','unpaid','incomplete','paused')) then raise exception 'Active subscription'; end if;
delete from auth.users where id=uid;
end $$;
revoke all on function public.delete_own_account() from public,anon;
grant execute on function public.delete_own_account() to authenticated;
notify pgrst,'reload schema';
commit;
