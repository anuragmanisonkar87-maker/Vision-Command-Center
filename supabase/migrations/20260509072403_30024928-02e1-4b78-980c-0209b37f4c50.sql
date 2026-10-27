create schema if not exists private;

revoke all on schema private from public;
grant usage on schema private to authenticated;
grant usage on schema private to service_role;

create or replace function private.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles
    where user_id = _user_id
      and role = _role
  )
$$;

revoke all on function private.has_role(uuid, public.app_role) from public;
grant execute on function private.has_role(uuid, public.app_role) to authenticated;
grant execute on function private.has_role(uuid, public.app_role) to service_role;

alter policy "Admins view all profiles"
on public.profiles
using (private.has_role(auth.uid(), 'admin'));

alter policy "Admins view all roles"
on public.user_roles
using (private.has_role(auth.uid(), 'admin'));

alter policy "Admins manage roles"
on public.user_roles
using (private.has_role(auth.uid(), 'admin'))
with check (private.has_role(auth.uid(), 'admin'));

alter policy "Admins can delete clients"
on public.marketizers_clients
using (private.has_role(auth.uid(), 'admin'));

alter policy "Admins can delete entries"
on public.marketizers_monthly_entries
using (private.has_role(auth.uid(), 'admin'));

alter policy "Admins can delete followups"
on public.marketizers_collection_followups
using (private.has_role(auth.uid(), 'admin'));

alter policy "Admins can delete targets"
on public.marketizers_targets
using (private.has_role(auth.uid(), 'admin'));

revoke execute on function public.has_role(uuid, public.app_role) from public;
revoke execute on function public.has_role(uuid, public.app_role) from anon;
revoke execute on function public.has_role(uuid, public.app_role) from authenticated;