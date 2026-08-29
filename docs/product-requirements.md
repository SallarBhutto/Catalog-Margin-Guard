# Catalog Margin Guard — Product Requirements

**Document:** Product Requirements Document (PRD)  
**Product:** Catalog Margin Guard  
**Release:** v0  
**Status:** Initial implementation source of truth

---

## 1. Purpose of This Document

This document defines **what Catalog Margin Guard v0 must do**, how users experience it, the business rules it follows, and what is explicitly outside v0 scope.

It is the source of truth for:

- product behavior
- user flows
- access rules
- privacy promises
- supported input behavior
- margin calculations
- result semantics
- data-quality behavior
- export behavior
- v0 scope and exclusions

This document intentionally does **not** prescribe detailed application architecture, package choices, repository structure, SQL implementation, deployment configuration, or test-framework setup. Those belong in the technical implementation specification.

If implementation decisions conflict with the product behavior defined here, this document wins unless the product requirements are explicitly changed.

---

# 2. Product Overview

## 2.1 Product Name

**Catalog Margin Guard**

## 2.2 Product Goal

Catalog Margin Guard helps resellers compare their supplier's current costs against their own current selling prices and quickly identify products that are:

- selling below supplier cost
- selling above cost but below the merchant's desired gross-margin target
- meeting or exceeding the desired gross-margin target

The core question is:

> Given my supplier's current cost file and my current catalog selling-price file, which products are selling at a loss or below the margin target I want for that product?

The application must also answer:

> What selling price would be required to reach that product's target gross margin?

## 2.3 Primary User

The primary v0 user is a reseller, merchant, distributor, ecommerce operator, or catalog/pricing manager who:

- receives supplier cost data in a file
- has a current product catalog with selling prices
- needs to check margin exposure across many SKUs
- may have one default margin target for most products
- may use product-specific margin targets for some SKUs
- wants a quick analysis without integrating systems or uploading sensitive supplier pricing to a third party

## 2.4 Core Value Proposition

Catalog Margin Guard should make it possible to go from two existing files to a useful margin-risk report in minutes, without requiring:

- system integration
- a database connection
- marketplace integration
- a paid subscription
- an account before seeing value
- uploading supplier or catalog data to Catalog Margin Guard

---

# 3. Product Philosophy

Catalog Margin Guard is a **deterministic margin-analysis tool**, not a general pricing engine.

It does not know or model:

- competitor pricing
- demand elasticity
- marketplace conditions
- category-specific market behavior
- shipping costs
- advertising costs
- marketplace fees
- fulfillment costs
- landed cost unless the user has already represented it as the supplied cost value

Therefore, the calculated price needed to achieve a target margin must **not** be described as:

- Suggested Price
- Recommended Price
- Optimal Price

Use product language such as:

- **Price for Target Margin**
- **Price Required for Target Margin**

The product must not claim that this calculated price is necessarily commercially optimal. It only states the price mathematically required to achieve the selected gross-margin target given the supplied cost.

---

# 4. v0 Product Principles

When product behavior is ambiguous, prefer the following principles:

1. **Show value before requiring sign-in.**
2. **Protect customer pricing data by keeping files on the customer's device.**
3. **Favor financial correctness over clever automation.**
4. **Report ambiguous data rather than guessing.**
5. **Keep v0 intentionally narrow.**
6. **Do not persist customer business data.**
7. **Do not imply capabilities the product does not have.**
8. **Large-catalog users should be able to evaluate the product before creating an account.**

---

# 5. Privacy Promise

The product must truthfully support the following customer-facing statement:

> 🔒 **Your files stay on your computer.**  
> Supplier pricing and catalog data are processed locally inside your browser and are never uploaded to Catalog Margin Guard.

Authentication must not invalidate this promise.

## 5.1 Business Data That Must Not Be Sent Remotely

Catalog Margin Guard must not send the following customer business data to authentication, analytics, logging, or application services:

- SKU or product identifier values
- supplier cost
- selling price
- calculated margin
- individual product rows
- supplier name inferred from data
- catalog contents
- customer column names
- original filenames
- analysis results
- margin target values tied to individual products

## 5.2 No Persistent Customer Business Data in v0

v0 must not persist:

- uploaded/selected supplier files
- uploaded/selected catalog files
- previous supplier files
- previous costs
- scan history
- SKU mappings
- column mappings
- analysis results
- pricing results
- per-product manual margin overrides between sessions
- imported product margin overrides outside the current analysis session

Refreshing the browser should reset the customer analysis.

This is intentional v0 behavior.

---

# 6. Access Model

v0 has two access levels:

1. **Anonymous**
2. **Signed In**

There is no paid plan in v0.

There is no subscription system in v0.

Authentication is used as a conversion/user-acquisition gate:

```text
Try product anonymously
        ↓
Receive real value
        ↓
Sign in free
        ↓
Unlock complete results and tools
```

The product must not require sign-in before the user receives meaningful analysis results.

---

# 7. Desired Product Funnel

The primary funnel is:

