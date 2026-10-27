CREATE INDEX IF NOT EXISTS idx_mz_entries_month ON public.marketizers_monthly_entries(month);
CREATE INDEX IF NOT EXISTS idx_mz_entries_client_month ON public.marketizers_monthly_entries(client_id, month);
CREATE INDEX IF NOT EXISTS idx_mz_clients_is_deleted ON public.marketizers_clients(is_deleted);