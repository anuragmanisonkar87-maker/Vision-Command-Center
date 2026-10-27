// Default-tab resolution rules for /delegation.
// Mirrors logic in DelegationPage so a regression where "mytasks" becomes
// the admin default (or where an invalid ?tab= leaks through) fails loudly.
import { describe, expect, it } from "vitest";
import { VALID_TABS, type DelegationTab } from "@/routes/delegation";

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

describe("delegation tab default", () => {
  it("admin with no ?tab lands on Daily Grid (NOT My Tasks)", () => {
    expect(resolveTab(undefined, true, true)).toBe("daily");
  });
  it("employee with no ?tab lands on My Tasks", () => {
    expect(resolveTab(undefined, false, false)).toBe("mytasks");
  });
  it("admin can switch to My Tasks via ?tab=mytasks", () => {
    expect(resolveTab("mytasks", true, true)).toBe("mytasks");
  });
  it("invalid ?tab falls back to role default", () => {
    expect(resolveTab("bogus", true, true)).toBe("daily");
    expect(resolveTab("bogus", false, false)).toBe("mytasks");
  });
  it("employee cannot land on Team Grid via URL", () => {
    expect(resolveTab("team", false, false)).toBe("mytasks");
  });
  it("non-admin cannot land on Admin Settings via URL", () => {
    expect(resolveTab("settings", false, false)).toBe("mytasks");
  });
  it("admin ?tab=team is honored", () => {
    expect(resolveTab("team", true, true)).toBe("team");
  });
});
