ALTER POLICY "dlr_read" ON public.daily_lead_reports TO authenticated;
ALTER POLICY "dlrmb_read" ON public.daily_lead_report_media_buyers TO authenticated;
ALTER POLICY "dlraa_read" ON public.daily_lead_report_ad_accounts TO authenticated;
ALTER POLICY "view roas quick save" ON public.marketizers_roas_quick_save_options TO authenticated;