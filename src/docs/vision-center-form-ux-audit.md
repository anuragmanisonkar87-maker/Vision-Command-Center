# Vision Center — Form UX Audit

Last updated: 2026-05-15. Tracks every significant data-entry surface and
whether it should remain a simple modal or be chunked into a guided wizard.

## Rule of thumb

Convert to wizard when ANY apply:
- > 6–8 fields
- > 2 logical sections
- conditional fields that depend on earlier choices
- compensation / access / finance / revenue data
- multi-step decisions

Keep simple when 1–5 fields and one logical section.

## Inventory

| # | Form / Module | File | Fields | Decision | Status |
|---|---|---|---:|---|---|
| 1 | Marketizers — Add Client | `src/components/marketizers/AddClientDrawer.tsx` | 30+ | **Wizard (5 steps)** — Identity → Business → Revenue → Ownership & Risk → Review | ✅ Converted |
| 2 | Team Access Control — Add Team Member | `src/components/access-control/TeamMemberDrawer.tsx` | 25+ | **Wizard (5 steps)** — Basic → Work → Compensation → Access → Review | ✅ Converted |
| 3 | Seminar / Webinar ROAS Tracker | `src/components/marketizers/roas/SeminarRoasCalculatorPage.tsx` | 30+ | **Wizard (5 steps)** — Event → Attendance → Spend → Sales → ROAS Review | ✅ Converted |
| 4 | HR — New Hiring Requirement (drawer) | `src/components/hr/HiringRequirementDrawer.tsx` | ~11 | Wizard — Role → Hiring Details → SLA & Source → Skills & Notes → Review | 🟡 Future cleanup (Priority 2) |
| 5 | HR — New Hiring Requirement (mobile route) | `src/routes/company-functions.hr-command-center.director-requirement-form.tsx` | ~13 | Wizard — same 5-step flow | 🟡 Future cleanup (Priority 2) |
| 6 | HR — Daily HR Report | `src/components/hr/DailyHrReportDrawer.tsx` | ~5 | **Keep simple** — short checklist + notes | ✅ Keep simple |
| 7 | Marketizers — Monthly Entry | `src/routes/brands.marketizers.revenue.entry.tsx` | ~7 visible + computed | Wizard — Client/Month → Revenue → Collection → Adjustments → Review | 🟡 Future cleanup (Priority 2) |
| 8 | Expenses — Add Expense | `src/components/marketizers/expenses/ExpenseDrawer.tsx` | ~8 | Wizard — Type → Details → Allocation → Payment → Review | 🟡 Future cleanup (Priority 2) |
| 9 | Expenses — Salary Details | `src/components/marketizers/expenses/SalaryDetailsDrawer.tsx` | varies | Reuse Team Member wizard fields where applicable | 🟡 Future cleanup (Priority 3) |
| 10 | Media Buyer — Daily Report | `src/components/marketizers/media-buyer/daily/DailyReportDrawer.tsx` | ~6 | **Keep simple** — short daily entry | ✅ Keep simple |
| 11 | Marketizers — Followup | `src/components/marketizers/FollowupDrawer.tsx` | small | **Keep simple** | ✅ Keep simple |
| 12 | Brand form | `src/components/brands/BrandFormDrawer.tsx` | small | **Keep simple** | ✅ Keep simple |
| 13 | User Invite | `src/components/users/UserInviteDrawer.tsx` | small | **Keep simple** | ✅ Keep simple |
| 14 | Access Control — Module / Position Preset drawers | `src/components/access-control/*Drawer.tsx` | small | **Keep simple** | ✅ Keep simple |
| 15 | Quick-save inline modals (master options) | `QuickSaveSelect`, `QuickSaveField`, `QuickSaveInput` | 1 | **Keep simple** — single-field add | ✅ Keep simple |

## Reusable wizard primitives

`src/components/ui/WizardForm.tsx` exports `WizardStepper`, `WizardStep`,
`WizardFooter`, `WizardReviewRow`, and the `useWizard` hook. New wizards
(and follow-up conversions) MUST reuse these primitives so the Vision Center
keeps a single, consistent wizard pattern.

## Follow-up plan (Priority 2)

1. `HiringRequirementDrawer` — adopt 5-step wizard using shared primitives.
2. `Monthly Entry` route — adopt 5-step wizard; performance metrics remain read-only when sourced from media-buyer reporting.
3. `ExpenseDrawer` — adopt 5-step wizard; preserve allocation logic.

These are tracked here so future agents pick them up without re-auditing.
