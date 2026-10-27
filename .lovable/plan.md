# Employee Daily Ops — Automated Playwright QA

Builds one Playwright spec that drives both admin and employee flows against the deployed app, mocks geolocation, exercises check-in / check-out / daily-checklist / my-tasks / isolation, and produces a markdown report. No production logic changes, no RLS changes, credentials read only from env files.

## Scope

In: new e2e spec + helpers, package script, env-cred loader extension, docs update, report generator.
Out: changes to attendance, delegation, recurring-tasks, dashboard, settings, or RLS. No new app features.

## Credentials

Extend `playwright.config.ts` cred loader to also pick up `VISUAL_QA_EMPLOYEE_EMAIL` / `VISUAL_QA_EMPLOYEE_PASSWORD` from the same four sources (process.env → `.env.local` → `/tmp/qa-creds.json` → `/tmp/qa-creds`). Preflight prints only `yes/no` per key — never values. If either employee credential is missing the spec calls `test.skip(...)` with a clear message; the file is otherwise inert. Update `docs/visual-qa-credentials.md` with the new keys and a one-line note that the employee account must be a non-admin team member with `linked_user_id` set.

## Files

New
- `tests/e2e/employeeDailyOpsQA.spec.ts` — single ordered describe (`test.describe.serial`) with named steps; one shared admin context + one employee context; each step writes a screenshot and a result line to a shared in-memory report.
- `tests/e2e/helpers/qaReport.ts` — `recordStep(name, status, note?)` + `writeReport(path)` writing `test-results/employee-daily-ops/report.md`.
- `tests/e2e/helpers/officeGeo.ts` — reads `gwv_attendance_settings` via the public Supabase client (anon key from `VITE_SUPABASE_*`) to fetch `office_lat/office_lng/allowed_radius_meters`; returns `{ inside, outside }` coordinate pairs (outside = office point shifted ~3× radius north).

Edited
- `playwright.config.ts` — add employee keys to the cred loader and preflight line.
- `package.json` — add `"test:e2e:employee-daily-ops": "PW_CHROMIUM_EXECUTABLE_PATH=${PW_CHROMIUM_EXECUTABLE_PATH:-/bin/chromium} playwright test tests/e2e/employeeDailyOpsQA.spec.ts"`.
- `docs/visual-qa-credentials.md` — append employee-creds section.

## Spec flow (ordered)

1. **Admin setup** — login admin, open `/settings/attendance`, assert auto-prompt toggle, ensure ON, save, screenshot. Read office coords for the geo helper.
2. **Seed throwaway data** via admin UI where possible, falling back to direct Supabase REST calls using the admin's session token:
   - recurring daily task `QA Auto Daily Checklist Task` assigned to the QA employee's `team_member_id`
   - delegation task `QA Employee My Task` assigned to the QA employee
   Track inserted row IDs in a `cleanup[]` array.
3. **Employee dashboard** — login in a separate browser context, open `/dashboard`, assert presence of Attendance, Daily Checklist, My Tasks, Points Today, Quick Actions, and Auto Check-In prompt (only when no record exists today). Assert admin-only summary strip is absent. Screenshot `dashboard.png`.
4. **Inside-radius check-in** — grant geolocation, set coords to `inside`, click `Check In Now`, assert prompt disappears + Attendance card flips to Checked In. Open `/attendance`, assert timer visible. Screenshot.
5. **Timer refresh** — reload `/attendance`, assert timer text != `00:00:00` and that no duplicate row exists for the employee+date (REST count == 1).
6. **Check-out** — click `Check Out`, assert Checked Out state + check-out timestamp visible. Return to `/dashboard`, assert prompt does not reappear.
7. **Outside-radius** — REST-delete the attendance row created in step 4 (only this QA row, by id), reload `/dashboard`, set geo to `outside`, click `Check In Now`, assert error contains "outside" and no new row is created.
8. **Permission denied** — new context with `permissions: []`, login employee, open `/dashboard`, click `Check In Now`, assert error mentions location permission and no row created.
9. **Daily Checklist** — original employee context, open `/daily-checklist`, find the seeded task by name, click Mark Done, assert Done state. Reload `/dashboard`, assert Points Today increased (read before/after).
10. **My Tasks** — open `/delegation?tab=mytasks`, find seeded task, set In Progress, add a note, submit. Assert only this employee's tasks are visible (no other assignee names).
11. **Admin approval** — admin context: open delegation Review Queue, approve the submitted task, assert success.
12. **Isolation** — employee context: navigate to `/settings/attendance`, `/settings/users`, `/settings/recurring-tasks`; assert each either redirects away or renders an access-denied state (no save buttons reachable).
13. **Cleanup** (always runs in `test.afterAll`):
    - delete delegation task by id
    - delete recurring daily template + any completion + points ledger rows for QA names
    - delete the outside-radius attempt and any leftover QA attendance rows for today
    - leave admin settings as found (auto-prompt left ON unless it was OFF originally — capture in step 1)
14. **Report** — write `test-results/employee-daily-ops/report.md` summarising each step's pass/fail + screenshot path.

## Run

- `bun run test:unit`
- `bunx tsc --noEmit`
- `bun run test:e2e:employee-daily-ops`

## Known limitations (documented in report)

- Requires a non-admin QA employee account with a `gwv_team_members` row whose `linked_user_id` matches the auth user.
- If office coords are unset in `gwv_attendance_settings`, geo steps skip with a clear note.
- Toast assertions are best-effort (`getByText`, short timeout) — failures here surface as warnings, not hard fails, to avoid flakiness.
- Test runs serially (matches existing `fullyParallel: false`).
