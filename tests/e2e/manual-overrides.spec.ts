import { expect, test, type Locator, type Page } from "@playwright/test"

const supplierCsv = `sku,cost
STORE-EXACT,80
CATALOG-EXACT,70
LOSS-ROW,110
EQUAL-COST,10`

const catalogCsv = `sku,price,min_margin
STORE-EXACT,100,
CATALOG-EXACT,100,30
LOSS-ROW,100,
EQUAL-COST,10,`

async function chooseSelectOption(page: Page, name: string, option: string) {
  await page.getByRole("combobox", { name }).click()
  await page.getByRole("option", { name: option, exact: true }).click()
}

async function prepareAuthenticatedResults(page: Page) {
  await page.goto("/check")
  await expect(page.getByTestId("engine-readiness")).toHaveText(
    "Local analysis is ready.",
    { timeout: 30_000 },
  )
  await page.locator("#supplier-file-input").setInputFiles({
    name: "supplier.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(supplierCsv),
  })
  await page.locator("#catalog-file-input").setInputFiles({
    name: "catalog.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(catalogCsv),
  })
  await expect(page.getByTestId("setup-readiness")).toHaveAttribute(
    "data-setup-state",
    "READY_FOR_ANALYSIS",
    { timeout: 30_000 },
  )
  await page.getByRole("button", { name: "Analyze Catalog" }).click()
  await expect(page.getByRole("heading", { name: "Margin analysis" })).toBeVisible({
    timeout: 30_000,
  })
  await page.getByRole("button", { name: "Sign in", exact: true }).click()
  await page.getByRole("button", { name: "Complete sign in" }).click()
  await expect(page.getByRole("table", { name: "Complete product results" })).toBeVisible(
    { timeout: 30_000 },
  )
}

async function findProduct(page: Page, identifier: string) {
  const search = page.getByRole("searchbox", { name: "Search product identifier" })
  await search.fill(identifier)
  const row = page
    .getByRole("table", { name: "Complete product results" })
    .getByRole("row")
    .filter({ hasText: identifier })
  await expect(row).toBeVisible()
  return row
}

async function openTargetDialog(page: Page, row: Locator, identifier: string) {
  await row.getByRole("button", { name: new RegExp(`target for ${identifier}$`) }).click()
  const dialog = page.getByRole("dialog", { name: "Set product target" })
  await expect(dialog).toBeVisible()
  return dialog
}

