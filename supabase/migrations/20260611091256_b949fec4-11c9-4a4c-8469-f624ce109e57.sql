
DROP POLICY IF EXISTS dlr_read ON public.daily_lead_reports;
CREATE POLICY dlr_read ON public.daily_lead_reports
FOR SELECT
USING (
  private.is_active(auth.uid())
  AND (
    created_by = auth.uid()
    OR private.has_role(auth.uid(), 'admin'::app_role)
    OR private.can_view_marketizers_finance(auth.uid())
  )
);

DROP POLICY IF EXISTS dlrmb_read ON public.daily_lead_report_media_buyers;
CREATE POLICY dlrmb_read ON public.daily_lead_report_media_buyers
FOR SELECT
USING (
  private.is_active(auth.uid())
  AND (
    private.has_role(auth.uid(), 'admin'::app_role)
    OR private.can_view_marketizers_finance(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.daily_lead_reports r
      WHERE r.id = daily_lead_report_media_buyers.report_id
        AND r.created_by = auth.uid()
    )
  )
);

DROP POLICY IF EXISTS dlraa_read ON public.daily_lead_report_ad_accounts;
CREATE POLICY dlraa_read ON public.daily_lead_report_ad_accounts
FOR SELECT
USING (
  private.is_active(auth.uid())
  AND (
    private.has_role(auth.uid(), 'admin'::app_role)
    OR private.can_view_marketizers_finance(auth.uid())
    OR EXISTS (
      SELECT 1
      FROM public.daily_lead_report_media_buyers mb
      JOIN public.daily_lead_reports r ON r.id = mb.report_id
      WHERE mb.id = daily_lead_report_ad_accounts.report_media_buyer_id
        AND r.created_by = auth.uid()
    )
  )
);
