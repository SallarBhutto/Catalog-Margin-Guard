import { getAccessCapabilities, type AccessCapabilities } from "@/app/access-policy"

const anonymousCapabilities: AccessCapabilities = {
  canViewFullResults: false,
  canSearchFullResults: false,
  canPaginateFullResults: false,
  canExportResults: false,
  canUseManualOverrides: false,
}

describe("access policy", () => {
  it("applies anonymous capabilities while authentication is loading", () => {
    expect(getAccessCapabilities("loading")).toEqual(anonymousCapabilities)
  })

  it("locks product-level results for anonymous users", () => {
    expect(getAccessCapabilities("anonymous")).toEqual(anonymousCapabilities)
  })

  it("unlocks every v0 capability for authenticated users", () => {
    const capabilities = getAccessCapabilities("authenticated")
    expect(capabilities).toEqual({
      canViewFullResults: true,
      canSearchFullResults: true,
      canPaginateFullResults: true,
      canExportResults: true,
      canUseManualOverrides: true,
    })
  })
})
