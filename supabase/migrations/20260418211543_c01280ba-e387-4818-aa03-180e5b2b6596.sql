-- Helper to insert a notification, bypassing RLS via security definer.
create or replace function public.create_notification(
  _user_id uuid,
  _type text,
  _title text,
  _body text,
  _action_url text default null,
  _metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  _id uuid;
begin
  insert into public.notifications (user_id, type, title, body, action_url, metadata)
  values (_user_id, _type, _title, _body, _action_url, _metadata)
  returning id into _id;
  return _id;
end;
$$;

-- Trigger: notify buyer when request status changes
create or replace function public.notify_buyer_on_request_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  _listing_title text;
begin
  if NEW.status = OLD.status then
    return NEW;
  end if;

  select title into _listing_title from public.listings where id = NEW.listing_id;

  if NEW.status = 'approved' then
    perform public.create_notification(
      NEW.buyer_id,
      'access_approved',
      'Access approved',
      'Your request for "' || coalesce(_listing_title, 'a dataset') || '" was approved.',
      '/marketplace/' || NEW.listing_id::text,
      jsonb_build_object('listing_id', NEW.listing_id, 'request_id', NEW.id)
    );
  elsif NEW.status = 'declined' then
    perform public.create_notification(
      NEW.buyer_id,
      'access_declined',
      'Access declined',
      'Your request for "' || coalesce(_listing_title, 'a dataset') || '" was declined.',
      '/marketplace/' || NEW.listing_id::text,
      jsonb_build_object('listing_id', NEW.listing_id, 'request_id', NEW.id)
    );
  end if;

  return NEW;
end;
$$;

create trigger access_requests_notify_buyer
  after update on public.access_requests
  for each row
  execute function public.notify_buyer_on_request_status_change();