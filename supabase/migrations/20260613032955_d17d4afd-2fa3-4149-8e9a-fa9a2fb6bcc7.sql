DROP POLICY IF EXISTS dpl_insert ON public.delegation_points_ledger;

CREATE POLICY dpl_insert ON public.delegation_points_ledger
FOR INSERT TO authenticated
WITH CHECK (
  private.has_role(auth.uid(), 'admin'::app_role)
  OR (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.delegation_tasks t
      WHERE t.id = delegation_points_ledger.task_id
        AND (t.assignee_id = auth.uid() OR t.created_by = auth.uid())
    )
  )
);