```text
Landing Page
      ↓
Choose Supplier File
      ↓
Choose Catalog File
      ↓
Inspect / Map Columns
      ↓
Configure Default Margin and Analysis Options
      ↓
Analyze Complete Catalog Locally
      ↓
Show Complete Summary
      ↓
Show Highest-Risk Products
      ↓
"We found N products needing attention"
      ↓
See All Results — Free
      ↓
Sign In
      ↓
Unlock Existing Analysis Instantly
      ↓
Search / Filter / Override / Export
```

Do **not** use a signup-first funnel such as:

```text
Landing Page
      ↓
Create Account
      ↓
Choose Files
```

---

# 8. Landing Page Requirements

The landing page should communicate the product's value quickly and clearly.

## 8.1 Primary Message

Preferred hero direction:

> **Find products quietly eating your margin.**

Supporting copy:

> Compare your supplier costs with your current catalog, see your actual gross margins, and identify products that need pricing review.

## 8.2 Primary CTA

Use:

**Check My Catalog**

The CTA should begin the file-analysis flow, not the signup flow.

## 8.3 Privacy Message

Prominently but calmly communicate:

> 🔒 Files stay on your computer.

## 8.4 Sign-In Link

An existing user may sign in from the header, but sign-in should remain secondary to trying the product.

---

# 9. File Workflow

The core workflow is:

```text
Choose Supplier File
        ↓
Choose Catalog File
        ↓
Inspect File Columns
        ↓
Map Columns
        ↓
Configure Margin Rules and Options
        ↓
Analyze
        ↓
Review Margin Exposure
        ↓
Authenticate If Needed
        ↓
Complete Review / Export
```

---

# 10. Supported File Formats

## 10.1 First-Class Formats

v0 must support:

- `.csv`
- `.tsv`

CSV is the priority format for large catalogs.

## 10.2 Excel

v0 should also support:

- `.xlsx`

Large Excel files should be treated more cautiously than CSV because browser processing may be resource intensive.

For an unusually large XLSX file, the user should be encouraged to export it as CSV rather than having the application upload it elsewhere.

Suggested message:

> **This Excel file is very large.**  
> For faster and more reliable processing, export it as CSV and try again.  
> Your file will still stay on your computer.

## 10.3 Not Supported in v0

Do not support legacy:

- `.xls`

---

# 11. File Selection Experience

Because files are not uploaded, user-facing language should avoid calling the action **Upload**.

Use language such as:

- **Choose Supplier File**
- **Choose Catalog File**

Support both:

- file picker
- drag and drop

After a file is selected, show basic local metadata such as:

- filename
- file size
- file format
- readiness/status

Example:

```text
supplier.csv
182.4 MB
CSV
✓ Ready
```

Displaying the local filename in the browser UI is allowed; it must not be transmitted remotely.

---

# 12. File Inspection and Preview

After selection, the application should:

1. detect the file type
2. inspect available columns
3. detect the delimiter when applicable
4. show a small sample preview, approximately 10–20 rows
5. identify likely mapping candidates
6. allow the user to confirm or change mappings
7. optionally determine row counts without blocking the primary workflow

The product should not require the entire file to be rendered or displayed to the user before analysis.

---

# 13. Column Mapping

## 13.1 Supplier File

Required mappings:

- **Product Identifier**
- **Supplier Cost**

Example:

```text
Product Identifier
[ Supplier SKU ▼ ]

Supplier Cost
[ Unit Cost ▼ ]
```

## 13.2 Catalog File

Required mappings:

- **Product Identifier**
- **Current Selling Price**

Optional mapping:

- **Per-product Margin Override**

Example:

```text
Product Identifier
[ SKU ▼ ]

Current Selling Price
[ Price ▼ ]

Per-product Margin Override
[ min_margin ▼ / None ]
```

## 13.3 Auto-Suggestion

The application should deterministically suggest likely columns based on common header names but must always let the user confirm or change the choice.

Likely product identifier headers may include:

- sku
- supplier_sku
- product_sku
- item_sku
- item_number
- item_no
- part_number
- part_no
- mpn
- upc
- ean
- gtin
- product_code
- item_code

Likely supplier cost headers may include:

- cost
- unit_cost
- supplier_cost
- wholesale_cost
- wholesale_price
- net_cost
- buy_price
- purchase_price

Likely selling-price headers may include:

- price
- selling_price
- sell_price
- retail_price
- regular_price
- current_price

Likely margin-override headers may include:

- margin
- target_margin
- minimum_margin
- min_margin
- margin_floor
- margin_pct
- target_margin_pct
- min_margin_pct
- minimum_margin_pct

AI-based column mapping is not required for v0.

---

# 14. Identifier Rules

## 14.1 Identifier Preservation

Product identifiers must initially be treated as identifiers, not ordinary numbers.

A value such as:

```text
001234
```

must remain:

```text
001234
```

and must not become `1234`.

## 14.2 Normalization

Default normalization is:

- trim surrounding whitespace

The application should provide an option:

**Ignore uppercase/lowercase differences** — enabled by default.

When enabled, matching is case-insensitive after trimming.

