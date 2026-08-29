import { render, screen } from "@testing-library/react"
import { useState } from "react"

import type { AuthStatus } from "@/app/access-policy"
import { AuthHeaderControl } from "@/features/auth/auth-header-control"
import { AuthStateProvider, useAccessCapabilities } from "@/features/auth/auth-context"

function AccessProbe() {
  const capabilities = useAccessCapabilities()
  const [analysisInstance] = useState(() => "active-analysis")

  return (
    <>
      <span>{analysisInstance}</span>
      <span>{capabilities.canViewFullResults ? "full results" : "preview results"}</span>
    </>
  )
}

function TestAuthState({ status }: { status: AuthStatus }) {
  return (
    <AuthStateProvider
      status={status}
      requestSignIn={() => undefined}
      accountMenu={<button type="button">User menu</button>}
    >
      <AuthHeaderControl />
      <AccessProbe />
    </AuthStateProvider>
  )
}

describe("application authentication boundary", () => {
  it("keeps restricted controls hidden while authentication loads", () => {
    render(<TestAuthState status="loading" />)

    expect(screen.getByLabelText("Checking account status")).toBeVisible()
    expect(screen.queryByRole("button", { name: "Sign in" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "User menu" })).not.toBeInTheDocument()
    expect(screen.getByText("preview results")).toBeVisible()
  })

  it("changes capabilities without remounting the application content", () => {
    const { rerender } = render(<TestAuthState status="anonymous" />)
    const analysisMarker = screen.getByText("active-analysis")

    expect(screen.getByText("preview results")).toBeVisible()

    rerender(<TestAuthState status="authenticated" />)

    expect(screen.getByText("full results")).toBeVisible()
    expect(screen.getByRole("button", { name: "User menu" })).toBeVisible()
    expect(screen.getByText("active-analysis")).toBe(analysisMarker)

    rerender(<TestAuthState status="anonymous" />)

    expect(screen.getByText("preview results")).toBeVisible()
    expect(screen.getByRole("button", { name: "Sign in" })).toBeVisible()
    expect(screen.getByText("active-analysis")).toBe(analysisMarker)
  })
})
