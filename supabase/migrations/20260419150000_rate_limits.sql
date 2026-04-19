-- Rate limiting table for edge functions.
-- Keyed by (identifier, window_start) where identifier = IP + endpoint slug
-- and window_start is truncated to the current minute.

create table if not exists public.rate_limits (
  identifier  text        not null,
  window_start timestamptz not null,
  request_count int        not null default 1,
  primary key (identifier, window_start)
);

-- Rows older than 5 minutes are worthless; clean them up automatically.
create index if not exists rate_limits_window_start_idx
  on public.rate_limits (window_start);

-- No direct client access — only service role writes via edge functions.
alter table public.rate_limits enable row level security;

-- Atomic upsert: inserts a new row for the window or increments the counter.
-- Returns the updated request_count so the caller can compare to the limit.
create or replace function public.upsert_rate_limit(
  p_identifier  text,
  p_window_start timestamptz
) returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  insert into public.rate_limits (identifier, window_start, request_count)
  values (p_identifier, p_window_start, 1)
  on conflict (identifier, window_start)
  do update set request_count = rate_limits.request_count + 1
  returning request_count into v_count;

  -- Prune stale rows older than 5 minutes to keep the table small.
  delete from public.rate_limits
  where window_start < now() - interval '5 minutes';

  return v_count;
end;
$$;

-- Only service role (used by edge functions) may call this.
revoke all on function public.upsert_rate_limit(text, timestamptz) from public;
grant execute on function public.upsert_rate_limit(text, timestamptz) to service_role;
