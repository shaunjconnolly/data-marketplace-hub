-- ============================================================
-- Uber4Data — sample dataset listings
-- Run in Supabase SQL Editor after seed.sql
-- ============================================================

-- Create two demo seller accounts
insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_super_admin
) values
(
  'aaaaaaaa-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated',
  'dataco@demo.uber4data.com',
  crypt('demo123456', gen_salt('bf')),
  now(), now(), now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"display_name":"DataCo Ireland"}'::jsonb,
  false
),
(
  'aaaaaaaa-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated',
  'belvault@demo.uber4data.com',
  crypt('demo123456', gen_salt('bf')),
  now(), now(), now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"display_name":"BelVault BV"}'::jsonb,
  false
)
on conflict (id) do nothing;

-- Profiles (trigger may have already created these, upsert is safe)
insert into public.profiles (id, display_name, company, primary_role, onboarding_completed)
values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'DataCo Ireland', 'DataCo Ltd', 'seller', true),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'BelVault BV', 'BelVault BV', 'seller', true)
on conflict (id) do update set
  display_name = excluded.display_name,
  company = excluded.company,
  primary_role = excluded.primary_role,
  onboarding_completed = excluded.onboarding_completed;

-- Sample listings
insert into public.listings (
  id, seller_id, title, description, category,
  price_per_record, total_records, currency, status, published_at,
  sample_preview
) values

(
  gen_random_uuid(),
  'aaaaaaaa-0000-0000-0000-000000000001',
  'Irish SME Contact Database 2024',
  'Verified contacts for 42,000 Irish small and medium enterprises. Includes company name, sector, county, employee band, turnover band, and primary contact email. Sourced from Companies Registration Office filings and verified against live web presence. GDPR-compliant with lawful basis documentation included.',
  'Business',
  0.0180,
  42000,
  'EUR',
  'published',
  now(),
  '[
    {"company":"Brennan & Sons Ltd","sector":"Construction","county":"Galway","employees":"10-49","contact":"info@brennanandsons.ie"},
    {"company":"Murphy Tech Solutions","sector":"IT Services","county":"Dublin","employees":"1-9","contact":"hello@murphytech.ie"},
    {"company":"Atlantic Foods Ltd","sector":"Food & Beverage","county":"Cork","employees":"50-249","contact":"sales@atlanticfoods.ie"}
  ]'::jsonb
),

(
  gen_random_uuid(),
  'aaaaaaaa-0000-0000-0000-000000000001',
  'Dublin Residential Property Transactions Q1–Q3 2024',
  'Every residential property transaction recorded in Dublin City and County from January to September 2024. Fields: address (anonymised to street level), sale price, property type, floor area band, BER rating, and sale date. Derived from the Property Price Register with enrichment from GeoDirectory.',
  'Real Estate',
  0.0045,
  18750,
  'EUR',
  'published',
  now(),
  '[
    {"street":"Griffith Avenue","sale_price":485000,"type":"Semi-detached","ber":"B2","date":"2024-02-14"},
    {"street":"Clontarf Road","sale_price":720000,"type":"Detached","ber":"A3","date":"2024-03-01"},
    {"street":"Rathmines Road Upper","sale_price":395000,"type":"Apartment","ber":"C1","date":"2024-01-22"}
  ]'::jsonb
),

(
  gen_random_uuid(),
  'aaaaaaaa-0000-0000-0000-000000000001',
  'European VC & PE Investment Records 2019–2024',
  'Structured deal-level data covering 28,000 venture capital and private equity investments across the EU27 and UK. Fields include round type, amount raised (EUR), investor names, target sector, target country, and close date. Aggregated from public disclosures and regulatory filings.',
  'Finance',
  0.0350,
  28000,
  'EUR',
  'published',
  now(),
  '[
    {"company":"NovaMed GmbH","round":"Series A","amount_eur":4200000,"sector":"HealthTech","country":"Germany","date":"2023-06-10"},
    {"company":"FleetOS","round":"Seed","amount_eur":850000,"sector":"Logistics","country":"Ireland","date":"2022-11-03"},
    {"company":"CreditPilot SA","round":"Series B","amount_eur":18000000,"sector":"FinTech","country":"Belgium","date":"2024-01-18"}
  ]'::jsonb
),

(
  gen_random_uuid(),
  'aaaaaaaa-0000-0000-0000-000000000002',
  'Belgian E-commerce Shopper Behavioural Signals',
  'Anonymised behavioural signals from 95,000 Belgian online shoppers. Includes age band, gender, preferred category, average order value band, purchase frequency, device type, and preferred payment method. All records fully anonymised and k-anonymity verified (k≥5). Ideal for propensity modelling and lookalike audience creation.',
  'E-commerce',
  0.0120,
  95000,
  'EUR',
  'published',
  now(),
  '[
    {"age_band":"25-34","gender":"F","category":"Fashion","aov_band":"50-100","frequency":"monthly","device":"mobile","payment":"card"},
    {"age_band":"45-54","gender":"M","category":"Electronics","aov_band":"200-500","frequency":"quarterly","device":"desktop","payment":"paypal"},
    {"age_band":"18-24","gender":"F","category":"Beauty","aov_band":"20-50","frequency":"weekly","device":"mobile","payment":"card"}
  ]'::jsonb
),

(
  gen_random_uuid(),
  'aaaaaaaa-0000-0000-0000-000000000002',
  'EU Pharmacy & Dispensary Location Dataset',
  'Geolocation and profile data for 61,200 licensed pharmacies and dispensaries across 22 EU member states. Includes pharmacy name, address, coordinates (lat/lon), opening hours band, dispensing categories, and whether the pharmacy offers online ordering. Updated quarterly from national regulatory registers.',
  'Healthcare',
  0.0080,
  61200,
  'EUR',
  'published',
  now(),
  '[
    {"name":"Pharmacie Centrale","country":"Belgium","city":"Brussels","lat":50.8503,"lon":4.3517,"online":true},
    {"name":"Apotheek De Linde","country":"Netherlands","city":"Amsterdam","lat":52.3702,"lon":4.8952,"online":false},
    {"name":"Farmacia Verde","country":"Spain","city":"Barcelona","lat":41.3851,"lon":2.1734,"online":true}
  ]'::jsonb
),

(
  gen_random_uuid(),
  'aaaaaaaa-0000-0000-0000-000000000002',
  'UK Graduate Employment Outcomes 2020–2023',
  'Anonymised employment outcome records for 130,000 UK university graduates tracked 6 and 18 months post-graduation. Fields: graduation year, subject area, degree classification, employment status at 6m, employment status at 18m, salary band at 18m, region, and employer sector. Sourced from Graduate Outcomes survey with ONS linkage.',
  'Employment',
  0.0060,
  130000,
  'GBP',
  'published',
  now(),
  '[
    {"grad_year":2022,"subject":"Computer Science","degree":"2:1","status_6m":"employed","status_18m":"employed","salary_band":"30-40k","region":"London","sector":"Technology"},
    {"grad_year":2021,"subject":"Nursing","degree":"Pass","status_6m":"employed","status_18m":"employed","salary_band":"25-30k","region":"North West","sector":"Healthcare"},
    {"grad_year":2023,"subject":"Economics","degree":"1st","status_6m":"further study","status_18m":"employed","salary_band":"40-50k","region":"South East","sector":"Finance"}
  ]'::jsonb
)

on conflict do nothing;
