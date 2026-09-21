export type AuthStatus = "loading" | "anonymous" | "authenticated"

export type AccessLevel = "anonymous" | "authenticated"

export type AccessCapabilities = {
  readonly canViewFullResults: boolean
  readonly canSearchFullResults: boolean
  readonly canPaginateFullResults: boolean
  readonly canExportResults: boolean
  readonly canUseManualOverrides: boolean
}

const ACCESS_CAPABILITIES: Readonly<Record<AccessLevel, AccessCapabilities>> = {
  anonymous: {
    canViewFullResults: false,
    canSearchFullResults: false,
    canPaginateFullResults: false,
    canExportResults: false,
    canUseManualOverrides: false,
  },
  authenticated: {
    canViewFullResults: true,
    canSearchFullResults: true,
    canPaginateFullResults: true,
    canExportResults: true,
    canUseManualOverrides: true,
  },
}

function getAccessLevel(authStatus: AuthStatus): AccessLevel {
  // Loading intentionally receives the safest policy so restricted UI cannot flash.
  return authStatus === "authenticated" ? "authenticated" : "anonymous"
}

function getAccessCapabilities(authStatus: AuthStatus): AccessCapabilities {
  return ACCESS_CAPABILITIES[getAccessLevel(authStatus)]
}

export { getAccessCapabilities }
