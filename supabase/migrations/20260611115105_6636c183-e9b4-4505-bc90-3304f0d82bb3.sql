
-- Fix WITH CHECK ownership on media buyers update
DROP POLICY IF EXISTS dlrmb_update ON public.daily_lead_report_media_buyers;
CREATE POLICY dlrmb_update ON public.daily_lead_report_media_buyers
FOR UPDATE TO authenticated
USING (
  private.is_active(auth.uid()) AND EXISTS (
    SELECT 1 FROM public.daily_lead_reports r
    WHERE r.id = daily_lead_report_media_buyers.report_id AND r.created_by = auth.uid()
  )
)
WITH CHECK (
  private.is_active(auth.uid()) AND EXISTS (
    SELECT 1 FROM public.daily_lead_reports r
    WHERE r.id = daily_lead_report_media_buyers.report_id AND r.created_by = auth.uid()
  )
);

-- Fix WITH CHECK ownership on ad accounts update
DROP POLICY IF EXISTS dlraa_update ON public.daily_lead_report_ad_accounts;
CREATE POLICY dlraa_update ON public.daily_lead_report_ad_accounts
FOR UPDATE TO authenticated
USING (
  private.is_active(auth.uid()) AND EXISTS (
    SELECT 1 FROM public.daily_lead_report_media_buyers mb
    JOIN public.daily_lead_reports r ON r.id = mb.report_id
    WHERE mb.id = daily_lead_report_ad_accounts.report_media_buyer_id AND r.created_by = auth.uid()
  )
)
WITH CHECK (
  private.is_active(auth.uid()) AND EXISTS (
    SELECT 1 FROM public.daily_lead_report_media_buyers mb
    JOIN public.daily_lead_reports r ON r.id = mb.report_id
    WHERE mb.id = daily_lead_report_ad_accounts.report_media_buyer_id AND r.created_by = auth.uid()
  )
);

-- Restrict gwv_company_positions read policy to authenticated role only
DROP POLICY IF EXISTS pos_read ON public.gwv_company_positions;
CREATE POLICY pos_read ON public.gwv_company_positions
FOR SELECT TO authenticated
USING (
  ((is_deleted = false) AND private.is_active(auth.uid()))
  OR private.has_role(auth.uid(), 'admin'::app_role)
);