Normalization must **not** remove meaningful characters such as:

- `-`
- `_`
- `/`
- `.`
- leading zeroes

## 14.3 Identifier Compatibility Warning

Before analysis, remind users that the selected supplier and catalog identifier columns must represent the same identifier system.

Examples:

- Supplier SKU ↔ Supplier SKU
- UPC ↔ UPC
- MPN ↔ MPN

The product must not imply that mismatched identifier systems can be automatically reconciled in v0.

---

# 15. Product Matching

v0 matching is deterministic.

A supplier product matches a catalog product when their normalized identifiers are equal.

Do not implement in v0:

- fuzzy matching
- description matching
- AI product matching
- product-name matching
- UPC-to-SKU inference
- saved identifier mappings

Correctness is more important than maximizing match rate.

---

# 16. Duplicate Identifier Handling

Duplicate identifiers are ambiguous.

Example supplier data:

```text
ABC-12,96
ABC-12,102
```

The application must not arbitrarily choose one record.

Likewise, duplicate matching identifiers in the catalog are ambiguous.

Only identifiers that are unambiguous on the relevant side should participate in automatic analysis.

Ambiguous duplicates should be excluded from margin analysis and reported in Data Quality.

Report at least:

- Supplier duplicate identifiers
- Catalog duplicate identifiers

---

# 17. Analysis Configuration

Before analysis, allow the user to configure:

- store default gross-margin target
- optional catalog per-product margin override column
- number format
- display currency
- case-insensitive identifier matching

## 17.1 Store Default Margin

Every analysis requires one store-wide default gross-margin target.

Example:

```text
Store Default Margin
[ 20 ] %
```

Explain:

> Products without an individual override will use this target.

## 17.2 Number Format

Support at least:

- `1,234.56`
- `1.234,56`

The user should be able to choose the expected format when necessary.

## 17.3 Currency

No currency conversion is performed in v0.

Supplier cost and catalog selling price must use the same currency.

Allow display currency selection such as:

- USD
- GBP
- EUR
- CAD
- AUD
- Other

Currency selection affects formatting only.

Display a clear note:

> Supplier cost and catalog selling price must use the same currency.

---

# 18. Margin Target Model

The v0 model is intentionally simple:

```text
Store Default Margin
        +
Optional Per-Product Overrides
```

Example:

```text
Store default = 20%

ABC-12 = 10%
XYZ-88 = 30%
KLP-91 = no override
```

Effective targets:

```text
ABC-12 = 10%
XYZ-88 = 30%
KLP-91 = 20%
```

Do not add category-, brand-, supplier-, or channel-level margin rules in v0.

---

# 19. Sources of Per-Product Margin Overrides

v0 supports two current-session sources.

## 19.1 Catalog Override Column

The catalog may contain a mapped margin-target column.

Example:

```csv
sku,price,min_margin
ABC-12,105,10
XYZ-88,69,30
KLP-91,149,
```

Blank means use the store default.

## 19.2 Manual Session Override

A signed-in user may manually change the target margin for an individual product during the current browser session.

Example:

```text
ABC-12

Current target: 20%

Manual override
[ 10 ] %

[ Save Override ]
```

Manual overrides:

- exist only for the current session
- are never saved remotely
- disappear on refresh/reset
- are unavailable to anonymous users

---

# 20. Override Precedence

Use exactly this precedence:

```text
Manual Session Override
        ↓
Catalog Override Column
        ↓
Store Default Margin
```

In other words:

```text
effective target =
  manual override if present,
  otherwise catalog override if valid and present,
  otherwise store default margin
```

Removing a manual override must restore the catalog override if one exists; otherwise it must restore the store default.

---

# 21. Margin Override Validation

Valid UI range:

- **0% through 95%**

Margin-override values are percentages.

Examples:

```text
10   = 10%
20   = 20%
35.5 = 35.5%
0.20 = 0.20%
```

Do not interpret `0.20` as `20%`.

Invalid product override values must not fail the complete analysis.

If the product is otherwise usable:

- report the invalid override in Data Quality
- fall back to the store default margin for that product

---

# 22. Money Parsing Requirements

The application should accept common human-formatted monetary values such as:

```text
$96
$96.00
1,234.50
USD 96.00
£101.25
```

It should support both selected number-format conventions:

```text
US: 1,234.56
EU: 1.234,56
```

Bad or unparseable monetary rows must not crash the complete analysis.

---

# 23. Gross Margin Calculation

Catalog Margin Guard uses **gross margin**, not markup.

Formula:

```text
Gross Margin = (Selling Price - Supplier Cost) / Selling Price
```

Percentage:

```text
Gross Margin % = Gross Margin × 100
```

Example:

```text
Supplier Cost = 96
Selling Price = 105

(105 - 96) / 105 × 100
= 8.5714...%
```

Display may show:

```text
8.57%
```

The product may also calculate gross profit:

```text
gross profit = selling price - supplier cost
```

Gross profit does not need to be prominent in the initial UI.

---

# 24. Effective Target

Each analyzed product must have:

- effective target margin
- target source

Target source values conceptually represent:

- Manual Override
- Product/Catalog Override
- Store Default

The UI may show, for example:

```text
Target: 10%
Source: Product Override
```

---

# 25. Price for Target Margin

Formula:

```text
Price for Target Margin = Supplier Cost / (1 - Target Margin)
```

Example:

```text
Cost = 96
Target = 20%

96 / 0.80 = 120
```

Another example:

```text
Cost = 151
Target = 20%

151 / 0.80 = 188.75
```

The resulting required selling price must be rounded **up** to the nearest currency cent when necessary so that rounding cannot produce a price below the requested target margin.

This value must be labeled as **Price for Target Margin** or **Price Required for Target Margin**, not Suggested Price.

---

# 26. Product Statuses

Use exactly three primary statuses.

## 26.1 LOSS

If:

```text
selling price < supplier cost
```

status is:

**LOSS**

LOSS is objective and should receive the strongest visual emphasis.

## 26.2 REVIEW

If:

```text
selling price >= supplier cost
```

but:

```text
gross margin < effective target margin
```

status is:

**REVIEW**

REVIEW means the product is below the merchant-selected target. Do not describe it as universally wrong or unprofitable.

## 26.3 OK

If:

```text
gross margin >= effective target margin
```

status is:

**OK**

---

# 27. Invalid Records

Treat at least the following as invalid data conditions:

- empty identifier
- supplier cost below 0
- selling price less than or equal to 0
- unparseable supplier cost
- unparseable selling price
- invalid catalog margin override

Invalid pricing records must not crash the full analysis.

They should be reported in Data Quality and excluded where a valid margin calculation cannot be performed.

An invalid margin override alone should not invalidate an otherwise usable product; use the store default target instead.

---

# 28. Margin Exposure Distribution

Always show the actual gross-margin distribution across successfully analyzed products.

Use non-overlapping buckets:

- below 0%
- 0–5%
- 5–10%
- 10–15%
- 15–20%
- 20–30%
- 30%+

Example:

```text
Margin Exposure

Below cost        7
0–5%             31
5–10%           104
10–15%          386
15–20%          712
20–30%        4,281
30%+          13,380
```

This full distribution remains visible to anonymous users.

---

# 29. Summary Metrics

Calculate and display at least:

- Products analyzed
- Products at loss
- Products needing review
- Products meeting target
- Average gross margin
- Products using store default target
- Products using a product-specific target

Example:

```text
18,901 analyzed
7 selling below cost
1,226 needing review
17,668 meeting target
28.4% average gross margin

17,901 using store default
1,000 using product-specific target
```

For the high-level target-source summary, catalog and manual product overrides may both count as product-specific targets.

The complete summary remains visible to anonymous users.

---

# 30. Data Quality Summary

Calculate and expose at least:

- Supplier rows
- Catalog rows
- Matched products
- Supplier-only products
- Catalog-only products
- Supplier duplicate identifiers
- Catalog duplicate identifiers
- Invalid supplier costs
- Invalid catalog selling prices
- Invalid product margin overrides

Example:

```text
Supplier rows                  21,481
Catalog rows                   19,233
Matched                        18,901
Supplier-only                   2,568
Catalog-only                      332
Duplicate supplier IDs             11
Duplicate catalog IDs                4
Invalid supplier costs               7
Invalid selling prices                3
Invalid margin overrides              2
```

The complete Data Quality summary remains visible to anonymous users.

---

# 31. Results Table

The complete results view should support these core columns:

- Product Identifier / SKU
- Supplier Cost
- Selling Price
- Gross Margin
- Target Margin
- Target Source
- Price for Target Margin
- Status

Example REVIEW product:

```text
ABC-12
Supplier Cost          $96.00
Selling Price         $105.00
Gross Margin             8.57%
Target Margin           10.00%
Target Source         Override
Price for Target       $106.67
Status                  REVIEW
```

Example LOSS product:

```text
KLP-91
Supplier Cost         $151.00
Selling Price         $149.00
Gross Margin            -1.34%
Target Margin           20.00%
Target Source          Default
Price for Target       $188.75
Status                   LOSS
```

---

# 32. Anonymous User Requirements

Anonymous users process the **complete selected files** for analysis.

Commercial gating must not reduce the analysis to only a sample of rows.

Anonymous users may:

- choose supplier and catalog files
- inspect file columns
- preview sample rows
- map required columns
- optionally map a catalog margin-override column
- configure store default margin
- configure number format, currency, and identifier case behavior
- run the complete local analysis
- see the complete summary metrics
- see the complete margin distribution
- see the complete Data Quality summary
- see up to 20 highest-risk products

Anonymous users may not:

- see the unrestricted complete results table
- paginate through the complete dataset
- perform unrestricted full-dataset identifier search
- download exports
- create manual per-product margin overrides

Browser/device safety limitations still apply regardless of authentication status.

---

# 33. Anonymous Result Preview

The anonymous result preview is limited to a configurable maximum of **20 products**.

It must show the highest-risk products, not a random sample.

