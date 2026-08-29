# Catalog Margin Guard — Design System & UI Specification

> Product-specific visual and interaction requirements for v0.
>
> This document defines how Catalog Margin Guard should look, feel, and behave visually. It complements:
>
> - `docs/product-requirements.md` — what the product must do
> - `docs/technical-requirements.md` — how the product is engineered
> - `.agents/skills/professional-web-ui/SKILL.md` — general UI quality standards
>
> When this document conflicts with a generic UI convention, prefer this document unless doing so would violate accessibility, product requirements, or technical requirements.

---

# 1. Design Goal

Catalog Margin Guard is a professional B2B utility for merchants and resellers working with real catalog and supplier pricing data.

The interface should feel:

- trustworthy
- precise
- calm
- fast
- data-oriented
- privacy-conscious
- practical rather than decorative

The product should look like a focused business tool, not a generic AI-generated SaaS template.

The desired impression is:

> "I can safely put a large supplier/catalog file into this tool, understand what is happening, and quickly find the products that need my attention."

The interface must make complicated pricing data feel manageable without making the product feel simplistic or toy-like.

---

# 2. Product Personality

Use these characteristics as the visual personality:

## Precise

Financial numbers, margins, prices, statuses, and data quality are the core of the product.

Typography, alignment, spacing, and number formatting should feel exact.

## Calm

LOSS products are important, but the application should not look like an emergency dashboard.

Use status color intentionally and locally.

Do not flood the page with red, amber, or green backgrounds.

## Trustworthy

The privacy promise is a genuine product differentiator.

"Files stay on your computer" should be visible at meaningful moments without becoming repetitive marketing noise.

## Efficient

This is a working tool.

Once the user is inside the application, prioritize scanning speed and information density over large decorative layouts.

## Restrained

Avoid visual trends that make the interface look generated from a generic SaaS template.

Do not use:

- glassmorphism
- glowing elements
- giant gradients
- decorative blobs
- oversized hero artwork
- excessive cards
- excessive badges
- unnecessary animation
- giant rounded corners
- shadows around every surface

---

# 3. Overall Visual Direction

Use a light, neutral B2B visual system.

Primary visual language:

- near-white application background
- white primary surfaces
- dark slate text
- subtle neutral borders
- blue product accent
- red only for LOSS/destructive states
- amber only for REVIEW/warnings
- green only for OK/success states

The design should feel closer to a polished financial/data application than a consumer app.

Use whitespace to create hierarchy, but keep the application workflow reasonably compact.

The landing page may have more breathing room than the application.

---

# 4. Theme

v0 should use a light theme only.

Do not spend v0 effort implementing dark mode.

Structure colors through semantic design tokens so dark mode can be introduced later without rewriting components.

---

# 5. Typography

## Primary Font

Use:

```text
Inter
```

Preferred implementation:

- bundle/self-host through the application dependency/build where practical
- do not depend on a runtime third-party font CDN

Fallback:

```css
font-family:
  Inter,
  ui-sans-serif,
  system-ui,
  -apple-system,
  BlinkMacSystemFont,
  "Segoe UI",
  sans-serif;
```

## Numeric Font Behavior

Financial tables and metrics should use tabular numbers:

```css
font-variant-numeric: tabular-nums;
```

This is important for:

- supplier cost
- selling price
- margin
- target margin
- price for target margin
- row counts
- summary metrics

Do not introduce a separate monospace font merely for numbers.

## Type Scale

Use a restrained scale.

### Marketing Hero

```text
48px / 56px / 700
```

At smaller desktop widths:

```text
40px / 48px / 700
```

Mobile:

```text
34px / 40px / 700
```

Do not exceed roughly 52px for the v0 landing page.

### Application Page Title

```text
28px / 36px / 650–700
```

### Section Heading

```text
18px / 28px / 600
```

### Card/Panel Heading

```text
15px / 22px / 600
```

### Body

```text
14px / 22px / 400
```

### Large Body / Landing Copy

```text
16px / 26px / 400
```

### Label

```text
13px / 18px / 500
```

### Supporting / Metadata

```text
12px / 18px / 400–500
```

Avoid creating additional sizes unless there is a concrete visual need.

---

# 6. Color System

Use semantic tokens. Do not scatter raw color values through feature components.

The exact token implementation may use CSS variables and Tailwind mappings.

## Neutral Foundation

Recommended light theme values:

```text
--background:            #F8FAFC
--surface:               #FFFFFF
--surface-subtle:        #F1F5F9
--surface-hover:         #F8FAFC

--text-primary:          #0F172A
--text-secondary:        #475569
--text-muted:            #64748B
--text-disabled:         #94A3B8

--border:                #E2E8F0
--border-strong:         #CBD5E1
```

## Product Accent

Use blue as the product/interaction accent.

```text
--brand:                 #2563EB
--brand-hover:           #1D4ED8
--brand-active:          #1E40AF
--brand-soft:            #EFF6FF
--brand-soft-border:     #BFDBFE
```

Blue is for:

- primary CTAs
- links
- focus states
- selected controls
- active navigation
- neutral informational emphasis

