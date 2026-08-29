# Catalog Margin Guard — Technical Requirements

**Document:** Technical Requirements / Engineering Specification  
**Product:** Catalog Margin Guard  
**Release:** v0  
**Status:** Initial implementation source of truth  
**Companion document:** `docs/product-requirements.md`

---

## 1. Purpose of This Document

This document defines **how Catalog Margin Guard v0 must be engineered**.

It is the source of truth for:

- system architecture
- technology choices
- browser-local processing
- dependency boundaries
- large-file handling
- DuckDB-Wasm usage
- React/data ownership boundaries
- authentication integration
- privacy enforcement
- security controls
- performance constraints
- error handling
- testing strategy
- deployment
- repository structure
- implementation order

`docs/product-requirements.md` remains the source of truth for **what the product does** and **how users experience it**.

If this document conflicts with the product requirements on product behavior, privacy promises, calculations, access rules, or v0 scope, the product requirements win.

Do not silently broaden product scope while implementing this specification.

---

# 2. Engineering Principles

When implementation choices are ambiguous, use these priorities in order:

1. **Customer files stay local.**
2. **Financial correctness beats cleverness.**
3. **The UI must remain responsive on large inputs.**
4. **Do not materialize entire catalogs in React or ordinary JavaScript arrays.**
5. **Report ambiguous/bad data instead of guessing.**
6. **Prefer a small v0 architecture over future-proof infrastructure.**
7. **Use existing well-maintained libraries for commodity concerns.**
8. **Keep product/domain logic independent from React components and Clerk.**
9. **Production deployment behavior matters more than localhost behavior.**
10. **Do not add a backend merely because the product is a SaaS.**

---

# 3. High-Level Architecture

Catalog Margin Guard v0 is a **static browser application with remote identity only**.

```text
                               INTERNET

                  ┌──────────────────────────┐
                  │     Cloudflare Pages     │
                  │                          │
                  │ React / TS / JS / WASM  │
                  └────────────┬─────────────┘
                               │
                           static app
                               │
                               ▼
              ┌──────────────────────────────────┐
              │         CUSTOMER BROWSER         │
              │                                  │
              │ supplier.csv    catalog.csv      │
              │      │               │           │
              │      └───────┬───────┘           │
              │              ▼                   │
              │       DuckDB-Wasm                │
              │       Worker / local memory      │
              │              │                   │
              │              ▼                   │
              │      normalized data             │
              │              │                   │
              │              ▼                   │
              │       matched products           │
              │              │                   │
              │              ▼                   │
              │     margin-analysis views        │
              │              │                   │
              │     ┌────────┴────────┐          │
              │     ▼                 ▼          │
              │ React UI        local CSV export │
              └──────────────────────────────────┘

                       separate channel

              Browser ───────────────► Clerk
                        identity/session only
```

There is **no application API/backend** in v0.

There is **no database service** in v0.

There is **no object storage** in v0.

There is **no queue/cache infrastructure** in v0.

---

# 4. v0 Technology Stack

Use the following stack.

## 4.1 Application

- React
- TypeScript
- Vite
- Tailwind CSS
- shadcn/ui components as editable source-level UI primitives
- Lucide React for icons

## 4.2 Local Data Processing

- `@duckdb/duckdb-wasm`
- Web Workers

## 4.3 Tables / Large Result Rendering

- `@tanstack/react-table`
- `@tanstack/react-virtual` where virtualization is useful

TanStack Table is a **view/controller layer for the current result page**, not the owner of the complete catalog dataset.

## 4.4 Validation

- Zod

Use Zod for application configuration, mappings, user-entered settings, worker message contracts where useful, and other small structured payloads.

Do not run full catalog rows through Zod one by one.

## 4.5 Authentication

- Clerk
- `@clerk/react`

Use Clerk only for identity/session/authentication concerns.

## 4.6 XLSX

- SheetJS Community Edition

Install/pin it from the official SheetJS distribution channel supported for bundlers rather than relying on a stale registry copy.

XLSX is secondary to the CSV/TSV path.

## 4.7 Testing

- Vitest
- React Testing Library where component-level tests provide value
- Playwright

## 4.8 Package / Repository / Hosting

- pnpm
- Git
- GitHub
- Cloudflare Pages

---

# 5. Technologies Explicitly Not Required in v0

Do not introduce the following unless the requirements are explicitly changed:

- Next.js
- NestJS
- Express
- React Router unless URL-level routing becomes concretely necessary
- PostgreSQL
- MySQL
- SQLite service
- Supabase
- Firebase
- Cloudflare D1
- Redis
- RabbitMQ
- Kafka
- GraphQL
- Prisma
- Redux
- Docker
- Kubernetes
- server-side catalog processing
- object storage
- serverless functions for catalog processing
- background jobs
- backend sessions
- custom OAuth server
- custom password system
- payment infrastructure

A static SPA is sufficient for v0.

---

# 6. Dependency and Version Policy

At project creation:

- use current stable versions that are mutually compatible
- commit `pnpm-lock.yaml`
- pin the package manager version through the `packageManager` field
- use a current Node.js LTS release for development/CI and pin it in the repository
- do not use broad unbounded dependency ranges intentionally

Do not hard-code library APIs from old examples without checking the installed version.

For security-sensitive and infrastructure-sensitive libraries such as Clerk, DuckDB-Wasm, Vite, and SheetJS, use their current official documentation during implementation.

---

# 7. Project Initialization

The initial project should be a React + TypeScript Vite application.

Configure:

- TypeScript strict mode
- ESLint
- consistent formatting
- Vite production build
- Tailwind
- `@/*` source alias
- shadcn/ui
- Vitest
- Playwright
- environment variable typing

Do not build product pages before these repository documents have been read:

```text
AGENTS.md
docs/product-requirements.md
docs/technical-requirements.md
docs/design.md
.agents/skills/professional-web-ui/SKILL.md
```

`docs/design.md` will be created after this technical specification and becomes the visual source of truth.

---

# 8. UI Technical Foundation

The product must not accumulate page-specific styling conventions.

Use:

```text
Tailwind tokens/utilities
        ↓
shadcn/ui source primitives
        ↓
product-specific shared components
        ↓
feature components/pages
```

Rules:

