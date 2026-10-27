# Mobile & Backend Readiness Foundation

This document describes the architecture put in place to prepare the GWV
Vision Center for future mobile (PWA / Capacitor / RN) extensions
without rebuilding the app.

## Layer overview

```
src/
  types/             — domain types (auth.ts, marketizers.ts)
  utils/             — pure functions, no React, no Supabase
    calculations/    — finance math (safe vs null/0)
    formatters/      — INR / %, Indian dates, month label
    permissions/     — role-based capability checks
    export/          — CSV + clipboard helpers
    validation/      — inline form validators
  services/          — Supabase access, no React
    marketizers/     — clients, monthlyEntries, dashboard
    users/           — profile + roles
  hooks/
    auth/useAuth.ts  — session + role state, single source of truth
  components/        — UI only, consume hooks + services
  routes/            — TanStack Start file-based routes
```

**Rule:** services and utils never import React. UI components never
import `@supabase/supabase-js` directly — they call services.

## Backend tables

| Table | Purpose |
|---|---|
| `profiles` | Display name per user. Auto-created on signup. |
| `user_roles` | Many-to-one user → `app_role`. Bootstraps first user as `admin`. |
| `marketizers_clients` | Client master data. Soft-delete. |
| `marketizers_monthly_entries` | One row per (client, month). Unique constraint. Lockable. |
| `marketizers_targets` | Monthly revenue/profit/collection targets. |

## Permission model

Roles: `admin`, `finance_manager`, `brand_manager`, `operator`,
`team_member`, `media_buyer`.

| Capability | Roles |
|---|---|
| View finance | admin, finance_manager, brand_manager |
| Edit finance | admin, finance_manager |
| Lock month | admin, finance_manager |
| Unlock / hard delete | admin |

Enforcement is **two-layer**:
1. Postgres RLS via `has_role()` / `can_view_marketizers_finance()`
   / `can_edit_marketizers_finance()` SECURITY DEFINER helpers.
2. Frontend `utils/permissions/rolePermissions.ts` to hide controls.

The helpers have `EXECUTE` revoked from `anon` and `authenticated` —
they're invoked only through RLS expressions.

## Auth flow

- `src/hooks/auth/useAuth.ts` subscribes to `onAuthStateChange` first,
  then refreshes the profile + roles. Avoids the Supabase race.
- `__root.tsx` wraps the app in an `AuthGate` that redirects
  unauthenticated visitors to `/login`. `/login` itself is standalone.
- `MarketizersAccessGuard` reads the same hook and shows the standard
  Access Restricted panel for users without finance roles.

## Performance posture

- Indexes on `(month)`, `(client_id, month)`, `(month, is_deleted)` for
  monthly entries; `(status, is_deleted)` and `(client_name)` for
  clients.
- Unique `(client_id, month)` constraint at the DB level — duplicate
  detection is now safe even under race conditions.
- Dashboard fetches clients + entries in parallel via
  `getMarketizersDashboardData(month)`.

## Mobile readiness

- `MobileGuard` removed — app renders at any width. Sidebar is still
  desktop-style; a hamburger drawer is the next responsive task.
- All financial logic, formatters, validators, services and types are
  React-free and Supabase-mediated, so a future Capacitor / Expo client
  can reuse the same `services/*` and `utils/*` modules.

## What is intentionally NOT done in this pass

- Responsive table/card swap (planned next mobile pass).
- AppShell hamburger drawer for <1024px.
- PWA manifest / service worker.
- Brand-scoped access (currently `brand_manager` is global).
- Server-side dashboard aggregation (RPC) — only needed when entry
  volume grows.
- Phase 3 business modules.

## Future PWA / Capacitor / RN path

- Reuse `src/services/*` and `src/utils/*` as-is.
- Replace `src/hooks/auth/useAuth.ts` with the platform's auth surface
  if needed (Capacitor secure storage, RN AsyncStorage).
- Replace `downloadCSV()` with a share-sheet helper on mobile.
- Wrap large tables with the planned `ResponsiveTable` component.