Priority order:

1. LOSS first
2. REVIEW second
3. lower gross margin first within those groups

If fewer than 20 products need attention, show all of them.

The preview is primarily intended to expose LOSS and REVIEW products.

Example result area:

```text
18,901 products analyzed

🚨 7 LOSS
⚠️ 1,226 REVIEW
✅ 17,668 OK

Average Gross Margin
28.4%

[complete Margin Exposure]

Highest Risk Products

SKU       Cost      Price      Margin     Target      Status
KLP-91    $151      $149       -1.34%      20%        LOSS
ABC-12     $96      $105        8.57%      10%        REVIEW
...
```

After the preview, communicate how much remains locked.

Example:

```text
Showing 20 of 1,233 products needing attention.
1,213 more products are hidden.

[ See All Results — Free ]

✓ No credit card
✓ Files stay on your computer
✓ Signing in does not upload your catalog
```

Do not imply payment is required.

---

# 34. Authentication Experience

Sign-in should support common low-friction methods such as:

- Continue with Google
- Email

Avoid requiring custom account-management workflows for v0 when the authentication provider can handle them.

## 34.1 Sign-In Without Losing Analysis

This is a critical product requirement.

Flow:

```text
Anonymous analysis completed
        ↓
User sees summary + preview
        ↓
User clicks See All Results — Free
        ↓
Sign-in opens without resetting the analysis
        ↓
Authentication succeeds
        ↓
Existing analysis unlocks immediately
```

After successful sign-in, do **not**:

- refresh the page as part of the normal unlock flow
- ask the user to choose the files again
- discard the active analysis
- rerun the complete analysis unnecessarily

Signing in should feel like unlocking the result that already exists.

## 34.2 Authentication Failure

If authentication fails:

- preserve the selected files while the current page/session remains active
- preserve the completed anonymous analysis
- preserve the anonymous preview
- allow the user to retry authentication

Authentication failure must not force the user to restart the scan.

## 34.3 Privacy Copy Near Sign-In

Use copy such as:

> Signing in only creates your Catalog Margin Guard account.  
> Your supplier and catalog files remain on your computer and are not uploaded.

---

# 35. Signed-In User Requirements

Signed-in users may:

- see all analyzed results
- paginate through the complete result set
- search all analyzed products
- sort and filter results
- view all LOSS products
- view all REVIEW products
- view all OK products
- create session-only manual margin overrides
- remove manual margin overrides
- download Products To Review CSV
- download Full Margin Report CSV

There are no artificial result-count limits for signed-in users in v0 beyond practical browser/device constraints.

---

# 36. Full Result Search, Filter, Sort, and Pagination

## 36.1 Status Filter

Support:

- All
- Loss
- Needs Review
- Meeting Target

## 36.2 Target Source Filter

Support:

- All
- Store Default
- Product Override

Manual and catalog overrides may both appear as Product Override in the high-level filter.

## 36.3 Search

Support searching by product identifier/SKU across the complete analyzed dataset for signed-in users.

## 36.4 Sorting

Support sorting by at least:

- Identifier
- Margin
- Supplier Cost
- Selling Price
- Target Margin
- Price for Target Margin

## 36.5 Pagination

Default signed-in page size:

- 100 rows

Page-size options:

- 50
- 100
- 250

The UI must never attempt to render the entire million-row dataset at once.

---

# 37. Manual Override Experience

Signed-in users may change a product's target margin during the current session.

Example:

```text
ABC-12

Store default:       20%
Catalog override:    15%
Current target:      15%

Manual override:
[ 10 ] %

[ Save Override ]
```

Also provide:

**Remove Manual Override**

Removing it falls back to:

1. catalog override if present and valid
2. otherwise store default

Changing a manual override should update the relevant product calculations and affected summaries without forcing the user to reselect or reprocess the source files from the beginning.

If an anonymous user reaches a manual-override action, show a sign-in prompt such as:

> Sign in free to set individual product targets.

---

# 38. Exports

Exports are available to signed-in users only and are generated from the current local analysis.

## 38.1 Products To Review

Include products with status:

- LOSS
- REVIEW

Columns:

- identifier
- supplier_cost
- selling_price
- gross_margin_percent
- target_margin_percent
- target_source
- price_for_target_margin
- status

Suggested filename:

```text
products-to-review-YYYY-MM-DD.csv
```

## 38.2 Full Margin Report

Include all successfully analyzed products.

Columns:

- identifier
- supplier_cost
- selling_price
- gross_margin_percent
- target_margin_percent
- target_source
- price_for_target_margin
- status

Suggested filename:

```text
catalog-margin-report-YYYY-MM-DD.csv
```

## 38.3 Export Safety

Exports must correctly handle user-derived text that could be interpreted as spreadsheet formulas.

Text values beginning with characters such as:

- `=`
- `+`
- `-`
- `@`

must be safely escaped when necessary.

CSV output must also correctly handle:

- commas
- quotes
- newlines

Generated monetary and percentage columns should remain numeric where appropriate.

## 38.4 Anonymous Export Gate

