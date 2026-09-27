import { SUPPORT_EMAIL } from "@/app/site-metadata"
import { LegalPageLayout } from "@/features/legal/legal-page-layout"

function PrivacyPage() {
  return (
    <LegalPageLayout
      title="Privacy Policy"
      summary="Catalog Margin Guard analyzes your supplier and catalog files inside your browser. This policy explains what stays on your computer, what leaves it, and who processes it."
    >
      <section>
        <h2>Your files stay on your computer</h2>
        <p>
          When you choose a supplier file or a catalog file, it is read by the application
          running in your browser and analyzed there. The file contents, product
          identifiers, costs, prices, margins, column names, and results are not uploaded
          to Catalog Margin Guard and are not stored by us. We do not have a server that
          receives them.
        </p>
        <p>
          The active analysis exists only in your browser's memory for the current page
          session. Refreshing or closing the page, or choosing Start New Scan, clears it.
          Manual target overrides you set during a session are cleared when you sign out
          or start a new scan. Reports you download are created in your browser and saved
          where you choose.
        </p>
      </section>

      <section>
        <h2>Account information (Clerk)</h2>
        <p>
          Signing in is optional and is only needed to view product-level results, set
          manual targets, and download reports. Accounts are provided by Clerk, which
          processes the information you give it to create and sign in to your account,
          such as your email address or the identity returned by a sign-in provider, along
          with session and security data. Clerk's handling of that information is
          described in Clerk's own privacy policy. Your supplier and catalog data are
          never sent to Clerk.
        </p>
      </section>

      <section>
        <h2>Google sign-in</h2>
        <p>
          If you choose "Continue with Google", Google processes your sign-in under its
          own terms and privacy policy and shares basic profile information, such as your
          email address, with Clerk to create your account. You can use an email address
          instead.
        </p>
      </section>

      <section>
        <h2>Hosting (Cloudflare)</h2>
        <p>
          The site is hosted and delivered by Cloudflare. Like any web host, Cloudflare
          may process ordinary request and security information, such as your IP address,
          browser type, and requested pages, to serve the site and protect it from abuse.
          Catalog Margin Guard does not receive your files through this hosting.
        </p>
      </section>

      <section>
        <h2>Analytics, advertising, and cookies</h2>
        <p>
          Catalog Margin Guard does not use analytics, advertising, or tracking services
          and does not set advertising or tracking cookies. The only cookies and browser
          storage in use are the ones Clerk needs to keep you signed in when you choose to
          sign in. We do not sell your catalog data or any other personal information.
        </p>
      </section>

      <section>
        <h2>Contact</h2>
        <p>
          Questions about this policy or your account can be sent to{" "}
          <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>. If this policy changes,
          the date at the top of this page will be updated.
        </p>
      </section>
    </LegalPageLayout>
  )
}

export { PrivacyPage }
