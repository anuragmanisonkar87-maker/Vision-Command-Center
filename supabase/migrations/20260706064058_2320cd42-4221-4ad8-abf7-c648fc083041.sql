
-- Video Editor Daily KPI (IPC) — own-or-admin RLS.

CREATE OR REPLACE FUNCTION public.ve_owns_team_member(_team_member_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.gwv_team_members
    WHERE id = _team_member_id AND linked_user_id = auth.uid()
  );
$$;
GRANT EXECUTE ON FUNCTION public.ve_owns_team_member(uuid) TO authenticated;

CREATE TABLE public.video_editor_kpi_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  is_active boolean NOT NULL DEFAULT true,
  fields jsonb NOT NULL DEFAULT '[]'::jsonb,
  daily_commit_target integer NOT NULL DEFAULT 3,
  cn_label text NOT NULL DEFAULT 'On-time delivery of weekly reels queue',
  cn_target numeric NOT NULL DEFAULT 90,
  cn_super_green numeric NOT NULL DEFAULT 95,
  cn_green numeric NOT NULL DEFAULT 90,
  cn_red numeric NOT NULL DEFAULT 75,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.video_editor_kpi_config TO authenticated;
GRANT ALL ON public.video_editor_kpi_config TO service_role;
ALTER TABLE public.video_editor_kpi_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY vekc_admin ON public.video_editor_kpi_config FOR ALL TO authenticated
  USING (private.has_role(auth.uid(),'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(),'admin'::app_role));
CREATE POLICY vekc_read ON public.video_editor_kpi_config FOR SELECT TO authenticated
  USING (is_active = true);

CREATE TABLE public.video_editor_daily_kpi (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_member_id uuid NOT NULL REFERENCES public.gwv_team_members(id) ON DELETE CASCADE,
  report_date date NOT NULL,
  committed_pieces integer NOT NULL DEFAULT 0,
  shipped_finished integer NOT NULL DEFAULT 0,
  finish_gate_passed boolean NOT NULL DEFAULT false,
  max_revision_rounds integer NOT NULL DEFAULT 0,
  backed_up_eod boolean NOT NULL DEFAULT false,
  blockers text,
  extra jsonb NOT NULL DEFAULT '{}'::jsonb,
  good_day boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (team_member_id, report_date)
);
CREATE INDEX idx_vedk_tm_date ON public.video_editor_daily_kpi(team_member_id, report_date DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.video_editor_daily_kpi TO authenticated;
GRANT ALL ON public.video_editor_daily_kpi TO service_role;
ALTER TABLE public.video_editor_daily_kpi ENABLE ROW LEVEL SECURITY;

CREATE POLICY vedk_admin ON public.video_editor_daily_kpi FOR ALL TO authenticated
  USING (private.has_role(auth.uid(),'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(),'admin'::app_role));
CREATE POLICY vedk_select_own ON public.video_editor_daily_kpi FOR SELECT TO authenticated
  USING (public.ve_owns_team_member(team_member_id));
CREATE POLICY vedk_insert_own ON public.video_editor_daily_kpi FOR INSERT TO authenticated
  WITH CHECK (public.ve_owns_team_member(team_member_id) AND created_by = auth.uid());
CREATE POLICY vedk_update_own ON public.video_editor_daily_kpi FOR UPDATE TO authenticated
  USING (public.ve_owns_team_member(team_member_id))
  WITH CHECK (public.ve_owns_team_member(team_member_id));
CREATE POLICY vedk_delete_own ON public.video_editor_daily_kpi FOR DELETE TO authenticated
  USING (public.ve_owns_team_member(team_member_id));

CREATE TRIGGER trg_vekc_updated_at BEFORE UPDATE ON public.video_editor_kpi_config
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_vedk_updated_at BEFORE UPDATE ON public.video_editor_daily_kpi
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.video_editor_kpi_config (fields, daily_commit_target) VALUES (
  '[
    {"key":"committed_pieces","name":"Committed pieces","type":"number","required":true},
    {"key":"shipped_finished","name":"Shipped / finished","type":"number","required":true},
    {"key":"finish_gate_passed","name":"Finish gate passed?","type":"boolean","required":true},
    {"key":"max_revision_rounds","name":"Max revision rounds","type":"number"},
    {"key":"backed_up_eod","name":"Backed up at EOD?","type":"boolean","required":true},
    {"key":"blockers","name":"Blockers","type":"text"}
  ]'::jsonb,
  3
);
