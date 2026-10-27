// Performance Summary Service — placeholder/foundation.
// Future Media Buyer Daily Reporting module will populate this.
// Today: returns isConnected:false with null values so Monthly Entry can
// safely show "Not connected yet" without blocking saves.

export type PerformanceSummary = {
  clientId: string;
  month: string;
  leadsGenerated: number | null;
  qualifiedLeads: number | null;
  callsBooked: number | null;
  salesClosed: number | null;
  adSpendFromPerformance: number | null;
  source: string | null;
  isConnected: boolean;
  notes: string | null;
};

export async function getClientMonthlyPerformanceSummary(
  clientId: string,
  month: string,
): Promise<PerformanceSummary> {
  // No backend table yet. When the Media Buyer Daily Reporting module ships,
  // wire it in here (e.g. supabase.from("marketizers_daily_performance")…).
  return {
    clientId,
    month,
    leadsGenerated: null,
    qualifiedLeads: null,
    callsBooked: null,
    salesClosed: null,
    adSpendFromPerformance: null,
    source: null,
    isConnected: false,
    notes: "Will be fetched from Team Performance module.",
  };
}
