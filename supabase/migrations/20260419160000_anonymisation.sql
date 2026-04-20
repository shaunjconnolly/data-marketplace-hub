-- anonymisation_jobs: tracks PII scanning and risk assessment for every
-- dataset file uploaded by a seller. A listing cannot be published until
-- its linked job reaches status = 'complete' and risk_score <= 0.30.

create table if not exists public.anonymisation_jobs (
  id                uuid        primary key default gen_random_uuid(),
  listing_id        uuid        references public.listings(id) on delete cascade,
  seller_id         uuid        not null references auth.users(id) on delete cascade,
  file_path         text        not null,
  status            text        not null default 'queued'
                                check (status in ('queued', 'processing', 'complete', 'failed')),
  risk_score        numeric(4,3),                    -- 0.000 – 1.000
  detected_fields   jsonb,                           -- [{name, risk_level, sample_values}]
  removed_fields    jsonb,                           -- [field_name, ...]
  flagged_for_review boolean    not null default false,
  report_html       text,
  error_message     text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists anon_jobs_listing_id_idx  on public.anonymisation_jobs (listing_id);
create index if not exists anon_jobs_seller_id_idx   on public.anonymisation_jobs (seller_id);
create index if not exists anon_jobs_status_idx      on public.anonymisation_jobs (status);
create index if not exists anon_jobs_flagged_idx     on public.anonymisation_jobs (flagged_for_review) where flagged_for_review = true;

-- updated_at trigger
create or replace function public.update_anon_job_updated_at()
returns trigger language plpgsql as $$
begin NEW.updated_at = now(); return NEW; end;
$$;

drop trigger if exists set_anon_job_updated_at on public.anonymisation_jobs;
create trigger set_anon_job_updated_at
  before update on public.anonymisation_jobs
  for each row execute function public.update_anon_job_updated_at();

-- RLS
alter table public.anonymisation_jobs enable row level security;

drop policy if exists "Sellers can view own jobs"   on public.anonymisation_jobs;
create policy "Sellers can view own jobs"
  on public.anonymisation_jobs for select to authenticated
  using (auth.uid() = seller_id);

drop policy if exists "Sellers can insert own jobs" on public.anonymisation_jobs;
create policy "Sellers can insert own jobs"
  on public.anonymisation_jobs for insert to authenticated
  with check (auth.uid() = seller_id);

drop policy if exists "Admins can view all jobs"    on public.anonymisation_jobs;
create policy "Admins can view all jobs"
  on public.anonymisation_jobs for select to authenticated
  using (public.has_role(auth.uid(), 'admin'));

drop policy if exists "Admins can update any job"   on public.anonymisation_jobs;
create policy "Admins can update any job"
  on public.anonymisation_jobs for update to authenticated
  using  (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));
