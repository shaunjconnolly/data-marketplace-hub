-- Admins can view all waitlist entries
create policy "Admins can view all waitlist entries"
  on public.waitlist for select
  to authenticated
  using (has_role(auth.uid(), 'admin'));

-- Admins can update waitlist entries (mark invited / converted)
create policy "Admins can update waitlist entries"
  on public.waitlist for update
  to authenticated
  using (has_role(auth.uid(), 'admin'))
  with check (has_role(auth.uid(), 'admin'));

-- Admins can update any listing (e.g. archive)
create policy "Admins can update any listing"
  on public.listings for update
  to authenticated
  using (has_role(auth.uid(), 'admin'))
  with check (has_role(auth.uid(), 'admin'));