- shadcn/ui is a component foundation, not the product's final visual identity
- customize components according to `docs/design.md`
- use Lucide as the single icon family unless a concrete exception is required
- add only shadcn components actually used by the product
- do not import a second broad component system such as MUI, Ant Design, Chakra, or Bootstrap
- reuse shared primitives for buttons, inputs, selects, dialogs, tooltips, badges, tables, alerts, and file-selection controls
- keep accessibility behavior from primitives intact
- do not scatter raw arbitrary color/radius/spacing values through feature components

UI visual-quality requirements are additionally governed by the `professional-web-ui` skill.

---

# 9. Infrastructure Model

v0 infrastructure is intentionally small:

```text
GitHub repository
        +
Cloudflare Pages
        +
Clerk
        +
customer browser compute
```

The application should be deployable without provisioning:

- application servers
- databases
- object stores
- queues
- caches
- Kubernetes
- VMs

The architecture must remain easy to run locally with:

```bash
pnpm install
pnpm dev
```

and easy to build with:

```bash
pnpm build
```

---

# 10. Business Data Persistence

Customer catalog/business data is **session-only**.

Do not persist customer business data in:

- localStorage
- sessionStorage
- IndexedDB
- OPFS
- Cache Storage
- service-worker caches
- remote databases
- object storage
- Clerk metadata

This prohibition covers:

- supplier/catalog files
- rows
- SKUs
- costs
- selling prices
- mappings
- analysis results
- manual product overrides
- imported per-product overrides
- prior scans

An in-memory DuckDB database is the main temporary analysis store.

Normal non-business application settings may only be persisted later if explicitly approved; do not add such persistence by default in v0.

---

# 11. DuckDB-Wasm Runtime

Use `@duckdb/duckdb-wasm` as the browser-local analytical engine.

## 11.1 Database Mode

Use an in-memory database.

Conceptually:

```text
:memory:
```

Do not persist the DuckDB database to OPFS or IndexedDB.

## 11.2 Worker Isolation

DuckDB work must execute outside the React main thread.

Use the asynchronous DuckDB API backed by a Web Worker.

The React main thread must not perform:

- large CSV parsing
- whole-catalog normalization loops
- million-row filtering
- million-row sorting
- expensive matching
- complete result materialization

## 11.3 Self-Hosted Runtime Assets

Production DuckDB assets must be served from the application deployment rather than depending on a third-party runtime CDN.

Self-host the required:

- WASM modules
- DuckDB worker scripts
- pthread worker if/when COI is enabled

The deployment must serve `.wasm` with the correct MIME type.

## 11.4 Bundle Fallback

Support the DuckDB bundle hierarchy available to the installed package:

```text
COI/threaded (when safely available)
        ↓
EH
        ↓
MVP
```

The application must function correctly without threaded WASM.

---

# 12. Threading / Cross-Origin Isolation Strategy

Threaded DuckDB is an **optional performance enhancement**, not a functional dependency for v0.

The baseline production application must work on the non-threaded `eh`/`mvp` path.

Reason:

- the `coi` bundle requires cross-origin isolation
- cross-origin isolation requires restrictive COOP/COEP behavior
- Clerk/authentication and other third-party resources must continue to work reliably

Therefore:

1. implement and verify the complete app using EH/MVP fallback first
2. self-host COI artifacts so the architecture can support threading
3. enable COOP/COEP only after deployed Clerk sign-in/sign-up/Google auth flows are proven compatible
4. if COI breaks authentication or essential third-party behavior, ship non-threaded v0
5. do not block launch on `SharedArrayBuffer`

If COI is enabled, verify at runtime:

```typescript
window.crossOriginIsolated === true
```

and let DuckDB feature-detect the compatible bundle.

Do not assume localhost behavior proves production COI compatibility.

---

# 13. DuckDB Lifecycle and Cleanup

Create one controlled application-level service responsible for DuckDB lifecycle.

It should own:

- worker creation
- DB instantiation
- connections
- registered input files
- temp tables/views
- queries
- cancellation/reset
- cleanup

Avoid allowing arbitrary feature components to create unmanaged DuckDB connections.

On `Start New Scan` or terminal cleanup:

1. stop/ignore in-flight UI requests
2. close active DuckDB connections
3. drop temporary views/tables where useful
4. unregister/drop registered input files
5. release browser `File` / `Blob` references
6. clear manual overrides
7. clear React analysis metadata
8. terminate/recreate the worker when that is the safest cleanup path

Do not retain customer data longer than required.

---

# 14. Supported Input Formats

v0 supports:

```text
.csv     first-class
.tsv     first-class
.xlsx    supported with tighter safety limits
```

Do not support legacy `.xls` in v0.

CSV/TSV is the primary large-catalog path.

---

# 15. CSV / TSV Ingestion Architecture

Large delimited files must be handled by DuckDB directly.

## 15.1 Do Not Fully Materialize Files in JavaScript

For large files, do not use patterns equivalent to:

```typescript
await file.text()
await file.arrayBuffer()
```

for the entire file unless a narrowly bounded operation absolutely requires it.

Do not convert the full file into:

```typescript
Array<Record<string, unknown>>
```

Do not store all rows in React.

## 15.2 Register Browser Files Directly

Register the browser `File` with DuckDB-Wasm using an internal synthetic name such as:

```text
supplier-input.csv
catalog-input.csv
```

The original filename may be shown locally in the UI but must not be:

- interpolated into SQL
- logged remotely
- sent to Clerk
- sent to telemetry

## 15.3 Raw CSV Types

Read raw CSV/TSV columns as strings first.

Use the equivalent DuckDB CSV setting:

```text
all_varchar = true
```

This is a deliberate correctness requirement.

It prevents identifier-like values such as:

```text
001234
```

from being inferred as numeric `1234` before the user maps the identifier column.

Explicitly parse only the selected monetary/percentage columns later.

## 15.4 Delimiter Detection

Allow DuckDB CSV sniffing for delimiter/quoting/header behavior where reliable.

For `.tsv`, prefer tab as the expected delimiter while still validating the result.

If automatic inspection is ambiguous or fails, show a friendly file-parse error rather than silently misreading the file.

---

# 16. XLSX Handling

XLSX is supported as a convenience format, not the preferred high-scale path.

## 16.1 Parser

