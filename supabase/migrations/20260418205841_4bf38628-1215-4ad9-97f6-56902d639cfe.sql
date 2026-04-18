-- V1 Foundation tables for Uber4Data

-- =========================================
-- WAITLIST
-- =========================================
create table public.waitlist (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  email text not null unique,
  role text check (role in ('buyer', 'seller', 'both')),
  company text,
  source text default 'homepage',
  status text not null default 'waiting'
    check (status in ('waiting', 'invited', 'converted'))
);

alter table public.waitlist enable row level security;

-- Anyone can join the waitlist (anon + authenticated)
create policy "Anyone can join the waitlist"
on public.waitlist
for insert
to anon, authenticated
with check (true);

-- No client-side reads/updates/deletes — admin only via service role

-- =========================================
-- AUDIT LOG
-- =========================================
create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  actor_id uuid,
  actor_type text,
  entity_type text not null,
  entity_id text not null,
  action text not null,
  payload jsonb not null default '{}'::jsonb
);

alter table public.audit_log enable row level security;
-- No policies = locked down to service role only

create index idx_audit_log_entity on public.audit_log (entity_type, entity_id);
create index idx_audit_log_created_at on public.audit_log (created_at desc);

-- =========================================
-- NOTIFICATIONS
-- =========================================
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_id uuid not null,
  type text not null,
  title text not null,
  body text,
  action_url text,
  metadata jsonb not null default '{}'::jsonb,
  read_at timestamptz
);

alter table public.notifications enable row level security;

create policy "Users can view their own notifications"
on public.notifications
for select
to authenticated
using (auth.uid() = user_id);

create policy "Users can mark their own notifications as read"
on public.notifications
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create index idx_notifications_user on public.notifications (user_id, created_at desc);

-- =========================================
-- CAPTURED ERRORS
-- =========================================
create table public.captured_errors (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  message text not null,
  stack text,
  context jsonb not null default '{}'::jsonb,
  resolved boolean not null default false
);

alter table public.captured_errors enable row level security;
-- No policies = locked down to service role only

create index idx_captured_errors_unresolved on public.captured_errors (created_at desc) where resolved = false;

-- =========================================
-- OUTBOUND EMAILS
-- =========================================
create table public.outbound_emails (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  to_address text not null,
  subject text not null,
  body_html text,
  body_text text,
  status text not null default 'pending'
    check (status in ('pending', 'sent', 'failed')),
  sent_at timestamptz,
  error_message text,
  metadata jsonb not null default '{}'::jsonb
);

alter table public.outbound_emails enable row level security;
-- No policies = locked down to service role only

create index idx_outbound_emails_status on public.outbound_emails (status, created_at);