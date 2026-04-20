-- WeSourceData — demo seed data
-- ─────────────────────────────────────────────────────────────────────────────
-- Test accounts (password: Demo123456!)
--   alice@demo.wesourcedata.com   — seller
--   bob@demo.wesourcedata.com     — seller
--   charlie@demo.wesourcedata.com — buyer
--   diana@demo.wesourcedata.com   — buyer + seller
-- ─────────────────────────────────────────────────────────────────────────────

-- ═══ SECTION 1: Auth users ═══════════════════════════════════════════════════

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at, is_sso_user
) values
(
  'a0000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
  'alice@demo.wesourcedata.com',
  crypt('Demo123456!', gen_salt('bf', 6)),
  now() - interval '30 days',
  '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
  now() - interval '30 days', now() - interval '30 days', false
),
(
  'b0000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
  'bob@demo.wesourcedata.com',
  crypt('Demo123456!', gen_salt('bf', 6)),
  now() - interval '25 days',
  '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
  now() - interval '25 days', now() - interval '25 days', false
),
(
  'c0000000-0000-0000-0000-000000000003',
  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
  'charlie@demo.wesourcedata.com',
  crypt('Demo123456!', gen_salt('bf', 6)),
  now() - interval '20 days',
  '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
  now() - interval '20 days', now() - interval '20 days', false
),
(
  'd0000000-0000-0000-0000-000000000004',
  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
  'diana@demo.wesourcedata.com',
  crypt('Demo123456!', gen_salt('bf', 6)),
  now() - interval '15 days',
  '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
  now() - interval '15 days', now() - interval '15 days', false
)
on conflict (id) do nothing;

-- ═══ SECTION 2: Profiles ═════════════════════════════════════════════════════

update public.profiles set
  display_name = 'Alice Chen', company = 'DataSource Ltd',
  primary_role = 'seller', onboarding_completed = true
where id = 'a0000000-0000-0000-0000-000000000001';

update public.profiles set
  display_name = 'Bob Martinez', company = 'Insights Corp',
  primary_role = 'seller', onboarding_completed = true
where id = 'b0000000-0000-0000-0000-000000000002';

update public.profiles set
  display_name = 'Charlie Park', company = 'Growth Analytics',
  primary_role = 'buyer', onboarding_completed = true
where id = 'c0000000-0000-0000-0000-000000000003';

update public.profiles set
  display_name = 'Diana Walsh', company = 'Walsh Ventures',
  primary_role = 'both', onboarding_completed = true
where id = 'd0000000-0000-0000-0000-000000000004';

-- ═══ SECTION 3: Waitlist ═════════════════════════════════════════════════════

insert into public.waitlist (email, role, company, source, status, created_at) values
('alice@demo.wesourcedata.com',   'seller', 'DataSource Ltd',    'organic',  'converted', now() - interval '35 days'),
('bob@demo.wesourcedata.com',     'seller', 'Insights Corp',     'referral', 'converted', now() - interval '28 days'),
('charlie@demo.wesourcedata.com', 'buyer',  'Growth Analytics',  'linkedin', 'converted', now() - interval '22 days'),
('diana@demo.wesourcedata.com',   'both',   'Walsh Ventures',    'organic',  'converted', now() - interval '18 days'),
('emma.jones@fintech.io',         'buyer',  'FinTech Solutions', 'linkedin', 'invited',   now() - interval '10 days'),
('raj.patel@dataworks.co',        'seller', 'DataWorks Co',      'organic',  'invited',   now() - interval '8 days'),
('sophie@marketpulse.com',        'buyer',  'MarketPulse',       'referral', 'waiting',   now() - interval '5 days'),
('tom.kim@analytix.io',           'seller', 'Analytix IO',       'organic',  'waiting',   now() - interval '3 days'),
('priya@databridge.com',          'both',   'DataBridge',        'linkedin', 'waiting',   now() - interval '2 days'),
('liam@insightful.co',            'buyer',  null,                'organic',  'waiting',   now() - interval '1 day')
on conflict do nothing;

-- ═══ SECTION 4: Listings ═════════════════════════════════════════════════════