Use SheetJS Community Edition in a dedicated worker or worker-owned processing path.

Do not parse a large workbook on the React main thread.

## 16.2 Soft File Limit

Use configurable defaults such as:

```typescript
MAX_XLSX_FILE_SIZE = 50 * 1024 * 1024
```

If an XLSX exceeds the threshold, recommend CSV rather than uploading it to a server.

This is a safety threshold, not a statement that every smaller workbook will always fit in browser memory.

## 16.3 Integration with DuckDB

After parsing the selected worksheet, bridge the needed data into the local analysis engine without putting the entire workbook in React state.

Acceptable approaches include a worker-local temporary CSV/Arrow representation registered with DuckDB, provided:

- the representation remains local
- temporary memory is released promptly
- raw rows are never stored in React state
- failure due to memory pressure results in a friendly recommendation to use CSV

Do not let XLSX complexity delay or compromise the CSV path.

---

# 17. File Inspection

After file selection, inspect the file locally.

The inspection path should:

1. validate extension/type
2. register or prepare the local file
3. determine header/schema
4. read only a small preview (roughly 10–20 rows)
5. expose discovered columns to the UI
6. run deterministic header suggestions
7. optionally calculate row count asynchronously

Do not block the UI waiting for a complete row count before column mapping can begin.

File inspection and full analysis are separate phases.

---

# 18. Column Mapping and SQL Identifier Safety

The user may choose columns with arbitrary or unusual names.

Never directly interpolate untrusted column names into SQL.

Create a single utility similar to:

```typescript
quoteSqlIdentifier(identifier: string): string
```

Requirements:

- only accept column names discovered from the file schema
- quote identifiers correctly for DuckDB
- reject names not present in the current file schema
- never use original filename strings as table identifiers

Use whitelists for:

- table/view names
- sortable result columns
- sort direction
- status filters
- target-source filters

Use bound parameters for ordinary filter/search values where supported.

---

# 19. Suggested DuckDB Data Model

Use temporary structures with clear ownership.

A recommended shape is:

```text
supplier_raw          view over local file, all VARCHAR
catalog_raw           view over local file, all VARCHAR

supplier_normalized   temporary table/view
catalog_normalized    temporary table/view

supplier_unique       unambiguous valid supplier keys
catalog_unique        unambiguous valid catalog keys

matched_products      stable matched base data

manual_margin_overrides   tiny temporary table

analysis_results      VIEW deriving current target/status/results
```

The exact names may vary slightly, but keep the same separation of concerns.

---

# 20. Normalized Supplier Data

Conceptual fields:

```text
source_row
raw_identifier
match_key
supplier_cost
identifier_valid
cost_valid
is_valid
```

`supplier_cost` should be a fixed-point monetary type after parsing.

Rows with invalid identifier/cost remain countable for data-quality reporting but must not enter valid matched analysis.

---

# 21. Normalized Catalog Data

Conceptual fields:

```text
source_row
raw_identifier
match_key
selling_price
catalog_margin_override_pct
identifier_valid
price_valid
override_valid
is_valid_for_matching
```

An invalid margin override by itself does **not** invalidate an otherwise valid product row.

Instead:

- record the invalid override in Data Quality
- treat the catalog override as `NULL`
- allow fallback to store default margin

---

# 22. Product Identifier Normalization

Default matching key:

```sql
TRIM(identifier)
```

When case-insensitive matching is enabled:

```sql
UPPER(TRIM(identifier))
```

Do not remove:

- hyphens
- underscores
- slashes
- periods
- leading zeroes

Do not perform fuzzy matching.

Do not infer one identifier system from another.

---

# 23. Duplicate Handling

Duplicate normalized keys are ambiguous and must not be chosen arbitrarily.

For each side, calculate key counts.

Only keys with:

```sql
COUNT(*) = 1
```

on the relevant valid side may participate in automatic matching.

Keep duplicate counts available for Data Quality.

Correctness takes priority over maximum match count.

---

# 24. Money Representation

Use fixed-point storage for parsed monetary inputs.

Baseline:

```sql
DECIMAL(18,4)
```

Use it for:

- supplier cost
- selling price
- gross profit
- stored/export monetary intermediates where appropriate

Do not use ordinary JavaScript `number` arithmetic as the source of truth for monetary calculations.

React may receive formatted/display values or bounded numeric values for rendering, but core financial outcomes must be derived in the domain/SQL layer.

---

# 25. Percentage Representation

Represent margin targets as percentage points, not fractional ratios.

Examples:

```text
20      = 20%
35.5    = 35.5%
0.20    = 0.20%
```

A reasonable internal fixed-point type is:

```sql
DECIMAL(7,4)
```

or an equivalent representation with enough precision for v0.

Enforce the product-valid range:

```text
0 <= target_margin_pct <= 95
```

Use the same semantic convention for:

- store default margin
- catalog override
- manual override

---

# 26. Money Parsing

Money parsing must happen deterministically in the local data layer.

Support the number formats defined by the PRD.

For US-style input:

```text
1,234.56
```

For EU-style input:

```text
1.234,56
```

The parser must tolerate the supported currency decorations from the PRD while rejecting genuinely unparseable values.

Use `TRY_CAST(... AS DECIMAL(18,4))` or an equivalent non-throwing normalization path so one bad row does not fail the entire scan.

Do not silently coerce arbitrary text that merely contains digits.

Maintain explicit tests for:

- currency symbols
- currency codes
- thousands separators
- decimal separators
- whitespace
- negative values
- empty values
- malformed values

---

# 27. Matching Architecture

Matching is a local DuckDB join over normalized, unambiguous identifiers.

Conceptually:

```sql
supplier_unique.match_key = catalog_unique.match_key
```

The resulting `matched_products` base should contain only products that are safe for margin analysis.

Do not perform matching in React.

Do not perform matching in a JavaScript `Map` over entire million-row files unless a future benchmark proves a compelling reason to replace DuckDB.

---

# 28. Financial Calculation Strategy

The formulas themselves are defined by the PRD.

Implementation must avoid making status decisions from unnecessarily lossy JavaScript floating-point calculations.

## 28.1 Gross Profit

```text
gross_profit = selling_price - supplier_cost
```

Use fixed-point arithmetic.

## 28.2 Gross Margin Display

