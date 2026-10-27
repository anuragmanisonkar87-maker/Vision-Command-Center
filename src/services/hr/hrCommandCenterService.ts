// HR Command Center — aggregate read service for the dashboard.
import { supabase } from "@/integrations/supabase/client";

const sb = supabase as any;

export type KpiSettings = Record<string, any>;

export async function loadKpiSettings(): Promise<KpiSettings> {
  const { data, error } = await sb.from("gwv_hr_kpi_settings").select("setting_key, setting_value");
  if (error) throw error;
  const out: KpiSettings = {};
  (data || []).forEach((r: any) => { out[r.setting_key] = r.setting_value; });
  return out;
}

export async function saveKpiSetting(setting_key: string, setting_value: any) {
  const { error } = await sb
    .from("gwv_hr_kpi_settings")
    .update({ setting_value, updated_at: new Date().toISOString() })
    .eq("setting_key", setting_key);
  if (error) throw error;
}

export type HiringMode = "high" | "normal" | "low" | "maintenance";

export type HiringModeResult = {
  mode: HiringMode;
  reason: string;
  target: number;
};

export function computeHiringMode(input: {
  openCount: number;
  urgentCount: number;
  slaDueIn48h: number;
  poolCriticalCount: number;
  override?: string;
  highTarget: number;
  normalTarget: number;
  lowTarget: number;
  maintTarget: number;
}): HiringModeResult {
  const ov = (input.override || "automatic").toLowerCase();
  let mode: HiringMode = "normal";
  let reason = "Default mode";
  if (["high", "normal", "low", "maintenance"].includes(ov)) {
    mode = ov as HiringMode;
    reason = `Director override: ${ov}`;
  } else {
    if (input.urgentCount > 0 || input.poolCriticalCount > 0 || input.slaDueIn48h > 0) {
      mode = "high";
      reason = `${input.openCount} open · ${input.poolCriticalCount} critical pool · ${input.slaDueIn48h} SLA due ≤48h`;
    } else if (input.openCount > 0) {
      mode = "normal";
      reason = `${input.openCount} open positions, pools acceptable`;
    } else {
      mode = "maintenance";
      reason = "No urgent demand — pool freshness only";
    }
  }
  const target =
    mode === "high" ? input.highTarget :
    mode === "normal" ? input.normalTarget :
    mode === "low" ? input.lowTarget :
    input.maintTarget;
  return { mode, reason, target };
}
