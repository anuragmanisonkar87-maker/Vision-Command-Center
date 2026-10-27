DO $$
DECLARE
  v_brand uuid;
  v_parent uuid;
BEGIN
  SELECT brand_id, id INTO v_brand, v_parent
  FROM public.gwv_modules WHERE module_key='marketizers_media_buyer_performance';

  INSERT INTO public.gwv_modules
    (brand_id, parent_module_id, module_name, module_key, route_path, sensitivity, default_access_level, module_status, is_assignable, show_in_sidebar, show_in_module_hub, sort_order)
  VALUES
    (v_brand, v_parent, 'Daily Reporting', 'marketizers_media_buyer_daily_reporting',
      '/brands/marketizers/team-performance/media-buyer-performance/daily-reporting',
      'performance', 'view', 'active', true, false, true, 10),
    (v_brand, v_parent, 'Seminar / Webinar ROAS Tracker', 'marketizers_media_buyer_seminar_roas',
      '/brands/marketizers/team-performance/media-buyer-performance/seminar-roas',
      'finance_performance', 'view', 'active', true, false, true, 20),
    (v_brand, v_parent, 'Reports & History', 'marketizers_media_buyer_reports_history',
      '/brands/marketizers/team-performance/media-buyer-performance/reports-history',
      'finance_performance', 'view', 'active', true, false, true, 30),
    (v_brand, v_parent, 'Settings / Master Data', 'marketizers_media_buyer_settings_master_data',
      '/brands/marketizers/team-performance/media-buyer-performance/settings',
      'admin_performance', 'manage', 'active', true, false, true, 40)
  ON CONFLICT (module_key) DO UPDATE SET
    parent_module_id = EXCLUDED.parent_module_id,
    route_path = EXCLUDED.route_path,
    module_name = EXCLUDED.module_name,
    sensitivity = EXCLUDED.sensitivity,
    is_assignable = EXCLUDED.is_assignable,
    show_in_module_hub = EXCLUDED.show_in_module_hub,
    sort_order = EXCLUDED.sort_order,
    updated_at = now();
END $$;