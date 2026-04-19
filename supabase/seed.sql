-- ============================================================
-- Uber4Data — full schema setup
-- Paste into Supabase SQL Editor and Run
-- Safe to re-run: uses IF NOT EXISTS + DROP … IF EXISTS guards
-- ============================================================

-- WAITLIST
create table if not exists public.waitlist (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  email text not null unique,
  role text check (role in ('buyer', 'seller', 'both')),
  company text,
  source text default 'homepage',
  status text not null default 'waiting' check (status in ('waiting', 'invited', 'converted'))
);
alter table public.waitlist enable row level security;
drop policy if exists "Anyone can join the waitlist" on public.waitlist;
create policy "Anyone can join the waitlist"
  on public.waitlist for insert to anon, authenticated with check (true);

-- AUDIT LOG
create table if not exists public.audit_log (
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
create index if not exists idx_audit_log_entity on public.audit_log (entity_type, entity_id);
create index if not exists idx_audit_log_created_at on public.audit_log (created_at desc);

-- NOTIFICATIONS
create table if not exists public.notifications (
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
drop policy if exists "Users can view their own notifications" on public.notifications;
create policy "Users can view their own notifications"
  on public.notifications for select to authenticated using (auth.uid() = user_id);
drop policy if exists "Users can mark their own notifications as read" on public.notifications;
create policy "Users can mark their own notifications as read"
  on public.notifications for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index if not exists idx_notifications_user on public.notifications (user_id, created_at desc);

-- CAPTURED ERRORS
create table if not exists public.captured_errors (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  message text not null,
  stack text,
  context jsonb not null default '{}'::jsonb,
  resolved boolean not null default false
);
alter table public.captured_errors enable row level security;

-- OUTBOUND EMAILS
create table if not exists public.outbound_emails (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  to_address text not null,
  subject text not null,
  body_html text,
  body_text text,
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed')),
  sent_at timestamptz,
  error_message text,
  metadata jsonb not null default '{}'::jsonb
);
alter table public.outbound_emails enable row level security;

-- APP ROLE ENUM
do $$ begin
  create type public.app_role as enum ('admin', 'moderator', 'user');
exception when duplicate_object then null;
end $$;

-- PROFILES
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  display_name text,
  company text,
  primary_role text check (primary_role in ('buyer', 'seller', 'both')),
  onboarding_completed boolean not null default false,
  deletion_requested_at timestamptz,
  deletion_scheduled_at timestamptz
);
alter table public.profiles enable row level security;

-- USER ROLES
create table if not exists public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
alter table public.user_roles enable row level security;

-- FUNCTION: has_role
create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role = _role
  );
$$;

-- FUNCTION: update_updated_at_column
create or replace function public.update_updated_at_column()
returns trigger
language plpgsql set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- FUNCTION: handle_new_user
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, company)
  values (
    new.id,
    new.raw_user_meta_data ->> 'display_name',
    new.raw_user_meta_data ->> 'company'
  );
  insert into public.user_roles (user_id, role)
  values (new.id, 'user');
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

drop trigger if exists update_profiles_updated_at on public.profiles;
create trigger update_profiles_updated_at
  before update on public.profiles
  for each row execute function public.update_updated_at_column();

-- PROFILES POLICIES
drop policy if exists "Users can view their own profile" on public.profiles;
create policy "Users can view their own profile"
  on public.profiles for select to authenticated using (auth.uid() = id);
drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
  on public.profiles for update to authenticated
  using (auth.uid() = id) with check (auth.uid() = id);
drop policy if exists "Admins can view all profiles" on public.profiles;
create policy "Admins can view all profiles"
  on public.profiles for select to authenticated
  using (public.has_role(auth.uid(), 'admin'));

-- USER ROLES POLICIES
drop policy if exists "Users can view their own roles" on public.user_roles;
create policy "Users can view their own roles"
  on public.user_roles for select to authenticated using (auth.uid() = user_id);
drop policy if exists "Admins can view all roles" on public.user_roles;
create policy "Admins can view all roles"
  on public.user_roles for select to authenticated
  using (public.has_role(auth.uid(), 'admin'));
