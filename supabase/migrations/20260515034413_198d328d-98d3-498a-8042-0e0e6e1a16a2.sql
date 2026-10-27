
ALTER TABLE public.gwv_team_members
  ADD COLUMN IF NOT EXISTS employment_type text,
  ADD COLUMN IF NOT EXISTS work_mode text,
  ADD COLUMN IF NOT EXISTS salary_type text,
  ADD COLUMN IF NOT EXISTS payment_date text,
  ADD COLUMN IF NOT EXISTS reporting_manager text,
  ADD COLUMN IF NOT EXISTS access_preset text;
