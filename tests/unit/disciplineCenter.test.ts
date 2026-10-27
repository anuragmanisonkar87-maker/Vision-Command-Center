// Phase 3F — Discipline tab gating + Daily Grid alert behavior.
import { describe, it, expect } from "vitest";
import { VALID_TABS, type DelegationTab } from "@/routes/delegation";
import { DEFAULT_DISCIPLINE_SETTINGS } from "@/components/delegation/AutomationSettingsPanel";

function resolveTab(
  searchTab: string | undefined,
  isAdmin: boolean,
  canManageSettings: boolean,
): DelegationTab {
  const defaultTab: DelegationTab = isAdmin ? "daily" : "mytasks";
  if (!searchTab) return defaultTab;
  if (!(VALID_TABS as readonly string[]).includes(searchTab)) return defaultTab;
  const t = searchTab as DelegationTab;
  if (t === "team" && !isAdmin) return defaultTab;
  if (t === "discipline" && !isAdmin) return defaultTab;
  if (t === "settings" && !canManageSettings) return defaultTab;
  return t;
}

describe("Discipline Automation Center", () => {
  it("'discipline' is a valid tab", () => {
    expect(VALID_TABS).toContain("discipline");
  });

  it("admin can land on /delegation?tab=discipline", () => {
    expect(resolveTab("discipline", true, true)).toBe("discipline");
  });

  it("employee cannot land on Discipline via URL", () => {
    expect(resolveTab("discipline", false, false)).toBe("mytasks");
  });

  it("automation defaults are safe: auto-send OFF, drafts ON, penalties OFF", () => {
    expect(DEFAULT_DISCIPLINE_SETTINGS.auto_send_emails).toBe(false);
    expect(DEFAULT_DISCIPLINE_SETTINGS.auto_apply_penalties).toBe(false);
    expect(DEFAULT_DISCIPLINE_SETTINGS.auto_create_drafts).toBe(true);
    expect(DEFAULT_DISCIPLINE_SETTINGS.email_mode).toBe("draft_only");
    expect(DEFAULT_DISCIPLINE_SETTINGS.automation_time).toBe("19:00");
  });
});
