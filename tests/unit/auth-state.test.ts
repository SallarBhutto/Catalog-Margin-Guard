import { resolveAuthStatus } from "@/features/auth/auth-status"

describe("authentication state", () => {
  it("models loading, anonymous, and authenticated states explicitly", () => {
    expect(resolveAuthStatus(false, undefined)).toBe("loading")
    expect(resolveAuthStatus(true, false)).toBe("anonymous")
    expect(resolveAuthStatus(true, true)).toBe("authenticated")
  })
})
