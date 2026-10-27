# Marketizers — Role-Based Finance Visibility

## Product principle

Finance-sensitive fields are **hidden, not masked**, for users without
finance visibility. No locks, no `₹••••`, no "Finance access required"
placeholders. The UI should look naturally designed for each role.

## Permission source

Single source of truth lives in `src/utils/permissions/financeVisibility.ts`,
which wraps the existing `canViewMarketizersFinance` helper from
`src/utils/permissions/rolePermissions.ts`.

Allowed roles (sees finance fields):
- `admin`
- `finance_manager`
- `brand_manager`

Not allowed by default:
- `media_buyer`
- `team_member`
- `operator`
- `hr`
- Any user without one of the roles above

Backend RLS policies on Marketizers tables already use the matching
SECURITY DEFINER function `public.can_view_marketizers_finance(uuid)`
(visible in `<db-functions>`), so the frontend rule matches what the
database will return.

## Reusable helpers

| Helper | Path | Use |
| --- | --- | --- |
| `useFinanceVisibility()` | `src/hooks/useFinanceVisibility.ts` | Returns `boolean` for current user |
| `<CanViewFinance>` | `src/components/access/CanViewFinance.tsx` | Wraps JSX, renders nothing when forbidden |
| `canViewFinanceFields(user)` | `src/utils/permissions/financeVisibility.ts` | Pure function for non-React paths |

## Frontend visibility status

| Surface | Route / file | Gating strategy | Status |
| --- | --- | --- | --- |
| Revenue Dashboard | `/brands/marketizers/revenue` | Wrapped in `MarketizersAccessGuard` → only `canViewMarketizersFinance` users reach the route. Non-finance users see no entry-point in side nav. | Gated at route |
| Client Accounts | `/brands/marketizers/revenue/clients` | Same `MarketizersAccessGuard`. List view itself shows identity-only columns (name, founder, niche, model, status, manager, start). No retainer/revenue values in the list. | Gated at route |
| Monthly Entry | `/brands/marketizers/revenue/entry` | Wrapped in `MarketizersAccessGuard` and additionally requires `canEditMarketizersFinance` for save. | Gated at route |
| Expenses Center | `/brands/marketizers/revenue/expenses` | Wrapped in `MarketizersAccessGuard`. | Gated at route |
| ROAS Tracker | `/brands/marketizers/team-performance/media-buyer-performance/seminar-roas` | Route accessible to media buyers. Finance outputs (ROAS, PNL, CPL, CPP, Revenue/Lead, Profit/Lead, Total Revenue, GST Summary, Import button, CSV/PDF/WhatsApp exports) gated with `useFinanceVisibility`. Operational fields (client, event, leads, show-up, conversion, sales) remain visible. | Gated per-field |
| ROAS Reports & History | `/brands/marketizers/team-performance/media-buyer-performance/reports-history` | KPI strip and table columns for Ad Spend / Revenue / CPL / ROAS / PNL / Avg ROAS removed entirely for non-finance users across History, Client-wise, Media-Buyer-wise, Trends, and Trash tabs. | Gated per-column |
| ROAS Import Wizard | `RoasImportWizard.tsx` | Entry button only renders for finance users. Wizard does not open without finance permission. | Gated at trigger |

## Tables protected by RLS (backend)

The following Marketizers tables are protected by Supabase RLS using
`can_view_marketizers_finance` / `can_edit_marketizers_finance`:

- `marketizers_clients`
- `marketizers_monthly_entries`
- `marketizers_expenses`
- `marketizers_expense_allocations`
- `marketizers_salary_entries`
- `marketizers_collection_followups`
- `marketizers_roas_sessions` (read open to media buyer scope; finance fields shown only when policy allows)
- `marketizers_roas_import_mappings`

Frontend hiding is therefore defense-in-depth, not the only barrier — a
non-finance user querying directly through the client SDK still cannot
read restricted columns.

## What is intentionally NOT in this pass

- Adding a separate `finance_visibility` permission toggle in Team Access
  Control. The existing role-based helper already covers the test matrix.
  If product wants a per-user override later, add it as an additional
  predicate inside `canViewFinanceFields` so all call-sites pick it up
  automatically.
- Rewriting RLS policies. Existing policies already match the frontend
  rule. A future hardening pass could split `roas_sessions` row read vs.
  column-level access for ad spend / revenue / pnl when media buyers need
  per-row access without finance numbers.
- Changes to ROAS, revenue, expense, or PNL formulas.
- Changes to Monthly Entry / Expense Drawer / ROAS Import save logic.

## Future hardening candidates

1. Column-level RLS or view-based projection for `marketizers_roas_sessions`
   so non-finance media buyers reading their own rows never receive
   `ad_spend`, `total_revenue`, `pnl`, `cpl`, `cpp` over the wire.
2. Add explicit `finance_visibility` permission to the
   `gwv_team_module_access` matrix and read it via `useEffectiveAccess`
   so admins can grant finance visibility on a per-user basis without
   promoting them to `brand_manager`.