If an anonymous user attempts export, use copy such as:

> Sign in free to download your complete margin report.

Use terms such as:

- Sign in free
- See All Results — Free

Do not use:

- Upgrade
- Subscribe
- Start Trial
- Buy

because there is no paid plan in v0.

---

# 39. Processing Experience

During analysis, show truthful stage-based progress such as:

- Preparing supplier file…
- Preparing catalog file…
- Checking product identifiers…
- Matching products…
- Calculating margins…
- Applying margin rules…
- Preparing results…

Do not show fake exact percentage progress when meaningful percentages are unavailable.

The interface should remain usable and responsive while large analyses are running.

---

# 40. Cancel Analysis

Provide a **Cancel Analysis** action while analysis is in progress.

After cancellation:

- stop the current analysis
- return the user to a safe state where they can try again
- do not show partial results as though they were complete

The user should not need to refresh the entire website to recover from cancellation.

---

# 41. Start New Scan

Provide a **Start New Scan** action from the results experience.

It should clear the current customer analysis context, including:

- selected source files
- mappings
- current results
- manual overrides
- current scan state

The user's authentication session may remain active.

The previous catalog data must not remain available as a saved scan.

---

# 42. Sign Out

When a signed-in user signs out:

- access returns to Anonymous
- full-result access is restricted again
- export access is removed
- manual override controls are removed
- full search/pagination is removed
- manual session overrides are cleared

Previously unlocked complete-result rows must not remain exposed in the rendered interface after sign-out.

If safely possible, the active analysis may remain available in memory so the user returns to the anonymous preview. If this would risk leaking previously unlocked data, privacy wins and the active analysis should be cleared.

---

# 43. Error Handling

Errors should be understandable to nontechnical users.

Relevant error conditions include:

- unsupported file format
- empty file
- delimited-file parse failure
- XLSX too large for reliable browser processing
- missing header row
- duplicate column names
- mapped column no longer available
- no matching products
- invalid default margin
- insufficient valid prices
- browser memory/resource failure
- analysis cancelled
- unknown processing error

Primary error messages should be user-friendly rather than raw engine errors.

Example:

> **We couldn't find matching product identifiers.**  
> Check that the Supplier Identifier and Catalog Identifier columns use the same type of identifier, such as SKU ↔ SKU.

Optional technical details may be exposed separately for troubleshooting, but should not be the primary error experience.

---

# 44. Large Catalog Requirements

The product is intended to handle realistic business datasets such as:

- 100k rows
- 500k rows
- 1M+ rows where the browser/device can support it

Large catalog users must not be commercially blocked from running the complete analysis merely because they are anonymous.

Browser/device limits still exist, so the product may provide safety warnings.

Suggested guidance:

- CSV up to roughly 500 MB: normal path where device resources permit
- CSV above roughly 500 MB: allow when technically feasible, but warn that desktop memory requirements may be significant
- XLSX up to roughly 50 MB: supported target
- XLSX above roughly 50 MB: recommend exporting to CSV

These are product safety guidelines, not promises that every device can process every file of those sizes.

---

# 45. Device and Browser Experience

## 45.1 Desktop Priority

Large-file catalog analysis is primarily a desktop B2B workflow.

The marketing site and basic application flow should be responsive, but v0 does not need to optimize million-row analysis for phones.

On smaller devices, show guidance such as:

> For large catalogs, we recommend using Catalog Margin Guard on a desktop computer.

## 45.2 Browser Support Target

Target current versions of:

- Chrome
- Edge
- Firefox
- Safari

A user should receive a clear error or fallback experience when their browser cannot safely perform the analysis rather than experiencing an unexplained failure.

---

# 46. Header Requirements

Anonymous state:

```text
Catalog Margin Guard                              Sign in
```

Signed-in state:

```text
Catalog Margin Guard                           [ User Menu ]
```

Account-management UI should remain simple in v0.

---

# 47. Main Analysis Screen — Content Requirements

The main analysis experience should make the workflow visually obvious.

Approximate content structure:

```text
Catalog Margin Guard

Find margin problems before they cost you money.

1. Supplier File
[ Choose Supplier File ]

2. Current Catalog
[ Choose Catalog File ]

Supplier Mapping
Product Identifier [ ... ]
Supplier Cost      [ ... ]

Catalog Mapping
Product Identifier       [ ... ]
Selling Price             [ ... ]
Product Margin Override   [ ... / None ]

Store Default Margin
[ 20 ] %
Products without an individual override will use this target.

Number Format
● 1,234.56
○ 1.234,56

Currency
[ USD ▼ ]

☑ Ignore uppercase/lowercase differences

[ Analyze Catalog ]

🔒 Files stay on your computer.
```

The final visual design may refine this layout, but the functionality and hierarchy above must remain easy to understand.

---

# 48. Anonymous Results Screen — Content Requirements

The anonymous results screen should prioritize proof of value, not the sign-in wall.

Recommended order:

1. products analyzed
2. LOSS / REVIEW / OK summary
3. average gross margin
4. complete Margin Exposure distribution
5. highest-risk product preview
6. count of additional hidden attention products
7. See All Results — Free CTA
8. privacy reassurance
9. Data Quality summary

