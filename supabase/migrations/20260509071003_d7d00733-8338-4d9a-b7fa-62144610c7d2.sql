grant execute on function public.has_role(uuid, public.app_role) to authenticated;
grant execute on function public.can_view_marketizers_finance(uuid) to authenticated;
grant execute on function public.can_edit_marketizers_finance(uuid) to authenticated;