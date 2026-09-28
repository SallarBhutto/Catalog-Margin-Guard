import { AppLink } from "@/components/shared/app-link"
import { PageContainer } from "@/components/shared/page-container"
import { ROUTE_PATHS, SITE_NAME, SUPPORT_EMAIL } from "@/app/site-metadata"

const linkClassName =
  "w-fit rounded-sm text-text-secondary outline-none hover:text-text-primary focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"

function SiteFooter() {
  return (
    <footer className="border-t border-border bg-surface py-8" data-testid="site-footer">
      <PageContainer className="flex flex-col gap-6 text-xs leading-[18px] text-text-muted md:flex-row md:items-start md:justify-between">
        <div className="max-w-copy">
          <p className="text-[13px] font-semibold text-text-primary">{SITE_NAME}</p>
          <p className="mt-1">
            Margin analysis that runs locally in your browser. Supplier and catalog files
            are never uploaded.
          </p>
        </div>
        <nav aria-label="Legal and support">
          <ul className="flex flex-wrap gap-x-6 gap-y-2 text-[13px]">
            <li>
              <AppLink href={ROUTE_PATHS.privacy} className={linkClassName}>
                Privacy Policy
              </AppLink>
            </li>
            <li>
              <AppLink href={ROUTE_PATHS.terms} className={linkClassName}>
                Terms
              </AppLink>
            </li>
            <li>
              <a href={`mailto:${SUPPORT_EMAIL}`} className={linkClassName}>
                Support
              </a>
            </li>
          </ul>
          <p className="mt-4">© 2026 {SITE_NAME}</p>
        </nav>
      </PageContainer>
    </footer>
  )
}

export { SiteFooter }