Example:

```text
18,901 products analyzed

🚨 7 LOSS
⚠️ 1,226 REVIEW
✅ 17,668 OK

Average Gross Margin
28.4%

Margin Exposure
...

Highest Risk Products
...

Showing 20 of 1,233 products needing attention.
1,213 more products are hidden.

[ See All Results — Free ]

No credit card required.
Your files stay on your computer.

Data Quality
...
```

---

# 49. Signed-In Results Screen — Content Requirements

Recommended order:

1. complete summary
2. search and filters
3. complete paginated result table
4. export actions
5. Data Quality summary

Example:

```text
18,901 products analyzed

🚨 7 LOSS
⚠️ 1,226 REVIEW
✅ 17,668 OK

Average Margin
28.4%

[ Search SKU ]
[ Status ▼ ]
[ Target Source ▼ ]
[ Margin ↑ ]

Complete paginated result table

[ Download Products To Review ]
[ Download Full Margin Report ]

Data Quality
```

---

# 50. Analytics and Telemetry Product Rules

Analytics is optional and is not required to ship v0.

If analytics is introduced, only coarse/non-business-data events may be collected, for example:

- scan started
- scan completed
- scan failed
- file type such as CSV/XLSX
- coarse row-count bucket
- coarse duration bucket
- sanitized technical error code

Potential row-count buckets:

- under 10k
- 10k–100k
- 100k–500k
- 500k–1M
- over 1M

Analytics must never include:

- filename
- SKU
- supplier cost
- selling price
- margin
- product row
- customer column names
- supplier name
- catalog contents

Analytics must never invalidate the files-stay-on-your-computer privacy promise.

---

# 51. v0 Explicit Exclusions

The following are explicitly outside v0 scope:

## Historical Data and Persistence

- previous supplier cost
- cost history
- old-vs-new cost comparison
- saved scans
- saved files
- saved mappings
- saved overrides
- persistent margin rules

## Advanced Margin Rules

- brand-level rules
- category-level rules
- supplier-level rules
- channel-level rules

## Full Cost / Profit Modeling

- shipping cost modeling
- fulfillment cost modeling
- marketplace-fee modeling
- advertising-cost modeling
- landed-cost calculation
- profit forecasting

## Integrations

- Shopify integration
- Amazon integration
- WooCommerce integration
- Magento integration
- ERP integrations
- supplier API integration

## Automation

- scheduled monitoring
- email alerts
- automatic repricing

## Market Intelligence

- competitive pricing
- competitor scraping
- market-price recommendation

## AI / Matching

- AI column mapping
- AI product matching
- fuzzy matching

## Billing / Enterprise Features

- payments
- subscription plans
- billing database
- teams
- organizations
- RBAC

Do not expand v0 scope merely because one of these features may be useful later.

---

# 52. Future Billing Preparation

Billing is not a v0 product requirement.

The current model is:

```text
ANONYMOUS
SIGNED IN
```

A future product may evolve to:

```text
ANONYMOUS
FREE
PAID
```

The v0 product should avoid UX assumptions that would make this evolution unnecessarily difficult, but no payment, subscription, entitlement, or billing workflow should be built now.

Authentication in v0 is primarily a conversion gate, not a hardened commercial paywall.

---

# 53. Core Domain Rules — Canonical Summary

These rules are the heart of Catalog Margin Guard.

## 53.1 Effective Target

```text
effective target margin =
  manual override
  else catalog product override
  else store default margin
```

## 53.2 Status

```text
if selling price < supplier cost:
    LOSS
else if gross margin < effective target margin:
    REVIEW
else:
    OK
```

## 53.3 Gross Margin

```text
gross margin % =
  ((selling price - supplier cost) / selling price) × 100
```

## 53.4 Price for Target Margin

```text
price for target margin =
  supplier cost / (1 - effective target margin)
```

Round the resulting required selling price upward to the nearest cent where necessary.

---

# 54. Worked Example

Supplier file:

```csv
sku,cost
ABC-12,96
XYZ-88,44
KLP-91,151
```

Catalog file:

```csv
sku,price,min_margin
ABC-12,105,10
XYZ-88,69,30
KLP-91,149,
```

Store default margin:

```text
20%
```

Effective targets:

```text
ABC-12 → 10%  (catalog override)
XYZ-88 → 30%  (catalog override)
KLP-91 → 20%  (store default)
```

Expected result:

```text
SKU       Cost      Sell      Margin      Target      Status
ABC-12    $96       $105       8.57%       10%        REVIEW
XYZ-88    $44        $69      36.23%       30%        OK
KLP-91   $151       $149      -1.34%       20%        LOSS
```

For KLP-91 at a 20% target:

```text
Price for Target Margin = 151 / 0.80 = 188.75
```

---

# 55. v0 Definition of Done — Product Acceptance Criteria

v0 is product-complete when all of the following are true.

## Entry and Privacy

