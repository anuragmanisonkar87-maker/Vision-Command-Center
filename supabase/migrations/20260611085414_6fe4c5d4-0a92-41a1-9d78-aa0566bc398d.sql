-- Ensure the `private` schema and its helper functions are reachable by RLS
-- policies that run as the calling user. SECURITY DEFINER alone is not enough —
-- the caller still needs USAGE on the schema and EXECUTE on the function.

GRANT USAGE ON SCHEMA private TO authenticated, service_role;

GRANT EXECUTE ON FUNCTION private.is_active(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.can_view_marketizers_finance(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.can_edit_marketizers_finance(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.can_manage_team_access(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.current_team_member_id() TO authenticated, service_role;
