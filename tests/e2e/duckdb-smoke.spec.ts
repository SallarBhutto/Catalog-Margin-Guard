import { expect, test } from "@playwright/test"

test("real DuckDB-Wasm initializes locally, returns 42, and tears down cleanly", async ({
  page,
}) => {
  const browserConsole: string[] = []
  const requestedUrls: string[] = []
  const wasmContentTypes: string[] = []

  page.on("console", (message) => browserConsole.push(message.text()))
  page.on("response", (response) => {
    const url = response.url()
    requestedUrls.push(url)
    if (url.includes(".wasm")) {
      wasmContentTypes.push(response.headers()["content-type"] ?? "")
    }
  })

  await page.goto("/")
  await expect(
    page.getByRole("heading", { name: "Find products quietly eating your margin." }),
  ).toBeVisible()
  expect(
    requestedUrls.some((url) => url.includes("duckdb") && url.includes(".wasm")),
  ).toBe(false)

  await page.getByRole("link", { name: "Check My Catalog — Free", exact: true }).click()

  const readiness = page.getByTestId("engine-readiness")
  await expect(readiness).toHaveText("Local analysis is ready.", { timeout: 30_000 })
  await expect(readiness).toHaveAttribute("data-engine-state", "ready")
  await expect(readiness).toHaveAttribute("data-engine-bundle", /^(eh|mvp)$/)
  await expect(readiness).toHaveAttribute("data-health-value", "42")
  await expect
    .poll(async () => Number(await readiness.getAttribute("data-initialization-ms")))
    .toBeGreaterThan(0)
  expect(await page.evaluate(() => globalThis.crossOriginIsolated)).toBe(false)

  const selectedBundle = await readiness.getAttribute("data-engine-bundle")
  const initializationMs = await readiness.getAttribute("data-initialization-ms")
  console.info(
    `DuckDB smoke: bundle=${selectedBundle}, initializationMs=${initializationMs}`,
  )

  const duckDBRuntimeRequests = requestedUrls.filter(
    (url) => url.includes("duckdb") || url.includes(".wasm"),
  )
  const appOrigin = new URL(page.url()).origin
  expect(duckDBRuntimeRequests.length).toBeGreaterThanOrEqual(2)
  expect(duckDBRuntimeRequests.every((url) => new URL(url).origin === appOrigin)).toBe(
    true,
  )
  // Development serves the raw module as application/wasm. The production build serves a
  // first-party gzip copy that the page decompresses into an application/wasm blob.
  const servesCompressedModule = duckDBRuntimeRequests.some((url) =>
    url.endsWith(".wasm.gz"),
  )
  if (!servesCompressedModule) {
    expect(
      wasmContentTypes.some((contentType) => contentType.includes("application/wasm")),
    ).toBe(true)
  }

  await page.getByRole("button", { name: "Back to overview" }).click()
  await expect(
    page.getByRole("heading", { name: "Find products quietly eating your margin." }),
  ).toBeVisible()

  await page.getByRole("link", { name: "Check My Catalog — Free", exact: true }).click()
  await expect(page.getByTestId("engine-readiness")).toHaveText(
    "Local analysis is ready.",
    { timeout: 30_000 },
  )

  const lifecycleLogs = browserConsole.filter((line) => line.includes("DuckDB"))
  if (lifecycleLogs.length > 0) {
    expect(lifecycleLogs.some((line) => line.includes("DuckDB disposed"))).toBe(true)
  }
})

test("falls back to the MVP bundle when exception handling is unavailable", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(WebAssembly, "validate", {
      configurable: true,
      value: () => false,
    })
  })

  await page.goto("/")
  await page.getByRole("link", { name: "Check My Catalog — Free", exact: true }).click()

  const readiness = page.getByTestId("engine-readiness")
  await expect(readiness).toHaveText("Local analysis is ready.", { timeout: 30_000 })
  await expect(readiness).toHaveAttribute("data-engine-bundle", "mvp")
  await expect(readiness).toHaveAttribute("data-health-value", "42")
})

test("runs a complete analysis on the MVP fallback bundle", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(WebAssembly, "validate", {
      configurable: true,
      value: () => false,
    })
  })
  const browserErrors: string[] = []
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(message.text())
  })

  await page.goto("/check")
  const readiness = page.getByTestId("engine-readiness")
  await expect(readiness).toHaveText("Local analysis is ready.", { timeout: 30_000 })
  await expect(readiness).toHaveAttribute("data-engine-bundle", "mvp")

  await page.locator("#supplier-file-input").setInputFiles({
    name: "supplier.csv",
    mimeType: "text/csv",
    buffer: Buffer.from("sku,cost\nABC-12,96\nXYZ-88,44\nKLP-91,151"),
  })
  await page.locator("#catalog-file-input").setInputFiles({
    name: "catalog.csv",
    mimeType: "text/csv",
    buffer: Buffer.from("sku,price,min_margin\nABC-12,105,10\nXYZ-88,69,30\nKLP-91,149,"),
  })
  await expect(page.getByTestId("setup-readiness")).toHaveAttribute(
    "data-setup-state",
    "READY_FOR_ANALYSIS",
    { timeout: 30_000 },
  )
  await page.getByRole("button", { name: "Analyze Catalog" }).click()

  await expect(page.getByText("3 products analyzed locally")).toBeVisible({
    timeout: 30_000,
  })
  const summary = page.getByRole("region", { name: "Analysis summary" })
  await expect(summary).toContainText("1Selling below costLOSS")
  await expect(summary).toContainText("1Need reviewREVIEW")
  await expect(summary).toContainText("1Meeting targetOK")
  expect(browserErrors).toEqual([])
})

test("tells an unsupported browser why local analysis cannot start", async ({ page }) => {
  // Only the production build ships compressed modules that need DecompressionStream.
  test.skip(
    !process.env.PLAYWRIGHT_BASE_URL,
    "The development server serves uncompressed modules.",
  )
  await page.addInitScript(() => {
    Reflect.deleteProperty(globalThis, "DecompressionStream")
  })

  await page.goto("/check")

  const alert = page.getByRole("alert")
  await expect(alert).toContainText("We couldn't prepare local analysis.", {
    timeout: 30_000,
  })
  await expect(alert).toContainText("This browser is not supported")
  await expect(alert).toContainText("Your files have not left this computer.")
  await expect(alert.getByRole("button", { name: "Try again" })).toBeVisible()
  await expect(page.getByRole("heading", { name: "Check your catalog" })).toBeVisible()
})
