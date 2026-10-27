# Vision Center — Form UX Rule (Standard)

Any form that meets ANY of the following MUST be built as a guided wizard
using the shared primitives in `src/components/ui/WizardForm.tsx`:

- more than 6–8 fields
- more than 2 logical sections
- conditional fields (later fields depend on earlier choices)
- compensation, access, finance, salary, or revenue data
- multi-step decisions

Forms with 1–5 simple fields stay as compact modals/drawers.

## Wizard rules

1. Stepper pills at the top (`WizardStepper`).
2. One focused card per step (`WizardStep`).
3. Only the relevant fields per step.
4. `Previous` / `Next` navigation in a sticky `WizardFooter`.
5. Final **Review & Save** step for any operationally important form
   (Add Client, Add Team Member, Hiring Requirement, Monthly Entry,
   ROAS Calculation, Salary/Payroll setup).
6. Step-level validation only — never block step 1 with step 4 requirements.
7. Advanced fields collapsed by default.
8. Conditional fields appear only after the controlling field is set.
9. Mobile responsive: full-width drawer, horizontally scrollable stepper,
   single-column fields, sticky footer.
10. Quick-save (`+`) buttons on every customizable dropdown remain available
    inside wizard steps.

## Design tokens (do not deviate)

- Background: `var(--parchment)` (page), `var(--ivory)` (cards)
- Borders: `var(--border)`, `var(--gold-border)` for completed/highlighted
- Ink text: `var(--ink)`, secondary `var(--ink4)`
- Accent: `var(--gold)`
- Headings: `'Cormorant Garamond', serif`
- Body / inputs: `'Figtree', sans-serif`
- Labels / badges / dates / numbers: `'DM Mono', monospace`, uppercase, tracked
- Status colors: green/amber/red/blue/purple

## Access control safety

Wizards must not bypass `MarketizersAccessGuard`, `ModuleGuard`, or any
finance/HR visibility rule. Route guards stay on the route file; the wizard
is purely the form body.

## Save semantics

- Existing save services and DB schema MUST NOT change for a wizardization PR.
- Final step calls the same `create*` / `update*` service the original form used.
- Optional secondary actions (`Save & Add Monthly Entry`, `Save & Preview`)
  go in `WizardFooter.extraActions`.

## When in doubt

If a form has only one logical section and no conditional fields, **do not**
wrap it in a wizard just for visual consistency. Simple stays simple.
