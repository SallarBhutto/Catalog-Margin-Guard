import { useEffect, useSyncExternalStore } from "react"

import { getCurrentPathname, subscribeToRoute } from "@/app/app-router"
import { DOCUMENT_TITLES, getRoute } from "@/app/site-metadata"
import { AppHeader } from "@/components/shared/app-header"
import { SiteFooter } from "@/components/shared/site-footer"
import { AuthHeaderControl } from "@/features/auth/auth-header-control"
import { LandingPage } from "@/features/landing/landing-page"
import { PrivacyPage } from "@/features/legal/privacy-page"
import { TermsPage } from "@/features/legal/terms-page"
import { SetupShell } from "@/features/setup/setup-shell"

function App() {
  const pathname = useSyncExternalStore(
    subscribeToRoute,
    getCurrentPathname,
    getCurrentPathname,
  )
  const route = getRoute(pathname)

  useEffect(() => {
    document.title = DOCUMENT_TITLES[route]
  }, [route])

  return (
    <div className="flex min-h-svh flex-col bg-background text-text-primary">
      <a
        href="#main-content"
        className="fixed top-2 left-2 z-[100] -translate-y-16 rounded-md bg-text-primary px-4 py-2 text-sm font-semibold text-white transition-transform focus:translate-y-0"
      >
        Skip to main content
      </a>
      <AppHeader currentPathname={pathname} accountControl={<AuthHeaderControl />} />
      <div className="flex-1">
        {route === "setup" ? (
          <SetupShell />
        ) : route === "privacy" ? (
          <PrivacyPage />
        ) : route === "terms" ? (
          <TermsPage />
        ) : (
          <LandingPage />
        )}
      </div>
      {route !== "setup" && <SiteFooter />}
    </div>
  )
}

export default App