test("manual targets recalculate one row, regroup filters, restore fallback, and clear on sign-out", async ({
  page,
}) => {
  const outboundRequests: string[] = []
  const browserErrors: string[] = []
  page.on("request", (request) =>
    outboundRequests.push(`${request.url()}\n${request.postData() ?? ""}`),
  )
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(message.text())
  })

  await prepareAuthenticatedResults(page)
  const exposureBefore = await page
    .getByRole("region", { name: "Margin exposure" })
    .textContent()
  const dataQualityBefore = await page.getByTestId("data-quality").textContent()

  let row = await findProduct(page, "STORE-EXACT")
  let dialog = await openTargetDialog(page, row, "STORE-EXACT")
  await expect(dialog).toContainText("Store default")
  await expect(dialog).toContainText("20.00%")
  await expect(dialog).toContainText("Catalog override")
  await expect(dialog).toContainText("—")
  await expect(dialog).toContainText("Current source")
  await expect(dialog).toContainText("Store Default")

  if (process.env.VISUAL_QA_DIR) {
    for (const viewport of [
      { width: 1440, height: 1000 },
      { width: 1024, height: 900 },
      { width: 768, height: 900 },
      { width: 390, height: 844 },
    ]) {
      await page.setViewportSize(viewport)
      await page.screenshot({
        path: `${process.env.VISUAL_QA_DIR}/manual-override-new-${viewport.width}.png`,
      })
      expect(
        await page.evaluate(
          () =>
            document.documentElement.scrollWidth > document.documentElement.clientWidth,
        ),
      ).toBe(false)
    }
    await page.setViewportSize({ width: 1280, height: 900 })
  }

  const input = dialog.getByLabel("Manual override")
  await input.fill("")
  await dialog.getByRole("button", { name: "Save Override" }).click()
  await expect(dialog.getByText("Margin must be between 0% and 95%.")).toBeVisible()
  if (process.env.VISUAL_QA_DIR) {
    await page.screenshot({
      path: `${process.env.VISUAL_QA_DIR}/manual-override-validation.png`,
    })
  }
  await input.fill("35.5")
  await dialog.getByRole("button", { name: "Save Override" }).click()
  await expect(dialog).not.toBeVisible()

  row = await findProduct(page, "STORE-EXACT")
  await expect(row).toContainText("35.50%")
  await expect(row).toContainText("Manual Override")
  await expect(row).toContainText("$124.04")
  await expect(row).toContainText("REVIEW")
  await expect(page.getByText("2 using store default")).toBeVisible()
  await expect(page.getByText("2 using product-specific target")).toBeVisible()
  expect(await page.getByRole("region", { name: "Margin exposure" }).textContent()).toBe(
    exposureBefore,
  )
  expect(await page.getByTestId("data-quality").textContent()).toBe(dataQualityBefore)

  await page.getByRole("button", { name: "Clear identifier search" }).click()
  await chooseSelectOption(page, "Target source", "Product Override")
  await expect(page.getByText("Showing 1–2 of 2")).toBeVisible()
  const overrideTable = page.getByRole("table", { name: "Complete product results" })
  await expect(overrideTable).toContainText("STORE-EXACT")
  await expect(overrideTable).toContainText("CATALOG-EXACT")
  await expect(overrideTable).not.toContainText("LOSS-ROW")

  await chooseSelectOption(page, "Target source", "All")
  row = await findProduct(page, "STORE-EXACT")
  dialog = await openTargetDialog(page, row, "STORE-EXACT")
  await expect(
    dialog.getByRole("button", { name: "Remove Manual Override" }),
  ).toBeVisible()
  if (process.env.VISUAL_QA_DIR) {
    await page.screenshot({
      path: `${process.env.VISUAL_QA_DIR}/manual-override-existing.png`,
    })
  }
  await dialog.getByRole("button", { name: "Remove Manual Override" }).click()
  await expect(dialog).not.toBeVisible()
  row = await findProduct(page, "STORE-EXACT")
  await expect(row).toContainText("20.00%")
  await expect(row).toContainText("Store Default")
  await expect(row).toContainText("$100.00")
  await expect(row).toContainText("OK")

  await page.getByRole("button", { name: "Clear identifier search" }).click()
  row = await findProduct(page, "CATALOG-EXACT")
  dialog = await openTargetDialog(page, row, "CATALOG-EXACT")
  await expect(dialog).toContainText("30.00%")
  await expect(dialog).toContainText("Product Override")
  await dialog.getByLabel("Manual override").fill("35.5")
  await dialog.getByRole("button", { name: "Save Override" }).click()
  row = await findProduct(page, "CATALOG-EXACT")
  await expect(row).toContainText("Manual Override")
  await expect(row).toContainText("$108.53")
  await expect(row).toContainText("REVIEW")
  dialog = await openTargetDialog(page, row, "CATALOG-EXACT")
  await dialog.getByRole("button", { name: "Remove Manual Override" }).click()
  row = await findProduct(page, "CATALOG-EXACT")
  await expect(row).toContainText("Product Override")
  await expect(row).toContainText("30.00%")
  await expect(row).toContainText("$100.00")
  await expect(row).toContainText("OK")

  await page.getByRole("button", { name: "Clear identifier search" }).click()
  row = await findProduct(page, "STORE-EXACT")
  dialog = await openTargetDialog(page, row, "STORE-EXACT")
  await dialog.getByLabel("Manual override").fill("0.20")
  await dialog.getByRole("button", { name: "Save Override" }).click()
  row = await findProduct(page, "STORE-EXACT")
  await expect(row).toContainText("0.20%")
  await expect(row).toContainText("$80.17")

  await page.getByRole("button", { name: "Sign out" }).click()
  await expect(page.getByRole("searchbox")).not.toBeVisible()
  await expect(page.getByRole("button", { name: /target for/i })).not.toBeVisible()
  await expect(page.getByText("3 using store default")).toBeVisible()
  await expect(page.getByText("1 using product-specific target")).toBeVisible()

  await page.getByRole("button", { name: "Sign in", exact: true }).click()
  await page.getByRole("button", { name: "Complete sign in" }).click()
  row = await findProduct(page, "STORE-EXACT")
  dialog = await openTargetDialog(page, row, "STORE-EXACT")
  await expect(dialog).toContainText("Current source")
  await expect(dialog).toContainText("Store Default")
  await expect(
    dialog.getByRole("button", { name: "Remove Manual Override" }),
  ).toHaveCount(0)

  const outboundText = outboundRequests.join("\n")
  for (const privateValue of ["STORE-EXACT", "35.5", "0.20", "MANUAL_OVERRIDE"]) {
    expect(outboundText).not.toContain(privateValue)
  }
  expect(browserErrors).toEqual([])
})

test("manual targets preserve LOSS, support multiple rows, and disappear on Start New Scan", async ({
  page,
}) => {
  await prepareAuthenticatedResults(page)

  let row = await findProduct(page, "LOSS-ROW")
  let dialog = await openTargetDialog(page, row, "LOSS-ROW")
  await dialog.getByLabel("Manual override").fill("0")
  await dialog.getByRole("button", { name: "Save Override" }).click()
  row = await findProduct(page, "LOSS-ROW")
  await expect(row).toContainText("Manual Override")
  await expect(row).toContainText("LOSS")

  await page.getByRole("button", { name: "Clear identifier search" }).click()
  row = await findProduct(page, "EQUAL-COST")
  dialog = await openTargetDialog(page, row, "EQUAL-COST")
  await dialog.getByLabel("Manual override").fill("0")
  await dialog.getByRole("button", { name: "Save Override" }).click()
  row = await findProduct(page, "EQUAL-COST")
  await expect(row).toContainText("OK")
  await expect(row).toContainText("Manual Override")

  await page.getByRole("button", { name: "Start New Scan" }).click()
  const confirmation = page.getByRole("dialog", { name: "Start a new scan?" })
  await expect(confirmation).toContainText("session-only target overrides")
  await confirmation.getByRole("button", { name: "Start New Scan" }).click()
  await expect(page.getByRole("heading", { name: "Check your catalog" })).toBeVisible()
  await expect(page.getByRole("heading", { name: "Margin analysis" })).not.toBeVisible()
})