Do not use blue for product status.

## LOSS

```text
--loss:                  #B91C1C
--loss-strong:           #991B1B
--loss-soft:             #FEF2F2
--loss-border:           #FECACA
```

## REVIEW

```text
--review:                #B45309
--review-strong:         #92400E
--review-soft:           #FFFBEB
--review-border:         #FDE68A
```

## OK

```text
--ok:                    #15803D
--ok-strong:             #166534
--ok-soft:               #F0FDF4
--ok-border:             #BBF7D0
```

## Informational / Privacy

Prefer the brand blue for privacy/informational messaging rather than introducing another large accent palette.

A lock icon with dark text and muted/blue supporting treatment is enough.

---

# 7. Color Usage Rules

Status colors should communicate state, not decorate the whole page.

Good:

- LOSS label with red text/icon and a very light red background
- REVIEW label with amber text/icon
- OK label with green text/icon
- a thin red accent or tinted cell for a negative margin where useful

Avoid:

- entire result rows filled solid red
- large red summary sections
- green page backgrounds
- using red for ordinary validation hints
- using amber for product branding

Always pair color with:

- text
- icon, when useful
- explicit status label

Never rely on color alone.

---

# 8. Spacing System

Use this spacing scale:

```text
4px
8px
12px
16px
20px
24px
32px
40px
48px
64px
80px
```

Default application component spacing should mostly use:

```text
8 / 12 / 16 / 24 / 32
```

Landing sections may use:

```text
48 / 64 / 80
```

Avoid arbitrary spacing values.

---

# 9. Border Radius

Keep radii restrained.

```text
--radius-sm:   6px
--radius-md:   8px
--radius-lg:   12px
```

Use:

- 6–8px for inputs/buttons
- 8–12px for panels
- full pill radius only for true status badges/tags

Do not make every component pill-shaped.

Avoid large 20–32px card radii.

---

# 10. Shadows

Use shadows sparingly.

Primary application panels should generally use a border instead of a shadow.

Allowed:

- dropdown menus
- dialogs
- popovers
- temporary floating surfaces

Recommended subtle shadow:

```text
0 8px 24px rgba(15, 23, 42, 0.08)
```

Do not place strong shadows around:

- every card
- table containers
- file upload panels
- summary metrics

---

# 11. Application Width and Layout

## Landing Page

Maximum content width:

```text
1200px
```

Horizontal page padding:

```text
desktop: 32px
tablet:  24px
mobile:  16px
```

## Application Setup Flow

Maximum content width:

```text
1120px
```

The setup workflow benefits from a slightly narrower measure than the results workspace.

## Results Workspace

Maximum width:

```text
1440px
```

Use the available width for the data table.

Do not force large data tables into an artificially narrow centered column.

---

# 12. Header

Use one simple top navigation bar.

Desktop:

```text
┌──────────────────────────────────────────────────────────────────────┐
│ Catalog Margin Guard                                      Sign in   │
└──────────────────────────────────────────────────────────────────────┘
```

Signed in:

```text
┌──────────────────────────────────────────────────────────────────────┐
│ Catalog Margin Guard                                  [ User Menu ] │
└──────────────────────────────────────────────────────────────────────┘
```

Header guidelines:

- approximately 64px high
- white or near-white surface
- subtle bottom border
- no heavy shadow
- product wordmark on the left
- auth/account action on the right
- no unnecessary navigation links in v0

The app does not need a sidebar.

Do not invent navigation sections when there is only one primary workflow.

---

# 13. Wordmark / Logo Treatment

For v0, use a clean text wordmark:

```text
Catalog Margin Guard
```

Optional mark:

- a small shield/check or shield/line-chart concept
- simple single-color Lucide-compatible visual treatment

Do not delay the product for a custom illustrated logo.

Do not use a cartoon mascot.

The wordmark should work without an icon.

---

# 14. Landing Page Structure

The landing page should be concise and conversion-focused.

Recommended structure:

```text
Header

Hero
  headline
  supporting copy
  primary CTA
  privacy reassurance

How it works
  1. Choose supplier file
  2. Choose current catalog
  3. See margin risk

Small privacy/trust section

Footer
```

Do not create a 10-section marketing site for v0.

Avoid:

- fake customer logos
- fake testimonials
- fake revenue claims
- fake usage statistics
- invented enterprise logos
- pricing section when there is no paid plan
- AI feature marketing

---

# 15. Landing Hero

Use the product copy defined in product requirements.

Primary headline:

> Find products quietly eating your margin.

Supporting copy:

> Compare your supplier costs with your current catalog, see your actual gross margins, and identify products that need pricing review.

Primary CTA:

```text
Check My Catalog
```

Privacy reassurance:

```text
Files stay on your computer.
```

Recommended visual hierarchy:

```text
small trust cue / optional eyebrow

Find products quietly
eating your margin.

Supporting description...

[ Check My Catalog ]

🔒 Files stay on your computer.
```

Use a left-aligned hero.

Avoid a centered giant SaaS hero unless the final composition clearly benefits from it.