The displayed margin percentage may be derived as:

```text
(selling_price - supplier_cost) / selling_price * 100
```

and rounded for display.

Because division may produce approximate numeric output, do not rely solely on the displayed/rounded margin when determining whether the product meets the target.

## 28.3 Exact Target Comparison

Prefer an equivalent comparison that avoids division for the status decision.

For non-loss products:

```text
gross_margin_pct >= target_pct
```

is equivalent to:

```text
100 * (selling_price - supplier_cost)
    >=
target_pct * selling_price
```

Use fixed-point/appropriately scaled arithmetic for this comparison.

This prevents a value sitting on a target boundary from being misclassified because of display rounding or floating-point noise.

## 28.4 Status

Evaluate in this order:

```text
selling_price < supplier_cost
    → LOSS

otherwise exact margin-vs-target comparison fails
    → REVIEW

otherwise
    → OK
```

## 28.5 Price for Target Margin

Mathematical formula:

```text
required_price = supplier_cost / (1 - target_margin)
```

The final user-facing monetary value must be **rounded upward to the nearest cent**.

Do not use ordinary nearest-cent rounding.

Implement this with a tested fixed/scaled arithmetic strategy so the returned cent value never falls below the requested target because of floating-point rounding.

Use higher-precision integer/fixed-point intermediates if necessary.

Add boundary tests where the mathematical result sits just above an exact cent.

---

# 29. Manual Overrides Architecture

Manual overrides are small, session-only state.

Prefer a tiny DuckDB temporary table:

```text
manual_margin_overrides

match_key       primary key
margin_pct
```

The effective target is derived with:

```text
manual override
    ↓
catalog override
    ↓
store default
```

Implement `analysis_results` as a view or equivalent query layer that joins `matched_products` with `manual_margin_overrides` and derives:

- effective target
- target source
- status
- price for target margin

Updating one manual override must **not** rerun:

- file registration
- raw CSV parsing
- normalization
- duplicate detection
- product matching

Only the derived result/query layer and affected summaries need to reflect the change.

---

# 30. Results Ownership Boundary

DuckDB owns the complete analytical dataset.

React does not.

## 30.1 DuckDB Owns

- raw file scans
- normalized rows
- duplicate checks
- matched products
- manual override join
- analysis results
- summary aggregations
- margin distribution
- data-quality aggregations
- result search
- result filters
- result sorting
- result pagination
- export source queries

## 30.2 React Owns

- selected file metadata
- discovered columns
- small preview rows
- current mapping
- user options
- processing phase
- summary values
- query/filter state
- current result page
- auth/access state
- modal/dialog state
- manual override editing state

Never do:

```typescript
const allRows = result.toArray()
setResults(allRows)
```

for the complete catalog.

---

# 31. Result Querying and Pagination

Signed-in result operations must execute in DuckDB.

Default page size:

```text
100
```

Options:

```text
50
100
250
```

Use query-level pagination such as:

```sql
SELECT ...
FROM analysis_results
WHERE ...
ORDER BY ...
LIMIT ? OFFSET ?
```

For v0, offset pagination is acceptable because the data is local/in-memory and page access is user-driven.

Do not return a million rows to TanStack Table.

Configure TanStack Table for manually controlled pagination/sorting/filtering where applicable.

Virtualization may be used to keep DOM rendering small, but it is not a substitute for DuckDB query pagination.

---

# 32. Search / Filter / Sort Safety

Search should execute against DuckDB, for example via a bound search pattern on `display_identifier`.

Rules:

- debounce identifier search reasonably
- whitelist sortable columns
- whitelist ASC/DESC
- whitelist status values
- whitelist target-source values
- do not accept arbitrary SQL fragments from UI state
- reset page index when filters/sort/search change
- cancel/ignore stale result-page queries when a newer request supersedes them

---

# 33. Access Capability Layer

Do not scatter direct Clerk checks through feature components.

Create a centralized access-policy layer.

Conceptual interface:

```typescript
type AccessCapabilities = {
  canViewFullResults: boolean
  canSearchFullResults: boolean
  canPaginateFullResults: boolean
  canExportResults: boolean
  canUseManualOverrides: boolean
  resultPreviewLimit: number | null
}
```

Expose something similar to:

```typescript
getAccessCapabilities(accessState)
```

Feature UI depends on capabilities, not Clerk internals.

Keep preview limit centralized:

```typescript
export const ACCESS_LIMITS = {
  anonymousResultPreview: 20,
} as const
```

This layer should make a future `ANONYMOUS / FREE / PAID` model possible without rewriting feature components.

Do not implement billing now.

---

# 34. Clerk Integration

Use Clerk through `@clerk/react`.

## 34.1 Environment

Frontend environment variable:

```text
VITE_CLERK_PUBLISHABLE_KEY
```

Never place a Clerk secret key in the Vite frontend bundle.

There is no v0 server-side use case requiring `CLERK_SECRET_KEY`.

## 34.2 Provider

Wrap the application appropriately with Clerk's React provider at the application entry point.

## 34.3 Authentication Methods

Prefer Clerk's maintained prebuilt UI/components for:

- Google sign-in
- email sign-in
- session/user menu

Do not build password storage, email verification, OAuth callbacks, or session infrastructure ourselves.

## 34.4 Auth State

Model auth state explicitly:

```text
loading
anonymous
authenticated
```

Do not flash authenticated-only data while Clerk is still resolving the session.

Keep Clerk user/session objects out of domain calculation code.

---

# 35. Sign-In Must Preserve the Existing Analysis

This is a critical architecture requirement.

After anonymous analysis:

```text
DuckDB session exists
analysis exists
selected File objects exist
        ↓
user opens Clerk sign-in
        ↓
sign-in succeeds
        ↓
access capabilities change
        ↓
same local analysis is immediately queryable in full
```

Do not:

- reload the page
- rerun raw ingestion
- recreate analysis unnecessarily
- ask the user to choose files again
- discard DuckDB solely because auth state changed

Authentication failure should preserve the anonymous analysis.

On sign-out:

- immediately reapply anonymous capabilities
- clear manual session overrides
- clear any full-result page currently held in React state
- preserve the underlying DuckDB scan only if the UI cannot expose authenticated-only rows from stale state
- when uncertain, clear more data rather than risk exposure

