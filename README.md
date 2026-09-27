# Catalog Margin Guard

Privacy-first, browser-local catalog margin analysis for merchants and resellers.

## First public beta scope

- Input: **CSV and TSV** supplier and catalog files. Excel (`.xlsx`) is not supported yet.
- Anonymous: complete local analysis, summary, margin exposure, and data quality.
- Free sign-in (Clerk Hobby): full results with search, filters, sorting and pagination,
  session-only manual target overrides, and two CSV reports (Products To Review, Full
  Margin Report). Production at `catalogmarginguard.com` uses a Clerk production
  instance on the free Hobby plan; `pages.dev` previews use the development instance.
- Files are processed by DuckDB-Wasm inside the browser. There is no application backend,
  database, analytics, or error reporting service. The only third-party traffic is Clerk
  identity traffic, which never receives catalog data.
- Nothing is persisted: refreshing the page clears the analysis.

Product, technical, and visual requirements live in `docs/` and take precedence over this
overview.

## Requirements

- Node.js 24.20.0 (see `.node-version` and `.nvmrc`)
- pnpm 11.24.0 (pinned in `package.json`)

## Local development

Copy `.env.example` to `.env.local` and add the Clerk publishable key for the environment.
Only `VITE_CLERK_PUBLISHABLE_KEY` is used by the frontend; never add a Clerk secret key.

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

`pnpm test:e2e` runs against `vite --mode e2e`, which replaces Clerk with a deterministic
test stub. That mode cannot be built for production.

## Deployment

Deployment, previews, environment variables, rollback, and the free-tier rules are
documented in [docs/deployment.md](docs/deployment.md), the single source of truth for
the release process. In short: Cloudflare Pages builds `main` from GitHub with
`pnpm build` into `dist` and serves it at `catalogmarginguard.com`; the build generates
`_headers`, fails if any output file exceeds 25 MiB, and fails a production build that
does not carry a Clerk production key.
