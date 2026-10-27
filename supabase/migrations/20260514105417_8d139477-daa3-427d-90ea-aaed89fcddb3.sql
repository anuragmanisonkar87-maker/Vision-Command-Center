
-- Link daily lead reports to a Marketizers client and link each media-buyer
-- entry to a team-directory member. Both are optional for backwards compat
-- with existing reports.

ALTER TABLE public.daily_lead_reports
  ADD COLUMN IF NOT EXISTS client_id uuid NULL REFERENCES public.marketizers_clients(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_dlr_client_id ON public.daily_lead_reports(client_id);

ALTER TABLE public.daily_lead_report_media_buyers
  ADD COLUMN IF NOT EXISTS team_member_id uuid NULL REFERENCES public.gwv_team_members(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_dlrmb_team_member_id ON public.daily_lead_report_media_buyers(team_member_id);
