-- setup_first_admin: security-definer RPC called by the /setup page.
-- Grants admin role to the given user ONLY if no admin exists yet.
-- Once one admin exists, subsequent calls raise an exception, preventing
-- privilege escalation through the public /setup endpoint.

create or replace function public.setup_first_admin(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (select 1 from public.user_roles where role = 'admin') then
    raise exception 'An admin account already exists. Contact an existing admin to grant additional roles.';
  end if;

  insert into public.user_roles (user_id, role)
  values (target_user_id, 'admin')
  on conflict (user_id, role) do nothing;
end;
$$;

-- Only authenticated users can call this function (Supabase default).
-- The function itself enforces the one-admin-at-a-time bootstrap rule.
revoke all on function public.setup_first_admin(uuid) from public;
grant execute on function public.setup_first_admin(uuid) to authenticated;
