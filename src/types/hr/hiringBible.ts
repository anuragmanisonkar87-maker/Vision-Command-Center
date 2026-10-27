// Type contracts for hb_vc_* RPCs. Mirrors src/docs/vision-center-sync-contract.md
// in the Hiring Bible project.

export type HbCompanyPosition = {
  position_id: string;
  brand_key: string | null;
  brand_name: string | null;
  position_key: string | null;
  position_name: string;
  department: string | null;
  reporting_manager: string | null;
  work_mode: string | null;
  location: string | null;
  role_category: string | null;
  hiring_guide_url: string | null;
  status: string;
  target_pool_count: number | null;
  // Optional JD-style fields. Hiring Bible may not send these yet — when it
  // does, the New Hiring Requirement drawer will auto-fill them on select.
  skills_required?: string | null;
  reason_for_hiring?: string | null;
  special_notes?: string | null;
  experience_required?: string | null;
  salary_range?: string | null;
};

export type HbFreshnessStatus = "Fresh" | "Warm" | "Cold" | "Expired";
export type HbPoolHealthStatus = "Healthy" | "Warning" | "Critical" | "Empty";

export type HbCandidate = {
  pool_id: string;
  candidate_name: string;
  phone: string | null;
  email: string | null;
  brand_key: string | null;
  brand_name: string | null;
  position_key: string | null;
  position_name: string | null;
  readiness_level: string | null;
  ready_to_join_from: string | null;
  expected_salary: string | null;
  availability: string | null;
  location: string | null;
  work_mode: string | null;
  interview_status: string | null;
  l1_score: number | null;
  l2_score: number | null;
  final_score: number | null;
  hr_name: string | null;
  freshness_status: HbFreshnessStatus | null;
  last_contacted_at: string | null;
  pool_notes: string | null;
};

export type HbDailyInterviewSummary = {
  report_date: string;
  total_interviews_conducted: number;
  shortlisted_count: number;
  rejected_count: number;
  ready_pool_added_count: number;
  quality_candidates_count: number;
  brand_breakdown: Record<string, number> | null;
  position_breakdown: Record<string, number> | null;
  hr_breakdown: Record<string, number> | null;
};

export type HbPoolHealthRow = {
  position_id: string;
  brand_name: string | null;
  position_name: string;
  target_pool_count: number | null;
  total_active_pool: number;
  ready_now_count: number;
  ready_soon_count: number;
  future_fit_count: number;
  hold_count: number;
  fresh_count: number;
  warm_count: number;
  cold_count: number;
  expired_count: number;
  pool_health_status: HbPoolHealthStatus;
};

export type HbSyncHealth = {
  hiring_bible_project_name: string;
  database_connected: boolean;
  last_candidate_pool_update: string | null;
  last_interview_update: string | null;
  total_active_positions: number;
  total_pool_candidates: number;
  sync_status: string;
  errors: string[] | null;
};