---

# 36. Privacy Enforcement at the Technical Layer

The product privacy promise is an architecture invariant.

Supplier/catalog business data must not be included in network requests to application-controlled or third-party services.

Prohibited outbound data includes:

- original filenames
- column names
- identifiers/SKUs
- supplier cost
- selling price
- product rows
- margin values tied to SKUs
- analysis results
- supplier names inferred from files
- catalog contents

Clerk receives only normal identity/session/authentication information.

Do not attach catalog/analysis data to Clerk metadata.

---

# 37. Network Boundary

Because the application processes sensitive commercial data locally, keep the network surface intentionally small.

Expected production network traffic should primarily be:

- static application assets from Catalog Margin Guard / Cloudflare Pages
- Clerk authentication/session traffic

The analysis engine must not fetch customer data from arbitrary remote URLs in v0.

Do not expose a UI or API that accepts arbitrary SQL or remote file URLs.

Do not dynamically load unneeded DuckDB extensions from external repositories.

Self-host runtime assets used by normal analysis where practical.

Any later analytics/error-reporting integration requires a separate privacy review before introduction.

---

# 38. Export Architecture

Exports are generated locally from DuckDB result queries.

Do not send export data through a backend.

For very large exports, prefer streaming/chunked generation where the installed browser/DuckDB APIs make that practical rather than materializing all rows into React.

The export layer must:

- produce the columns defined in the PRD
- use current effective targets and manual overrides
- use safe filenames
- generate a local browser download
- correctly quote CSV commas, quotes, and newlines
- mitigate spreadsheet formula injection in user-derived text fields beginning with `=`, `+`, `-`, or `@`

Keep generated numeric fields numeric-looking rather than unnecessarily prefixing them as text.

---

# 39. Worker Communication

Worker communication should be coarse-grained.

Do not `postMessage` one row at a time.

Messages should represent operations such as:

```text
initialize
inspect-file
run-analysis
query-summary
query-results-page
apply-manual-override
remove-manual-override
export
cancel
reset
```

Use typed message contracts.

Send only small UI-facing result payloads back to React.

Do not serialize complete million-row datasets through `postMessage`.

---

# 40. Processing State Model

Use real stage-based progress.

Possible internal states:

```text
idle
inspecting
mapping
ready
analyzing
results
error
```

Analysis substages can include:

```text
preparing supplier file
preparing catalog file
checking identifiers
normalizing values
matching products
calculating margins
applying margin rules
preparing results
```

Do not display fake exact percentages when the engine cannot supply meaningful progress percentages.

The UI should remain interactive enough to cancel/reset while work is occurring.

---

# 41. Cancellation

Implement cancellation simply and robustly.

A valid v0 approach is:

```text
user clicks Cancel Analysis
        ↓
mark operation cancelled
        ↓
terminate DuckDB worker / active engine when needed
        ↓
release resources
        ↓
create a fresh engine for the next scan
```

Do not over-engineer fine-grained SQL cancellation if worker termination provides a safer v0 implementation.

Prevent stale worker responses from updating React after cancellation/reset.

Use operation IDs/generation tokens if helpful.

---

# 42. Error Architecture

Create a centralized application error model.

Use stable error codes defined by the PRD, including cases such as:

```text
UNSUPPORTED_FILE_FORMAT
FILE_EMPTY
CSV_PARSE_FAILED
XLSX_TOO_LARGE
NO_HEADER_ROW
DUPLICATE_COLUMN_NAMES
COLUMN_NOT_FOUND
NO_MATCHING_PRODUCTS
INVALID_MARGIN
INSUFFICIENT_VALID_PRICES
OUT_OF_MEMORY
ANALYSIS_CANCELLED
UNKNOWN_PROCESSING_ERROR
```

Rules:

- translate raw DuckDB/SheetJS/browser exceptions into friendly app errors
- do not make raw engine exceptions the primary user message
- keep sanitized technical details available for local debugging where useful
- never include file contents or rows in production error reporting/logging
- recover without full page reload when practical

Use an application-level React error boundary for unexpected UI failures.

---

# 43. Memory and Large-File Protection

Browser-side WASM has finite memory.

Use configurable warning thresholds rather than pretending there is a universal safe file size.

Initial guidance:

```text
CSV <= ~500 MB
    normal path where device resources permit

CSV > ~500 MB
    allow when technically feasible, but warn about desktop/RAM needs

XLSX <= ~50 MB
    supported target

XLSX > ~50 MB
    recommend CSV
```

If available, inspect coarse device memory information such as `navigator.deviceMemory` only to improve warnings.

Do not use it as a privacy-invasive fingerprinting mechanism or absolute compatibility decision.

If DuckDB reports memory exhaustion:

- stop the analysis
- clean up resources
- show a clear message
- recommend CSV, a smaller file, closing memory-heavy applications, or a desktop device as appropriate

Do not silently fall back to uploading the file.

---

# 44. Main-Thread Performance Rules

Do not:

- parse huge CSV files on the main thread
- filter/sort million-row JavaScript arrays
- retain all rows in React state
- render thousands of DOM rows at once
- JSON stringify complete result sets
- create a JS object for every source row unless a bounded XLSX bridge requires it off-thread
- transmit complete files/results between workers and React unnecessarily

Prefer:

- DuckDB
- Web Workers
- SQL aggregations
- bounded previews
- result pagination
- optional virtualization
- batched messages
- lazy result queries

The user must be able to interact with the page while analysis runs.

---

# 45. Browser Compatibility

Target current stable versions of:

- Chrome
- Edge
- Firefox
- Safari

The product must not require threaded WASM to function.

Feature-detect capabilities instead of browser-name branching wherever possible.

Test actual browser behavior for:

- file registration
- WASM loading
- workers
- local downloads
- Clerk auth
- large-file memory behavior

---

# 46. Mobile / Tablet Technical Scope

The marketing and setup UI must be responsive.

Large-catalog analysis is primarily a desktop B2B workload.

Do not invest disproportionate v0 engineering effort in making million-row processing ideal on phones.

On constrained/mobile environments:

- keep the page usable
- show the product guidance defined in the PRD
- fail gracefully if memory limits are reached
- never switch to server upload as an automatic fallback

---

# 47. Security Headers and CSP

