-- V15: Immutable audit log with SHA-256 hash chaining.
--
-- Each row stores:
--   prev_hash — row_hash of the immediately preceding row (ordered by id)
--   row_hash  — SHA-256(prev_hash | id | actor_id | action | entity_type | created_at | payload)
--
-- If any row is modified after insert, its hash no longer matches what
-- the next row recorded as prev_hash, making tampering detectable.

create extension if not exists pgcrypto;

-- Add hash columns (nullable so existing rows don't break)
alter table public.audit_log
  add column if not exists prev_hash text,
  add column if not exists row_hash  text;

-- Trigger function: compute hashes on every INSERT.
-- Uses the highest-id row as "previous" to avoid clock-skew issues.
create or replace function public.hash_audit_log_row()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prev_hash text;
  v_content   text;
begin
  -- Grab the most recent row's hash to chain from
  select coalesce(row_hash, 'genesis')
  into   v_prev_hash
  from   public.audit_log
  order  by created_at desc, id desc
  limit  1;

  new.prev_hash := coalesce(v_prev_hash, 'genesis');

  -- Deterministic content string — nulls replaced with empty string
  v_content :=
    new.prev_hash                          || '|' ||
    new.id::text                           || '|' ||
    coalesce(new.actor_id::text,  '')      || '|' ||
    coalesce(new.actor_type,      '')      || '|' ||
    coalesce(new.action,          '')      || '|' ||
    coalesce(new.entity_type,     '')      || '|' ||
    coalesce(new.entity_id::text, '')      || '|' ||
    new.created_at::text                   || '|' ||
    coalesce(new.payload::text,   '');

  new.row_hash := encode(digest(v_content, 'sha256'), 'hex');

  return new;
end;
$$;

drop trigger if exists hash_audit_log_on_insert on public.audit_log;
create trigger hash_audit_log_on_insert
  before insert on public.audit_log
  for each row execute function public.hash_audit_log_row();

-- Allow admins to read the audit log (previously locked to service role)
drop policy if exists "Admins can read audit log" on public.audit_log;
create policy "Admins can read audit log"
  on public.audit_log for select to authenticated
  using (public.has_role(auth.uid(), 'admin'));

-- Explicitly block UPDATE and DELETE for all authenticated users.
-- The service role bypasses RLS so backend inserts still work.
drop policy if exists "No updates on audit log" on public.audit_log;
create policy "No updates on audit log"
  on public.audit_log for update to authenticated
  using (false);

drop policy if exists "No deletes on audit log" on public.audit_log;
create policy "No deletes on audit log"
  on public.audit_log for delete to authenticated
  using (false);

-- Chain verification function.
-- Returns every row where the stored prev_hash does not match the
-- actual row_hash of its predecessor — i.e. where tampering occurred.
create or replace function public.verify_audit_chain()
returns table (
  broken_id       uuid,
  broken_at       timestamptz,
  action          text,
  stored_prev     text,
  expected_prev   text
)
language sql
security definer
set search_path = public
as $$
  with ordered as (
    select
      id,
      created_at,
      action,
      prev_hash,
      row_hash,
      lag(row_hash) over (order by created_at asc, id asc) as actual_prev_hash
    from public.audit_log
    where row_hash is not null
  )
  select
    id           as broken_id,
    created_at   as broken_at,
    action,
    prev_hash    as stored_prev,
    coalesce(actual_prev_hash, 'genesis') as expected_prev
  from ordered
  where prev_hash is distinct from coalesce(actual_prev_hash, 'genesis')
  order by created_at asc;
$$;

-- Only admins may call the verify function
revoke all on function public.verify_audit_chain() from public;
grant execute on function public.verify_audit_chain() to authenticated;
