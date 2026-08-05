create or replace function public.sync_cron_service_role_key(new_value text)
returns boolean
language plpgsql
security definer
set search_path = public, vault, extensions
as $$
declare
  v_id uuid;
begin
  select id into v_id from vault.secrets where name = 'cron_service_role_key' limit 1;
  if v_id is null then
    perform vault.create_secret(new_value, 'cron_service_role_key', 'Service role key used by internal cron/net.http_post calls');
    return false;
  else
    perform vault.update_secret(v_id, new_value, 'cron_service_role_key', 'Service role key used by internal cron/net.http_post calls');
    return true;
  end if;
end;
$$;

revoke all on function public.sync_cron_service_role_key(text) from public, anon, authenticated;
grant execute on function public.sync_cron_service_role_key(text) to service_role;