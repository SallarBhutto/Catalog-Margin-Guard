# Catalog Margin Guard

Privacy-first, browser-local catalog margin analysis for merchants and resellers.

This repository currently contains the initial application foundation: the React/Vite toolchain,
design system, shared UI primitives, application shell, public landing page, and test foundations.
Catalog file processing, authentication, and the complete setup workflow are intentionally deferred
to later implementation phases.

## Requirements

- Node.js 24.20.0 (see `.node-version` and `.nvmrc`)
- pnpm 11.24.0 (pinned in `package.json`)

## Local development

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
