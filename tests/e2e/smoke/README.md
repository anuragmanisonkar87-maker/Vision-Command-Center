# E2E smoke tests

These Playwright specs only verify route load + sidebar visibility for the
admin and employee roles. They are read-only / non-destructive: no records
are created, deleted, or mutated.

## Run locally

```bash
bun run test:smoke       # smoke spec only
bun run test:e2e         # all e2e specs
```

## Credentials

Put QA credentials in a gitignored `.env.local` at the repo root:

```
VISUAL_QA_ADMIN_EMAIL=...
VISUAL_QA_ADMIN_PASSWORD=...
VISUAL_QA_EMPLOYEE_EMAIL=...
VISUAL_QA_EMPLOYEE_PASSWORD=...
```

`E2E_ADMIN_EMAIL` / `E2E_ADMIN_PASSWORD` / `E2E_EMPLOYEE_EMAIL` /
`E2E_EMPLOYEE_PASSWORD` are also accepted as aliases.

The admin and employee specs skip automatically when their credentials are
missing — only the public `/login` smoke runs in that case.

## Adding new smoke checks

Keep them tiny: route loads, sidebar item visible, page heading rendered.
Anything beyond that belongs in a dedicated spec (see
`tests/e2e/employeeDailyOpsQA.spec.ts` for the deeper QA pattern).
