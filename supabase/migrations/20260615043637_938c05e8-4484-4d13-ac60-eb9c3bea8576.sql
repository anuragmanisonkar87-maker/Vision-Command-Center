CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Replace existing schedules if present (idempotent)
DO $$
BEGIN
  PERFORM cron.unschedule('qa-autopilot-daily');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  PERFORM cron.unschedule('qa-autopilot-weekly');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'qa-autopilot-daily',
  '0 8 * * *',
  $cmd$
  SELECT net.http_post(
    url := 'https://gwvvisioncenter.lovable.app/api/public/hooks/qa-autopilot',
    headers := '{"Content-Type": "application/json", "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ4c3h5YnpueG5zcW9jeWZxZXJvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgyNzM2NzAsImV4cCI6MjA5Mzg0OTY3MH0.H9OL0kpVafNh68qwL-wt27mxcJrp90Xeau0pj5a2XaA"}'::jsonb,
    body := '{"weekly": false}'::jsonb
  );
  $cmd$
);

SELECT cron.schedule(
  'qa-autopilot-weekly',
  '0 9 * * 0',
  $cmd$
  SELECT net.http_post(
    url := 'https://gwvvisioncenter.lovable.app/api/public/hooks/qa-autopilot',
    headers := '{"Content-Type": "application/json", "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ4c3h5YnpueG5zcW9jeWZxZXJvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgyNzM2NzAsImV4cCI6MjA5Mzg0OTY3MH0.H9OL0kpVafNh68qwL-wt27mxcJrp90Xeau0pj5a2XaA"}'::jsonb,
    body := '{"weekly": true}'::jsonb
  );
  $cmd$
);