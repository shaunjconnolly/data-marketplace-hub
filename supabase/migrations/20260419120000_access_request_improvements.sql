-- Allow admins to approve/decline any access request
drop policy if exists "Admins can update any access request" on public.access_requests;
create policy "Admins can update any access request"
  on public.access_requests for update to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

-- Notify seller when a new access request is created
create or replace function public.notify_seller_on_access_request()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if exists (select 1 from public.listings where id = NEW.listing_id) then
    perform public.create_notification(
      (select seller_id from public.listings where id = NEW.listing_id),
      'access_request',
      'New access request',
      'A buyer requested access to "' || coalesce(
        (select title from public.listings where id = NEW.listing_id),
        'your dataset'
      ) || '".',
      '/dashboard/requests',
      jsonb_build_object('listing_id', NEW.listing_id, 'request_id', NEW.id)
    );
  end if;
  return NEW;
end;
$$;

drop trigger if exists notify_seller_on_access_request_trg on public.access_requests;
create trigger notify_seller_on_access_request_trg
  after insert on public.access_requests
  for each row execute function public.notify_seller_on_access_request();
