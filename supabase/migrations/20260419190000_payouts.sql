-- V9: Seller payout requests.
--
-- Sellers accumulate earnings from purchases on their listings.
-- They can request a payout of their available balance; admins
-- approve and mark as paid. All amounts in the listing's currency (USD).

create table public.payout_requests (
  id          uuid primary key default gen_random_uuid(),
  seller_id   uuid not null references auth.users(id) on delete cascade,
  amount      numeric(12, 2) not null check (amount > 0),
  currency    text not null default 'USD',
  status      text not null default 'pending'
                check (status in ('pending', 'approved', 'paid', 'rejected')),
  notes       text,
  admin_notes text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index idx_payout_requests_seller on public.payout_requests (seller_id);
create index idx_payout_requests_status on public.payout_requests (status);

alter table public.payout_requests enable row level security;

create policy "Sellers can view their own payout requests"
  on public.payout_requests for select to authenticated
  using (auth.uid() = seller_id);

create policy "Sellers can create their own payout requests"
  on public.payout_requests for insert to authenticated
  with check (auth.uid() = seller_id);

create policy "Admins can view all payout requests"
  on public.payout_requests for select to authenticated
  using (public.has_role(auth.uid(), 'admin'));

create policy "Admins can update payout requests"
  on public.payout_requests for update to authenticated
  using (public.has_role(auth.uid(), 'admin'));

create trigger update_payout_requests_updated_at
  before update on public.payout_requests
  for each row execute function public.update_updated_at_column();

-- ─── Earnings summary function ────────────────────────────────────────────────
--
-- Returns one row: total_earned, total_requested (pending+approved+paid),
-- total_paid_out (status=paid), available (= total_earned - total_requested).

create or replace function public.get_seller_earnings(p_seller_id uuid)
returns table (
  total_earned    numeric,
  total_requested numeric,
  total_paid_out  numeric,
  available       numeric
)
language sql
security definer
set search_path = public
as $$
  select
    coalesce(earned.total, 0)     as total_earned,
    coalesce(req.requested, 0)    as total_requested,
    coalesce(req.paid_out, 0)     as total_paid_out,
    greatest(0,
      coalesce(earned.total, 0) - coalesce(req.requested, 0)
    )                             as available
  from
    (
      select sum(p.total_amount) as total
      from   public.purchases p
      join   public.listings  l on l.id = p.listing_id
      where  l.seller_id = p_seller_id
        and  p.payment_status = 'paid'
    ) earned,
    (
      select
        sum(amount) filter (where status in ('pending','approved','paid')) as requested,
        sum(amount) filter (where status = 'paid')                         as paid_out
      from public.payout_requests
      where seller_id = p_seller_id
    ) req;
$$;

-- Only the owner or an admin should call this
revoke all on function public.get_seller_earnings(uuid) from public;
grant execute on function public.get_seller_earnings(uuid) to authenticated;

-- ─── Audit trigger ────────────────────────────────────────────────────────────

create or replace function public.audit_payout_request()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.audit_log (actor_id, actor_type, entity_type, entity_id, action, payload)
  values (
    auth.uid(), 'user', 'payout_request', NEW.id,
    case
      when TG_OP = 'INSERT' then 'payout_requested'
      when NEW.status = 'approved' then 'payout_approved'
      when NEW.status = 'paid'     then 'payout_paid'
      when NEW.status = 'rejected' then 'payout_rejected'
      else 'payout_updated'
    end,
    jsonb_build_object('seller_id', NEW.seller_id, 'amount', NEW.amount, 'status', NEW.status)
  );
  return NEW;
end;
$$;

create trigger audit_payout_request_trg
  after insert or update on public.payout_requests
  for each row execute function public.audit_payout_request();
