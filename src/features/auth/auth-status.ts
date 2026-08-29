import type { AuthStatus } from "@/app/access-policy"

function resolveAuthStatus(
  isLoaded: boolean,
  isSignedIn: boolean | undefined,
): AuthStatus {
  if (!isLoaded) return "loading"
  return isSignedIn ? "authenticated" : "anonymous"
}

export { resolveAuthStatus }