drop policy if exists "Admins can grant roles" on public.user_roles;
create policy "Admins can grant roles"
  on public.user_roles for insert to authenticated
  with check (public.has_role(auth.uid(), 'admin'));
drop policy if exists "Admins can revoke roles" on public.user_roles;
create policy "Admins can revoke roles"
  on public.user_roles for delete to authenticated
  using (public.has_role(auth.uid(), 'admin'));

-- LISTINGS
create table if not exists public.listings (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text not null,
  category text not null,
  sample_preview jsonb not null default '[]'::jsonb,
  price_per_record numeric(10,4) not null check (price_per_record >= 0),
  total_records integer not null check (total_records >= 0),
  currency text not null default 'USD',
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  file_path text,
  file_size_bytes bigint,
  file_mime text,
  file_original_name text
);
alter table public.listings enable row level security;
create index if not exists idx_listings_seller on public.listings (seller_id);
create index if not exists idx_listings_status on public.listings (status);
create index if not exists idx_listings_category on public.listings (category);
drop policy if exists "Anyone can view published listings" on public.listings;
create policy "Anyone can view published listings"
  on public.listings for select to anon, authenticated using (status = 'published');
drop policy if exists "Sellers can view their own listings" on public.listings;
create policy "Sellers can view their own listings"
  on public.listings for select to authenticated using (auth.uid() = seller_id);
drop policy if exists "Admins can view all listings" on public.listings;
create policy "Admins can view all listings"
  on public.listings for select to authenticated using (has_role(auth.uid(), 'admin'));
drop policy if exists "Sellers can create their own listings" on public.listings;
create policy "Sellers can create their own listings"
  on public.listings for insert to authenticated with check (auth.uid() = seller_id);
drop policy if exists "Sellers can update their own listings" on public.listings;
create policy "Sellers can update their own listings"
  on public.listings for update to authenticated
  using (auth.uid() = seller_id) with check (auth.uid() = seller_id);
drop policy if exists "Sellers can delete their own listings" on public.listings;
create policy "Sellers can delete their own listings"
  on public.listings for delete to authenticated using (auth.uid() = seller_id);
drop policy if exists "Admins can update any listing" on public.listings;
create policy "Admins can update any listing"
  on public.listings for update to authenticated
  using (has_role(auth.uid(), 'admin')) with check (has_role(auth.uid(), 'admin'));
drop trigger if exists update_listings_updated_at on public.listings;
create trigger update_listings_updated_at
  before update on public.listings
  for each row execute function public.update_updated_at_column();

-- ACCESS REQUESTS
create table if not exists public.access_requests (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  buyer_id uuid not null references auth.users(id) on delete cascade,
  message text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'declined')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (listing_id, buyer_id)
);
alter table public.access_requests enable row level security;
create index if not exists idx_access_requests_listing on public.access_requests (listing_id);
create index if not exists idx_access_requests_buyer on public.access_requests (buyer_id);
drop policy if exists "Buyers can view their own requests" on public.access_requests;
create policy "Buyers can view their own requests"
  on public.access_requests for select to authenticated using (auth.uid() = buyer_id);
drop policy if exists "Sellers can view requests on their listings" on public.access_requests;
create policy "Sellers can view requests on their listings"
  on public.access_requests for select to authenticated
  using (exists (
    select 1 from public.listings
    where listings.id = access_requests.listing_id
      and listings.seller_id = auth.uid()
  ));
drop policy if exists "Admins can view all requests" on public.access_requests;
create policy "Admins can view all requests"
  on public.access_requests for select to authenticated
  using (has_role(auth.uid(), 'admin'));
drop policy if exists "Buyers can create requests on published listings" on public.access_requests;
create policy "Buyers can create requests on published listings"
  on public.access_requests for insert to authenticated
  with check (
    auth.uid() = buyer_id
    and exists (
      select 1 from public.listings
      where listings.id = access_requests.listing_id
        and listings.status = 'published'
    )
  );
drop policy if exists "Sellers can update requests on their listings" on public.access_requests;
create policy "Sellers can update requests on their listings"
  on public.access_requests for update to authenticated
  using (exists (
    select 1 from public.listings
    where listings.id = access_requests.listing_id
      and listings.seller_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.listings
    where listings.id = access_requests.listing_id
      and listings.seller_id = auth.uid()
  ));
