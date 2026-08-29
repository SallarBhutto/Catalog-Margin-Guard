import { ArrowRight, CheckCircle2, LockKeyhole } from "lucide-react"

import { PageContainer } from "@/components/shared/page-container"
import { PrivacyNotice } from "@/components/shared/privacy-notice"
import { Button } from "@/components/ui/button"

type LandingPageProps = {
  onStart: () => void
}

const steps = [
  {
    number: "01",
    title: "Choose supplier costs",
    description: "Select the supplier file containing your current product costs.",
  },
  {
    number: "02",
    title: "Choose your catalog",
    description: "Select the catalog file containing your current selling prices.",
  },
  {
    number: "03",
    title: "See margin risk",
    description: "Review products selling below cost or below your target gross margin.",
  },
] as const

function LandingPage({ onStart }: LandingPageProps) {
  return (
    <>
      <main id="main-content">
        <section className="border-b border-border bg-background py-16 sm:py-20 lg:py-24">
          <PageContainer>
            <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)] lg:gap-20">
              <div>
                <p className="mb-4 text-[13px] leading-[18px] font-semibold tracking-[0.08em] text-brand uppercase">
                  Browser-local margin analysis
                </p>
                <h1 className="max-w-hero text-[34px] leading-10 font-bold tracking-[-0.035em] text-balance text-text-primary sm:text-[40px] sm:leading-12 lg:text-5xl lg:leading-14">
                  Find products quietly eating your margin.
                </h1>
                <p className="mt-6 max-w-copy text-base leading-[26px] text-text-secondary">
                  Compare your supplier costs with your current catalog, see your actual
                  gross margins, and identify products that need pricing review.
                </p>
                <div className="mt-8 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
                  <Button size="large" onClick={onStart}>
                    Check My Catalog
                    <ArrowRight aria-hidden="true" />
                  </Button>
                  <PrivacyNotice compact />
                </div>
              </div>

              <aside
                className="border-l-2 border-brand pl-6 sm:pl-8"
                aria-label="Privacy summary"
              >
                <LockKeyhole className="size-6 text-brand" aria-hidden="true" />
                <h2 className="mt-5 text-lg leading-7 font-semibold text-text-primary">
                  Private by design
                </h2>
                <p className="mt-2 text-sm leading-[22px] text-text-secondary">
                  Supplier pricing and catalog data stay in your browser. Catalog Margin
                  Guard does not upload or store your files.
                </p>
                <ul className="mt-6 grid gap-3 text-sm leading-[22px] text-text-secondary">
                  <li className="flex items-start gap-3">
                    <CheckCircle2
                      className="mt-0.5 size-4 shrink-0 text-brand"
                      aria-hidden="true"
                    />
                    No account required to start
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle2
                      className="mt-0.5 size-4 shrink-0 text-brand"
                      aria-hidden="true"
                    />
                    No catalog or supplier data upload
                  </li>
                </ul>
              </aside>
            </div>
          </PageContainer>
        </section>

        <section
          id="how-it-works"
          className="bg-surface py-16 sm:py-20"
          aria-labelledby="how-heading"
        >
          <PageContainer>
            <div className="max-w-copy">
              <p className="text-[13px] leading-[18px] font-semibold tracking-[0.08em] text-brand uppercase">
                How it works
              </p>
              <h2
                id="how-heading"
                className="mt-3 text-[28px] leading-9 font-semibold tracking-[-0.02em] text-text-primary"
              >
                From two files to a focused review.
              </h2>
              <p className="mt-3 text-base leading-[26px] text-text-secondary">
                Use the catalog data you already have. The analysis runs locally, with no
                integration or database connection required.
              </p>
            </div>

            <ol className="mt-10 grid border-y border-border md:grid-cols-3">
              {steps.map((step, index) => (
                <li
                  key={step.number}
                  className={`py-6 md:px-8 md:py-8 ${
                    index === 0
                      ? "md:pl-0"
                      : "border-t border-border md:border-t-0 md:border-l"
                  }`}
                >
                  <span className="text-xs leading-[18px] font-semibold tabular-nums text-brand">
                    {step.number}
                  </span>
                  <h3 className="mt-3 text-[15px] leading-[22px] font-semibold text-text-primary">
                    {step.title}
                  </h3>
                  <p className="mt-2 max-w-xs text-sm leading-[22px] text-text-secondary">
                    {step.description}
                  </p>
                </li>
              ))}
            </ol>
          </PageContainer>
        </section>

        <section
          id="privacy"
          className="bg-background py-16 sm:py-20"
          aria-labelledby="privacy-heading"
        >
          <PageContainer>
            <div className="grid gap-6 rounded-lg border border-brand-soft-border bg-brand-soft p-6 sm:p-8 md:grid-cols-[auto_1fr] md:gap-5 lg:p-10">
              <div className="flex size-10 items-center justify-center rounded-md border border-brand-soft-border bg-surface text-brand">
                <LockKeyhole className="size-5" aria-hidden="true" />
              </div>
              <div className="max-w-copy">
                <h2
                  id="privacy-heading"
                  className="text-lg leading-7 font-semibold text-text-primary"
                >
                  Your pricing data stays yours.
                </h2>
                <p className="mt-2 text-sm leading-[22px] text-text-secondary">
                  Supplier pricing and catalog data are processed locally inside your
                  browser and are never uploaded to Catalog Margin Guard. Refreshing the
                  browser resets the active analysis.
                </p>
              </div>
            </div>
          </PageContainer>
        </section>
      </main>

      <footer className="border-t border-border bg-surface py-6">
        <PageContainer className="flex flex-col gap-3 text-xs leading-[18px] text-text-muted sm:flex-row sm:items-center sm:justify-between">
          <p className="font-medium text-text-secondary">Catalog Margin Guard</p>
          <a
            href="#privacy"
            className="w-fit rounded-sm outline-none hover:text-text-primary focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
          >
            Privacy
          </a>
        </PageContainer>
      </footer>
    </>
  )
}

export { LandingPage }
