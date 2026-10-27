import { describe, expect, it } from "vitest";
import fs from "node:fs";
import {
  getRecoveryForwardUrl,
  getRecoveryUrlParams,
  PASSWORD_RESET_REDIRECT_URL,
} from "@/lib/authRecovery.helpers";

describe("auth recovery routing", () => {
  it("keeps reset/setup emails on the production reset-password route", () => {
    expect(PASSWORD_RESET_REDIRECT_URL).toBe("https://gwvvisioncenter.lovable.app/reset-password");

    const accessFunctions = fs.readFileSync("src/lib/userAccess.functions.ts", "utf8");
    expect(accessFunctions).toContain("PASSWORD_RESET_REDIRECT_URL");
    expect(accessFunctions).not.toContain("originFromRequest");
    expect(accessFunctions).not.toContain("/dashboard`;");
    expect(accessFunctions).not.toContain("/login`;");
  });

  it("forwards /login hash recovery links to /reset-password without dropping tokens", () => {
    const url = getRecoveryForwardUrl({
      search: "",
      hash: "#type=recovery&access_token=abc&refresh_token=def",
    } as Location);

    expect(url).toBe("/reset-password#type=recovery&access_token=abc&refresh_token=def");
  });

  it("forwards /login query recovery links to /reset-password without dropping params", () => {
    const url = getRecoveryForwardUrl({
      search: "?type=recovery&error_description=expired",
      hash: "",
    } as Location);

    expect(url).toBe("/reset-password?type=recovery&error_description=expired");
  });

  it("reads recovery tokens from query and hash, preferring hash values", () => {
    const params = getRecoveryUrlParams({
      search: "?type=recovery&access_token=query-token",
      hash: "#access_token=hash-token&refresh_token=refresh-token",
    } as Location);

    expect(params.get("type")).toBe("recovery");
    expect(params.get("access_token")).toBe("hash-token");
    expect(params.get("refresh_token")).toBe("refresh-token");
  });

  it("keeps /reset-password public and shows an invalid-link state without auth", () => {
    const rootRoute = fs.readFileSync("src/routes/__root.tsx", "utf8");
    const resetRoute = fs.readFileSync("src/routes/reset-password.tsx", "utf8");

    expect(rootRoute).toContain('pathname === "/reset-password"');
    expect(resetRoute).toContain('setStatus("invalid")');
    expect(resetRoute).toContain("This setup link is invalid or expired");
    expect(resetRoute).not.toContain("getSession()");
  });

  it("keeps public signup hidden from the login page", () => {
    const loginRoute = fs.readFileSync("src/routes/login.tsx", "utf8");
    expect(loginRoute).toContain("Please contact your administrator for login access");
    expect(loginRoute).not.toMatch(/signUp\(/);
    expect(loginRoute).not.toMatch(/create account/i);
  });
});