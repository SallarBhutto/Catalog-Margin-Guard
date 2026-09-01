import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"

import type { MarginAnalysisSuccess } from "@/features/analysis/margin-analysis-types"
import { AuthStateProvider } from "@/features/auth/auth-context"
import { ResultsPage } from "@/features/results/results-page"
import type { MarginResultRow } from "@/features/results/results-query-types"

function result(
  productsAtLoss: number,
  productsNeedingReview: number,
  productsMeetingTarget: number,
): MarginAnalysisSuccess {
  const productsAnalyzed = productsAtLoss + productsNeedingReview + productsMeetingTarget
  return {
    status: "READY",
    relations: {
      matches: { name: "identifier_matches", rowCount: productsAnalyzed },
      results: { name: "analysis_results", rowCount: productsAnalyzed },
    },
    metadata: {
      summary: {
        productsAnalyzed,
        productsAtLoss,
        productsNeedingReview,
        productsMeetingTarget,
        averageGrossMarginPct: productsAnalyzed ? "18.125000000000" : null,
        productsUsingStoreDefaultTarget: productsAnalyzed,
        productsUsingProductSpecificTarget: 0,
      },
      exposure: {
        belowZero: productsAtLoss,
        zeroToFive: 0,
        fiveToTen: productsNeedingReview,
        tenToFifteen: 0,
        fifteenToTwenty: 0,
        twentyToThirty: productsMeetingTarget,
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

function previewRow(index: number): MarginResultRow {
  return {
    identifier: `SKU-${String(index).padStart(2, "0")}`,
    supplierCost: "10.0000",
    sellingPrice: "9.0000",
    grossMarginPercent: "-11.111111111111",
    targetMarginPercent: "20.0000",
    targetSource: "STORE_DEFAULT",
    priceForTargetMargin: "12.50",
    status: "LOSS",
  }
}

function resultPageRow(
  identifier: string,
  status: MarginResultRow["status"],
): MarginResultRow {
  return {
    identifier,
    supplierCost: "10.0000",
    sellingPrice: status === "LOSS" ? "9.0000" : "20.0000",
    grossMarginPercent: status === "LOSS" ? "-11.111111111111" : "50.000000000000",
    targetMarginPercent: "20.0000",
    targetSource: "STORE_DEFAULT",
    priceForTargetMargin: "12.50",
    status,
  }
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((promiseResolve) => {
    resolve = promiseResolve
  })
  return { promise, resolve }
}

function renderResults(
  analysis: MarginAnalysisSuccess,
  rows: readonly MarginResultRow[],
) {
  const requestSignIn = vi.fn()
  render(
    <AuthStateProvider status="anonymous" requestSignIn={requestSignIn}>
      <ResultsPage
        result={analysis}
        previewRows={rows}
        currency="USD"
        numberFormat="US"
        onStartNewScan={() => Promise.resolve()}
      />
    </AuthStateProvider>,
  )
  return requestSignIn
}

describe("anonymous results", () => {
  it("shows the actual hidden attention count and free sign-in gate", () => {
    renderResults(
      result(25, 10, 4),
      Array.from({ length: 20 }, (_, index) => previewRow(index)),
    )

    expect(screen.getByText("Showing 20 of 35 products needing attention.")).toBeVisible()
    expect(screen.getByText("15 more products are hidden.")).toBeVisible()
    expect(screen.getByRole("button", { name: "See All Results — Free" })).toBeEnabled()
    expect(screen.getAllByRole("row")).toHaveLength(21)
  })

  it("does not invent hidden results or a gate when every attention row is shown", () => {
    renderResults(
      result(2, 3, 5),
      Array.from({ length: 5 }, (_, index) => previewRow(index)),
    )

    expect(screen.queryByText(/more products are hidden/i)).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "See All Results — Free" }),
    ).not.toBeInTheDocument()
  })

  it("does not claim hidden products when exactly 20 attention rows are shown", () => {
    renderResults(
      result(10, 10, 5),
      Array.from({ length: 20 }, (_, index) => previewRow(index)),
    )

    expect(screen.queryByText(/more products are hidden/i)).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "See All Results — Free" }),
    ).not.toBeInTheDocument()
  })

  it("shows deliberate zero-risk and zero-analyzable states", () => {
    const { unmount } = render(
      <AuthStateProvider status="anonymous" requestSignIn={() => undefined}>
        <ResultsPage
          result={result(0, 0, 7)}
          previewRows={[]}
          currency="USD"
          numberFormat="US"
          onStartNewScan={() => Promise.resolve()}
        />
      </AuthStateProvider>,
    )
    expect(screen.getByText("No products currently need margin review.")).toBeVisible()
    expect(
      screen.queryByRole("button", { name: "See All Results — Free" }),
    ).not.toBeInTheDocument()

    unmount()
    renderResults(result(0, 0, 0), [])
    expect(
      screen.getByText("We couldn't calculate margins for any matched products."),
    ).toBeVisible()
    expect(screen.getByTestId("data-quality")).toHaveAttribute("open")
    expect(screen.queryByText("Margin exposure")).not.toBeInTheDocument()
  })

  it("replaces the preview with full browsing controls after authentication", async () => {
    const analysis = result(25, 10, 4)
    const rows = Array.from({ length: 20 }, (_, index) => previewRow(index))
    const fullRows = [resultPageRow("LOSS-1", "LOSS"), resultPageRow("OK-1", "OK")]
    const getResultsPage = vi.fn(() =>
      Promise.resolve({ rows: fullRows, totalRows: 39, page: 1, pageSize: 100 as const }),
    )
    const { rerender } = render(
      <AuthStateProvider status="anonymous" requestSignIn={() => undefined}>
        <ResultsPage
          result={analysis}
          previewRows={rows}
          currency="USD"
          numberFormat="US"
          onStartNewScan={() => Promise.resolve()}
          fullResultsService={{ getResultsPage }}
        />
      </AuthStateProvider>,
    )

    expect(screen.getByRole("button", { name: "See All Results — Free" })).toBeVisible()

    rerender(
      <AuthStateProvider status="authenticated" requestSignIn={() => undefined}>
        <ResultsPage
          result={analysis}
          previewRows={rows}
          currency="USD"
          numberFormat="US"
          onStartNewScan={() => Promise.resolve()}
          fullResultsService={{ getResultsPage }}
        />
      </AuthStateProvider>,
    )

    await waitFor(() => expect(getResultsPage).toHaveBeenCalledOnce())
    expect(
      screen.queryByRole("button", { name: "See All Results — Free" }),
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole("searchbox", { name: "Search product identifier" }),
    ).toBeVisible()
    expect(screen.getByRole("button", { name: "Needs Review" })).toBeVisible()
    expect(screen.getByRole("combobox", { name: "Target source" })).toBeVisible()
    expect(screen.getByRole("combobox", { name: "Sort results" })).toBeVisible()
    expect(screen.getByRole("combobox", { name: "Rows per page" })).toBeVisible()
    expect(
      await screen.findByRole("table", { name: "Complete product results" }),
    ).toHaveTextContent("OK-1")
    expect(screen.getByText("Showing 1–2 of 39")).toBeVisible()

    rerender(
      <AuthStateProvider status="anonymous" requestSignIn={() => undefined}>
        <ResultsPage
          result={analysis}
          previewRows={rows}
          currency="USD"
          numberFormat="US"
          onStartNewScan={() => Promise.resolve()}
          fullResultsService={{ getResultsPage }}
        />
      </AuthStateProvider>,
    )

    expect(screen.queryByRole("searchbox")).not.toBeInTheDocument()
    expect(screen.queryByText("OK-1")).not.toBeInTheDocument()
    expect(screen.getByRole("table", { name: "Highest risk products" })).toBeVisible()
    expect(screen.getByRole("button", { name: "See All Results — Free" })).toBeVisible()
  })

  it("does not expose privileged controls while auth is loading", () => {
    render(
      <AuthStateProvider status="loading" requestSignIn={() => undefined}>
        <ResultsPage
          result={result(25, 10, 4)}
          previewRows={Array.from({ length: 20 }, (_, index) => previewRow(index))}
          currency="USD"
          numberFormat="US"
          onStartNewScan={() => Promise.resolve()}
        />
      </AuthStateProvider>,
    )

    expect(screen.queryByRole("searchbox")).not.toBeInTheDocument()
    expect(
      screen.queryByRole("combobox", { name: "Sort results" }),
    ).not.toBeInTheDocument()
    expect(screen.getByText("Checking sign-in status…")).toBeVisible()
  })

  it("ignores an older results request that completes after a newer filter", async () => {
    const older = deferred<{
      rows: readonly MarginResultRow[]
      totalRows: number
      page: number
      pageSize: 100
    }>()
    const getResultsPage = vi.fn((query: { status: string }) =>
      query.status === "ALL"
        ? older.promise
        : Promise.resolve({
            rows: [resultPageRow("CURRENT-LOSS", "LOSS")],
            totalRows: 1,
            page: 1,
            pageSize: 100 as const,
          }),
    )

    render(
      <AuthStateProvider status="authenticated" requestSignIn={() => undefined}>
        <ResultsPage
          result={result(25, 10, 4)}
          previewRows={Array.from({ length: 20 }, (_, index) => previewRow(index))}
          currency="USD"
          numberFormat="US"
          onStartNewScan={() => Promise.resolve()}
          fullResultsService={{ getResultsPage }}
        />
      </AuthStateProvider>,
    )

    await waitFor(() => expect(getResultsPage).toHaveBeenCalledOnce())
    fireEvent.click(screen.getByRole("button", { name: "Loss" }))
    expect(await screen.findByText("CURRENT-LOSS")).toBeVisible()

    await act(async () => {
      older.resolve({
        rows: [resultPageRow("STALE-OK", "OK")],
        totalRows: 1,
        page: 1,
        pageSize: 100,
      })
      await older.promise
    })

    expect(screen.getByText("CURRENT-LOSS")).toBeVisible()
    expect(screen.queryByText("STALE-OK")).not.toBeInTheDocument()
  })
})
