-- Listings table
create table public.listings (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text not null,
  category text not null,
  sample_preview jsonb not null default '[]'::jsonb,
  price_per_record numeric(10, 4) not null check (price_per_record >= 0),
  total_records integer not null check (total_records >= 0),
  currency text not null default 'USD',
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_listings_seller on public.listings(seller_id);
create index idx_listings_status on public.listings(status);
create index idx_listings_category on public.listings(category);

alter table public.listings enable row level security;

create policy "Anyone can view published listings"
  on public.listings for select
  to anon, authenticated
  using (status = 'published');

create policy "Sellers can view their own listings"
  on public.listings for select
  to authenticated
  using (auth.uid() = seller_id);

create policy "Admins can view all listings"
  on public.listings for select
  to authenticated
  using (has_role(auth.uid(), 'admin'));

create policy "Sellers can create their own listings"
  on public.listings for insert
  to authenticated
  with check (auth.uid() = seller_id);

create policy "Sellers can update their own listings"
  on public.listings for update
  to authenticated
  using (auth.uid() = seller_id)
  with check (auth.uid() = seller_id);

create policy "Sellers can delete their own listings"
  on public.listings for delete
  to authenticated
  using (auth.uid() = seller_id);

create trigger update_listings_updated_at
  before update on public.listings
  for each row
  execute function public.update_updated_at_column();

-- Access requests table
create table public.access_requests (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  buyer_id uuid not null references auth.users(id) on delete cascade,
  message text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'declined')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (listing_id, buyer_id)
);

create index idx_access_requests_listing on public.access_requests(listing_id);
create index idx_access_requests_buyer on public.access_requests(buyer_id);

alter table public.access_requests enable row level security;

create policy "Buyers can view their own requests"
  on public.access_requests for select
  to authenticated
  using (auth.uid() = buyer_id);

create policy "Sellers can view requests on their listings"
  on public.access_requests for select
  to authenticated
  using (exists (
    select 1 from public.listings
    where listings.id = access_requests.listing_id
      and listings.seller_id = auth.uid()
  ));

create policy "Admins can view all requests"
  on public.access_requests for select
  to authenticated
  using (has_role(auth.uid(), 'admin'));

create policy "Buyers can create requests on published listings"
  on public.access_requests for insert
  to authenticated
  with check (
    auth.uid() = buyer_id
    and exists (
      select 1 from public.listings
      where listings.id = access_requests.listing_id
        and listings.status = 'published'
    )
  );

create policy "Sellers can update requests on their listings"
  on public.access_requests for update
  to authenticated
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

create trigger update_access_requests_updated_at
  before update on public.access_requests
  for each row
  execute function public.update_updated_at_column();