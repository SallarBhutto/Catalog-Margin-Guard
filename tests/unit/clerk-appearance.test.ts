import {
  clerkProviderAppearance,
  clerkSignInAppearance,
} from "@/features/auth/clerk-appearance"

describe("Clerk appearance", () => {
  it("integrates the prebuilt sign-in form into the application dialog", () => {
    expect(clerkProviderAppearance.cssLayerName).toBe("clerk")
    expect(clerkSignInAppearance.elements.header).toEqual({ display: "none" })
    expect(clerkSignInAppearance.elements.cardBox).toMatchObject({
      border: 0,
      borderRadius: 0,
      boxShadow: "none",
    })
    expect(clerkSignInAppearance.elements.card).toMatchObject({
      padding: 0,
      border: 0,
      borderRadius: 0,
      background: "transparent",
      boxShadow: "none",
    })
  })
})