insert into public.listings (id, seller_id, title, description, category, price_per_record, total_records, status, published_at, created_at) values
(
  '00000000-0000-0000-1111-000000000001',
  'a0000000-0000-0000-0000-000000000001',
  'UK Consumer Demographics 2024',
  'Comprehensive UK consumer dataset covering age, income bands, location, lifestyle preferences and purchasing behaviour. Sourced from opt-in panel surveys with full GDPR compliance.',
  'demographics', 0.0120, 850000, 'published', now() - interval '22 days', now() - interval '28 days'
),
(
  '00000000-0000-0000-1111-000000000002',
  'a0000000-0000-0000-0000-000000000001',
  'E-Commerce Transaction History Q1-Q3 2024',
  'Anonymised e-commerce transaction records including product categories, basket sizes, time-of-purchase and regional breakdowns. Retail and fashion verticals.',
  'transactions', 0.0085, 2100000, 'draft', null, now() - interval '5 days'
),
(
  '00000000-0000-0000-1111-000000000003',
  'b0000000-0000-0000-0000-000000000002',
  'B2B Contact Database EMEA 2024',
  'Verified B2B contacts across EMEA: company name, industry, company size, job title, country. All contacts opted in to third-party marketing. 94% email deliverability rate.',
  'b2b', 0.0350, 420000, 'published', now() - interval '18 days', now() - interval '20 days'
),
(
  '00000000-0000-0000-1111-000000000004',
  'd0000000-0000-0000-0000-000000000004',
  'Social Media Sentiment UK Finance Sector',
  'Aggregated and anonymised social media sentiment data for the UK finance and fintech sector. Includes sentiment scores, topic clusters and trend indicators by week.',
  'social', 0.0045, 3400000, 'published', now() - interval '10 days', now() - interval '12 days'
)
on conflict (id) do nothing;

-- ═══ SECTION 5: Anonymisation jobs ═══════════════════════════════════════════

insert into public.anonymisation_jobs (id, listing_id, seller_id, file_path, status, risk_score, detected_fields, flagged_for_review, created_at) values
(
  '00000000-0000-0000-5555-000000000001',
  '00000000-0000-0000-1111-000000000001',
  'a0000000-0000-0000-0000-000000000001',
  'dataset-files/a0000000-0000-0000-0000-000000000001/uk-consumer-2024.csv',
  'complete', 0.187,
  '[{"name":"age","risk_level":"medium"},{"name":"postcode","risk_level":"medium"},{"name":"income_band","risk_level":"low"}]'::jsonb,
  false, now() - interval '22 days'
),
(
  '00000000-0000-0000-5555-000000000002',
  '00000000-0000-0000-1111-000000000002',
  'a0000000-0000-0000-0000-000000000001',
  'dataset-files/a0000000-0000-0000-0000-000000000001/ecommerce-q1q3-2024.csv',
  'complete', 0.421,
  '[{"name":"email","risk_level":"high"},{"name":"name","risk_level":"medium"},{"name":"address","risk_level":"high"}]'::jsonb,
  false, now() - interval '5 days'
),
(
  '00000000-0000-0000-5555-000000000003',
  '00000000-0000-0000-1111-000000000003',
  'b0000000-0000-0000-0000-000000000002',
  'dataset-files/b0000000-0000-0000-0000-000000000002/b2b-emea-2024.csv',
  'complete', 0.640,
  '[{"name":"email","risk_level":"high"},{"name":"phone","risk_level":"high"},{"name":"company","risk_level":"low"},{"name":"name","risk_level":"medium"}]'::jsonb,
  true, now() - interval '18 days'
)
on conflict (id) do nothing;

-- ═══ SECTION 6: Access requests ══════════════════════════════════════════════

