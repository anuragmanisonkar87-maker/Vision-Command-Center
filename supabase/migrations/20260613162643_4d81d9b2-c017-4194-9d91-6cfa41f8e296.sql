
-- Phase 2C: separate ledger for recurring daily tasks.
-- Kept distinct from delegation_points_ledger (which is FK-tied to delegation_tasks).
CREATE TABLE public.recurring_daily_points_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.recurring_daily_tasks(id) ON DELETE CASCADE,
  completion_id uuid REFERENCES public.recurring_daily_completions(id) ON DELETE SET NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  team_member_id uuid,
  points integer NOT NULL,
  event_type text NOT NULL CHECK (event_type IN (
    'recurring_daily_completed',
    'recurring_daily_late_completed',
    'recurring_daily_missed'
  )),
  points_date date NOT NULL DEFAULT CURRENT_DATE,
  reason text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- one reward per completion
CREATE UNIQUE INDEX rdpl_completion_unique
  ON public.recurring_daily_points_ledger(completion_id)
  WHERE completion_id IS NOT NULL;

-- one missed penalty per template/user/day
CREATE UNIQUE INDEX rdpl_missed_unique
  ON public.recurring_daily_points_ledger(template_id, user_id, points_date)
  WHERE event_type = 'recurring_daily_missed';

CREATE INDEX rdpl_user_date_idx ON public.recurring_daily_points_ledger(user_id, points_date);
CREATE INDEX rdpl_template_date_idx ON public.recurring_daily_points_ledger(template_id, points_date);

GRANT SELECT, INSERT ON public.recurring_daily_points_ledger TO authenticated;
GRANT ALL ON public.recurring_daily_points_ledger TO service_role;

ALTER TABLE public.recurring_daily_points_ledger ENABLE ROW LEVEL SECURITY;

-- Employees see own; admins see all.
CREATE POLICY "rdpl_select"
  ON public.recurring_daily_points_ledger
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR private.has_role(auth.uid(), 'admin'::app_role));

-- Insert rules:
--   * admins may insert any entry (including missed penalties)
--   * employees may insert ONLY a completion/late-completion reward for themselves
--     and only when that completion row exists and is theirs.
CREATE POLICY "rdpl_insert"
  ON public.recurring_daily_points_ledger
  FOR INSERT
  TO authenticated
  WITH CHECK (
    private.has_role(auth.uid(), 'admin'::app_role)
    OR (
      user_id = auth.uid()
      AND event_type IN ('recurring_daily_completed', 'recurring_daily_late_completed')
      AND completion_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.recurring_daily_completions c
        WHERE c.id = completion_id
          AND c.completed_by_user_id = auth.uid()
      )
    )
  );