Cloudflare Pages static responses should use a checked-in `public/_headers` file or the current recommended equivalent.

Baseline security headers should include appropriate versions of:

```text
X-Content-Type-Options: nosniff
Referrer-Policy: no-referrer
X-Frame-Options: DENY
```

Use a restrictive Content Security Policy compatible with:

- Vite production assets
- WASM execution
- Web Workers
- Clerk
- any Clerk anti-bot/auth resources required by the configured flows

Prefer same-origin/self-hosted fonts and application assets.

Do not copy a generic CSP blindly.

Validate CSP in the deployed Cloudflare preview.

## 47.1 COOP / COEP

Do **not** make these headers mandatory in the initial baseline simply to obtain DuckDB threads.

If the COI optimization is enabled later, it will require the appropriate COOP/COEP headers and a full regression of:

- Google auth
- email auth
- Clerk modals
- bot-protection resources
- profile/user menu assets
- all browsers

If auth compatibility is not clean, keep EH/MVP and omit COI headers.

---

# 48. Client-Side Logging

Production logs must be sanitized.

Do not log:

- product rows
- SKU values
- prices/costs
- raw column values
- file contents
- original filenames
- complete SQL containing user column/value data

Development logging may show internal operation metadata, but fixture/synthetic data is preferred.

Use stable operation/error codes rather than dumping raw data.

No remote logging vendor is required for v0.

---

# 49. Telemetry

Do not add analytics as a prerequisite to ship v0.

If analytics is later introduced, implement only the coarse privacy-safe events approved in the PRD.

Before adding an analytics SDK, verify:

- exact fields it automatically collects
- URL/query/title capture behavior
- session replay is disabled
- DOM/text capture is disabled
- filenames/column names cannot leak
- event payloads contain no product/business data

No session replay product should be enabled in v0.

---

# 50. State Management

Do not use Redux.

Prefer:

- React reducer/context for app/session workflow state
- localized component state

A very small Zustand store may be introduced only if it clearly simplifies cross-feature state without becoming a dataset store.

Never put full product datasets in a global JS store.

Conceptual app state:

```typescript
type AppState = {
  supplierFile?: FileMetadata
  catalogFile?: FileMetadata

  supplierColumns: string[]
  catalogColumns: string[]

  mapping?: {
    supplierIdentifier: string
    supplierCost: string
    catalogIdentifier: string
    catalogPrice: string
    catalogMarginOverride?: string
  }

  options: {
    storeDefaultMargin: number
    caseInsensitive: boolean
    numberFormat: "US" | "EU"
    currency: string
  }

  phase: "idle" | "inspecting" | "mapping" | "ready" | "analyzing" | "results" | "error"

  summary?: AnalysisSummary
}
```

Access/auth state should be separate from domain analysis state.

---

# 51. Recommended Repository Structure

Use a feature-oriented structure.

```text
.
├── .agents/
│   └── skills/
│       └── professional-web-ui/
│           └── SKILL.md
│
├── docs/
│   ├── product-requirements.md
│   ├── technical-requirements.md
│   └── design.md
│
├── public/
│   ├── _headers
│   └── duckdb/                  # self-hosted runtime assets if copied here
│
├── src/
│   ├── app/
│   │   ├── App.tsx
│   │   ├── app-state.ts
│   │   ├── access-policy.ts
│   │   └── config.ts
│   │
│   ├── components/
│   │   ├── ui/                  # shadcn primitives
│   │   └── shared/              # product-level shared UI
│   │
│   ├── features/
│   │   ├── auth/
│   │   ├── file-selection/
│   │   ├── file-inspection/
│   │   ├── column-mapping/
│   │   ├── margin-rules/
│   │   ├── analysis/
│   │   ├── results/
│   │   ├── exports/
│   │   └── data-quality/
│   │
│   ├── lib/
│   │   ├── duckdb/
│   │   ├── money/
│   │   ├── csv/
│   │   ├── xlsx/
│   │   ├── security/
│   │   └── errors/
│   │
│   ├── workers/
│   ├── types/
│   ├── main.tsx
│   └── index.css
│
├── tests/
│   ├── fixtures/
│   ├── integration/
│   ├── performance/
│   └── e2e/
│
├── AGENTS.md
├── package.json
├── pnpm-lock.yaml
├── tsconfig.json
└── vite.config.ts
```

This is a preferred shape, not a reason to create empty abstraction folders with no use.

Keep domain/business logic out of presentational React components.

---

# 52. Configuration Constants

Centralize configurable limits/defaults.

Examples:

```typescript
export const ACCESS_LIMITS = {
  anonymousResultPreview: 20,
} as const

export const FILE_LIMITS = {
  xlsxSoftBytes: 50 * 1024 * 1024,
  csvWarningBytes: 500 * 1024 * 1024,
} as const

export const RESULT_PAGE_SIZES = [50, 100, 250] as const
export const DEFAULT_RESULT_PAGE_SIZE = 100
```

Do not scatter product limits/magic numbers throughout components.

---

# 53. Domain Unit Tests

Unit/integration tests must cover the core financial and normalization behavior.

At minimum:

- gross profit
- gross margin display calculation
- exact target-boundary comparison
- LOSS status
- REVIEW status
- OK status
- price for target margin
- upward cent rounding
- exact-cent target-price case
- near-cent target-price case
- store default fallback
- catalog override
- manual override
- override precedence
- manual override removal
- target source
- valid target min/max boundaries
- invalid target values
- leading-zero identifier
- trimming
- case-insensitive matching
- case-sensitive matching
- duplicate supplier identifiers
- duplicate catalog identifiers
- invalid supplier cost
- invalid catalog price
- invalid margin override fallback
- US money parsing
- EU money parsing
- currency symbol parsing
- thousands separators
- SQL identifier quoting
- search/sort whitelist validation
- CSV escaping
- formula-injection mitigation

Use the numeric examples from the PRD as test fixtures.

---

# 54. Authentication / Access Tests

Test capability behavior independently from Clerk UI where possible.

At minimum:

- auth loading never exposes unrestricted data
- anonymous analysis succeeds
- anonymous preview is bounded
- anonymous full result query is blocked at UI/capability layer
- anonymous export unavailable
- anonymous manual override unavailable
- successful sign-in changes capabilities without rerunning analysis
- failed sign-in preserves analysis
- signed-in full result queries work
- signed-in export works
- signed-in manual override works
- sign-out restores anonymous capabilities
- sign-out clears manual overrides
- sign-out clears stale full-result React page data

