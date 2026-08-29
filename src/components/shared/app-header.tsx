import { Button } from "@/components/ui/button"
import { PageContainer } from "@/components/shared/page-container"

type AppHeaderProps = {
  onNavigateHome: () => void
}

function AppHeader({ onNavigateHome }: AppHeaderProps) {
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
        <Button
          type="button"
          variant="ghost"
          size="small"
          disabled
          title="Authentication will be added in a later implementation phase"
        >
          Sign in
        </Button>
      </PageContainer>
    </header>
  )
}

export { AppHeader }
