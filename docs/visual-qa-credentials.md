# Theme Visual QA — Local Credentials

The automated visual QA suite (`bun run test:e2e:theme-visual`) needs to log
into the published site. Credentials are read from **gitignored local files
only** — never from chat, never committed.

## Step 1 — Create a temporary QA admin

In Lovable Cloud → Users, create a **temporary** QA admin account
(e.g. `qa-visual+<date>@yourdomain.com`). Do **not** use a real owner
account. Give it the `admin` role only for the duration of the QA run.

## Step 2 — Provide credentials locally (choose ONE)

### Option A — `.env.local` (already gitignored via `*.local`)

Create `./.env.local` at the project root:

```
VISUAL_QA_ADMIN_EMAIL=qa-visual+temp@yourdomain.com
VISUAL_QA_ADMIN_PASSWORD=<the temporary password>
```

### Option B — `/tmp/qa-creds.json` (never committed; outside repo)

```json
{
  "VISUAL_QA_ADMIN_EMAIL": "qa-visual+temp@yourdomain.com",
  "VISUAL_QA_ADMIN_PASSWORD": "<the temporary password>"
}
```

`/tmp/qa-creds` (KEY=VALUE format) is also supported.

## Step 3 — Run the QA

```
bun run test:e2e:theme-visual
```

A preflight line is printed showing only **presence** (`yes`/`no`) of each
credential and the base URL. The password is never printed.

Outputs:
- `test-results/theme-visual/<theme>/<page>.png`
- `test-results/theme-visual/report.md`
- `test-results/theme-visual/index.html`

## Step 4 — Rotate after QA

After the QA run completes:
1. Delete `./.env.local` (or remove the two QA keys).
2. Delete `/tmp/qa-creds*`.
3. Reset the QA admin password, **or** delete the temporary QA admin account.

Never paste real production credentials into these files.

---

## Employee Daily Ops QA — additional credentials

`bun run test:e2e:employee-daily-ops` drives both admin and a non-admin
employee. Add two more keys to the same local credential file (`.env.local`
or `/tmp/qa-creds.json`):

```
VISUAL_QA_EMPLOYEE_EMAIL=qa-employee+temp@yourdomain.com
VISUAL_QA_EMPLOYEE_PASSWORD=<the temporary password>
```

Requirements for the employee account:
- **NOT** an admin (no row in `user_roles` with `role = 'admin'`).
- Has a row in `gwv_team_members` whose `linked_user_id` equals the auth user id
  (needed so seeded recurring/delegation tasks attach correctly).

The preflight line at startup prints only presence (`yes/no`) for each key.
Outputs land in `test-results/employee-daily-ops/` (screenshots + `report.md`).
The spec self-skips when any required credential or env var is missing.
