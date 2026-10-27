ALTER TABLE public.delegation_tasks
  ADD COLUMN IF NOT EXISTS revision_1_date date,
  ADD COLUMN IF NOT EXISTS revision_2_date date,
  ADD COLUMN IF NOT EXISTS final_date date,
  ADD COLUMN IF NOT EXISTS follow_up_reminder timestamptz,
  ADD COLUMN IF NOT EXISTS custom_fields jsonb NOT NULL DEFAULT '{}'::jsonb;