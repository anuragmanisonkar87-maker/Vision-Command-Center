ALTER TABLE public.marketizers_clients
  ADD COLUMN IF NOT EXISTS revenue_tracking_sources text[];

UPDATE public.marketizers_clients
SET revenue_tracking_sources = ARRAY[revenue_tracking_source]
WHERE revenue_tracking_source IS NOT NULL
  AND revenue_tracking_source <> ''
  AND revenue_tracking_sources IS NULL;