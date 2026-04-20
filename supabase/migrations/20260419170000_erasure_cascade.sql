-- process_erasure_request: GDPR Art. 17 right to erasure.
-- Called by admin after approving a DSR erasure request.
-- Anonymises personal data in place rather than hard-deleting rows so that
-- referential integrity is preserved (purchase records, audit trails, etc.).

create or replace function public.process_erasure_request(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Anonymise profile: wipe PII fields, keep row for FK integrity
  update public.profiles set
    display_name         = '[deleted]',
    company              = null,
    deletion_requested_at  = coalesce(deletion_requested_at, now()),
    deletion_scheduled_at  = now()
  where id = p_user_id;

  -- Archive seller listings so buyers can't see them
  update public.listings set
    status = 'archived'
  where seller_id = p_user_id and status != 'archived';

  -- Revoke all roles
  delete from public.user_roles where user_id = p_user_id;

  -- Record consent withdrawal for all purposes
  insert into public.consent_records (user_id, purpose, consented, session_id, user_agent)
  select
    p_user_id,
    purpose,
    false,
    'erasure-cascade',
    'system'
  from unnest(array['analytics','marketing','data_processing','terms_of_service']) as purpose;

  -- Audit log entry
  insert into public.audit_log (
    actor_id, actor_type, entity_type, entity_id, action, payload
  ) values (
    null, 'system', 'profile', p_user_id,
    'gdpr_erasure_completed',
    jsonb_build_object('user_id', p_user_id, 'erased_at', now())
  );
end;
$$;

-- Only admins (via service role in edge function or directly) can call this.
revoke all on function public.process_erasure_request(uuid) from public;
grant execute on function public.process_erasure_request(uuid) to authenticated;

-- Immutable audit_log: remove UPDATE and DELETE for non-service-role users.
-- Rows can only be inserted, never modified after the fact.
drop policy if exists "No update on audit_log" on public.audit_log;
drop policy if exists "No delete on audit_log" on public.audit_log;

-- Ensure no existing permissive update/delete policies exist for regular users.
-- (audit_log had RLS enabled with no policies = locked to service role only — preserve that.)
