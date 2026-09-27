import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ReactNode } from "react"

import { getCurrentPathname } from "@/app/app-router"
import { AuthHeaderControl } from "@/features/auth/auth-header-control"
import { useAuthState } from "@/features/auth/auth-context"
import { AuthenticationProvider } from "@/features/auth/authentication-provider"
import {
  clerkProviderLocalization,
  clerkSignInAppearance,
} from "@/features/auth/clerk-appearance"

type RouterFn = (to: string) => unknown
type CapturedProviderProps = {
  routerPush?: RouterFn
  routerReplace?: RouterFn
  afterSignOutUrl?: string
  children?: ReactNode
}
type CapturedUserButtonProps = {
  appearance?: { elements?: Record<string, unknown> }
  children?: ReactNode
}
type MenuActionProps = {
  label: string
  labelIcon?: ReactNode
  onClick?: () => void
}

const clerkMocks = vi.hoisted(() => ({
  closeSignIn: vi.fn(),
  openSignIn: vi.fn(),
  signOut: vi.fn<(...args: unknown[]) => Promise<void>>(() => Promise.resolve()),
  auth: {
    isLoaded: true,
    isSignedIn: false,
  },
  eligibleForTouch: false,
  providerProps: null as CapturedProviderProps | null,
  userButtonProps: null as CapturedUserButtonProps | null,
}))

vi.mock("@clerk/react", () => {
  const MenuItems = ({ children }: { children?: ReactNode }) => <>{children}</>
  const Action = ({ label, labelIcon, onClick }: MenuActionProps) =>
    onClick ? (
      <button type="button" onClick={onClick}>
        {labelIcon}
        {label}
      </button>
    ) : (
      <span>{`built-in:${label}`}</span>
    )
  const UserButton = Object.assign(
    (props: CapturedUserButtonProps) => {
      clerkMocks.userButtonProps = props
      return <div data-testid="account-menu">{props.children}</div>
    },
    { MenuItems, Action },
  )

  return {
    ClerkProvider: (props: CapturedProviderProps) => {
      clerkMocks.providerProps = props
      return props.children
    },
    UserButton,
    useAuth: () => clerkMocks.auth,
    useClerk: () => ({
      loaded: clerkMocks.auth.isLoaded,
      client: { isEligibleForTouch: () => clerkMocks.eligibleForTouch },
      closeSignIn: clerkMocks.closeSignIn,
      openSignIn: clerkMocks.openSignIn,
      signOut: clerkMocks.signOut,
    }),
  }
})

function renderConfiguredProvider() {
  return render(
    <AuthenticationProvider publishableKey="pk_test_configured">
      <AuthHeaderControl />
    </AuthenticationProvider>,
  )
}

