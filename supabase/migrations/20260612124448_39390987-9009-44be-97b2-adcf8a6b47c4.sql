DROP POLICY IF EXISTS dpl_select ON public.delegation_points_ledger;
CREATE POLICY dpl_select ON public.delegation_points_ledger
FOR SELECT TO authenticated
USING (auth.uid() = user_id OR private.has_role(auth.uid(), 'admin'::app_role));