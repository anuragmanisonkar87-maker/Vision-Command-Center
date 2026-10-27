/**
 * Shared E2E login helper.
 *
 * Prefers stable `data-testid` selectors (auth-email / auth-password / auth-submit)
 * and falls back to placeholder-based selectors when the test IDs are not yet
 * deployed to the target build.
 */
import { expect, type Page } from "@playwright/test";

export async function loginAs(page: Page, email: string, password: string) {
  await page.context().clearCookies();
  await page.goto("/login");

  const emailById = page.getByTestId("auth-email");
  const useTestIds = await emailById.count().then((n) => n > 0).catch(() => false);

  const emailInput = useTestIds ? emailById : page.getByPlaceholder("you@gratefulworld.in");
  const passwordInput = useTestIds
    ? page.getByTestId("auth-password")
    : page.getByPlaceholder("••••••••");
  const submit = useTestIds
    ? page.getByTestId("auth-submit")
    : page.getByRole("button", { name: /sign in/i });

  await expect(emailInput).toBeVisible({ timeout: 15_000 });
  await emailInput.fill(email);
  await passwordInput.fill(password);
  await submit.click();

  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 25_000 });
}
