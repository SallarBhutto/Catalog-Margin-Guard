import { useSyncExternalStore } from "react"

import { getCurrentPathname, navigateTo, subscribeToRoute } from "@/app/app-router"
import { AppHeader } from "@/components/shared/app-header"
import { AuthHeaderControl } from "@/features/auth/auth-header-control"
import { LandingPage } from "@/features/landing/landing-page"
import { SetupShell } from "@/features/setup/setup-shell"

type AppRoute = "landing" | "setup"

function getRoute(pathname: string): AppRoute {
  return pathname === "/check" ? "setup" : "landing"
}

function App() {
  const pathname = useSyncExternalStore(
    subscribeToRoute,
    getCurrentPathname,
    getCurrentPathname,
  )
  const route = getRoute(pathname)

  const navigate = (nextPathname: string) => {
    navigateTo(nextPathname)
    window.scrollTo({ top: 0, behavior: "auto" })
  }

  return (
    <div className="min-h-svh bg-background text-text-primary">
      <a
        href="#main-content"
        className="fixed top-2 left-2 z-[100] -translate-y-16 rounded-md bg-text-primary px-4 py-2 text-sm font-semibold text-white transition-transform focus:translate-y-0"
      >
        Skip to main content
      </a>
      <AppHeader
        onNavigateHome={() => navigate("/")}
        accountControl={<AuthHeaderControl />}
      />
      {route === "landing" ? (
        <LandingPage onStart={() => navigate("/check")} />
      ) : (
        <SetupShell onBack={() => navigate("/")} />
      )}
    </div>
  )
}

export default App
