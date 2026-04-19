create table public.purchases (
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

create index idx_purchases_buyer on public.purchases (buyer_id);
create index idx_purchases_listing on public.purchases (listing_id);

alter table public.purchases enable row level security;

create policy "Buyers can view their own purchases"
on public.purchases for select to authenticated
using (auth.uid() = buyer_id);

create policy "Sellers can view purchases on their listings"
on public.purchases for select to authenticated
using (
  exists (
    select 1 from public.listings l
    where l.id = purchases.listing_id and l.seller_id = auth.uid()
  )
);

create policy "Admins can view all purchases"
on public.purchases for select to authenticated
using (public.has_role(auth.uid(), 'admin'));

create policy "Buyers can create their own purchases"
on public.purchases for insert to authenticated
with check (
  auth.uid() = buyer_id
  and exists (
    select 1 from public.listings l
    where l.id = purchases.listing_id and l.status = 'published'
  )
);

create trigger update_purchases_updated_at
before update on public.purchases
for each row execute function public.update_updated_at_column();

-- Notify seller on new purchase
create or replace function public.notify_seller_on_purchase()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  _seller_id uuid;
  _title text;
begin
  select seller_id, title into _seller_id, _title
  from public.listings where id = NEW.listing_id;

  if _seller_id is not null then
    perform public.create_notification(
      _seller_id,
      'purchase_completed',
      'New purchase',
      'A buyer purchased "' || coalesce(_title, 'your dataset') || '".',
      '/dashboard/listings',
      jsonb_build_object('listing_id', NEW.listing_id, 'purchase_id', NEW.id)
    );
  end if;

  return NEW;
end;
$$;

create trigger notify_seller_on_purchase_trg
after insert on public.purchases
for each row execute function public.notify_seller_on_purchase();