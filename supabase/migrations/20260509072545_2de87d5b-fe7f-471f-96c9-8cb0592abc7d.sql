create or replace function private.can_view_marketizers_finance(_user_id uuid)
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
      and role in ('admin','finance_manager','brand_manager')
  )
$$;

create or replace function private.can_edit_marketizers_finance(_user_id uuid)
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
      and role in ('admin','finance_manager')
  )
$$;

revoke all on function private.can_view_marketizers_finance(uuid) from public;
revoke all on function private.can_edit_marketizers_finance(uuid) from public;
grant execute on function private.can_view_marketizers_finance(uuid) to authenticated;
grant execute on function private.can_edit_marketizers_finance(uuid) to authenticated;
grant execute on function private.can_view_marketizers_finance(uuid) to service_role;
grant execute on function private.can_edit_marketizers_finance(uuid) to service_role;

alter policy "Finance viewers can read clients"
on public.marketizers_clients
using (private.can_view_marketizers_finance(auth.uid()));

alter policy "Finance editors can insert clients"
on public.marketizers_clients
with check (private.can_edit_marketizers_finance(auth.uid()));

alter policy "Finance editors can update clients"
on public.marketizers_clients
using (private.can_edit_marketizers_finance(auth.uid()))
with check (private.can_edit_marketizers_finance(auth.uid()));

alter policy "Finance viewers can read entries"
on public.marketizers_monthly_entries
using (private.can_view_marketizers_finance(auth.uid()));

alter policy "Finance editors can insert entries"
on public.marketizers_monthly_entries
with check (private.can_edit_marketizers_finance(auth.uid()));

alter policy "Finance editors can update entries"
on public.marketizers_monthly_entries
using (private.can_edit_marketizers_finance(auth.uid()))
with check (private.can_edit_marketizers_finance(auth.uid()));

alter policy "Finance viewers can read followups"
on public.marketizers_collection_followups
using (private.can_view_marketizers_finance(auth.uid()));

alter policy "Finance editors can insert followups"
on public.marketizers_collection_followups
with check (private.can_edit_marketizers_finance(auth.uid()));

alter policy "Finance editors can update followups"
on public.marketizers_collection_followups
using (private.can_edit_marketizers_finance(auth.uid()))
with check (private.can_edit_marketizers_finance(auth.uid()));

alter policy "Finance viewers can read targets"
on public.marketizers_targets
using (private.can_view_marketizers_finance(auth.uid()));

alter policy "Finance editors can insert targets"
on public.marketizers_targets
with check (private.can_edit_marketizers_finance(auth.uid()));

alter policy "Finance editors can update targets"
on public.marketizers_targets
using (private.can_edit_marketizers_finance(auth.uid()))
with check (private.can_edit_marketizers_finance(auth.uid()));

revoke execute on function public.can_view_marketizers_finance(uuid) from public;
revoke execute on function public.can_view_marketizers_finance(uuid) from anon;
revoke execute on function public.can_view_marketizers_finance(uuid) from authenticated;
revoke execute on function public.can_edit_marketizers_finance(uuid) from public;
revoke execute on function public.can_edit_marketizers_finance(uuid) from anon;
revoke execute on function public.can_edit_marketizers_finance(uuid) from authenticated;