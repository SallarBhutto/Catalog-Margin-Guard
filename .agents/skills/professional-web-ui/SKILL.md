---
name: professional-web-ui
description: >
  Use this skill whenever designing, creating, modifying, reviewing, or improving frontend UI, pages, components, dashboards, forms, tables, navigation, responsive layouts, landing pages, authentication screens, or visual styling. Produce polished, modern, professional, production-quality web interfaces rather than generic AI-generated UI.
---

# Professional Web UI

## Goal

Build interfaces that look intentionally designed by an experienced product
designer and frontend engineer.

Functionality alone is not sufficient. Visual quality, consistency,
usability, responsiveness, and accessibility are part of completion.

## Before implementing UI

Before creating or changing UI:

1. Understand the purpose of the page and its primary user action.
2. Inspect the existing design system and reusable components.
3. Read the project's design documentation if it exists.
4. Reuse existing patterns before inventing new ones.
5. Maintain one consistent visual language throughout the application.

For a new project, establish the design system before building many pages.

## Visual hierarchy

Every page should clearly communicate:

1. What page am I on?
2. What is most important here?
3. What should I do next?
4. What information is secondary?

Use typography, spacing, positioning, contrast, and grouping to establish
hierarchy.

Do not make every element equally prominent.

## Layout

Use strong alignment and consistent layout primitives.

Prefer clear page containers and predictable spacing.

Avoid:

- arbitrary widths
- inconsistent alignment
- excessive nested containers
- putting every section inside a card
- unnecessarily large empty areas
- giant padding merely to make the UI look "premium"

Information density should match the product.

## Spacing

Use a consistent spacing scale.

Prefer values based around:

- 4px
- 8px
- 12px
- 16px
- 24px
- 32px
- 48px
- 64px

Avoid arbitrary spacing unless there is a clear reason.

## Typography

Establish a restrained typography hierarchy for:

- page titles
- section headings
- body text
- labels
- supporting text
- metadata

Avoid:

- too many font sizes
- excessive bold text
- oversized headings
- weak contrast between hierarchy levels

Optimize for readability and scanning.

## Colors

Use design tokens.

Never scatter arbitrary color values throughout components.

Define semantic colors for:

- background
- surface
- primary text
- secondary text
- borders
- brand/accent
- success
- warning
- danger
- informational states

Use accent colors intentionally.

Do not introduce gradients simply to make the interface look modern.

## Borders, radius, and shadows

Use consistent border-radius tokens.

Use borders and shadows sparingly.

Prefer hierarchy through spacing and surface contrast.

Avoid:

- excessive rounded rectangles
- heavy shadows
- glowing elements
- borders around every section
- card-inside-card interfaces

## Components

Create reusable UI primitives where appropriate.

Before creating a new component, determine whether an existing component can
be reused, composed, or extended.

Avoid nearly-identical duplicated components.

Keep visual behavior centralized.

## Forms

Forms should be easy to understand and fast to complete.

- Group related fields.
- Keep labels consistent.
- Clearly communicate required fields.
- Use appropriate controls for the data type.
- Maintain consistent input heights.
- Show useful validation errors.
- Preserve entered values when validation fails.
- Provide clear disabled/loading states.

Do not make simple forms unnecessarily large.

## Tables and data-heavy interfaces

Prioritize readability and information density.

- Keep row heights reasonable.
- Make important fields visually stronger.
- Keep metadata subdued.
- Make sorting/filtering obvious.
- Provide useful pagination when necessary.
- Design meaningful empty states.
- Design loading and error states.
- Avoid decorative elements that reduce usable space.

## Navigation

Navigation should make the application's structure obvious.

Clearly differentiate:

- current location
- navigation actions
- primary actions
- account/settings actions

Avoid unnecessarily complex navigation.

## Interaction states

Interactive elements should account for:

- default
- hover
- focus
- active
- disabled
- loading
- error
- selected states

Never remove visible keyboard focus without providing an accessible
replacement.

## Responsive design

Do not treat responsiveness as simply shrinking desktop UI.

Review approximately:

- 1440px desktop
- 1024px laptop/tablet
- 768px tablet
- 390px mobile

At smaller widths reconsider:

- navigation
- sidebars
- forms
- tables
- button groups
- typography
- spacing
- information priority

## Accessibility

Use:

- semantic HTML
- accessible labels
- sufficient contrast
- keyboard-accessible interactions
- visible focus indicators
- appropriate ARIA only where necessary

Do not communicate important state using color alone.

## Icons

Use one consistent icon library.

Icons should improve comprehension, not decorate every label and heading.

Avoid excessive icon usage.

## Avoid generic AI-generated UI

Do not default to:

- giant gradient hero sections
- excessive gradients
- glassmorphism everywhere
- huge rounded cards
- floating decorative blobs
- unnecessary pills and badges
- icons beside every heading
- excessive shadows
- giant headings
- oversized whitespace
- card grids for content that does not need cards
- multiple nested cards
- random accent colors

Choose patterns appropriate to the actual product.

The design should feel intentional rather than generated from a generic
"SaaS landing page" template.

## New-project design system

When starting a new application, define a design system before creating many
product pages.

Establish:

- typography
- colors
- spacing
- radius
- shadows
- layout/container widths
- responsive breakpoints
- buttons
- inputs
- dropdowns
- dialogs
- navigation
- tables
- cards/surfaces
- notifications
- loading states
- empty states
- error states

Document product-specific decisions in the project's design documentation.

## Visual QA

After implementing substantial UI:

1. Run the application.
2. Inspect the actual rendered result.
3. Review desktop and mobile.
4. Check:

   - hierarchy
   - alignment
   - spacing
   - typography
   - visual consistency
   - information density
   - responsiveness
   - interaction states
   - accessibility

5. Fix visual issues before declaring the work complete.

Do not consider UI complete merely because it compiles and functions.

## Final standard

The interface should be:

- clean
- cohesive
- restrained
- professional
- responsive
- accessible
- product-specific
- production quality

Prefer intentional product design over visual decoration.
