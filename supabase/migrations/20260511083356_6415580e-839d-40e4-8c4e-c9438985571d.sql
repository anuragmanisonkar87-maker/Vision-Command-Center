
-- Move helpers behind tighter grants. RLS policies still call them
-- because SECURITY DEFINER bypasses the EXECUTE grant for definer-owned
-- function calls inside policy evaluation.
REVOKE EXECUTE ON FUNCTION public.is_active(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.purge_old_deleted_daily_reports() FROM PUBLIC, anon, authenticated;
-- Allow service_role only (cron / admin tooling) for the purge function.
GRANT EXECUTE ON FUNCTION public.purge_old_deleted_daily_reports() TO service_role;
