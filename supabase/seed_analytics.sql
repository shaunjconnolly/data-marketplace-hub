-- Seed analytics data for connollyshaun@hotmail.com
do $$
declare
  v_user_id uuid;
  v_listing_id uuid;
  v_buyer_id uuid;
  v_month int;
  v_day int;
  v_records int;
  i int;
  v_prices numeric[] := array[0.035, 0.012, 0.085, 0.008, 0.025];
  v_titles text[] := array[
    'UK B2B Contact Database 2024',
    'Consumer Behaviour Dataset',
    'Financial Transactions Data',
    'Social Media Profiles EU',
    'Healthcare Demographics'
  ];
  v_cats text[] := array['b2b','demographics','transactions','social','healthcare'];
begin
  -- Get the user ID
  select id into v_user_id from auth.users where email = 'connollyshaun@hotmail.com' limit 1;

  if v_user_id is null then
    raise exception 'User not found';
  end if;

  -- Get a buyer (any other user)
  select id into v_buyer_id from public.profiles where id != v_user_id limit 1;

  -- Create 5 listings if user has none
  for i in 1..5 loop
    v_listing_id := gen_random_uuid();

    insert into public.listings (
      id, seller_id, title, description, category,
      price_per_record, total_records, status, published_at, created_at
    ) values (
      v_listing_id, v_user_id,
      v_titles[i],
      'High quality compliant dataset available for immediate purchase.',
      v_cats[i],
      v_prices[i], 500000, 'published', now() - '5 days'::interval, now() - '10 days'::interval
    )
    on conflict do nothing;

    -- 3-6 purchases per month for 6 months
    for v_month in 0..5 loop
      for i in 1..floor(random()*4+3)::int loop
        v_day     := floor(random()*26+1)::int;
        v_records := floor(random()*9000+1000)::int;

        insert into public.purchases (
          listing_id, buyer_id,
          price_per_record, record_count,
          total_amount, currency,
          payment_provider, payment_status,
          paid_at, created_at
        ) values (
          v_listing_id,
          coalesce(v_buyer_id, v_user_id),
          v_prices[i % 5 + 1],
          v_records,
          round((v_prices[i % 5 + 1] * v_records)::numeric, 2),
          'EUR', 'stripe', 'paid',
          now() - (v_month||' months')::interval - (v_day||' days')::interval,
          now() - (v_month||' months')::interval - (v_day||' days')::interval
        );
      end loop;
    end loop;

  end loop;

  raise notice 'Done — seeded analytics data for user %', v_user_id;
end;
$$;
