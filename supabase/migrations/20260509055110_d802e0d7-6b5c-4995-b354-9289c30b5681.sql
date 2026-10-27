
-- Create the collection followups table
CREATE TABLE IF NOT EXISTS public.marketizers_collection_followups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.marketizers_clients(id) ON DELETE CASCADE,
  monthly_entry_id uuid REFERENCES public.marketizers_monthly_entries(id) ON DELETE SET NULL,
  month text NOT NULL,
  pending_amount numeric NOT NULL DEFAULT 0,
  due_date date,
  followup_owner text,
  status text NOT NULL DEFAULT 'pending',
  priority text NOT NULL DEFAULT 'medium',
  last_followup_date date,
  next_followup_date date,
  communication_channel text,
  notes text,
  promise_to_pay_date date,
  amount_recovered numeric NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  is_deleted boolean NOT NULL DEFAULT false,
  deleted_at timestamptz,
  deleted_by uuid,
  CONSTRAINT marketizers_followups_status_chk CHECK (status IN (
    'pending','followed_up','promised','partially_collected',
    'collected','disputed','overdue','written_off'
  )),
  CONSTRAINT marketizers_followups_priority_chk CHECK (priority IN (
    'low','medium','high','urgent'
  )),
  CONSTRAINT marketizers_followups_channel_chk CHECK (
    communication_channel IS NULL OR communication_channel IN (
      'Call','WhatsApp','Email','Meeting','Other'
    )
  ),
  CONSTRAINT marketizers_followups_amounts_chk CHECK (
    pending_amount >= 0 AND amount_recovered >= 0
  ),
  CONSTRAINT marketizers_followups_month_chk CHECK (month ~ '^[0-9]{4}-[0-9]{2}$')
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_followups_client_id ON public.marketizers_collection_followups(client_id);
CREATE INDEX IF NOT EXISTS idx_followups_entry_id ON public.marketizers_collection_followups(monthly_entry_id);
CREATE INDEX IF NOT EXISTS idx_followups_month ON public.marketizers_collection_followups(month);
CREATE INDEX IF NOT EXISTS idx_followups_status ON public.marketizers_collection_followups(status);
CREATE INDEX IF NOT EXISTS idx_followups_priority ON public.marketizers_collection_followups(priority);
CREATE INDEX IF NOT EXISTS idx_followups_due_date ON public.marketizers_collection_followups(due_date);
CREATE INDEX IF NOT EXISTS idx_followups_next_followup_date ON public.marketizers_collection_followups(next_followup_date);
CREATE INDEX IF NOT EXISTS idx_followups_is_deleted ON public.marketizers_collection_followups(is_deleted);

-- Updated-at trigger
DROP TRIGGER IF EXISTS trg_followups_updated_at ON public.marketizers_collection_followups;
CREATE TRIGGER trg_followups_updated_at
BEFORE UPDATE ON public.marketizers_collection_followups
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS
ALTER TABLE public.marketizers_collection_followups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Finance viewers can read followups"
  ON public.marketizers_collection_followups
  FOR SELECT TO authenticated
  USING (public.can_view_marketizers_finance(auth.uid()));

CREATE POLICY "Finance editors can insert followups"
  ON public.marketizers_collection_followups
  FOR INSERT TO authenticated
  WITH CHECK (public.can_edit_marketizers_finance(auth.uid()));

CREATE POLICY "Finance editors can update followups"
  ON public.marketizers_collection_followups
  FOR UPDATE TO authenticated
  USING (public.can_edit_marketizers_finance(auth.uid()))
  WITH CHECK (public.can_edit_marketizers_finance(auth.uid()));

CREATE POLICY "Admins can delete followups"
  ON public.marketizers_collection_followups
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
