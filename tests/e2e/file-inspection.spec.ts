import path from "node:path"
import { fileURLToPath } from "node:url"

import { expect, test } from "@playwright/test"

const fixtureDirectory = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../fixtures",
)
const fixture = (name: string) => path.join(fixtureDirectory, name)

test.beforeEach(async ({ page }) => {
  await page.goto("/check")
  await expect(page.getByTestId("engine-readiness")).toHaveText(
    "Local analysis is ready.",
    { timeout: 30_000 },
  )
})

test("inspects supplier CSV and catalog TSV locally with preserved identifiers", async ({
  page,
}) => {
  await page.locator("#supplier-file-input").setInputFiles(fixture("valid-supplier.csv"))

  const supplier = page.getByTestId("supplier-inspection")
  await expect(supplier).toBeVisible({ timeout: 30_000 })
  await expect(supplier.getByRole("columnheader", { name: "Supplier SKU" })).toBeVisible()
  await expect(supplier.getByRole("columnheader", { name: "Unit Cost" })).toBeVisible()
  await expect(supplier.getByRole("cell", { name: "001234" })).toBeVisible()
  await expect(supplier.getByText("Product identifier")).toBeVisible()
  await expect(supplier.getByText("Supplier cost")).toBeVisible()

  await page.locator("#catalog-file-input").setInputFiles(fixture("valid-catalog.tsv"))

  const catalog = page.getByTestId("catalog-inspection")
  await expect(catalog).toBeVisible({ timeout: 30_000 })
  await expect(catalog).toContainText("Tab delimiter")
  await expect(catalog.getByRole("columnheader", { name: "Product SKU" })).toBeVisible()
  await expect(catalog.getByRole("columnheader", { name: "Retail Price" })).toBeVisible()
  await expect(page.getByText("Both files are ready.")).toBeVisible()
})

test("replacing one file removes its previous inspection and keeps the other file", async ({
  page,
}) => {
  await page.locator("#supplier-file-input").setInputFiles(fixture("valid-supplier.csv"))
  await page.locator("#catalog-file-input").setInputFiles(fixture("valid-catalog.csv"))
  await expect(page.getByTestId("supplier-inspection")).toContainText("Supplier SKU")
  await expect(page.getByTestId("catalog-inspection")).toContainText("Selling Price")

  await page.locator("#supplier-file-input").setInputFiles(fixture("unusual-columns.csv"))

  const supplier = page.getByTestId("supplier-inspection")
  await expect(supplier).toContainText('Product "Code"', { timeout: 30_000 })
  await expect(supplier).not.toContainText("Supplier SKU")
  await expect(page.getByTestId("catalog-inspection")).toContainText("Selling Price")
})

test("shows controlled errors for unsupported, empty, missing-header, duplicate-header, and malformed files", async ({
  page,
}) => {
  const catalogInput = page.locator("#catalog-file-input")
  const catalogPicker = page.getByTestId("catalog-file-picker")

  await catalogInput.setInputFiles({
    name: "catalog.xlsx",
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer: Buffer.from("not an xlsx"),
  })
  await expect(catalogPicker).toContainText("Choose a CSV or TSV file")

  await catalogInput.setInputFiles(fixture("empty.csv"))
  await expect(catalogPicker).toContainText("This file is empty")

  await catalogInput.setInputFiles(fixture("no-header.csv"))
  await expect(catalogPicker).toContainText("usable header row", { timeout: 30_000 })

  await catalogInput.setInputFiles(fixture("duplicate-header.csv"))
  await expect(catalogPicker).toContainText("duplicate column names", { timeout: 30_000 })

  await catalogInput.setInputFiles(fixture("malformed.csv"))
  await expect(catalogPicker).toContainText("We couldn't read this file", {
    timeout: 30_000,
  })
})

test("file selection and inspection send no source business data over the network", async ({
  page,
}) => {
  const outbound: string[] = []
  page.on("request", (request) => {
    outbound.push(`${request.url()}\n${request.postData() ?? ""}`)
  })

  await page.locator("#supplier-file-input").setInputFiles(fixture("valid-supplier.csv"))
  await expect(page.getByTestId("supplier-inspection")).toBeVisible({ timeout: 30_000 })

  const payload = outbound.join("\n")
  expect(payload).not.toContain("valid-supplier.csv")
  expect(payload).not.toContain("Supplier SKU")
  expect(payload).not.toContain("Unit Cost")
  expect(payload).not.toContain("001234")
  expect(payload).not.toContain("12.50")
})

test("file workflow remains usable without horizontal page overflow on mobile", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.locator("#supplier-file-input").setInputFiles(fixture("valid-supplier.csv"))
  await expect(page.getByTestId("supplier-inspection")).toBeVisible({ timeout: 30_000 })

  const hasPageOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  )
  expect(hasPageOverflow).toBe(false)
  await expect(
    page.getByTestId("catalog-file-picker").getByRole("button", {
      name: "Choose Catalog File",
    }),
  ).toBeVisible()
})

test("wide previews scroll inside the table without widening the page", async ({
  page,
}) => {
  await page.setViewportSize({ width: 768, height: 900 })
  await page.locator("#catalog-file-input").setInputFiles(fixture("wide-preview.csv"))

  const inspection = page.getByTestId("catalog-inspection")
  await expect(inspection).toBeVisible({ timeout: 30_000 })
  const tableContainer = inspection.locator('[data-slot="table-container"]')
  await expect
    .poll(() =>
      tableContainer.evaluate((element) => element.scrollWidth > element.clientWidth),
    )
    .toBe(true)

  const hasPageOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  )
  expect(hasPageOverflow).toBe(false)
})
