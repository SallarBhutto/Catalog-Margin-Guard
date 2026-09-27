import type { ReactNode } from "react"

import { ROUTE_PATHS, SITE_NAME } from "@/app/site-metadata"
import { AppLink } from "@/components/shared/app-link"
import { BrandMark } from "@/components/shared/brand-mark"
import { PageContainer } from "@/components/shared/page-container"
import { cn } from "@/lib/utils"

type AppHeaderProps = {
  currentPathname: string
  accountControl: ReactNode
}

const NAVIGATION = [
  { label: "How it works", href: "/#how-it-works" },
  { label: "Privacy", href: ROUTE_PATHS.privacy },
] as const

function AppHeader({ currentPathname, accountControl }: AppHeaderProps) {
  const onSetup = currentPathname === ROUTE_PATHS.setup

  return (
    <header className="h-16 border-b border-border bg-surface" data-testid="app-header">
      <PageContainer className="flex h-full items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-8">
          <AppLink
            href={ROUTE_PATHS.landing}
            className="flex shrink-0 items-center gap-2.5 text-[15px] font-semibold tracking-[-0.01em] text-text-primary"
            aria-label={`${SITE_NAME} home`}
          >
            <BrandMark className="text-brand" />
            <span className="truncate">{SITE_NAME}</span>
          </AppLink>
          <nav aria-label="Site" className="hidden md:block">
            <ul className="flex items-center gap-6 text-sm font-medium">
              {NAVIGATION.map((item) => (
                <li key={item.href}>
                  <AppLink
                    href={item.href}
                    className="text-text-secondary hover:text-text-primary"
                    aria-current={currentPathname === item.href ? "page" : undefined}
                  >
                    {item.label}
                  </AppLink>
                </li>
              ))}
              {!onSetup && (
                <li>
                  <AppLink
                    href={ROUTE_PATHS.setup}
                    className={cn(
                      "inline-flex h-9 items-center rounded-md border border-border-strong bg-surface px-3 text-[13px] font-semibold text-text-primary hover:bg-surface-hover",
                    )}
                  >
                    Check my catalog
                  </AppLink>
                </li>
              )}
            </ul>
          </nav>
        </div>
        {accountControl}
      </PageContainer>
    </header>
  )
}

export { AppHeader }