No gradient headline text.

No animated background.

No giant dashboard screenshot required for v0.

If a product visual is included, use a restrained mock results panel showing:

- a few SKUs
- Margin
- Target
- LOSS / REVIEW / OK

Do not use sensitive-looking fake company data.

---

# 16. Privacy Messaging

Privacy is a product feature, not legal fine print.

Use a consistent privacy pattern:

```text
[lock icon] Files stay on your computer.
```

Expanded supporting copy where useful:

```text
Supplier pricing and catalog data are processed locally in your browser.
```

Use privacy messaging:

- on landing hero
- near file selection
- near Analyze Catalog
- near sign-in gating
- around large-file warnings when helpful

Do not repeat the same full paragraph in every section.

Visual treatment:

- small lock icon
- dark/secondary text
- optional subtle brand-soft background for larger callouts
- no alarm styling

---

# 17. Main Setup Workflow

The setup experience should feel like one guided workflow, not a collection of unrelated cards.

Use three primary sections:

```text
1. Choose files
2. Map columns
3. Margin settings
```

Then:

```text
Analyze Catalog
```

Avoid a complex multi-page wizard unless implementation proves it materially improves the flow.

Desktop can present these as vertically stacked sections inside one primary surface.

Recommended:

```text
Page heading
Short explanation
Privacy cue

┌──────────────────────────────────────────────────┐
│ 1. Choose files                                  │
│                                                  │
│ Supplier file          Current catalog           │
│ [ drop/select ]        [ drop/select ]           │
└──────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────┐
│ 2. Map columns                                   │
│                                                  │
│ Supplier               Catalog                   │
│ Identifier             Identifier                │
│ Cost                   Selling price             │
│                        Margin override (optional) │
└──────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────┐
│ 3. Margin settings                               │
│                                                  │
│ Default margin   Number format   Currency         │
│ Case-insensitive identifier matching             │
└──────────────────────────────────────────────────┘

[ Analyze Catalog ]

🔒 Files stay on your computer.
```

Do not render later sections as fully active before the required files are ready.

Use progressive enablement:

- file section active initially
- mapping becomes active after inspection
- settings remain editable once relevant
- analyze becomes enabled only when required mappings/options are valid

---

# 18. Section Styling

Setup sections should be large bordered surfaces, but avoid nested-card overload.

Primary section:

```text
background: surface
border: 1px solid border
radius: 12px
padding: 24px
```

Section heading should include:

- step number
- concise title
- optional one-line description

Example:

```text
1  Choose your files
   Select your supplier cost file and current catalog.
```

Step number may use a small brand-soft circle.

Do not use giant numbered illustrations.

---

# 19. File Selection Component

The file selector is a major trust interaction and should look polished.

Idle state:

```text
┌─────────────────────────────────────────────────┐
│                                                 │
│      [file icon]                                │
│      Drop supplier file here                    │
│      or choose from your computer               │
│                                                 │
│      CSV, TSV, or XLSX                          │
│                                                 │
└─────────────────────────────────────────────────┘
```

Use:

- dashed neutral border
- white or subtle background
- brand border/background on drag-over
- approximately 150–180px height on desktop
- keyboard-accessible file selection

Use wording:

```text
Choose Supplier File
Choose Catalog File
```

Do not use:

```text
Upload
Upload to server
```

because files are processed locally.

## Selected File State

After selection, transform the drop zone into a compact file summary:

```text
[file icon] supplier.csv
            182.4 MB · CSV

            ✓ Ready

                             Change
```

Use:

- filename as primary text
- size/type as secondary
- ready state with green icon/text
- "Change" as secondary action

Do not show the full local filesystem path.

---

# 20. File Preview

After file inspection, show a compact preview.

Use:

- approximately 10 rows
- sticky/simple header if useful
- horizontal scroll for wide files
- neutral table styling
- no attempt to display the entire file

Header text:

```text
File preview
```

Supporting text:

```text
Showing a sample from this file.
```

Preview should visually reinforce column selection without becoming a full data browser.

---

# 21. Column Mapping

Column mapping must feel obvious and low-risk.

Separate supplier and catalog groups clearly.

Desktop:

```text
Supplier file                  Current catalog

Product Identifier             Product Identifier
[ Supplier SKU       ▼ ]       [ SKU                ▼ ]

Supplier Cost                  Selling Price
[ Unit Cost          ▼ ]       [ Price              ▼ ]

                               Product Margin Override
                               [ None / min_margin  ▼ ]
```

Use consistent labels and select widths.

Auto-suggested values should look selected normally.

Do not imply AI intelligence.

Optionally show a small muted text:

```text
Suggested from column name
```

only when helpful.

Before Analyze, show a subtle information note:

```text
Make sure both identifier columns represent the same identifier
—for example SKU ↔ SKU or UPC ↔ UPC.
```

Use info styling, not warning styling.

---

# 22. Form Controls

Default control height:

```text
40px
```

Primary button height:

```text
40–44px
```

Labels above inputs.

Use inline descriptions beneath controls only when the meaning is not obvious.

