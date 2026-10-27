// COMPATIBILITY SHIM
// Existing pages still import from "@/lib/marketizersFinanceUtils".
// Source of truth has moved to:
//   - src/types/marketizers.ts
//   - src/utils/calculations/financeCalculations.ts
//   - src/utils/formatters/format.ts
//   - src/utils/export/csv.ts
// New code should import from those modules directly.

export type { Client, MonthlyEntry, HealthStatus } from "@/types/marketizers";
export {
  calculateNetProfit,
  calculateProfitMargin,
  calculateCollectionPercent,
  calculatePendingPercent,
  calculateClientROAS,
  calculateCPL,
  calculateCostPerSale,
  calculateLeadToSalePercent,
  calculateGrowthPercent,
  getClientHealthStatus,
} from "@/utils/calculations/financeCalculations";
export {
  formatINR,
  formatPercent,
  formatNumber,
  previousMonth,
} from "@/utils/formatters/format";
export { exportToCSV } from "@/utils/export/csv";
