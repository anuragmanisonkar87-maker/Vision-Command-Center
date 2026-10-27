-- Lock down SECURITY DEFINER helpers: revoke broad EXECUTE, grant only where needed.
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.dt_assignee_is_self(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.ve_owns_team_member(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dt_assignee_is_self(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ve_owns_team_member(uuid) TO authenticated;
