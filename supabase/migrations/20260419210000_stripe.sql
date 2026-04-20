-- Stripe integration columns

alter table public.profiles
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_account_id text;

alter table public.purchases
  add column if not exists stripe_session_id text,
  add column if not exists stripe_payment_intent_id text;

alter table public.payout_requests
  add column if not exists stripe_transfer_id text;
