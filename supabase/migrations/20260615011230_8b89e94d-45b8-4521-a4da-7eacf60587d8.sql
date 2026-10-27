ALTER TABLE public.gwv_attendance_settings
  ADD COLUMN IF NOT EXISTS missed_cutoff_time time without time zone NOT NULL DEFAULT '12:00:00';

ALTER TABLE public.gwv_attendance_records
  ADD COLUMN IF NOT EXISTS is_late boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS late_minutes integer NOT NULL DEFAULT 0;