insert into public.access_requests (id, listing_id, buyer_id, message, status, created_at) values
(
  '00000000-0000-0000-2222-000000000001',
  '00000000-0000-0000-1111-000000000001',
  'c0000000-0000-0000-0000-000000000003',
  'We are building a consumer segmentation model and this dataset looks ideal.',
  'approved', now() - interval '18 days'
),
(
  '00000000-0000-0000-2222-000000000002',
  '00000000-0000-0000-1111-000000000003',
  'c0000000-0000-0000-0000-000000000003',
  'Looking for EMEA B2B contact data for an outbound campaign in Q4.',
  'approved', now() - interval '14 days'
),
(
  '00000000-0000-0000-2222-000000000003',
  '00000000-0000-0000-1111-000000000003',
  'd0000000-0000-0000-0000-000000000004',
  'Interested in EMEA contacts for market research purposes.',
  'approved', now() - interval '12 days'
),
(
  '00000000-0000-0000-2222-000000000004',
  '00000000-0000-0000-1111-000000000004',
  'c0000000-0000-0000-0000-000000000003',
  'Need sentiment data to track brand perception for a fintech client.',
  'pending', now() - interval '2 days'
)
on conflict (listing_id, buyer_id) do nothing;

-- ═══ SECTION 7: Purchases ════════════════════════════════════════════════════

insert into public.purchases (id, listing_id, buyer_id, access_request_id, price_per_record, record_count, total_amount, currency, payment_status, paid_at, created_at) values
(
  '00000000-0000-0000-3333-000000000001',
  '00000000-0000-0000-1111-000000000001',
  'c0000000-0000-0000-0000-000000000003',
  '00000000-0000-0000-2222-000000000001',
  0.0120, 100000, 1200.00, 'USD', 'paid', now() - interval '17 days', now() - interval '17 days'
),
(
  '00000000-0000-0000-3333-000000000002',
  '00000000-0000-0000-1111-000000000003',
  'c0000000-0000-0000-0000-000000000003',
  '00000000-0000-0000-2222-000000000002',
  0.0350, 50000, 1750.00, 'USD', 'paid', now() - interval '13 days', now() - interval '13 days'
),
(
  '00000000-0000-0000-3333-000000000003',
  '00000000-0000-0000-1111-000000000001',
  'd0000000-0000-0000-0000-000000000004',
  null,
  0.0120, 250000, 3000.00, 'USD', 'paid', now() - interval '9 days', now() - interval '9 days'
)
on conflict (id) do nothing;

-- ═══ SECTION 8: Payout requests ══════════════════════════════════════════════

insert into public.payout_requests (id, seller_id, amount, currency, status, notes, admin_notes, created_at) values
(
  '00000000-0000-0000-4444-000000000001',
  'a0000000-0000-0000-0000-000000000001',
  4200.00, 'USD', 'pending',
  'Please process to my bank account on file.', null,
  now() - interval '3 days'
),
(
  '00000000-0000-0000-4444-000000000002',
  'b0000000-0000-0000-0000-000000000002',
  1750.00, 'USD', 'approved',
  null, 'Approved — payment scheduled for Friday.',
  now() - interval '6 days'
),
(
  '00000000-0000-0000-4444-000000000003',
  'a0000000-0000-0000-0000-000000000001',
  980.00, 'USD', 'paid',
  null, 'Payment processed via BACS.',
  now() - interval '45 days'
)
on conflict (id) do nothing;

-- ═══ SECTION 9: Consent records ══════════════════════════════════════════════

