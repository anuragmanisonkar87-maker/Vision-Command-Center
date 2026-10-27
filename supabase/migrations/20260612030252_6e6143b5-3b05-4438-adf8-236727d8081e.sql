ALTER TABLE public.delegation_points_ledger
  DROP CONSTRAINT IF EXISTS delegation_points_ledger_task_id_reason_key;

CREATE UNIQUE INDEX IF NOT EXISTS delegation_points_ledger_completion_base_uniq
  ON public.delegation_points_ledger (task_id)
  WHERE reason = 'completion_base';