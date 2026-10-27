CREATE OR REPLACE FUNCTION public.dt_assignee_is_self(_assignee_id uuid, _assignee_team_member_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    (_assignee_id IS NOT NULL AND _assignee_id = auth.uid())
    OR (
      _assignee_team_member_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.gwv_team_members tm
        WHERE tm.id = _assignee_team_member_id
          AND tm.linked_user_id = auth.uid()
      )
    )
$function$;