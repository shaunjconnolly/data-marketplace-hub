-- GDPR compliance tables for Uber4Data (Ireland / Belgium jurisdiction)

-- Consent records: immutable log of each consent decision per user per purpose
create table public.consent_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  session_id text,                          -- for pre-auth / anonymous consent
  purpose text not null,                    -- 'terms_of_service' | 'privacy_policy' | 'analytics' | 'marketing' | 'data_processing'
  consented boolean not null,
  ip_address text,
  user_agent text,
  created_at timestamptz default now() not null
);

alter table public.consent_records enable row level security;

create policy "Users can view own consent records"
  on public.consent_records for select
  using (auth.uid() = user_id);

create policy "Anyone can insert consent records"
  on public.consent_records for insert
  with check (true);

create index idx_consent_records_user_id on public.consent_records (user_id);
create index idx_consent_records_created_at on public.consent_records (created_at desc);

-- Data subject requests: GDPR Articles 17 (erasure) and 20 (portability)
create table public.data_subject_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  email text not null,
  request_type text not null check (request_type in ('export', 'erasure', 'rectification', 'restriction')),
  status text not null default 'pending' check (status in ('pending', 'processing', 'completed', 'rejected')),
  notes text,
  completed_at timestamptz,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

alter table public.data_subject_requests enable row level security;

create policy "Users can view own data subject requests"
  on public.data_subject_requests for select
  using (auth.uid() = user_id);

create policy "Authenticated users can create data subject requests"
  on public.data_subject_requests for insert
  with check (auth.uid() = user_id);

create policy "Admins can manage all data subject requests"
  on public.data_subject_requests for all
  using (
    exists (
      select 1 from public.user_roles
      where user_id = auth.uid() and role = 'admin'
    )
  );

create index idx_dsr_user_id on public.data_subject_requests (user_id);
create index idx_dsr_status on public.data_subject_requests (status);
create index idx_dsr_created_at on public.data_subject_requests (created_at desc);

-- Auto-update updated_at
create trigger set_updated_at_data_subject_requests
  before update on public.data_subject_requests
  for each row execute function public.set_updated_at();

-- Retention policy marker on profiles (soft delete support)
alter table public.profiles
  add column if not exists deletion_requested_at timestamptz,
  add column if not exists deletion_scheduled_at timestamptz;
