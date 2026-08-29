import { Component, type ReactNode } from "react"
import { CircleAlert } from "lucide-react"

import { Button } from "@/components/ui/button"
import { PageContainer } from "@/components/shared/page-container"

type Props = { children: ReactNode }
type State = { hasError: boolean }

class AppErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch() {
    // Intentionally avoid emitting potentially sensitive application state.
  }

  render() {
    if (!this.state.hasError) return this.props.children

    return (
      <main className="flex min-h-svh items-center py-16">
        <PageContainer width="app">
          <div className="mx-auto max-w-copy rounded-lg border border-loss-border bg-loss-soft p-6">
            <CircleAlert className="mb-4 size-6 text-loss" aria-hidden="true" />
            <h1 className="text-xl leading-7 font-semibold text-text-primary">
              Something went wrong.
            </h1>
            <p className="mt-2 text-sm leading-[22px] text-text-secondary">
              Reload the page to return to a safe starting point.
            </p>
            <Button className="mt-5" onClick={() => window.location.reload()}>
              Reload page
            </Button>
          </div>
        </PageContainer>
      </main>
    )
  }
}

export { AppErrorBoundary }