Inputs should use:

- white background
- 1px neutral border
- 8px radius
- dark text
- blue focus ring

Focus treatment:

```text
2px brand ring
with sufficient offset/contrast
```

Disabled controls should remain readable and clearly disabled.

---

# 23. Default Margin Control

The store default margin is important and should be visually clear.

Preferred:

```text
Store default margin

[ 20.00 ] %

Products without an individual override use this target.
```

Do not use a slider.

Financial/percentage values require precise input.

The `%` suffix should visually attach to the input without becoming editable text.

Validation should appear directly below.

---

# 24. Number Format and Currency

Keep these as secondary settings.

Desktop may place them on one row:

```text
Number format                    Currency

(●) 1,234.56                     [ USD ▼ ]
( ) 1.234,56
```

Do not overemphasize currency because currency selection only affects formatting.

Show a small note:

```text
Supplier cost and catalog selling price must use the same currency.
```

---

# 25. Analyze CTA

Primary CTA:

```text
Analyze Catalog
```

Use brand blue.

Place it at the end of the setup flow.

The button should not be giant/full-screen.

Recommended desktop width:

- content width or natural width around 160–220px
- full width on narrow mobile layouts

Below/alongside:

```text
🔒 Files stay on your computer.
```

Do not call the action "Upload & Analyze."

---

# 26. Processing / Analysis State

The analysis state should communicate real work without fake precision.

Do not use fake percentages such as:

```text
73%
```

unless the engine can genuinely provide them.

Use stage-based progress.

Example:

```text
Analyzing your catalog

✓ Preparing supplier file
✓ Preparing catalog file
● Checking product identifiers
○ Matching products
○ Calculating margins
○ Applying margin rules
○ Preparing results

Your files are being processed locally in this browser.

[ Cancel Analysis ]
```

Design:

- one centered/contained processing panel
- current stage uses brand color
- completed stages use check icons
- pending stages are neutral
- subtle spinner beside active stage if desired

Keep the global header visible.

Avoid a full-screen animated loading spectacle.

---

# 27. Analysis Error State

Errors should feel actionable.

Use a bordered error panel:

```text
[error icon] We couldn't find matching product identifiers.

Check that the Supplier Identifier and Catalog Identifier columns use
the same type of identifier, such as SKU ↔ SKU.

[ Review column mapping ]
```

Optional secondary action:

```text
Show technical details
```

Do not make raw exceptions the primary content.

Technical details should be collapsed by default.

---

# 28. Results Page Hierarchy

Results should answer three questions immediately:

1. How many products were analyzed?
2. How much risk exists?
3. Which products need attention first?

Recommended order:

```text
Results header / actions

Summary status strip

Margin exposure

Highest-risk / full results table

Data quality

Exports / secondary actions
```

For signed-in users, filters/search belong directly above the full table.

---

# 29. Results Header

Example:

```text
Margin analysis

18,901 products analyzed

                                    [ Start New Scan ]
```

Signed-in secondary actions may include export menu/button.

Do not show the source filenames prominently after analysis.

Files are temporary session inputs, not persistent project artifacts.

---

# 30. Summary Metrics

Avoid six giant independent statistic cards.

Use one cohesive summary surface with compact metrics.

Example desktop:

```text
┌─────────────────────────────────────────────────────────────────────┐
│ 7                    1,226                 17,668         28.4%     │
│ Selling below cost   Need review           Meeting target Avg margin│
│ LOSS                 REVIEW                OK                       │
└─────────────────────────────────────────────────────────────────────┘
```

Status label treatment:

- LOSS: red
- REVIEW: amber
- OK: green
- Average margin: neutral/brand

Numbers should be larger than labels but not dashboard-gigantic.

Recommended number size:

```text
24–28px / 700
```

On mobile, stack into a 2-column grid or vertical list.

---

# 31. Status Language

User-facing labels:

```text
LOSS
REVIEW
OK
```

Supporting language may be:

```text
Selling below cost
Below target margin
Meeting target
```

Do not change REVIEW into:

- Bad
- Failing
- Wrong
- Underpriced

The target is merchant-selected and REVIEW is not necessarily objectively incorrect.

---

# 32. Status Badges

Use compact badges.

Example:

```text
[ ! LOSS ]
[ ! REVIEW ]
[ ✓ OK ]
```

Recommended visual style:

- soft background
- semantic text color
- subtle border
- 6px radius or pill only if the badge is small
- 11–12px label
- medium/semibold weight

Do not use oversized status pills.

---

# 33. Margin Exposure

Show margin distribution as a readable compact horizontal bar/list.

Prefer this over a pie/donut chart.

Example:

```text
Margin exposure

Below cost   █                         7
0–5%         ██                       31
5–10%        ███                     104
10–15%       █████                   386
15–20%       ███████                 712
20–30%       █████████████        4,281
30%+         █████████████████  13,380
```

Guidelines:

- categories remain readable without color
- use neutral/brand bars for ordinary ranges
- below-cost can use LOSS color
- do not turn every range into a rainbow
- exact counts must always be visible
- accessible labels required