1. A user can open the application without authentication.
2. The user can begin the catalog-check workflow before signing in.
3. Supplier/catalog business data never leaves the user's browser as part of Catalog Margin Guard processing.
4. The product truthfully communicates that files stay on the user's computer.
5. Refreshing removes the active customer analysis data.

## File Selection and Mapping

6. The user can choose a supplier CSV/TSV.
7. The user can choose a catalog CSV/TSV.
8. XLSX is supported within practical v0 limits.
9. File columns can be inspected and previewed.
10. The user can map supplier identifier and supplier cost.
11. The user can map catalog identifier and selling price.
12. The user can optionally map a per-product margin-override column.
13. The user can set one store-wide default margin.
14. Identifier leading zeroes are preserved.
15. Case-insensitive matching can be used.

## Data Correctness

16. Product matching is deterministic.
17. Ambiguous duplicate identifiers are not arbitrarily matched.
18. Common money formats can be parsed according to the selected number format.
19. Invalid prices are reported without crashing the complete scan.
20. Invalid per-product margin overrides fall back correctly.
21. Gross-margin calculation is correct.
22. Store-default fallback is correct.
23. Catalog override precedence is correct.
24. Manual override precedence is correct.
25. LOSS classification is correct.
26. REVIEW classification is correct.
27. OK classification is correct.
28. Price-for-target calculation is correct.
29. Required selling price rounds upward correctly.

## Results

30. The complete summary is produced.
31. The complete margin distribution is produced.
32. The complete Data Quality summary is produced.
33. Results expose supplier cost, selling price, gross margin, target, target source, price for target margin, and status.

## Anonymous Experience

34. Anonymous users can analyze the complete selected dataset, subject to browser safety limits.
35. Anonymous users see the complete summary.
36. Anonymous users see the complete Margin Exposure distribution.
37. Anonymous users see the complete Data Quality summary.
38. Anonymous users see no more than the configured 20 highest-risk attention products.
39. The preview prioritizes LOSS, then REVIEW, then lowest margin.
40. Anonymous users cannot browse unrestricted full results.
41. Anonymous users cannot export reports.
42. Anonymous users cannot create manual product overrides.
43. The CTA clearly offers free sign-in rather than implying payment.

## Authentication Unlock

44. The user can sign in free.
45. Authentication failure does not discard the current anonymous analysis.
46. Successful sign-in unlocks the existing analysis without forcing a new file selection.
47. Successful sign-in does not unnecessarily rerun the complete analysis.
48. Signing in does not upload supplier/catalog data.

## Signed-In Experience

49. Signed-in users can view all results.
50. Signed-in users can search the complete analyzed dataset by identifier.
51. Signed-in users can filter results by status.
52. Signed-in users can filter by target source.
53. Signed-in users can sort supported columns.
54. Signed-in users can paginate complete results.
55. Signed-in users can create a manual target override.
56. Manual override beats catalog override.
57. Catalog override beats store default.
58. Removing a manual override restores the correct fallback.
59. Manual override changes do not force source files to be selected/processed again from scratch.

## Exports and Session Controls

60. Signed-in users can download Products To Review CSV.
61. Signed-in users can download Full Margin Report CSV.
62. Exported customer text is protected against spreadsheet-formula injection.
63. The user can cancel an active analysis safely.
64. Start New Scan clears the current customer's analysis data.
65. Signing out safely removes authenticated-only access and clears manual session overrides.
66. Previously unlocked complete rows are not left visible after sign-out.

## Usability

67. Processing presents truthful progress stages.
68. The UI remains usable while realistic large files are being processed on a capable desktop device.
69. The application provides understandable errors for common failure conditions.
70. Mobile users receive appropriate desktop guidance for large-catalog workflows.

---

# 56. Product Success Signals for v0

These are useful product-learning signals, not launch blockers unless explicitly promoted later.

We want to learn:

- Do visitors start a catalog scan before signing up?
- What percentage complete an analysis successfully?
- How often does the analysis find LOSS or REVIEW products?
- What percentage of users click **See All Results — Free** after seeing the preview?
- What percentage successfully sign in after analysis?
- Do signed-in users use search/filtering?
- Do users export Products To Review or the Full Margin Report?
- What file-size/row-count ranges are common among real users?
- Are large-file browser limitations a meaningful adoption blocker?

Any measurement mechanism must obey the privacy requirements in this document.

---

# 57. Final v0 Product Summary

Catalog Margin Guard v0 is a focused, privacy-first catalog margin checker.

A user should be able to:

```text
choose supplier costs
        +
choose current catalog prices
        +
set one default margin target
        +
optionally use product-specific targets
        ↓
run a complete local analysis
        ↓
see which products are LOSS / REVIEW / OK
        ↓
see the price mathematically required for the target margin
        ↓
receive real value before signing in
        ↓
sign in free to unlock complete review tools and exports
```

It is deliberately **not** a historical cost monitor, marketplace pricing engine, automatic repricer, integration platform, or full profitability system in v0.

The central product promise is simple:

> **Find margin problems in the catalog you already have, without uploading your supplier pricing to us.**
