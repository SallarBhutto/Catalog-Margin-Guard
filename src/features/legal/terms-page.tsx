import { SUPPORT_EMAIL } from "@/app/site-metadata"
import { LegalPageLayout } from "@/features/legal/legal-page-layout"

function TermsPage() {
  return (
    <LegalPageLayout
      title="Terms of Service"
      summary="These terms apply when you use Catalog Margin Guard. They are short because the service is simple: it helps you review margins on data you already have."
    >
      <section>
        <h2>What the service does</h2>
        <p>
          Catalog Margin Guard compares supplier costs with catalog selling prices and
          reports gross margin, target margin, status, and the price needed to reach a
          target. It is an analysis aid. It does not know your market, fees, shipping, or
          costs beyond the values in your files, and it does not recommend prices.
        </p>
      </section>

      <section>
        <h2>Your responsibilities</h2>
        <p>
          You are responsible for the files you choose, for confirming that your columns
          are mapped correctly, for checking results before acting on them, and for every
          pricing decision you make. Keep copies of your own data; the service stores
          nothing for you.
        </p>
      </section>

      <section>
        <h2>No guarantees</h2>
        <p>
          The service is provided as is and as available, without warranties of any kind.
          We do not guarantee that it will be available at any particular time, that
          calculations will suit your situation, or that results are free of errors,
          including errors caused by the data you provide. To the extent permitted by law,
          Catalog Margin Guard is not liable for losses arising from your use of the
          service or from decisions based on its output.
        </p>
      </section>

      <section>
        <h2>Acceptable use</h2>
        <p>
          Use the service only for lawful purposes and only with data you are entitled to
          use. Do not attempt to disrupt the service, probe its security, or use it to
          harm others.
        </p>
      </section>

      <section>
        <h2>Intellectual property</h2>
        <p>
          The Catalog Margin Guard name, mark, application, and content belong to Catalog
          Margin Guard. Your files and the reports generated from them remain yours.
        </p>
      </section>

      <section>
        <h2>Changes</h2>
        <p>
          We may change or discontinue the service or these terms. When these terms
          change, the date at the top of this page will be updated. Continued use after a
          change means you accept the updated terms.
        </p>
      </section>

      <section>
        <h2>Contact</h2>
        <p>
          Questions about these terms can be sent to{" "}
          <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
        </p>
      </section>
    </LegalPageLayout>
  )
}

export { TermsPage }
