# Catalog Margin Guard

Privacy-first, browser-local catalog margin analysis for merchants and resellers.

This repository currently contains the initial application foundation and authentication shell:
the React/Vite toolchain, design system, shared UI primitives, public landing page, Clerk boundary,
and centralized access-capability policy. Catalog file processing and the complete setup workflow
are intentionally deferred to later implementation phases.

## Requirements

- Node.js 24.20.0 (see `.node-version` and `.nvmrc`)
- pnpm 11.24.0 (pinned in `package.json`)

## Local development

Copy `.env.example` to `.env.local` and add the Clerk publishable key for the environment. Only
`VITE_CLERK_PUBLISHABLE_KEY` is used by the frontend; do not add a Clerk secret key.

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm dev
```

## Quality checks

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm build
```

Product, technical, and visual requirements live in `docs/` and take precedence over this overview.