A simple CSS/SVG implementation is preferable to introducing a charting library solely for this visualization.

---

# 34. Results Table

This is the most important application surface.

Columns:

```text
SKU
Supplier Cost
Selling Price
Gross Margin
Target Margin
Target Source
Price for Target Margin
Status
Actions (signed-in where needed)
```

## Table Density

Use compact but comfortable density.

Recommended:

```text
header height: 40–44px
row height:    44–48px
```

Avoid 64px+ rows.

## Alignment

Left-align:

- SKU
- Target Source
- Status
- Actions

Right-align:

- Supplier Cost
- Selling Price
- Gross Margin
- Target Margin
- Price for Target Margin

Use tabular numbers.

## Headers

Use:

- 12–13px
- medium/semibold
- muted/dark text
- subtle surface background if helpful

Do not use giant uppercase headers.

## Row Dividers

Use subtle horizontal borders.

Avoid vertical grid lines unless testing shows they materially improve readability.

## Hover

Use a very subtle neutral hover background.

Do not animate table rows.

---

# 35. Financial Number Styling

Examples:

```text
$96.00
$105.00
8.57%
20.00%
$120.00
```

Use consistent decimal precision.

Negative margin:

```text
-1.34%
```

May use LOSS text color.

Below-target but non-negative margins may use REVIEW text color sparingly.

Meeting-target margin does not need to be green everywhere.

Reserve green primarily for status.

---

# 36. Price for Target Margin

The field must visually be descriptive, not prescriptive.

Header:

```text
Price for Target Margin
```

Do not label it:

```text
Suggested Price
Recommended Price
Optimal Price
```

Use a tooltip/info explanation if needed:

```text
The selling price required to reach this product's configured target
gross margin. This is not a market-price recommendation.
```

---

# 37. Target Source

Display compact values:

```text
Default
Catalog override
Manual override
```

Use neutral text/tags.

Do not assign status colors to target-source values.

If a target source column becomes too wide, shorten visible labels but keep full explanation in tooltip/details.

---

# 38. Signed-In Table Toolbar

Recommended layout:

```text
[ Search identifier...                    ]

[ Status: All ▼ ] [ Target source: All ▼ ] [ Sort: Margin ↑ ▼ ]

                                    [ Export ▼ ]
```

On wide screens, search may occupy the left side and filters/actions the right.

On medium screens, wrap naturally.

On mobile, stack.

Filters should not be placed in a permanent sidebar.

---

# 39. Search

Search field placeholder:

```text
Search identifier
```

Use a small search icon.

Provide a clear button when text exists.

Do not display a search field to anonymous users if unrestricted search is unavailable.

Do not render disabled full-search UI just to tease a feature.

---

# 40. Pagination

Use simple pagination.

Example:

```text
1–100 of 18,901

Rows per page [100 ▼]

[ Previous ]  Page 1 of 190  [ Next ]
```

Avoid showing 20 individual page-number buttons.

Large catalogs require functional navigation more than decorative pagination.

---

# 41. Anonymous Results Experience

Anonymous users should receive real value.

Show:

- complete summary
- complete margin exposure
- complete data-quality summary
- up to 20 highest-risk rows

The table should simply stop at the allowed preview.

Do not render hidden rows behind a CSS blur.

Do not create a fake disabled pagination UI over data already present in the DOM.

After the preview, show a clean conversion surface.

Example:

```text
1,213 more products need attention.

Sign in free to review the complete results, search your catalog,
set individual targets, and download reports.

[ See All Results — Free ]

No credit card required.
🔒 Signing in does not upload your catalog.
```

Visual treatment:

- one bordered brand-soft panel
- clear CTA
- no dark overlay
- no manipulative countdown
- no "upgrade" language
- no paid-plan language

---

# 42. Sign-In Modal

Use Clerk's supported/prebuilt authentication UI where practical, styled to match the application.

Before/around the auth surface, show:

```text
Signing in only creates your Catalog Margin Guard account.

Your supplier and catalog files remain on your computer and are not uploaded.
```

Prioritize:

```text
Continue with Google
```

and email authentication.

Do not build a custom illustrated login page for v0.

The sign-in experience must feel like unlocking the existing local analysis, not leaving the workflow.

---

# 43. Manual Target Override

Signed-in users can change target margin from a row action.

Preferred desktop interaction:

- small row action such as `Change Target`
- modal/dialog on desktop
- sheet/drawer may be used on mobile

Dialog:

```text
Change target margin

ABC-12

Store default          20.00%
Catalog override       15.00%
Current target         15.00%

Manual override
[ 10.00 ] %

[ Cancel ] [ Save Override ]

Remove manual override
```

Visual hierarchy:

- SKU prominent
- source values secondary
- editable manual override obvious
- destructive-looking red styling is NOT required for "Remove Manual Override"
  because removal simply restores fallback

Use a neutral text button for removal unless product behavior indicates destructive loss.

---

# 44. Data Quality

Data quality matters but should not compete visually with pricing risk.

Default presentation:

```text
Data quality
```

