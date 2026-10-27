revoke execute on function public.has_role(uuid, public.app_role) from authenticated;
revoke execute on function public.can_view_marketizers_finance(uuid) from authenticated;
revoke execute on function public.can_edit_marketizers_finance(uuid) from authenticated;