import { useEffect, useState } from "react"

import { AppHeader } from "@/components/shared/app-header"
import { LandingPage } from "@/features/landing/landing-page"
import { SetupShell } from "@/features/setup/setup-shell"

type AppRoute = "landing" | "setup"

function getRoute(pathname: string): AppRoute {
  return pathname === "/check" ? "setup" : "landing"
}

function App() {
  const [route, setRoute] = useState<AppRoute>(() => getRoute(window.location.pathname))

  useEffect(() => {
    const handlePopState = () => setRoute(getRoute(window.location.pathname))
    window.addEventListener("popstate", handlePopState)
    return () => window.removeEventListener("popstate", handlePopState)
  }, [])

  const navigate = (pathname: string) => {
    if (window.location.pathname !== pathname) window.history.pushState({}, "", pathname)
    setRoute(getRoute(pathname))
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
      <AppHeader onNavigateHome={() => navigate("/")} />
      {route === "landing" ? (
        <LandingPage onStart={() => navigate("/check")} />
      ) : (
        <SetupShell onBack={() => navigate("/")} />
      )}
    </div>
  )
}

export default App