insert into public.consent_records (user_id, purpose, consented, session_id, user_agent, created_at) values
('a0000000-0000-0000-0000-000000000001', 'analytics',        true,  'sess-alice-1',   'Mozilla/5.0', now() - interval '30 days'),
('a0000000-0000-0000-0000-000000000001', 'marketing',        true,  'sess-alice-1',   'Mozilla/5.0', now() - interval '30 days'),
('a0000000-0000-0000-0000-000000000001', 'data_processing',  true,  'sess-alice-1',   'Mozilla/5.0', now() - interval '30 days'),
('a0000000-0000-0000-0000-000000000001', 'terms_of_service', true,  'sess-alice-1',   'Mozilla/5.0', now() - interval '30 days'),
('b0000000-0000-0000-0000-000000000002', 'analytics',        false, 'sess-bob-1',     'Mozilla/5.0', now() - interval '25 days'),
('b0000000-0000-0000-0000-000000000002', 'marketing',        false, 'sess-bob-1',     'Mozilla/5.0', now() - interval '25 days'),
('b0000000-0000-0000-0000-000000000002', 'data_processing',  true,  'sess-bob-1',     'Mozilla/5.0', now() - interval '25 days'),
('b0000000-0000-0000-0000-000000000002', 'terms_of_service', true,  'sess-bob-1',     'Mozilla/5.0', now() - interval '25 days'),
('c0000000-0000-0000-0000-000000000003', 'analytics',        true,  'sess-charlie-1', 'Mozilla/5.0', now() - interval '20 days'),
('c0000000-0000-0000-0000-000000000003', 'marketing',        false, 'sess-charlie-1', 'Mozilla/5.0', now() - interval '20 days'),
('c0000000-0000-0000-0000-000000000003', 'data_processing',  true,  'sess-charlie-1', 'Mozilla/5.0', now() - interval '20 days'),
('c0000000-0000-0000-0000-000000000003', 'terms_of_service', true,  'sess-charlie-1', 'Mozilla/5.0', now() - interval '20 days'),
('d0000000-0000-0000-0000-000000000004', 'analytics',        true,  'sess-diana-1',   'Mozilla/5.0', now() - interval '15 days'),
('d0000000-0000-0000-0000-000000000004', 'marketing',        true,  'sess-diana-1',   'Mozilla/5.0', now() - interval '15 days'),
('d0000000-0000-0000-0000-000000000004', 'data_processing',  true,  'sess-diana-1',   'Mozilla/5.0', now() - interval '15 days'),
('d0000000-0000-0000-0000-000000000004', 'terms_of_service', true,  'sess-diana-1',   'Mozilla/5.0', now() - interval '15 days');

-- ═══ SECTION 10: GDPR requests ═══════════════════════════════════════════════

insert into public.data_subject_requests (id, user_id, email, request_type, status, notes, created_at) values
(
  '00000000-0000-0000-6666-000000000001',
  'c0000000-0000-0000-0000-000000000003',
  'charlie@demo.wesourcedata.com',
  'export', 'completed',
  'User requested full data export. Delivered via secure link.',
  now() - interval '12 days'
),
(
  '00000000-0000-0000-6666-000000000002',
  'd0000000-0000-0000-0000-000000000004',
  'diana@demo.wesourcedata.com',
  'erasure', 'pending', null,
  now() - interval '1 day'
)
on conflict (id) do nothing;

-- ═══ SECTION 11: Notifications ═══════════════════════════════════════════════

insert into public.notifications (user_id, type, title, body, action_url, metadata, created_at) values
(
  'a0000000-0000-0000-0000-000000000001', 'purchase_completed', 'New purchase',
  'Charlie Park purchased "UK Consumer Demographics 2024" — $1,200.00',
  '/dashboard/listings', '{"purchase_id":"00000000-0000-0000-3333-000000000001"}'::jsonb,
  now() - interval '17 days'
),
(
  'a0000000-0000-0000-0000-000000000001', 'purchase_completed', 'New purchase',
  'Diana Walsh purchased "UK Consumer Demographics 2024" — $3,000.00',
  '/dashboard/listings', '{"purchase_id":"00000000-0000-0000-3333-000000000003"}'::jsonb,
  now() - interval '9 days'
),
(
  'b0000000-0000-0000-0000-000000000002', 'purchase_completed', 'New purchase',
  'Charlie Park purchased "B2B Contact Database EMEA 2024" — $1,750.00',
  '/dashboard/listings', '{"purchase_id":"00000000-0000-0000-3333-000000000002"}'::jsonb,
  now() - interval '13 days'
),
(
  'b0000000-0000-0000-0000-000000000002', 'payout_approved', 'Payout approved',
  'Your payout request of $1,750.00 has been approved and will be processed Friday.',
  '/dashboard/payouts', '{}'::jsonb,
  now() - interval '5 days'
),
(
  'c0000000-0000-0000-0000-000000000003', 'access_approved', 'Access approved',
  'Your request for "UK Consumer Demographics 2024" has been approved.',
  '/dashboard/purchases', '{"listing_id":"00000000-0000-0000-1111-000000000001"}'::jsonb,
  now() - interval '17 days'
),
(
  'c0000000-0000-0000-0000-000000000003', 'access_approved', 'Access approved',
  'Your request for "B2B Contact Database EMEA 2024" has been approved.',
  '/dashboard/purchases', '{"listing_id":"00000000-0000-0000-1111-000000000003"}'::jsonb,
  now() - interval '13 days'
);