Mock Clerk for most deterministic tests.

Use a small deployed/manual smoke test for actual configured Google/email flows before release.

---

# 55. Privacy Tests

Privacy must be testable, not merely documented.

Add tests/instrumentation that verify analysis does not send business data through network APIs.

At minimum verify no application analytics/auth wrapper is passed:

- filename
- SKU
- supplier cost
- selling price
- margin
- column names
- supplier/catalog rows

For E2E/privacy smoke testing, intercept browser network traffic during a synthetic scan and inspect application-controlled request payloads.

Use synthetic fixtures only.

---

# 56. Integration Test Fixtures

Create small committed fixtures covering:

- perfect matches
- supplier-only products
- catalog-only products
- supplier duplicates
- catalog duplicates
- bad supplier cost
- bad catalog price
- blank margin override
- invalid margin override
- leading-zero SKU
- case differences
- whitespace
- negative margin
- zero selling price
- currency symbols
- thousands separators
- quoted CSV fields
- commas inside quoted values
- embedded quote characters
- EU numeric format
- unusual but valid column names

Do not use real customer data.

---

# 57. End-to-End Tests

Playwright should cover the critical user journey with local fixture files.

Core flow:

```text
open app
choose supplier file
choose catalog file
inspect/map columns
set default margin
optionally map product override
analyze
verify summary
verify LOSS / REVIEW / OK
verify anonymous preview gate
simulate/authenticate signed-in state
verify same analysis unlocks
query/search/filter full results
create manual override
verify recalculation
remove manual override
export review CSV
export full report
start new scan
verify customer analysis state cleared
```

Do not make live Google OAuth a mandatory automated CI test.

---

# 58. Performance Tests

Create a synthetic fixture generator rather than committing huge datasets.

Benchmark representative datasets such as:

```text
10k rows
100k rows
500k rows
1M rows
```

Measure:

- file inspection time
- row-count time if requested
- normalization time
- duplicate detection time
- matching time
- total analysis duration
- summary query time
- first result-page query time
- search/filter/sort page query time
- export time
- worker/main-thread responsiveness
- peak browser memory where practical

Do not define fake universal time SLAs because performance depends heavily on user hardware/browser.

Record baseline numbers on a documented reference machine/browser so regressions can be noticed.

Primary acceptance condition:

> The interface remains usable and does not freeze while the local analytical work runs.

---

# 59. CI Quality Gates

Use GitHub Actions or an equivalent simple GitHub-native workflow.

On pull requests and/or main branch, run:

```text
pnpm install --frozen-lockfile
lint
typecheck
unit/integration tests
production build
```

Run Playwright in CI when reliable and economical; otherwise keep a smaller browser smoke suite in PR CI and full E2E on main/release.

A failing required quality gate must not be ignored merely because the application appears to run manually.

---

# 60. Cloudflare Pages Deployment

Use Cloudflare Pages to host the Vite static build.

Typical build contract:

```text
install: pnpm install --frozen-lockfile
build:   pnpm build
output:  dist
```

Use Cloudflare Pages Git integration for simple deployments from GitHub.

Environment configuration should contain the Clerk publishable key for each environment.

Do not put secrets in committed `.env` files.

Provide:

```text
.env.example
```

with placeholders only.

Deploy early in implementation because WASM, workers, CSP, auth, and browser isolation behavior must be validated in a real hosted environment.

---

# 61. Production Deployment Verification

A localhost-successful implementation is not complete.

Verify a Cloudflare preview deployment for:

- app loads from a clean browser session
- DuckDB worker loads
- WASM module loads with correct content type
- `SELECT 42` succeeds in DuckDB
- CSV local file registration works
- analysis works
- file data remains local
- Clerk loads
- email auth works
- Google auth works if enabled
- sign-in preserves existing analysis
- sign-out safely regates results
- export download works
- security headers do not break workers/auth
- Safari/Firefox fallback works

If COI/threading is enabled, separately verify `crossOriginIsolated` and the selected DuckDB bundle.

---

# 62. Implementation Order

Implement in this sequence.

## Phase 1 — Repository Skeleton

- Vite + React + TypeScript
- pnpm
- lint/typecheck/build
- Tailwind
- shadcn/ui base setup
- Lucide
- Vitest
- Playwright
- source alias
- basic Cloudflare deployment

Do not build the complete product UI yet.

## Phase 2 — App Shell and Design Foundation

After `docs/design.md` exists:

- base tokens
- typography
- layout primitives
- shared UI primitives
- landing/app shell
- responsive structure

Use the professional UI skill.

## Phase 3 — Authentication Shell

- Clerk provider
- auth loading/anonymous/authenticated state
- centralized access capabilities
- sign-in modal/button
- user menu

Do not gate the core tool behind login.

## Phase 4 — DuckDB Runtime

- self-hosted runtime assets
- worker startup
- EH/MVP fallback
- optional COI asset support
- engine service
- connection lifecycle
- reset/teardown
- deployed `SELECT 42` smoke test

## Phase 5 — CSV/TSV File Selection and Inspection

- choose/drop local file
- register browser `File`
- synthetic internal filename
- `all_varchar` raw reading
- schema/header inspection
- preview rows
- deterministic header suggestions
- file summary

Test increasingly large CSVs during this phase.

## Phase 6 — Column Mapping and Options

- supplier identifier
- supplier cost
- catalog identifier
- catalog selling price
- optional catalog margin override
- store default margin
- number format
- currency formatting choice
- case-insensitive matching option

## Phase 7 — Normalization / Data Quality Base

- identifier normalization
- money parsing
- margin override parsing
- invalid row flags
- duplicate detection
- supplier-only/catalog-only counts

## Phase 8 — Matching and Margin Analysis

- unique safe keys
- matched product base
- gross profit
- gross margin display
- exact margin target comparison
- effective target
- target source
- LOSS/REVIEW/OK
- price-for-target with safe upward rounding

## Phase 9 — Summary and Anonymous Results

- summary metrics
- margin exposure buckets
- data-quality summary
- highest-risk result query
- centralized anonymous preview limit

