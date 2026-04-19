-- Create private bucket for dataset files
insert into storage.buckets (id, name, public)
values ('dataset-files', 'dataset-files', false)
on conflict (id) do nothing;

-- RLS policies on storage.objects for the dataset-files bucket
-- Files are stored under {seller_id}/{filename}

-- Sellers can upload to their own folder
create policy "Sellers can upload their own dataset files"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'dataset-files'
  and auth.uid()::text = (storage.foldername(name))[1]
);

-- Sellers can read their own dataset files
create policy "Sellers can read their own dataset files"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'dataset-files'
  and auth.uid()::text = (storage.foldername(name))[1]
);

-- Sellers can update their own dataset files
create policy "Sellers can update their own dataset files"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'dataset-files'
  and auth.uid()::text = (storage.foldername(name))[1]
);

-- Sellers can delete their own dataset files
create policy "Sellers can delete their own dataset files"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'dataset-files'
  and auth.uid()::text = (storage.foldername(name))[1]
);

-- Admins can read all dataset files
create policy "Admins can read all dataset files"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'dataset-files'
  and public.has_role(auth.uid(), 'admin')
);

-- Add columns to listings to track the uploaded dataset file
alter table public.listings
  add column if not exists file_path text,
  add column if not exists file_size_bytes bigint,
  add column if not exists file_mime text,
  add column if not exists file_original_name text;