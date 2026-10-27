GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.can_view_marketizers_finance(uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.can_edit_marketizers_finance(uuid) TO authenticated, anon;