## Phase 10 — Sign-In Unlock

- Clerk sign-in flow
- preserve current local analysis
- instant capability unlock
- no refresh
- no reprocessing
- auth failure preservation

## Phase 11 — Full Signed-In Results

- DuckDB pagination
- search
- filters
- sorting
- TanStack Table integration
- optional row virtualization

## Phase 12 — Manual Session Overrides

- temp override table
- set override
- remove override
- effective-target view
- efficient result/summary refresh
- clear overrides on logout/new scan

## Phase 13 — Exports

- products-to-review CSV
- full margin report CSV
- local generation
- CSV escaping
- formula-injection protection

## Phase 14 — XLSX

Implement only after the CSV/TSV path is stable and performant.

## Phase 15 — Hardening

- cancellation
- memory warnings
- error mapping
- Safari/Firefox checks
- security headers/CSP
- privacy network audit
- performance benchmarks
- production auth smoke test
- optional COI experiment

---

# 63. Explicit Technical Non-Goals for v0

Do not use implementation work as an excuse to add:

- server persistence
- user scan history
- saved mappings
- saved product targets
- backend APIs
- job queues
- scheduled scans
- email notifications
- webhook integrations
- vendor/marketplace integrations
- automatic repricing
- AI column mapping
- AI product matching
- fuzzy matching
- billing
- organizations/teams
- RBAC
- server-side entitlement enforcement
- remote file storage
- remote observability that captures business data
- SSR
- SEO-driven multi-page architecture for the application workflow

---

# 64. Definition of Done — Technical

v0 engineering is complete when all of the following are true:

1. The application is a production-buildable React + TypeScript Vite app.
2. Tailwind and the agreed shared UI primitives are configured.
3. `docs/design.md` is followed by implemented UI.
4. Customer supplier/catalog files are processed locally.
5. No application backend handles catalog data.
6. No database/object storage is required.
7. DuckDB-Wasm runs in a Web Worker.
8. Production DuckDB runtime assets are self-hosted.
9. The app works without threaded WASM.
10. CSV/TSV raw ingestion preserves identifier strings/leading zeroes.
11. Large CSV files are not fully materialized into React or ordinary JS arrays.
12. XLSX runs off the main thread and respects safety thresholds.
13. SQL identifiers are safely quoted/whitelisted.
14. Money values use fixed-point storage for core inputs/intermediates.
15. Status boundary decisions do not rely on displayed rounded margin values.
16. Price-for-target is rounded upward safely to a cent.
17. Duplicate identifiers are excluded deterministically.
18. Full analysis data remains in DuckDB, not React state.
19. Search/filter/sort/pagination execute in DuckDB.
20. Result pages are bounded to configured page sizes.
21. Manual overrides do not rerun file ingestion/matching.
22. Access rules are centralized outside Clerk-specific feature logic.
23. Clerk uses only the frontend publishable key.
24. Sign-in unlocks the current analysis without refresh/reprocessing.
25. Sign-out safely removes authenticated-only UI data and manual overrides.
26. No customer business data is attached to Clerk metadata.
27. No customer business data is emitted to remote logging/analytics.
28. Exports are generated locally.
29. CSV exports handle quoting and formula-injection risks.
30. Cancel/reset reliably releases analysis resources.
31. Large-file memory failures produce friendly recoverable errors.
32. The main UI remains responsive during realistic analysis workloads.
33. Current Chrome, Edge, Firefox, and Safari have been smoke-tested.
34. A deployed Cloudflare preview successfully loads DuckDB WASM/workers.
35. Deployed Clerk email auth works.
36. Deployed Google auth works when configured.
37. Security headers/CSP work in the deployed environment.
38. Lint passes.
39. Typecheck passes.
40. Unit/domain tests pass.
41. Integration tests pass.
42. Required E2E tests pass.
43. Production build passes.
44. No unnecessary backend/database/queue/object-storage infrastructure has been introduced.
45. No real customer data exists in test fixtures.

---

# 65. Final Technical Architecture

```text
                                  GitHub
                                     │
                                     │ source / CI
                                     ▼
                           ┌───────────────────┐
                           │ Cloudflare Pages  │
                           │   static assets   │
                           └─────────┬─────────┘
                                     │
                                     ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                           CUSTOMER BROWSER                               │
│                                                                          │
│   React UI                                                               │
│      │                                                                   │
│      ├────────────► Clerk (identity/session only)                         │
│      │                                                                   │
│      ▼                                                                   │
│   App / Access State                                                     │
│      │                                                                   │
│      ▼                                                                   │
│   Typed Analysis Service                                                 │
│      │                                                                   │
│      ▼                                                                   │
│   DuckDB-Wasm Worker                                                     │
│      │                                                                   │
│      ├──── supplier-input.csv/tsv ── local browser File                  │
│      ├──── catalog-input.csv/tsv  ── local browser File                  │
│      ├──── XLSX worker bridge      ── local only                         │
│      │                                                                   │
│      ├──── supplier/catalog normalized                                   │
│      ├──── duplicate-safe matching                                       │
│      ├──── matched_products                                              │
│      ├──── manual_margin_overrides                                       │
│      └──── analysis_results view                                         │
│                 │                                                        │
│                 ├──── summary / data quality                             │
│                 ├──── paged search/filter/sort                           │
│                 └──── local CSV export                                   │
│                                                                          │
│   Customer catalog/business data never goes to Catalog Margin Guard      │
│   application servers because no such processing server exists in v0.    │
└──────────────────────────────────────────────────────────────────────────┘
```

---

# 66. Instruction to the Implementing Agent

Before writing implementation code:

1. read `AGENTS.md`
2. read `docs/product-requirements.md` completely
3. read this document completely
4. read `docs/design.md` completely once it exists
5. read `.agents/skills/professional-web-ui/SKILL.md` for UI work
6. inspect the repository's current state
7. produce a concise implementation plan
8. identify architecture/performance/privacy risks
9. implement in the phased order above unless a small sequencing change is justified
10. run lint, typecheck, tests, and production build
11. fix issues encountered rather than merely documenting them
12. verify WASM/auth behavior on an actual Cloudflare preview before declaring the implementation complete

Do not substitute speculative future architecture for the intentionally simple v0 described here.