drop trigger if exists update_access_requests_updated_at on public.access_requests;
create trigger update_access_requests_updated_at
  before update on public.access_requests
  for each row execute function public.update_updated_at_column();

-- NOTIFICATION HELPER
create or replace function public.create_notification(
  _user_id uuid,
  _type text,
  _title text,
  _body text,
  _action_url text default null,
  _metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  _id uuid;
begin
  insert into public.notifications (user_id, type, title, body, action_url, metadata)
  values (_user_id, _type, _title, _body, _action_url, _metadata)
  returning id into _id;
  return _id;
end;
$$;

-- TRIGGER: notify buyer on request status change
-- Uses inline subqueries instead of declared variables to avoid parser ambiguity
create or replace function public.notify_buyer_on_request_status_change()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if NEW.status = OLD.status then
    return NEW;
  end if;

  if NEW.status = 'approved' then
    perform public.create_notification(
      NEW.buyer_id,
      'access_approved',
      'Access approved',
      'Your request for "' || coalesce(
        (select title from public.listings where id = NEW.listing_id),
        'a dataset'
      ) || '" was approved.',
      '/marketplace/' || NEW.listing_id::text,
      jsonb_build_object('listing_id', NEW.listing_id, 'request_id', NEW.id)
    );
  elsif NEW.status = 'declined' then
    perform public.create_notification(
      NEW.buyer_id,
      'access_declined',
      'Access declined',
      'Your request for "' || coalesce(
        (select title from public.listings where id = NEW.listing_id),
        'a dataset'
      ) || '" was declined.',
      '/marketplace/' || NEW.listing_id::text,
      jsonb_build_object('listing_id', NEW.listing_id, 'request_id', NEW.id)
    );
  end if;

  return NEW;
end;
$$;

drop trigger if exists access_requests_notify_buyer on public.access_requests;
create trigger access_requests_notify_buyer
  after update on public.access_requests
  for each row execute function public.notify_buyer_on_request_status_change();

-- WAITLIST ADMIN POLICIES
drop policy if exists "Admins can view all waitlist entries" on public.waitlist;
create policy "Admins can view all waitlist entries"
  on public.waitlist for select to authenticated
  using (has_role(auth.uid(), 'admin'));
drop policy if exists "Admins can update waitlist entries" on public.waitlist;
create policy "Admins can update waitlist entries"
  on public.waitlist for update to authenticated
  using (has_role(auth.uid(), 'admin')) with check (has_role(auth.uid(), 'admin'));

-- PURCHASES
create table if not exists public.purchases (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null,
  buyer_id uuid not null,
  access_request_id uuid,
  price_per_record numeric not null,
  record_count integer not null,
  total_amount numeric not null,
  currency text not null default 'USD',
  payment_provider text not null default 'mock',
  payment_status text not null default 'paid',
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.purchases enable row level security;
create index if not exists idx_purchases_buyer on public.purchases (buyer_id);
create index if not exists idx_purchases_listing on public.purchases (listing_id);
drop policy if exists "Buyers can view their own purchases" on public.purchases;
create policy "Buyers can view their own purchases"
  on public.purchases for select to authenticated using (auth.uid() = buyer_id);
drop policy if exists "Sellers can view purchases on their listings" on public.purchases;
create policy "Sellers can view purchases on their listings"
  on public.purchases for select to authenticated
  using (exists (
    select 1 from public.listings l
    where l.id = purchases.listing_id and l.seller_id = auth.uid()
  ));
drop policy if exists "Admins can view all purchases" on public.purchases;
create policy "Admins can view all purchases"
  on public.purchases for select to authenticated
  using (public.has_role(auth.uid(), 'admin'));
drop policy if exists "Buyers can create their own purchases" on public.purchases;
create policy "Buyers can create their own purchases"
  on public.purchases for insert to authenticated
  with check (
    auth.uid() = buyer_id
    and exists (
      select 1 from public.listings l
      where l.id = purchases.listing_id and l.status = 'published'
    )
  );
drop trigger if exists update_purchases_updated_at on public.purchases;
create trigger update_purchases_updated_at
  before update on public.purchases
  for each row execute function public.update_updated_at_column();

-- TRIGGER: notify seller on purchase
-- Uses inline subqueries instead of declared variables to avoid parser ambiguity
create or replace function public.notify_seller_on_purchase()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if exists (select 1 from public.listings where id = NEW.listing_id) then
    perform public.create_notification(
      (select seller_id from public.listings where id = NEW.listing_id),
      'purchase_completed',
      'New purchase',
      'A buyer purchased "' || coalesce(
        (select title from public.listings where id = NEW.listing_id),
        'your dataset'
      ) || '".',
      '/dashboard/listings',
      jsonb_build_object('listing_id', NEW.listing_id, 'purchase_id', NEW.id)
    );
  end if;
  return NEW;
end;
$$;

drop trigger if exists notify_seller_on_purchase_trg on public.purchases;
create trigger notify_seller_on_purchase_trg
  after insert on public.purchases
  for each row execute function public.notify_seller_on_purchase();

-- STORAGE
insert into storage.buckets (id, name, public)
values ('dataset-files', 'dataset-files', false)
on conflict (id) do nothing;

drop policy if exists "Sellers can upload their own dataset files" on storage.objects;
create policy "Sellers can upload their own dataset files"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'dataset-files' and auth.uid()::text = (storage.foldername(name))[1]);
drop policy if exists "Sellers can read their own dataset files" on storage.objects;
create policy "Sellers can read their own dataset files"
  on storage.objects for select to authenticated
  using (bucket_id = 'dataset-files' and auth.uid()::text = (storage.foldername(name))[1]);
drop policy if exists "Sellers can update their own dataset files" on storage.objects;
create policy "Sellers can update their own dataset files"
  on storage.objects for update to authenticated
  using (bucket_id = 'dataset-files' and auth.uid()::text = (storage.foldername(name))[1]);
drop policy if exists "Sellers can delete their own dataset files" on storage.objects;
create policy "Sellers can delete their own dataset files"
  on storage.objects for delete to authenticated
  using (bucket_id = 'dataset-files' and auth.uid()::text = (storage.foldername(name))[1]);
drop policy if exists "Admins can read all dataset files" on storage.objects;
create policy "Admins can read all dataset files"
  on storage.objects for select to authenticated
  using (bucket_id = 'dataset-files' and public.has_role(auth.uid(), 'admin'));

-- GDPR: CONSENT RECORDS
create table if not exists public.consent_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  session_id text,
  purpose text not null,
  consented boolean not null,
  ip_address text,
  user_agent text,
  created_at timestamptz default now() not null
);
alter table public.consent_records enable row level security;
drop policy if exists "Users can view own consent records" on public.consent_records;
create policy "Users can view own consent records"
  on public.consent_records for select using (auth.uid() = user_id);
drop policy if exists "Anyone can insert consent records" on public.consent_records;
create policy "Anyone can insert consent records"
  on public.consent_records for insert with check (true);
create index if not exists idx_consent_records_user_id on public.consent_records (user_id);

-- GDPR: DATA SUBJECT REQUESTS
create table if not exists public.data_subject_requests (
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
drop policy if exists "Users can view own data subject requests" on public.data_subject_requests;
create policy "Users can view own data subject requests"
  on public.data_subject_requests for select using (auth.uid() = user_id);
drop policy if exists "Authenticated users can create data subject requests" on public.data_subject_requests;
create policy "Authenticated users can create data subject requests"
  on public.data_subject_requests for insert with check (auth.uid() = user_id);
drop policy if exists "Admins can manage all data subject requests" on public.data_subject_requests;
create policy "Admins can manage all data subject requests"
  on public.data_subject_requests for all
  using (exists (
    select 1 from public.user_roles
    where user_id = auth.uid() and role = 'admin'
  ));
create index if not exists idx_dsr_user_id on public.data_subject_requests (user_id);
drop trigger if exists set_updated_at_dsr on public.data_subject_requests;
create trigger set_updated_at_dsr
  before update on public.data_subject_requests
  for each row execute function public.update_updated_at_column();