Use a collapsible section after the main results.

Summary line may show:

```text
18,901 matched · 11 supplier duplicates · 7 invalid supplier costs
```

Expanded view:

```text
Supplier rows
Catalog rows
Matched products
Supplier-only products
Catalog-only products
Duplicate supplier identifiers
Duplicate catalog identifiers
Invalid supplier costs
Invalid selling prices
Invalid margin overrides
```

Use a compact two-column definition-list/grid.

Warnings can use amber for actual issues.

Do not mark ordinary unmatched records as red errors by default.

---

# 45. Empty / Zero-Risk Results

If no LOSS or REVIEW products exist, celebrate lightly but remain professional.

Example:

```text
No products currently need margin review.

All analyzed products meet or exceed their configured target margin.
```

Use:

- small success icon
- restrained green
- no confetti
- no full-page celebration animation

Still show:

- summary
- distribution
- data quality
- full results for signed-in users

---

# 46. No Matching Products State

This is not a generic empty state.

Use an actionable error/information state:

```text
We couldn't find matching product identifiers.

Check that the selected Supplier Identifier and Catalog Identifier
columns use the same identifier type.

Examples:
SKU ↔ SKU
UPC ↔ UPC
MPN ↔ MPN

[ Review Column Mapping ]
```

Avoid decorative empty-state illustrations.

---

# 47. Large File Warnings

Large-file warnings should be informative rather than frightening.

Example:

```text
Large catalog detected

This file may use significant browser memory while being analyzed.
For best results, use a desktop computer and close memory-heavy tabs.

Your file will still stay on your computer.

[ Continue ]
```

Use amber-soft styling.

Do not use a destructive/error modal merely because a CSV is large.

For very large XLSX where CSV is recommended, clearly explain the alternative.

---

# 48. Mobile

The landing page must be fully responsive.

The setup workflow should remain usable on mobile/tablet.

However, large catalog analysis is primarily a desktop workflow.

Show a restrained advisory on small screens:

```text
For large catalogs, we recommend using Catalog Margin Guard on a desktop computer.
```

## Mobile Setup

Stack:

- supplier file
- catalog file
- mapping groups
- settings
- CTA

Inputs/buttons become full-width where appropriate.

## Mobile Results

Summary:

- 2-column metrics or vertical list

Margin distribution:

- vertical bar/list

Table:

- horizontal scrolling is acceptable
- keep first identifier column easy to locate
- do not attempt to squeeze every column into the viewport

Alternative compact row cards may be used only if they remain efficient and do not duplicate an entirely separate mobile implementation unnecessarily.

Do not hide important financial values merely to make the table fit.

---

# 49. Breakpoints

Use Tailwind's standard breakpoint strategy unless the implementation has a concrete reason to differ.

Design review should explicitly include approximately:

```text
390px
768px
1024px
1440px
```

At 1024px+, the primary application should feel desktop-like.

At 768px and below, layouts should simplify/stack.

---

# 50. Buttons

## Primary

Use for:

- Check My Catalog
- Analyze Catalog
- See All Results — Free
- Save Override

Style:

- brand blue background
- white text
- medium/semibold
- 8px radius
- clear hover/active/focus
- no gradient

## Secondary

Use for:

- Start New Scan
- Cancel
- Review Column Mapping
- Change File

Style:

- white background
- neutral border
- dark text

## Ghost / Text

Use for:

- Sign in
- Remove Manual Override
- Show technical details
- small row actions when appropriate

## Destructive

Reserve for truly destructive actions.

Do not style ordinary reset/fallback behavior as destructive without reason.

---

# 51. Icons

Use Lucide icons consistently.

Recommended concepts:

- `LockKeyhole` / `Lock` — privacy
- `FileSpreadsheet` — selected files
- `Upload` should generally be avoided in labels, but an import/file-arrow icon may still be acceptable visually if it does not imply server upload
- `CheckCircle2` — ready/success
- `AlertTriangle` — review/warning
- `CircleAlert` / `OctagonAlert` — loss/error
- `Search` — search
- `Download` — export
- `RefreshCw` — new scan/reset only if clear
- `Info` — explanations
- `ChevronDown` — disclosure/selects

Do not place icons beside every heading.

Use icons where they improve comprehension.

Recommended icon sizes:

```text
16px controls/table
18–20px section/supporting
24px major status/empty state
```

---

# 52. Tooltips

Use tooltips only for concepts that genuinely need explanation.

Good tooltip candidates:

- Gross Margin
- Target Margin
- Target Source
- Price for Target Margin
- Case-insensitive identifier matching

Do not hide essential instructions exclusively inside tooltips.

---

# 53. Toasts / Notifications

Use toasts sparingly.

Good uses:

- export generated
- manual override saved
- manual override removed
- non-blocking operation confirmation

Do not use toast-only error reporting for critical analysis failures.

Critical errors belong inline in context.

Toast duration should allow users enough time to read the message.

---

# 54. Dialogs

Dialogs are appropriate for:

- sign-in
- manual override
- critical confirmation when genuinely necessary

Avoid dialogs for:

