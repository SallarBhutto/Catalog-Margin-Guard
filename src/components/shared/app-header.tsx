import type { ReactNode } from "react"

import { ROUTE_PATHS, SITE_NAME } from "@/app/site-metadata"
import { AppLink } from "@/components/shared/app-link"
import { BrandMark } from "@/components/shared/brand-mark"
import { PageContainer } from "@/components/shared/page-container"

type AppHeaderProps = {
  accountControl: ReactNode
}

/**
 * One compact bar on every route: the brand linking home and the account control. The
 * homepage carries the workflow entry point and the footer carries the legal links, so the
 * header needs no further navigation.
 */
function AppHeader({ accountControl }: AppHeaderProps) {
  return (
    <header className="h-16 border-b border-border bg-surface" data-testid="app-header">
      <PageContainer className="flex h-full items-center justify-between gap-4">
        <AppLink
          href={ROUTE_PATHS.landing}
          className="flex min-w-0 items-center gap-2.5 text-[15px] font-semibold tracking-[-0.01em] text-text-primary"
          aria-label={`${SITE_NAME} home`}
        >
          <BrandMark className="text-brand" />
          <span className="truncate">{SITE_NAME}</span>
        </AppLink>
        {accountControl}
      </PageContainer>
    </header>
  )
}

export { AppHeader }
