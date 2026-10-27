CREATE TABLE IF NOT EXISTS public.delegation_due_date_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.delegation_tasks(id) ON DELETE CASCADE,
  requested_by uuid NOT NULL,
  current_due_date date,
  requested_due_date date NOT NULL,
  delay_reason text,
  note text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  decided_by uuid,
  decided_at timestamptz,
  decision_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.delegation_due_date_requests TO authenticated;
GRANT ALL ON public.delegation_due_date_requests TO service_role;

ALTER TABLE public.delegation_due_date_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY ddr_select ON public.delegation_due_date_requests
FOR SELECT TO authenticated
USING (
  requested_by = auth.uid()
  OR private.has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.delegation_tasks t
    WHERE t.id = delegation_due_date_requests.task_id
      AND (t.assignee_id = auth.uid() OR t.created_by = auth.uid())
  )
);

CREATE POLICY ddr_insert ON public.delegation_due_date_requests
FOR INSERT TO authenticated
WITH CHECK (
  requested_by = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.delegation_tasks t
    WHERE t.id = delegation_due_date_requests.task_id
      AND t.assignee_id = auth.uid()
  )
);

CREATE POLICY ddr_update ON public.delegation_due_date_requests
FOR UPDATE TO authenticated
USING (private.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_ddr_updated_at
BEFORE UPDATE ON public.delegation_due_date_requests
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_ddr_task ON public.delegation_due_date_requests(task_id);
CREATE INDEX IF NOT EXISTS idx_ddr_status ON public.delegation_due_date_requests(status);