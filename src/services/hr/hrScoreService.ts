// HR Score engine — out of 100. Pure function; persistence happens in caller.

export type ScoreInput = {
  interviews_conducted: number;
  interview_target: number;
  ready_pool_added: number;
  shortlisted: number;
  joined: number;
  open_positions: number;
  positions_closed: number;
  sla_missed: number;
  checklist_completed: number;
  checklist_total: number;
  report_submitted: boolean;
  late_submission: boolean;
  pool_below_minimum: boolean;
  kpi: Record<string, any>;
};

export type ScoreOutput = {
  score_total: number;
  score_breakdown: Record<string, number>;
  penalty_breakdown: { reason: string; delta: number }[];
  bonus_breakdown: { reason: string; delta: number }[];
};

const clamp = (n: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, Math.round(n)));
const safeDiv = (a: number, b: number) => (b > 0 ? a / b : 0);

export function computeScore(i: ScoreInput): ScoreOutput {
  const breakdown: Record<string, number> = {};
  const penalties: ScoreOutput["penalty_breakdown"] = [];
  const bonuses: ScoreOutput["bonus_breakdown"] = [];

  // 1. Interviews Conducted (20)
  breakdown.interviews = clamp(20 * Math.min(1, safeDiv(i.interviews_conducted, Math.max(1, i.interview_target))), 0, 20);

  // 2. Ready Candidate Pool Addition (20) — 4 pts per added, max 20
  breakdown.ready_pool = clamp(Math.min(20, i.ready_pool_added * 4), 0, 20);

  // 3. Open Position Progress (20)
  breakdown.position_progress = i.open_positions > 0
    ? clamp(20 * safeDiv(i.positions_closed, i.open_positions), 0, 20)
    : 20;

  // 4. Quality Outcome (20)
  breakdown.quality = clamp(Math.min(20, i.shortlisted * 2 + i.joined * 8), 0, 20);

  // 5. Checklist + Email Discipline (10)
  breakdown.checklist = i.checklist_total > 0
    ? clamp(10 * safeDiv(i.checklist_completed, i.checklist_total), 0, 10)
    : 0;

  // 6. Daily Report Submitted (10)
  breakdown.report = i.report_submitted ? 10 : 0;

  let total = Object.values(breakdown).reduce((a, b) => a + b, 0);

  // Penalties
  if (!i.report_submitted) {
    const p = Number(i.kpi.missed_report_penalty ?? -20);
    penalties.push({ reason: "Daily report not submitted", delta: p });
    total += p;
  }
  if (i.late_submission) {
    penalties.push({ reason: "Late submission", delta: -5 });
    total -= 5;
  }
  if (i.sla_missed > 0) {
    const p = Number(i.kpi.missed_sla_penalty ?? -15) * i.sla_missed;
    penalties.push({ reason: `SLA missed (${i.sla_missed})`, delta: p });
    total += p;
  }
  if (i.pool_below_minimum) {
    penalties.push({ reason: "Pool below minimum", delta: -8 });
    total -= 8;
  }
  if (i.interviews_conducted < i.interview_target) {
    const gap = i.interview_target - i.interviews_conducted;
    penalties.push({ reason: `Below interview target (-${gap})`, delta: -gap * 2 });
    total -= gap * 2;
  }

  // Bonuses
  if (i.interviews_conducted > i.interview_target) {
    bonuses.push({ reason: "Above interview target", delta: 5 });
    total += 5;
  }
  if (i.joined > 0) {
    const b = Number(i.kpi.bonus_candidate_joined ?? 15) * i.joined;
    bonuses.push({ reason: `Candidate joined (${i.joined})`, delta: b });
    total += b;
  }

  return {
    score_total: clamp(total, -100, 100),
    score_breakdown: breakdown,
    penalty_breakdown: penalties,
    bonus_breakdown: bonuses,
  };
}
