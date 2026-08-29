# Project Instructions

## UI and Frontend

For any frontend or UI implementation:

- Use the `professional-web-ui` skill.
- Follow `docs/design.md` once that document exists.
- Maintain a consistent design system.
- Reuse existing components before creating new ones.
- Do not introduce arbitrary colors, spacing, typography, radii, shadows, or component patterns.
- Responsive behavior is required.
- Accessibility is part of completion.
- Visually inspect substantial UI work before considering it complete.

## Product Requirements

The source of truth for product behavior, scope, user flows, and business rules is:

`docs/product-requirements.md`

Do not invent product requirements that conflict with this document.

If a product behavior is unclear, prefer the simplest interpretation consistent with the product requirements rather than expanding scope.

## Technical Requirements

The source of truth for architecture, technology choices, implementation constraints, performance requirements, security requirements, privacy architecture, testing, and deployment is:

`docs/technical-requirements.md`

Follow the technical requirements before introducing architectural or infrastructure decisions.

Do not replace specified technologies or architectural decisions without a concrete reason.

If implementation details are unspecified, make the simplest maintainable engineering decision that remains consistent with both the product and technical requirements.

## Design Requirements

The source of truth for the product's visual language and product-specific UI decisions is:

`docs/design.md`

Once this document exists:

- Follow it for all frontend implementation.
- Do not introduce competing design patterns.
- Use the established design tokens and component patterns.
- Prefer consistency with the existing application over inventing new visual treatments.

The `professional-web-ui` skill defines general UI quality standards.

`docs/design.md` defines how this specific product should look and feel.

## Architecture Principles

Prefer simple, maintainable architecture appropriate for the current product stage.

Do not introduce unnecessary:

- infrastructure
- abstraction
- dependencies
- services
- state-management libraries
- persistence
- background processing
- backend components

without a concrete requirement.

Do not overengineer for hypothetical future use cases.

Optimize for:

1. correctness
2. privacy
3. maintainability
4. responsiveness
5. simplicity
6. performance appropriate for the documented workloads

## Source of Truth Priority

When making implementation decisions, use this order:

1. `docs/product-requirements.md` — what the product must do
2. `docs/technical-requirements.md` — how the system should be engineered
3. `docs/design.md` — how the product should look and behave visually
4. `.agents/skills/professional-web-ui/SKILL.md` — general UI quality standards
5. existing code and established project patterns

Do not silently contradict a higher-priority source.

## Implementation Discipline

Before making substantial changes:

- Read the relevant requirements.
- Inspect existing code and reusable components.
- Preserve established project conventions.
- Keep changes scoped to the task.
- Avoid unrelated refactors.

Before considering substantial work complete:

- run lint
- run typecheck
- run relevant tests
- run the production build
- fix issues introduced by the change

For substantial UI work, also inspect the rendered application at appropriate desktop and mobile sizes.