-- ═══ SECTION 12: Outbound emails ═════════════════════════════════════════════

insert into public.outbound_emails (to_address, subject, body_text, status, sent_at, created_at) values
(
  'charlie@demo.wesourcedata.com',
  'Your access to UK Consumer Demographics 2024 has been approved',
  'Hi Charlie, your access request has been approved. Log in to download your dataset.',
  'sent', now() - interval '17 days', now() - interval '17 days'
),
(
  'alice@demo.wesourcedata.com',
  'New purchase: UK Consumer Demographics 2024',
  'Hi Alice, Charlie Park purchased your dataset for $1,200.00.',
  'sent', now() - interval '17 days', now() - interval '17 days'
),
(
  'bob@demo.wesourcedata.com',
  'Payout approved — $1,750.00',
  'Hi Bob, your payout request has been approved and will be processed by Friday.',
  'sent', now() - interval '5 days', now() - interval '5 days'
),
(
  'emma.jones@fintech.io',
  'You have been invited to join WeSourceData',
  'Hi Emma, you have been invited to join WeSourceData. Click the link to create your account.',
  'pending', null, now() - interval '10 days'
);

-- ═══ SECTION 13: Captured errors ═════════════════════════════════════════════

insert into public.captured_errors (message, context, created_at) values
(
  'Failed to generate download URL: storage bucket policy denied request',
  '{"scope":"dataset-download-url","listing_id":"00000000-0000-0000-1111-000000000002","user_id":"c0000000-0000-0000-0000-000000000003"}'::jsonb,
  now() - interval '11 days'
),
(
  'parse-dataset: file size exceeded 50MB limit',
  '{"scope":"parse-dataset","file_size_mb":67.3,"file_name":"large-dataset-v2.csv"}'::jsonb,
  now() - interval '4 days'
);

-- ═══ SECTION 14: Audit log ═══════════════════════════════════════════════════

insert into public.audit_log (actor_id, actor_type, entity_type, entity_id, action, payload, created_at) values
(
  'a0000000-0000-0000-0000-000000000001', 'user', 'listing',
  '00000000-0000-0000-1111-000000000001', 'listing_published',
  '{"title":"UK Consumer Demographics 2024","status":"published"}'::jsonb,
  now() - interval '22 days'
),
(
  'b0000000-0000-0000-0000-000000000002', 'user', 'listing',
  '00000000-0000-0000-1111-000000000003', 'listing_published',
  '{"title":"B2B Contact Database EMEA 2024","status":"published"}'::jsonb,
  now() - interval '18 days'
),
(
  null, 'system', 'access_request',
  '00000000-0000-0000-2222-000000000001', 'access_approved',
  '{"listing_id":"00000000-0000-0000-1111-000000000001","buyer_id":"c0000000-0000-0000-0000-000000000003"}'::jsonb,
  now() - interval '17 days'
),
(
  'c0000000-0000-0000-0000-000000000003', 'user', 'purchase',
  '00000000-0000-0000-3333-000000000001', 'purchase_completed',
  '{"amount":1200.00,"currency":"USD","listing_id":"00000000-0000-0000-1111-000000000001"}'::jsonb,
  now() - interval '17 days'
),
(
  'c0000000-0000-0000-0000-000000000003', 'user', 'purchase',
  '00000000-0000-0000-3333-000000000002', 'purchase_completed',
  '{"amount":1750.00,"currency":"USD","listing_id":"00000000-0000-0000-1111-000000000003"}'::jsonb,
  now() - interval '13 days'
),
(
  null, 'system', 'payout_request',
  '00000000-0000-0000-4444-000000000002', 'payout_approved',
  '{"seller_id":"b0000000-0000-0000-0000-000000000002","amount":1750.00}'::jsonb,
  now() - interval '5 days'
);
