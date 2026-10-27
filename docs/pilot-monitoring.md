# Phase 3H.1 — 3-Day Employee Pilot Monitoring

Pilot window: **Day 1 → Day 3** (admin fills the date when kicking off).
No new features. Read-only monitoring against the existing system.

## Pilot employees (verified active in `gwv_team_members`)

| Name           | Email                          | Account status |
| -------------- | ------------------------------ | -------------- |
| Afreen         | afreenekram96@gmail.com        | active         |
| Swati Agarwal  | saanjhagarwal2017@gmail.com    | active         |
| Rohit Goswami  | goswamirohit140@gmail.com      | active         |

Reset / invite links are sent from **Settings → Users → Login Access**
(see `docs/pilot-checklist.md` for the click-path).

## Daily monitoring report (copy/paste per day)

> Day: ____  •  Date: ____  •  Admin on duty: ____

| Employee | Login | Attendance (in/out) | Checklist | Task submitted | Admin approved | Issues found | Fix required (Y/N) |
| -------- | ----- | ------------------- | --------- | -------------- | -------------- | ------------ | ------------------ |
| Afreen   |       |                     |           |                |                |              |                    |
| Swati    |       |                     |           |                |                |              |                    |
| Rohit    |       |                     |           |                |                |              |                    |

Status legend: `OK` / `PARTIAL` / `FAIL` / `N/A`.
"Fix required" = **Y only for critical bugs that block usage**. Cosmetic
issues are logged in the *Issues found* column and deferred to post-pilot.

## What "OK" means per column

- **Login** — employee signed in via reset link and sees the purple
  Employee Dashboard (not admin).
- **Attendance** — at least one check-in today; check-out by end of day.
  Visible in `/attendance` and Admin Summary Strip.
- **Checklist** — `/daily-checklist` items ticked; dashboard card count
  updates.
- **Task submitted** — at least one task submitted via `/task-manager`
  with proof/notes.
- **Admin approved** — admin approved in `/delegation → Submissions`;
  points appear in employee's *Points Today* card.
- **Issues found** — short note (e.g. "GPS prompt slow on Safari").

## Critical-bug triage rule

Fix during the pilot **only** if the issue blocks:
- login / password reset
- attendance check-in/out
- daily checklist completion
- task submission
- admin approval

Everything else (spacing, copy, colour, ordering) → backlog for after pilot.

## Always-available admin tools during pilot

- `/dashboard` — Admin Summary Strip
- `/delegation` — task board, Submissions, **Discipline Center** (missed/late)
- `/attendance` — live + history
- **QA Automation Center** (inside Delegation) — *Run Full System QA*
  for spot checks. Real GPS + final visual approval still owner-reviewed.

## Verification

- `bun run test:unit` → **326/326 passing**
- `bunx tsc --noEmit` → **clean**
