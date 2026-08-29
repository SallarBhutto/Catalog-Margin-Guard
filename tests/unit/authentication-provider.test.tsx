import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { AuthHeaderControl } from "@/features/auth/auth-header-control"
import { AuthenticationProvider } from "@/features/auth/authentication-provider"

describe("authentication provider", () => {
  it("keeps anonymous access available when Clerk is not configured", async () => {
    const user = userEvent.setup()

    render(
      <AuthenticationProvider>
        <AuthHeaderControl />
      </AuthenticationProvider>,
    )

    await user.click(screen.getByRole("button", { name: "Sign in" }))

    expect(
      screen.getByRole("heading", { name: "Sign in is not configured" }),
    ).toBeVisible()
    expect(
      screen.getByText("Signing in only creates your Catalog Margin Guard account."),
    ).toBeVisible()
    expect(
      screen.getByText(
        "Your supplier and catalog files remain on your computer and are not uploaded.",
      ),
    ).toBeVisible()
  })
})