describe("authentication provider", () => {
  beforeEach(() => {
    window.history.replaceState({}, "", "/")
    clerkMocks.auth.isLoaded = true
    clerkMocks.auth.isSignedIn = false
    clerkMocks.closeSignIn.mockReset()
    clerkMocks.openSignIn.mockReset()
    clerkMocks.signOut.mockClear()
    clerkMocks.providerProps = null
    clerkMocks.userButtonProps = null
    clerkMocks.eligibleForTouch = false
  })

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

  it("opens Clerk's in-context modal with the initiating location as the redirect fallback", async () => {
    const user = userEvent.setup()
    window.history.replaceState({}, "", "/check")

    renderConfiguredProvider()
    await user.click(screen.getByRole("button", { name: "Sign in" }))

    expect(clerkMocks.openSignIn).toHaveBeenCalledWith({
      appearance: clerkSignInAppearance,
      oauthFlow: "popup",
      withSignUp: true,
      fallbackRedirectUrl: "/check",
      signUpFallbackRedirectUrl: "/check",
    })
    expect(clerkMocks.openSignIn).toHaveBeenCalledTimes(1)
    expect(clerkProviderLocalization.signIn.start.title).toBe("Sign in free")
    expect(clerkProviderLocalization.signUp.start.title).toBe("Create your free account")
  })

  it("keeps sign-in from the landing page on the landing page", async () => {
    const user = userEvent.setup()

    renderConfiguredProvider()
    await user.click(screen.getByRole("button", { name: "Sign in" }))

    expect(clerkMocks.openSignIn).toHaveBeenCalledWith(
      expect.objectContaining({
        fallbackRedirectUrl: "/",
        signUpFallbackRedirectUrl: "/",
      }),
    )
  })

  it("hands Clerk client-side routerPush and routerReplace callbacks", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined)
    const pushState = vi.spyOn(window.history, "pushState")
    const replaceState = vi.spyOn(window.history, "replaceState")

    renderConfiguredProvider()
    const props = clerkMocks.providerProps
    expect(props?.routerPush).toEqual(expect.any(Function))
    expect(props?.routerReplace).toEqual(expect.any(Function))

    props?.routerPush?.("/check")
    expect(pushState).toHaveBeenCalledWith({}, "", "http://localhost:3000/check")
    expect(getCurrentPathname()).toBe("/check")

    pushState.mockClear()
    props?.routerPush?.("/check")
    expect(pushState).not.toHaveBeenCalled()

    props?.routerReplace?.("/")
    expect(replaceState).toHaveBeenCalledWith({}, "", "http://localhost:3000/")
    expect(getCurrentPathname()).toBe("/")

    // jsdom logs "Not implemented: navigation" when anything assigns location.href.
    expect(consoleError).not.toHaveBeenCalled()
    consoleError.mockRestore()
    pushState.mockRestore()
    replaceState.mockRestore()
  })

  it("signs out without any Clerk navigation through the application's own menu action", async () => {
    const user = userEvent.setup()
    const pushState = vi.spyOn(window.history, "pushState")
    const replaceState = vi.spyOn(window.history, "replaceState")
    clerkMocks.auth.isSignedIn = true
    window.history.replaceState({}, "", "/check")
    replaceState.mockClear()

    renderConfiguredProvider()

    expect(clerkMocks.providerProps?.afterSignOutUrl).toBeUndefined()
    // A style object, not a utility class: `@layer clerk` outranks Tailwind utilities.
    expect(
      clerkMocks.userButtonProps?.appearance?.elements
        ?.userButtonPopoverActionButton__signOut,
    ).toEqual({ display: "none" })
    expect(screen.getByText("built-in:manageAccount")).toBeInTheDocument()
    expect(screen.getAllByRole("button", { name: "Sign out" })).toHaveLength(1)

    await user.click(screen.getByRole("button", { name: "Sign out" }))

    // Clerk runs a supplied callback instead of navigating, so no redirect is passed.
    expect(clerkMocks.signOut).toHaveBeenCalledTimes(1)
    const signOutArguments = clerkMocks.signOut.mock.calls[0] ?? []
    expect(signOutArguments).toHaveLength(1)
    const callback = signOutArguments[0] as () => unknown
    expect(callback).toEqual(expect.any(Function))
    expect(callback()).toBeUndefined()
    expect(pushState).not.toHaveBeenCalled()
    expect(replaceState).not.toHaveBeenCalled()
    expect(window.location.pathname).toBe("/check")
    pushState.mockRestore()
    replaceState.mockRestore()
  })

  it("handles a rejected Clerk sign-out without an unhandled rejection", async () => {
    const user = userEvent.setup()
    const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => undefined)
    clerkMocks.auth.isSignedIn = true
    clerkMocks.signOut.mockRejectedValueOnce(new Error("sign-out rejected"))

    renderConfiguredProvider()
    await user.click(screen.getByRole("button", { name: "Sign out" }))
    await Promise.resolve()

    expect(clerkMocks.signOut).toHaveBeenCalledTimes(1)
    expect(consoleWarn).toHaveBeenCalledWith(
      "[Catalog Margin Guard] Sign-out did not complete.",
    )
    expect(screen.getByRole("button", { name: "Sign out" })).toBeVisible()
    consoleWarn.mockRestore()
  })

  it("exposes whether Clerk will reload the page on sign-in from its public client API", () => {
    function Probe() {
      const { signInWillReloadPage } = useAuthState()
      return <span>{signInWillReloadPage ? "reloads" : "stays"}</span>
    }
    const view = render(
      <AuthenticationProvider publishableKey="pk_test_configured">
        <Probe />
      </AuthenticationProvider>,
    )
    expect(screen.getByText("stays")).toBeInTheDocument()

    clerkMocks.eligibleForTouch = true
    view.rerender(
      <AuthenticationProvider publishableKey="pk_test_configured">
        <Probe />
      </AuthenticationProvider>,
    )
    expect(screen.getByText("reloads")).toBeInTheDocument()

    // Never reported for a signed-in user: there is no sign-in to warn about.
    clerkMocks.auth.isSignedIn = true
    view.rerender(
      <AuthenticationProvider publishableKey="pk_test_configured">
        <Probe />
      </AuthenticationProvider>,
    )
    expect(screen.getByText("stays")).toBeInTheDocument()
  })

  it("closes the Clerk modal when its session transition authenticates", () => {
    const view = renderConfiguredProvider()

    expect(clerkMocks.closeSignIn).not.toHaveBeenCalled()

    clerkMocks.auth.isSignedIn = true
    view.rerender(
      <AuthenticationProvider publishableKey="pk_test_configured">
        <AuthHeaderControl />
      </AuthenticationProvider>,
    )

    expect(clerkMocks.closeSignIn).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId("account-menu")).toBeVisible()
  })
})
