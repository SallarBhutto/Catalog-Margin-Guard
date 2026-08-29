import type { ReactNode } from "react"

import { PageContainer } from "@/components/shared/page-container"

type AppHeaderProps = {
  onNavigateHome: () => void
  accountControl: ReactNode
}

function AppHeader({ onNavigateHome, accountControl }: AppHeaderProps) {
  return (
    <header className="h-16 border-b border-border bg-surface" data-testid="app-header">
      <PageContainer className="flex h-full items-center justify-between gap-4">
        <a
          href="/"
          onClick={(event) => {
            event.preventDefault()
            onNavigateHome()
          }}
          className="rounded-sm text-[15px] font-semibold tracking-[-0.01em] text-text-primary outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
        >
          Catalog Margin Guard
        </a>
        {accountControl}
      </PageContainer>
    </header>
  )
}

export { AppHeader }
