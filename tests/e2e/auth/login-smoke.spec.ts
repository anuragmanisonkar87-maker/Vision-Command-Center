/**
 * Smoke test — confirms the shared loginAs helper works against the target
 * E2E base URL for both an admin and an employee QA user, and that
 * /delegation loads after sign-in.
 */
import { test, expect } from "@playwright/test";
import { loginAs } from "../helpers/loginAs";
import { QA_USERS } from "../../seed/qa-users";

const ADMIN = QA_USERS[0];
const EMP1 = QA_USERS[1];

test.describe("Auth login smoke", () => {
  test("employee can sign in and reach /delegation", async ({ page }) => {
    await loginAs(page, EMP1.email, EMP1.password);
    await page.goto("/delegation");
    await expect(
      page.getByRole("heading", { name: /delegation command center/i }),
    ).toBeVisible({ timeout: 20_000 });
  });

  test("admin can sign in and reach /delegation", async ({ page, context }) => {
    await context.clearCookies();
    await loginAs(page, ADMIN.email, ADMIN.password);
    await page.goto("/delegation");
    await expect(
      page.getByRole("heading", { name: /delegation command center/i }),
    ).toBeVisible({ timeout: 20_000 });
  });
});
