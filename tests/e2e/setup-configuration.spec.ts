import path from "node:path"
import { fileURLToPath } from "node:url"

import { expect, test, type Page } from "@playwright/test"

const fixtureDirectory = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../fixtures",
)
const fixture = (name: string) => path.join(fixtureDirectory, name)

async function chooseColumn(page: Page, triggerId: string, column: string) {
  await page.locator(`#${triggerId}`).click()
  await page.getByRole("option", { name: column, exact: true }).click()
}

async function selectInitialFiles(page: Page) {
  await page.locator("#supplier-file-input").setInputFiles(fixture("valid-supplier.csv"))
  await page.locator("#catalog-file-input").setInputFiles(fixture("valid-catalog.csv"))
  await expect(page.getByTestId("column-mapping-section")).toBeVisible({
    timeout: 30_000,
  })
}

test.beforeEach(async ({ page }) => {
  await page.goto("/check")
  await expect(page.getByTestId("engine-readiness")).toHaveText(
    "Local analysis is ready.",
    { timeout: 30_000 },
  )
})

test("configures a complete setup and preserves unaffected state across file replacement", async ({
  page,
}) => {
  await selectInitialFiles(page)

  await expect(page.locator("#supplier-identifier-mapping")).toContainText("Supplier SKU")
  await expect(page.locator("#supplier-cost-mapping")).toContainText("Unit Cost")
  await expect(page.locator("#catalog-identifier-mapping")).toContainText("SKU")
  await expect(page.locator("#catalog-price-mapping")).toContainText("Selling Price")
  await expect(page.locator("#catalog-margin-override-mapping")).toContainText(
    "min_margin",
  )

  await chooseColumn(page, "supplier-identifier-mapping", "Description")
  await chooseColumn(page, "catalog-margin-override-mapping", "None")
  await page.locator("#store-default-margin").fill("25.5")
  await page.getByLabel("1.234,56").click()
  await page.locator("#display-currency").click()
  await page.getByRole("option", { name: "EUR", exact: true }).click()
  await page.getByLabel("Ignore uppercase/lowercase differences").click()

  await expect(page.getByLabel("1.234,56")).toBeChecked()
  await expect(
    page.getByLabel("Ignore uppercase/lowercase differences"),
  ).not.toBeChecked()
  await expect(page.getByTestId("setup-readiness")).toHaveAttribute(
    "data-setup-state",
    "READY_FOR_ANALYSIS",
  )

  await page
    .locator("#supplier-file-input")
    .setInputFiles(fixture("replacement-supplier.csv"))
  await expect(page.locator("#supplier-identifier-mapping")).toContainText(
    "Part Number",
    {
      timeout: 30_000,
    },
  )
  await expect(page.locator("#supplier-cost-mapping")).toContainText("Wholesale Cost")
  await expect(page.locator("#catalog-identifier-mapping")).toContainText("SKU")
  await expect(page.locator("#catalog-price-mapping")).toContainText("Selling Price")
  await expect(page.locator("#store-default-margin")).toHaveValue("25.5")

  await page
    .locator("#catalog-file-input")
    .setInputFiles(fixture("replacement-catalog.csv"))
  await expect(page.locator("#catalog-identifier-mapping")).toContainText("Item Code", {
    timeout: 30_000,
  })
  await expect(page.locator("#catalog-price-mapping")).toContainText("Current Price")
  await expect(page.locator("#catalog-margin-override-mapping")).toContainText(
    "Target Margin",
  )
  await expect(page.locator("#supplier-identifier-mapping")).toContainText("Part Number")
  await expect(page.locator("#supplier-cost-mapping")).toContainText("Wholesale Cost")
  await expect(page.getByTestId("setup-readiness")).toHaveAttribute(
    "data-setup-state",
    "READY_FOR_ANALYSIS",
  )
})

test("shows field-level margin and mapping conflict validation", async ({ page }) => {
  await selectInitialFiles(page)

  const readiness = page.getByTestId("setup-readiness")
  await expect(readiness).toHaveAttribute("data-setup-state", "READY_FOR_ANALYSIS")

  const margin = page.locator("#store-default-margin")
  await margin.fill("96")
  await margin.blur()
  await expect(page.getByText("Enter a margin between 0% and 95%.")).toBeVisible()
  await expect(readiness).toHaveAttribute("data-setup-state", "CONFIGURATION_INCOMPLETE")

  await margin.fill("0.20")
  await margin.blur()
  await expect(readiness).toHaveAttribute("data-setup-state", "READY_FOR_ANALYSIS")

  await chooseColumn(page, "supplier-cost-mapping", "Supplier SKU")
  await expect(
    page.getByText("This column is already being used as the product identifier."),
  ).toBeVisible()
  await expect(readiness).toHaveAttribute("data-setup-state", "CONFIGURATION_INCOMPLETE")

  await chooseColumn(page, "supplier-cost-mapping", "Unit Cost")
  await expect(readiness).toHaveAttribute("data-setup-state", "READY_FOR_ANALYSIS")

  await chooseColumn(page, "catalog-margin-override-mapping", "Selling Price")
  await expect(
    page.getByText("This column is already being used as the selling price."),
  ).toBeVisible()
  await expect(readiness).toHaveAttribute("data-setup-state", "CONFIGURATION_INCOMPLETE")
})

test("keeps the complete setup workflow usable at tablet and mobile widths", async ({
  page,
}) => {
  await selectInitialFiles(page)

  for (const viewport of [
    { width: 768, height: 900 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport)
    await expect(page.getByTestId("column-mapping-section")).toBeVisible()
    await expect(page.getByTestId("margin-settings-section")).toBeVisible()
    await expect(page.getByTestId("setup-readiness")).toHaveAttribute(
      "data-setup-state",
      "READY_FOR_ANALYSIS",
    )
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
      ),
    ).toBe(false)
  }
})