- ordinary file warnings
- simple validation errors
- every settings change

Dialogs should be compact.

Recommended maximum width:

```text
480–560px
```

---

# 55. Motion

Motion should be subtle and functional.

Allowed:

- 120–200ms hover/focus transitions
- dropdown/dialog open/close
- subtle spinner/progress indicator
- accordion expansion

Avoid:

- page-load entrance animation cascades
- bouncing CTAs
- animated gradients
- parallax
- excessive spring effects
- count-up animations for financial results

Respect `prefers-reduced-motion`.

---

# 56. Accessibility

Meet at least WCAG 2.1 AA principles for the v0 UI.

Required:

- sufficient text/background contrast
- visible keyboard focus
- semantic labels
- keyboard-operable controls
- status not communicated by color alone
- accessible table headers
- dialog focus management
- correct form error association
- sensible heading hierarchy
- reduced-motion support

Minimum target size for primary interactive controls should be approximately 40px high.

Small table row actions must still have a usable click/tap target.

---

# 57. Tables and Accessibility

Use semantic table markup where practical.

Requirements:

- headers associated with cells
- sortable columns communicate sort state
- action buttons have accessible names
- status text remains available to assistive technology
- horizontal scrolling container is keyboard usable
- do not make the entire row a clickable element if there are nested actions

---

# 58. Form Validation

Validation should be immediate enough to help but not noisy.

Use:

- inline field message
- error-colored border
- concise explanation

Example:

```text
Store default margin

[ 120 ] %

Margin must be between 0% and 95%.
```

Do not display validation errors before the user has interacted with the field unless submission requires it.

---

# 59. Loading Skeletons

Use skeletons only when actual loading is expected and content shape is known.

Examples:

- auth state resolving
- tiny summary query transition

Do not use dozens of shimmering rows during long analysis.

For analysis, stage-based progress is more truthful.

---

# 60. Auth Loading

While authentication state is unresolved:

- do not flash signed-in-only controls
- do not flash full result access
- use a small neutral loading placeholder where account controls belong

The application content that is safe for anonymous users may remain visible.

---

# 61. New Scan

`Start New Scan` is a secondary action on the results page.

Do not make it visually compete with the results.

If user action immediately clears the current in-memory analysis, confirmation may be used only when accidental loss is likely.

Suggested confirmation:

```text
Start a new scan?

Your current analysis and session-only target overrides will be cleared.
Your account will remain signed in.

[ Cancel ] [ Start New Scan ]
```

Use neutral confirmation styling.

---

# 62. Export UX

Signed-in users should have clear export actions.

Preferred:

```text
[ Export ▼ ]
```

Menu:

```text
Products to review
Full margin report
```

Alternatively, two secondary buttons are acceptable if the results header has enough space.

Do not use giant export cards.

Show that exports are created locally only when privacy reassurance is useful.

---

# 63. Footer

Keep the v0 footer minimal.

Possible content:

```text
Catalog Margin Guard
Privacy
```

Only include links/pages that actually exist.

Do not create fake social profiles, company addresses, or enterprise pages.

---

# 64. Component Foundation

Use shadcn/ui-style primitives as the implementation foundation where appropriate.

Likely primitives:

- Button
- Input
- Label
- Select
- Checkbox
- Radio Group
- Dialog
- Dropdown Menu
- Tooltip
- Collapsible / Accordion
- Table primitives
- Alert
- Progress/Spinner primitives where suitable
- Sheet only where mobile behavior benefits

Do not treat default shadcn styling as the finished design.

Apply the tokens and rules in this document consistently.

---

# 65. Reusable Product Components

Prefer reusable product components such as:

```text
AppHeader
PrivacyNotice
FilePicker
SelectedFileSummary
FilePreviewTable
SetupSection
ColumnMappingField
MarginInput
AnalysisProgress
StatusBadge
SummaryStrip
MarginExposure
ResultsToolbar
ResultsTable
DataQualityPanel
AccessGate
ManualOverrideDialog
ErrorPanel
LargeFileWarning
EmptyResultsState
```

Do not create page-specific copies of equivalent components.

---

# 66. UI State Coverage

Every major component must account for relevant states.

## File Picker

```text
idle
drag-over
inspecting
ready
warning
error
```

## Analyze Button

```text
disabled
ready
loading/analyzing
```

## Results

```text
anonymous preview
authenticated full access
empty attention set
error
```

## Auth

```text
loading
anonymous
authenticated
authentication failure
```

## Manual Override

```text
no manual override
manual override exists
saving/applying
invalid value
```

Do not design only the happy path.

---

# 67. Visual Priority Rules

When multiple things compete for attention, use this priority:

1. Critical LOSS information
2. Primary user action needed to continue
3. REVIEW information
4. Main data/results
5. Privacy/trust reassurance
6. OK information
7. Secondary configuration
8. Metadata/details

Do not make every status equally loud.

LOSS should be easiest to notice.

REVIEW should be clearly visible.

OK should provide reassurance without dominating.

---

# 68. Information Density

Landing page:

```text
low-to-medium density
```

