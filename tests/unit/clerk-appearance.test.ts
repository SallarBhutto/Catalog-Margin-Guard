import {
  clerkProviderAppearance,
  clerkProviderLocalization,
  clerkSignInAppearance,
} from "@/features/auth/clerk-appearance"

describe("Clerk appearance", () => {
  it("styles Clerk's native modal and preserves the local-data privacy message", () => {
    expect(clerkProviderAppearance.cssLayerName).toBe("clerk")
    expect(clerkSignInAppearance.elements.cardBox).toMatchObject({
      width: "100%",
      maxWidth: "28rem",
    })
    expect(clerkProviderLocalization.signIn.start.subtitleCombined).toContain(
      "remain on your computer and are not uploaded",
    )
    expect(clerkProviderLocalization.signUp.start.subtitleCombined).toContain(
      "remain on your computer and are not uploaded",
    )
  })
})
