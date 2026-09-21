import { act, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import type { AuthStatus } from "@/app/access-policy"
import type { MarginAnalysisSuccess } from "@/features/analysis/margin-analysis-types"
import { AuthStateProvider } from "@/features/auth/auth-context"
import type { ReportExporter } from "@/features/exports/export-reports-section"
import { ReportExportError } from "@/features/exports/report-export-service"
import { ResultsPage } from "@/features/results/results-page"

function analysis(loss: number, review: number, ok: number): MarginAnalysisSuccess {
  const productsAnalyzed = loss + review + ok
  return {
    status: "READY",
    relations: {
      matches: { name: "identifier_matches", rowCount: productsAnalyzed },
      results: { name: "analysis_results", rowCount: productsAnalyzed },
    },
    metadata: {
      summary: {
        productsAnalyzed,
        productsAtLoss: loss,
        productsNeedingReview: review,
        productsMeetingTarget: ok,
        averageGrossMarginPct: productsAnalyzed ? "18.125000000000" : null,
        productsUsingStoreDefaultTarget: productsAnalyzed,
        productsUsingProductSpecificTarget: 0,
      },
      exposure: {
        belowZero: loss,
        zeroToFive: 0,
        fiveToTen: review,
        tenToFifteen: 0,
        fifteenToTwenty: 0,
        twentyToThirty: ok,
        thirtyAndAbove: 0,
      },
      dataQuality: {
        supplierRows: productsAnalyzed,
        catalogRows: productsAnalyzed,
        matchedProducts: productsAnalyzed,
        supplierOnlyProducts: 0,
        catalogOnlyProducts: 0,
        supplierDuplicateIdentifiers: 0,
        catalogDuplicateIdentifiers: 0,
        invalidSupplierCosts: 0,
        invalidSellingPrices: 0,
        invalidMarginOverrides: 0,
      },
    },
  }
}

type ExportReport = ReportExporter["exportReport"]

function createExporter(exportReport: ExportReport) {
  return { cancelActive: vi.fn(), exportReport: vi.fn(exportReport) }
}

const fullResultsService = {
  getResultsPage: () =>
    Promise.resolve({ rows: [], totalRows: 0, page: 1, pageSize: 100 as const }),
}

function page(
  status: AuthStatus,
  result: MarginAnalysisSuccess,
  exporter: ReturnType<typeof createExporter>,
) {
  return (
    <AuthStateProvider status={status} requestSignIn={() => undefined}>
      <ResultsPage
        result={result}
        currency="USD"
        numberFormat="US"
        onStartNewScan={() => Promise.resolve()}
        fullResultsService={fullResultsService}
        exportService={exporter}
      />
    </AuthStateProvider>
  )
}

describe("report export controls", () => {
  it("offers no export action to anonymous or unresolved sessions", () => {
    const exporter = createExporter(() => Promise.resolve({ status: "EMPTY" }))

    for (const status of ["anonymous", "loading"] as const) {
      const view = render(page(status, analysis(2, 3, 5), exporter))
      expect(screen.queryByTestId("export-reports")).not.toBeInTheDocument()
      expect(
        screen.queryByRole("button", { name: /Products To Review|Full Margin Report/ }),
      ).not.toBeInTheDocument()
      view.unmount()
    }
    expect(exporter.exportReport).not.toHaveBeenCalled()
  })

  it("exports with the current capabilities and reports the downloaded file", async () => {
    const user = userEvent.setup()
    const exporter = createExporter(() =>
      Promise.resolve({
        status: "DOWNLOADED",
        rows: 1234,
        filename: "catalog-margin-report-2026-09-05.csv",
      }),
    )
    render(page("authenticated", analysis(2, 3, 5), exporter))

    expect(
      screen.getByText(/not only the page, search, or filters shown above/),
    ).toBeVisible()
    await user.click(screen.getByRole("button", { name: "Full Margin Report" }))

    expect(exporter.exportReport).toHaveBeenCalledWith(
      "FULL_MARGIN_REPORT",
      expect.objectContaining({ canExportResults: true }),
      expect.objectContaining({ onProgress: expect.any(Function) as unknown }),
    )
    expect(
      await screen.findByText(
        "Downloaded catalog-margin-report-2026-09-05.csv with 1,234 products.",
      ),
    ).toBeVisible()
    expect(screen.getByRole("button", { name: "Full Margin Report" })).toBeEnabled()
  })

  it("shows progress, blocks repeated clicks, and can be cancelled", async () => {
    const user = userEvent.setup()
    let reportProgress: (rows: number) => void = () => undefined
    let finish: (outcome: { status: "CANCELLED" }) => void = () => undefined
    const exporter = createExporter((_kind, _access, options) => {
      reportProgress = options?.onProgress ?? reportProgress
      return new Promise((resolve) => {
        finish = resolve
      })
    })
    render(page("authenticated", analysis(2, 3, 5), exporter))

    await user.click(screen.getByRole("button", { name: "Products To Review" }))
    act(() => reportProgress(4))

    expect(
      screen.getByText("Preparing Products To Review… 4 of 5 products"),
    ).toBeVisible()
    expect(screen.getByRole("button", { name: "Products To Review" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "Full Margin Report" })).toBeDisabled()
    expect(exporter.exportReport).toHaveBeenCalledOnce()

    await user.click(screen.getByRole("button", { name: "Cancel" }))
    expect(exporter.cancelActive).toHaveBeenCalledOnce()
    act(() => finish({ status: "CANCELLED" }))

    expect(
      await screen.findByText("Report cancelled. No file was created."),
    ).toBeVisible()
    expect(screen.getByRole("button", { name: "Products To Review" })).toBeEnabled()
  })

  it("explains why Products To Review is unavailable when nothing needs review", () => {
    const exporter = createExporter(() => Promise.resolve({ status: "EMPTY" }))
    render(page("authenticated", analysis(0, 0, 7), exporter))

    const review = screen.getByRole("button", { name: "Products To Review" })
    expect(review).toBeDisabled()
    expect(review).toHaveAccessibleDescription(
      "No products currently need review, so Products To Review has nothing to include.",
    )
    expect(screen.getByRole("button", { name: "Full Margin Report" })).toBeEnabled()
  })

  it("reports an empty result and a failure without claiming a download", async () => {
    const user = userEvent.setup()
    const exporter = createExporter(() => Promise.resolve({ status: "EMPTY" }))
    const view = render(page("authenticated", analysis(1, 0, 1), exporter))

    await user.click(screen.getByRole("button", { name: "Products To Review" }))
    expect(
      await screen.findByText(
        "Products To Review has no products to include, so no file was created.",
      ),
    ).toBeVisible()
    view.unmount()

    const failing = createExporter(() => Promise.reject(new ReportExportError("FAILED")))
    render(page("authenticated", analysis(1, 0, 1), failing))
    await user.click(screen.getByRole("button", { name: "Full Margin Report" }))

    const alert = await screen.findByRole("alert")
    expect(alert).toHaveTextContent("We couldn't prepare this report.")
    expect(screen.queryByText(/^Downloaded /)).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Full Margin Report" })).toBeEnabled()
  })

  it("cancels a report in progress when sign-out removes the controls", async () => {
    const user = userEvent.setup()
    const exporter = createExporter(() => new Promise(() => undefined))
    const result = analysis(2, 3, 5)
    const view = render(page("authenticated", result, exporter))

    await user.click(screen.getByRole("button", { name: "Full Margin Report" }))
    expect(exporter.cancelActive).not.toHaveBeenCalled()

    view.rerender(page("anonymous", result, exporter))

    await waitFor(() => expect(exporter.cancelActive).toHaveBeenCalled())
    expect(screen.queryByTestId("export-reports")).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Reveal My Results — Free" })).toBeVisible()
  })
})
