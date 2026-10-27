// Marketizers domain types. Mirror the Supabase schema. Reusable by web,
// PWA, and any future Capacitor / RN app.

export type RevenueModel =
  | "Fixed Retainer"
  | "Revenue Share"
  | "Hybrid"
  | "One-Time Setup"
  | "Performance Bonus"
  | "Other";

export type AccountStatus = "active" | "paused" | "closed" | "trial";

export type Client = {
  id: string;
  client_name: string;
  founder_name: string | null;
  niche: string | null;
  revenue_model: string;
  start_date: string | null;
  status: string;
  assigned_manager: string | null;
  notes: string | null;
  is_deleted: boolean;
};

export type MonthlyEntry = {
  id: string;
  client_id: string;
  month: string; // YYYY-MM
  revenue_model: string | null;
  account_status: string | null;
  marketizers_revenue: number;
  amount_collected: number;
  amount_pending: number;
  client_gross_revenue: number;
  ad_spend: number;
  leads_generated: number;
  qualified_leads: number;
  sales_closed: number;
  total_direct_expense: number;
  notes: string | null;
  is_locked: boolean;
  is_deleted: boolean;
  created_at?: string | null;
  updated_at?: string | null;
};

export type HealthStatus =
  | "Inactive"
  | "Loss-making"
  | "Payment Pending"
  | "Watch"
  | "Healthy";

export type FollowupStatus =
  | "pending"
  | "followed_up"
  | "promised"
  | "partially_collected"
  | "collected"
  | "disputed"
  | "overdue"
  | "written_off";

export type FollowupPriority = "low" | "medium" | "high" | "urgent";

export type CommunicationChannel =
  | "Call"
  | "WhatsApp"
  | "Email"
  | "Meeting"
  | "Other";

export type CollectionFollowup = {
  id: string;
  client_id: string;
  monthly_entry_id: string | null;
  month: string;
  pending_amount: number;
  due_date: string | null;
  followup_owner: string | null;
  status: FollowupStatus;
  priority: FollowupPriority;
  last_followup_date: string | null;
  next_followup_date: string | null;
  communication_channel: CommunicationChannel | null;
  notes: string | null;
  promise_to_pay_date: string | null;
  amount_recovered: number;
  is_deleted: boolean;
  created_at?: string | null;
  updated_at?: string | null;
};

export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };
