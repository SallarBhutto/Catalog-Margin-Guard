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

  await page.getByRole("button", { name: "Check My Catalog" }).click()

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
  expect(
    wasmContentTypes.some((contentType) => contentType.includes("application/wasm")),
  ).toBe(true)

  await page.getByRole("button", { name: "Back to overview" }).click()
  await expect(
    page.getByRole("heading", { name: "Find products quietly eating your margin." }),
  ).toBeVisible()

  await page.getByRole("button", { name: "Check My Catalog" }).click()
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
  await page.getByRole("button", { name: "Check My Catalog" }).click()

  const readiness = page.getByTestId("engine-readiness")
  await expect(readiness).toHaveText("Local analysis is ready.", { timeout: 30_000 })
  await expect(readiness).toHaveAttribute("data-engine-bundle", "mvp")
  await expect(readiness).toHaveAttribute("data-health-value", "42")
})
