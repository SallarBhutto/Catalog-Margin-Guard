import { act, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import App from "@/app/App"
import { navigateTo, replaceRoute } from "@/app/app-router"
import { DOCUMENT_TITLES, getRoute } from "@/app/site-metadata"
import { AuthStateProvider } from "@/features/auth/auth-context"

function renderApp(
  status: "anonymous" | "authenticated" = "anonymous",
  requestSignIn = () => undefined,
) {
  return render(
    <AuthStateProvider
      status={status}
      requestSignIn={requestSignIn}
      accountMenu={<button type="button">Open account menu</button>}
    >
      <App />
    </AuthStateProvider>,
  )
}

describe("application foundation", () => {
  beforeEach(() => {
    window.history.replaceState({}, "", "/")
  })

  it("presents the landing page value, trust line, and privacy promise", () => {
    renderApp()

    expect(
      screen.getByRole("heading", { name: "Find products quietly eating your margin." }),
    ).toBeVisible()
    expect(screen.getByRole("link", { name: "Check My Catalog — Free" })).toHaveAttribute(
      "href",
      "/check",
    )
    expect(screen.getByText(/No file upload\. No credit card required\./)).toBeVisible()
    expect(screen.getByRole("button", { name: "Sign in" })).toBeEnabled()
    expect(document.title).toBe(DOCUMENT_TITLES.landing)
  })

  it("moves to the setup shell client-side without requiring sign in", async () => {
    const user = userEvent.setup()
    const pushState = vi.spyOn(window.history, "pushState")
    renderApp()

    await user.click(screen.getByRole("link", { name: "Check My Catalog — Free" }))

    expect(window.location.pathname).toBe("/check")
    expect(pushState).toHaveBeenCalledOnce()
    expect(screen.getByRole("heading", { name: "Check your catalog" })).toBeVisible()
    expect(document.title).toBe(DOCUMENT_TITLES.setup)
    // Privacy, Terms, and Support stay reachable during the workflow.
    expect(screen.getByTestId("site-footer")).toBeInTheDocument()
    pushState.mockRestore()
  })

  it("routes /privacy and /terms, with trailing slashes, and falls back to the landing page", () => {
    expect(getRoute("/privacy")).toBe("privacy")
    expect(getRoute("/terms/")).toBe("terms")
    expect(getRoute("/check")).toBe("setup")
    expect(getRoute("/")).toBe("landing")
    expect(getRoute("/unknown")).toBe("landing")

    window.history.replaceState({}, "", "/privacy")
    renderApp()
    expect(screen.getByRole("heading", { name: "Privacy Policy" })).toBeVisible()
    expect(screen.getByText("Last updated: September 2026")).toBeVisible()
    expect(document.title).toBe(DOCUMENT_TITLES.privacy)

    act(() => navigateTo("/terms"))
    expect(screen.getByRole("heading", { name: "Terms of Service" })).toBeVisible()
    expect(document.title).toBe(DOCUMENT_TITLES.terms)
  })

  it("keeps the header to the brand link and account control, with legal links in the footer", () => {
    renderApp()
    const header = screen.getByTestId("app-header")

    expect(
      within(header).getByRole("link", { name: "Catalog Margin Guard home" }),
    ).toHaveAttribute("href", "/")
    expect(within(header).queryByRole("navigation")).not.toBeInTheDocument()
    expect(within(header).getAllByRole("link")).toHaveLength(1)
    for (const removed of ["How it works", "Privacy", "Check my catalog"]) {
      expect(
        within(header).queryByRole("link", { name: removed }),
      ).not.toBeInTheDocument()
    }

    const footer = screen.getByTestId("site-footer")
    const legal = within(footer).getByRole("navigation", { name: "Legal and support" })
    expect(within(legal).getByRole("link", { name: "Privacy Policy" })).toHaveAttribute(
      "href",
      "/privacy",
    )
    expect(within(legal).getByRole("link", { name: "Terms" })).toHaveAttribute(
      "href",
      "/terms",
    )
    expect(within(legal).getByRole("link", { name: "Support" })).toHaveAttribute(
      "href",
      "mailto:support@catalogmarginguard.com",
    )
    expect(within(footer).getByText("© 2026 Catalog Margin Guard")).toBeVisible()
    expect(within(footer).getByText(/runs locally in your browser/)).toBeVisible()
    expect(
      within(footer).queryByRole("link", { name: /twitter|linkedin|facebook|x\.com/i }),
    ).not.toBeInTheDocument()
  })

  it("labels the signed-in account control", () => {
    renderApp("authenticated")
    const control = screen.getByTestId("account-control")
    expect(within(control).getByText("Account")).toBeInTheDocument()
    expect(
      within(control).getByRole("button", { name: "Open account menu" }),
    ).toBeVisible()
    expect(screen.queryByRole("button", { name: "Sign in" })).not.toBeInTheDocument()
  })

  it("updates the canonical link and og:url in place on every route change", () => {
    // index.html ships the homepage values; the test document starts with them too.
    document.head.innerHTML =
      '<link rel="canonical" href="https://catalogmarginguard.com/" />' +
      '<meta property="og:url" content="https://catalogmarginguard.com/" />'
    const canonical = () => document.head.querySelectorAll('link[rel="canonical"]')
    const ogUrl = () => document.head.querySelectorAll('meta[property="og:url"]')

    renderApp()
    expect(canonical()[0]).toHaveAttribute("href", "https://catalogmarginguard.com/")

    for (const [path, expected] of [
      ["/check", "https://catalogmarginguard.com/check"],
      ["/privacy", "https://catalogmarginguard.com/privacy"],
      ["/terms", "https://catalogmarginguard.com/terms"],
      ["/", "https://catalogmarginguard.com/"],
      ["/privacy", "https://catalogmarginguard.com/privacy"],
    ] as const) {
      act(() => navigateTo(path))
      expect(canonical()).toHaveLength(1)
      expect(ogUrl()).toHaveLength(1)
      expect(canonical()[0]).toHaveAttribute("href", expected)
      expect(ogUrl()[0]).toHaveAttribute("content", expected)
    }
    expect(document.title).toBe(DOCUMENT_TITLES.privacy)
  })

  it("creates the canonical link and og:url once when rendering a route directly", () => {
    document.head.innerHTML = ""
    window.history.replaceState({}, "", "/terms")

    const view = renderApp()
    view.rerender(
      <AuthStateProvider status="anonymous" requestSignIn={() => undefined}>
        <App />
      </AuthStateProvider>,
    )

    expect(document.head.querySelectorAll('link[rel="canonical"]')).toHaveLength(1)
    expect(document.head.querySelectorAll('meta[property="og:url"]')).toHaveLength(1)
    expect(document.head.querySelector('link[rel="canonical"]')).toHaveAttribute(
      "href",
      "https://catalogmarginguard.com/terms",
    )
    expect(document.head.querySelector('meta[property="og:url"]')).toHaveAttribute(
      "content",
      "https://catalogmarginguard.com/terms",
    )
  })

  it("follows external client-side route changes without remounting the application", () => {
    renderApp()
    const header = screen.getByTestId("app-header")

    act(() => navigateTo("/check"))
    expect(screen.getByRole("heading", { name: "Check your catalog" })).toBeVisible()
    expect(screen.getByTestId("app-header")).toBe(header)

    const setupHeading = screen.getByRole("heading", { name: "Check your catalog" })
    act(() => navigateTo("/check"))
    expect(screen.getByRole("heading", { name: "Check your catalog" })).toBe(setupHeading)

    act(() => replaceRoute("/"))
    expect(
      screen.getByRole("heading", { name: "Find products quietly eating your margin." }),
    ).toBeVisible()
    expect(screen.getByTestId("app-header")).toBe(header)
  })

  it("follows browser history traversal", () => {
    window.history.replaceState({}, "", "/check")
    renderApp()
    expect(screen.getByRole("heading", { name: "Check your catalog" })).toBeVisible()

    window.history.replaceState({}, "", "/")
    act(() => {
      window.dispatchEvent(new PopStateEvent("popstate"))
    })

    expect(
      screen.getByRole("heading", { name: "Find products quietly eating your margin." }),
    ).toBeVisible()
  })

  it("opens authentication from the secondary header action", async () => {
    const user = userEvent.setup()
    const requestSignIn = vi.fn()
    renderApp("anonymous", requestSignIn)

    await user.click(screen.getByRole("button", { name: "Sign in" }))

    expect(requestSignIn).toHaveBeenCalledOnce()
  })
})
