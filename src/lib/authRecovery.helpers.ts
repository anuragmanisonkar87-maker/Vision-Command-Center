export const PRODUCTION_APP_URL = "https://gwvvisioncenter.lovable.app";
export const PASSWORD_RESET_REDIRECT_URL = `${PRODUCTION_APP_URL}/reset-password`;

type RecoveryLocation = Pick<Location, "hash" | "search">;

export function hasRecoveryParams(location: RecoveryLocation): boolean {
  const hashParams = new URLSearchParams(location.hash.replace(/^#/, ""));
  const searchParams = new URLSearchParams(location.search.replace(/^\?/, ""));
  return [hashParams, searchParams].some((params) => {
    const type = params.get("type");
    return (
      type === "recovery" ||
      !!params.get("access_token") ||
      !!params.get("refresh_token") ||
      !!params.get("error_description") ||
      !!params.get("error")
    );
  });
}

export function getRecoveryForwardUrl(location: RecoveryLocation, targetPath = "/reset-password"): string | null {
  if (!hasRecoveryParams(location)) return null;
  return `${targetPath}${location.search}${location.hash}`;
}

export function getRecoveryUrlParams(location: RecoveryLocation): URLSearchParams {
  const hashParams = new URLSearchParams(location.hash.replace(/^#/, ""));
  const searchParams = new URLSearchParams(location.search.replace(/^\?/, ""));
  const merged = new URLSearchParams(searchParams);
  hashParams.forEach((value, key) => merged.set(key, value));
  return merged;
}