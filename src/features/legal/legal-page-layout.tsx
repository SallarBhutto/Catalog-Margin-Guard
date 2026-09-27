import type { ReactNode } from "react"

import { LEGAL_LAST_UPDATED } from "@/app/site-metadata"
import { PageContainer } from "@/components/shared/page-container"

type LegalPageLayoutProps = Readonly<{
  title: string
  summary: string
  children: ReactNode
}>

function LegalPageLayout({ title, summary, children }: LegalPageLayoutProps) {
  return (
    <main id="main-content" className="min-h-[calc(100svh-4rem)] py-10 sm:py-14">
      <PageContainer width="app">
        <article className="mx-auto max-w-copy">
          <h1 className="text-[28px] leading-9 font-semibold tracking-[-0.02em] text-text-primary">
            {title}
          </h1>
          <p className="mt-2 text-[13px] leading-[18px] text-text-muted">
            Last updated: {LEGAL_LAST_UPDATED}
          </p>
          <p className="mt-5 text-base leading-[26px] text-text-secondary">{summary}</p>
          <div className="mt-8 space-y-8 text-sm leading-[22px] text-text-secondary [&_h2]:text-lg [&_h2]:leading-7 [&_h2]:font-semibold [&_h2]:text-text-primary [&_p+p]:mt-3 [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:space-y-1.5 [&_ul]:pl-5 [&_a]:font-medium [&_a]:text-brand [&_a]:underline-offset-2 hover:[&_a]:underline">
            {children}
          </div>
        </article>
      </PageContainer>
    </main>
  )
}

export { LegalPageLayout }
