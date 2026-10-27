# Phase 3H — 2–3 Employee Pilot Checklist

Use this as the admin runbook for a controlled pilot with 2–3 employees.
No new features are introduced; this verifies the existing system end-to-end.

## Readiness snapshot

- Active admin: `abdlhans@gmail.com`
- Candidate pilot employees already in the system:
  - Afreen — `afreenekram96@gmail.com` (invite sent)
  - Arfin — `arfinekram1407@gmail.com` (invite sent)
  - Swati Agarwal — `saanjhagarwal2017@gmail.com` (invite sent)
  - Rohit Goswami — `goswamirohit140@gmail.com` (reset sent)

Pick any 2–3 of the above (or invite fresh ones from
**Settings → Users → Login Access**).

## Per-employee checklist

For each pilot employee, the admin walks through:

1. **Invite / Login**
   - Settings → Users → Login Access → *Send Invite* (or *Resend* / *Send Reset*).
   - Employee receives email → sets password → lands on `/dashboard`.
   - Verify employee sees the purple **Employee Dashboard** (not admin).
2. **Attendance check-in**
   - Employee opens `/attendance` (or uses the dashboard prompt).
   - Allows GPS permission on their device → *Check In*.
   - Admin verifies the record under Attendance / Admin Summary Strip.
3. **Daily Checklist**
   - Employee opens `/daily-checklist` → ticks today's items.
   - Card on dashboard updates count + accent dot.
4. **My Tasks — submit one task**
   - Employee opens `/task-manager` (or the My Tasks card).
   - Picks an assigned task → *Submit* with proof/notes.
5. **Admin approves the submission**
   - Admin opens `/delegation` → Submissions queue → approves.
   - Points appear in employee's *Points Today* card.
6. **Missed / late behaviour (if applicable)**
   - Any overdue task surfaces in the employee's *Missed Tasks* card.
   - Admin verifies it in Discipline Center; missed-task email log records the run.

## Admin monitoring (always available)

- `/dashboard` — Admin summary strip (attendance + tasks + missed).
- `/delegation` — task board, approvals, discipline center.
- `/attendance` — live + historical records.
- **QA Automation Center** (inside Delegation) — *Run Full System QA*
  remains available for spot checks. Note: real GPS and final visual
  approval still require owner review.

## Verification results

- `bun run test:unit` → **326/326 passing**
- `bunx tsc --noEmit` → **clean**

## Known limitations

- Real GPS permission must be granted on an actual office device.
- Final visual / UX approval is subjective and owner-reviewed.
- Email delivery depends on Resend; sandbox smoke test covers the happy path only.
