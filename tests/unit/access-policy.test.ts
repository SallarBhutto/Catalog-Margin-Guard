import {
  ACCESS_LIMITS,
  getBoundedPreviewLimit,
  getAccessCapabilities,
  type AccessCapabilities,
} from "@/app/access-policy"

const anonymousCapabilities: AccessCapabilities = {
  canViewFullResults: false,
  canSearchFullResults: false,
  canPaginateFullResults: false,
  canExportResults: false,
  canUseManualOverrides: false,
  resultPreviewLimit: ACCESS_LIMITS.anonymousResultPreview,
}

describe("access policy", () => {
  it("applies anonymous capabilities while authentication is loading", () => {
    expect(getAccessCapabilities("loading")).toEqual(anonymousCapabilities)
  })

  it("limits anonymous users to the centralized result preview", () => {
    expect(ACCESS_LIMITS.anonymousResultPreview).toBe(20)
    expect(getAccessCapabilities("anonymous")).toEqual(anonymousCapabilities)
    expect(getBoundedPreviewLimit(anonymousCapabilities)).toBe(20)
  })

  it("unlocks every v0 capability for authenticated users", () => {
    const capabilities = getAccessCapabilities("authenticated")
    expect(capabilities).toEqual({
      canViewFullResults: true,
      canSearchFullResults: true,
      canPaginateFullResults: true,
      canExportResults: true,
      canUseManualOverrides: true,
      resultPreviewLimit: null,
    })
    expect(getBoundedPreviewLimit(capabilities)).toBe(20)
  })
})
