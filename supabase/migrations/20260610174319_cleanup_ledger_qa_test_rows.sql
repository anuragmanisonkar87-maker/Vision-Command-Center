-- Soft-delete QA test rows created during live ledger QA
UPDATE public.marketizers_client_ledger_entries
SET is_deleted = true
WHERE client_id = '284b87b3-1428-474f-a323-c572ac2fe503'
  AND id IN (
    'edf8bed5-913b-43ae-8b99-534d5afb9f7e',
    '38df8813-d324-4a6a-b962-892c13b65b12'
  );

UPDATE public.marketizers_client_profit_splits
SET is_deleted = true
WHERE client_id = '284b87b3-1428-474f-a323-c572ac2fe503'
  AND receiver_name IN ('Marketizers','Partner')
  AND is_deleted = false;
