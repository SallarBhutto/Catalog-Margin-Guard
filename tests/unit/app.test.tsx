import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import App from "@/app/App"
import { AuthStateProvider } from "@/features/auth/auth-context"

function renderAnonymousApp(requestSignIn = () => undefined) {
  return render(
    <AuthStateProvider status="anonymous" requestSignIn={requestSignIn}>
      <App />
    </AuthStateProvider>,
  )
}

describe("application foundation", () => {
  beforeEach(() => {
    window.history.replaceState({}, "", "/")
  })

  it("presents the landing page value and privacy promise", () => {
    renderAnonymousApp()

    expect(
      screen.getByRole("heading", { name: "Find products quietly eating your margin." }),
    ).toBeVisible()
    expect(screen.getByRole("button", { name: "Check My Catalog" })).toBeEnabled()
    expect(screen.getAllByText("Files stay on your computer.").length).toBeGreaterThan(0)
    expect(screen.getByRole("button", { name: "Sign in" })).toBeEnabled()
  })

  it("moves to the initial setup shell without requiring sign in", async () => {
    const user = userEvent.setup()
    renderAnonymousApp()

    await user.click(screen.getByRole("button", { name: "Check My Catalog" }))

    expect(window.location.pathname).toBe("/check")
    expect(screen.getByRole("heading", { name: "Check your catalog" })).toBeVisible()
    expect(screen.getByText("Choose your files")).toBeVisible()
  })

  it("opens authentication from the secondary header action", async () => {
    const user = userEvent.setup()
    const requestSignIn = vi.fn()
    renderAnonymousApp(requestSignIn)

    await user.click(screen.getByRole("button", { name: "Sign in" }))

    expect(requestSignIn).toHaveBeenCalledOnce()
  })
})