Setup workflow:

```text
medium density
```

Results/table:

```text
medium-to-high density
```

Do not use landing-page-sized typography inside the application.

Do not create 300px-tall empty result cards.

The product's value is in quickly understanding data.

---

# 69. Content Tone

UI copy should be:

- direct
- calm
- factual
- non-technical where possible
- respectful of the user's data

Prefer:

```text
We couldn't read this file.
```

over:

```text
Fatal parser exception.
```

Prefer:

```text
Needs review
```

over:

```text
Bad pricing
```

Prefer:

```text
Choose Supplier File
```

over:

```text
Upload Supplier Dataset
```

Avoid marketing exaggeration inside the application.

---

# 70. Privacy Tone

Use confident, factual language.

Good:

```text
Your files stay on your computer.
```

Good:

```text
Signing in does not upload your catalog.
```

Avoid:

```text
100% unhackable
Military-grade privacy
Completely impossible for anyone to access
```

Do not make claims the architecture cannot guarantee.

---

# 71. Design Anti-Patterns — Explicitly Avoid

Do not introduce:

- gradient brand backgrounds
- gradient text
- neon accents
- glass cards
- giant dashboard KPI cards
- rounded card around every tiny group
- giant empty-state illustrations
- unnecessary illustrations of spreadsheets
- excessive iconography
- status rainbow palettes
- sidebar navigation with one workflow
- floating action buttons
- oversized pills everywhere
- marketing banners inside results
- disabled teaser controls over the entire authenticated feature set
- blurred sensitive rows to simulate a paywall
- fake progress percentages
- fake activity/history
- fake customer logos/testimonials
- custom charts when a simple readable list is better

---

# 72. Design Acceptance Criteria

UI is considered visually complete when:

1. Landing page communicates the product and primary CTA immediately.
2. Privacy/local-processing reassurance is visible without overwhelming the page.
3. The setup flow clearly communicates file selection, column mapping, and margin settings.
4. The interface never calls local file selection an upload to the product/backend.
5. File-ready, warning, processing, and error states are visually complete.
6. The analysis state uses truthful stage-based progress.
7. Results show LOSS, REVIEW, OK, analyzed count, and average margin with strong hierarchy.
8. LOSS is visually strongest, REVIEW second, and OK restrained.
9. Margin exposure is readable without relying on color.
10. The results table remains compact and easy to scan.
11. Numeric columns are right-aligned and use tabular numbers.
12. Statuses are represented with text, not color alone.
13. Anonymous users see real results before the sign-in gate.
14. The sign-in gate does not use blur/dark-overlay manipulation.
15. Sign-in privacy messaging is clear.
16. Signed-in search/filter/sort/pagination controls are compact and understandable.
17. Manual target editing clearly explains default, catalog, and manual target sources.
18. Data quality is available without dominating the primary results.
19. Desktop 1440px and 1024px layouts are polished.
20. 768px and 390px layouts remain usable and intentional.
21. Keyboard focus is visible throughout.
22. Major flows meet accessibility expectations.
23. No raw/random colors, spacing, or radius values are introduced outside the design token system without justification.
24. UI components reuse the established design primitives.
25. The final result looks like a focused, credible B2B pricing/data product rather than a generic AI-generated SaaS template.

---

# 73. Visual QA Checklist

After implementing any substantial screen, inspect the rendered application.

## Landing

Check:

- headline width and wrapping
- CTA prominence
- privacy message visibility
- whitespace
- mobile hero
- no excessive marketing decoration

## Setup

Check:

- file selectors feel trustworthy
- file states are obvious
- mapping alignment
- labels/inputs are compact
- settings hierarchy
- Analyze button enable/disable state
- privacy message
- mobile stacking

## Processing

Check:

- active stage clear
- completed/pending stages distinct
- cancel action visible but secondary
- no fake progress

## Results

Check:

- analyzed count understood immediately
- LOSS visible immediately
- REVIEW visible second
- OK not visually dominant
- average margin readable
- exposure distribution readable
- table numeric alignment
- status badges
- long SKU handling
- horizontal overflow
- pagination
- anonymous access gate
- signed-in filters/actions

## Dialogs

Check:

- focus behavior
- keyboard escape/close
- button hierarchy
- privacy text around authentication
- manual override values

## Responsive

Review at:

```text
1440px
1024px
768px
390px
```

Fix visual issues before considering the UI complete.

---

# 74. Initial Design Direction Summary

If implementation needs a concise design brief, use this:

> Build Catalog Margin Guard as a clean, restrained, light-mode B2B data application. Use dark slate typography, white surfaces, subtle neutral borders, and blue as the product accent. Reserve red, amber, and green for LOSS, REVIEW, and OK. The landing page should be concise and confident; the application should be denser and optimized for scanning financial data. Use compact tables, tabular numbers, strong alignment, and minimal decoration. Privacy should be visible and factual. Avoid gradients, glassmorphism, oversized cards, unnecessary illustrations, excessive rounded corners, and generic SaaS styling. The product should feel precise, trustworthy, and intentionally designed.
