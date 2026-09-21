# Catalog Margin Guard — Deployment

This is the single source of truth for building, previewing, releasing, and rolling back
Catalog Margin Guard. Other documents describe architecture and link here for process.

External limits below were checked against the linked official pages on **2026-09-22**.
They change; re-check every link in [References](#references) before each launch.

## 1. Operating-cost rule for the beta

Hosting, deployments, previews, SSL, authentication, browser processing, and file delivery
must stay inside free tiers.

- The application is **entirely static**. Do not add Pages Functions, Workers logic, R2, KV,
  D1, a database, a backend, or any paid service. A `functions/` directory or a
  `_worker.js` file would turn requests into metered Workers requests and is not allowed.
- All analysis runs in the visitor's browser (DuckDB-Wasm). Nothing about a catalog is sent
  to Cloudflare or Clerk.
- A purchased custom domain is optional and deferred. The beta uses the free
  `<project>.pages.dev` address.

| Service          | Tier used        | Role                               |
| ---------------- | ---------------- | ---------------------------------- |
| GitHub           | Free, public repo | Source, pull requests, CI (Actions) |
| Cloudflare Pages | Free             | Static hosting, previews, SSL       |
| Clerk            | Hobby (free)     | Sign-in only                        |
| Google OAuth     | Free             | Only once a Clerk production instance exists |

## 2. Cloudflare Pages free-tier constraints

| Constraint                     | Free limit                         | How this project stays inside it |
| ------------------------------ | ---------------------------------- | -------------------------------- |
| Builds per month               | 500                                | Every push to a built branch consumes one. Limit preview branches (section 6). |
| Concurrent builds              | 1                                  | Builds queue; do not push in bursts. |
| Build timeout                  | 20 minutes                         | The build takes well under a minute. |
| Files per site                 | 20,000                             | The build emits about 20 files. |
| Maximum size of a single asset | 25 MiB                             | DuckDB modules ship gzip-compressed (about 7.3 and 8.3 MiB). **The build fails if any output file exceeds 25 MiB.** |
| Static asset requests          | Free and unlimited                 | The site serves only static assets. |
| Pages Functions requests       | Count against the Workers quota    | Not used. Must stay unused. |
| Preview deployments            | Available, unlimited active        | Used for release verification. Public by default. |

Exceeding the build quota stops builds until the next month; it does not bill. A charge can
only come from deliberately adding a paid Cloudflare product, a paid plan, or a domain.

## 3. Clerk Hobby constraints

- The Hobby plan is free. When checked it included 50,000 monthly retained users per
  application; exceeding it requires upgrading. **Monitor usage in the Clerk dashboard and
  act before the ceiling is reached.**
- No paid Clerk feature may be required. When checked, paid-only features included
  multi-factor authentication, passkeys, custom password rules, user bans, allowlists and
  blocklists, simultaneous sessions, and removing Clerk branding. The application uses
  none of them, runs in single-session mode, and **Clerk branding remains visible**.
- Clerk SDK telemetry is disabled in the application.

### The `pages.dev` address and Clerk instances

Clerk's documentation states that a **production instance requires a domain you own**
(it needs DNS records) and that production keys cannot be used on host-provided domains.
A `pages.dev` address cannot satisfy that. Therefore:

- **While the beta runs on `pages.dev`, it uses the Clerk _development_ instance**
  (`pk_test_` key). Clerk caps development instances at **100 users**, shows a
  "Development mode" badge in its components, uses shared OAuth credentials for Google,
  and describes them as not suitable for production workloads. The build prints a warning
  for this key; that warning is expected in this phase. Treat this phase as a limited beta.
- **Moving to a Clerk production instance requires the deferred custom domain.** It stays
  on the free Hobby plan, but needs: the domain and its DNS records in Clerk, a `pk_live_`
  key, and **our own Google OAuth credentials** (Clerk's shared development credentials
  are not available in production). Users do not transfer between instances.

## 4. Build contract

| Setting          | Value                                              |
| ---------------- | -------------------------------------------------- |
| Package manager  | pnpm 11.24.0 (`packageManager` in `package.json`)  |
| Node.js          | 24.20.0 (`.node-version`, `.nvmrc`)                |
| Install          | `pnpm install --frozen-lockfile`                   |
| Build command    | `pnpm build` (`tsc -b && vite build`)              |
| Output directory | `dist`                                             |

What the build produces beyond the bundle:

- **`dist/_headers`** is generated, not checked in (`deployment/security-headers.ts`). It
  contains the Content Security Policy, `X-Content-Type-Options`, `Referrer-Policy`,
  `X-Frame-Options`, `Permissions-Policy`, `Strict-Transport-Security`, and immutable
  caching for `/assets/*`. The CSP names the Clerk Frontend API host decoded from
  `VITE_CLERK_PUBLISHABLE_KEY`, so **each environment's build carries its own policy**.
  Without a valid key the build warns and emits a policy with sign-in disabled.
- **`dist/assets/duckdb-*.wasm.gz`** replace the raw modules. The browser decompresses the
  selected one with `DecompressionStream`; a browser without it sees an "unsupported
  browser" message.
- The DuckDB worker URL carries a hash of the generated headers, so a policy change is
  never masked by a cached worker script.
- There is **no `_redirects` file**. Cloudflare Pages serves `index.html` for unknown paths
  such as `/check` when the site has no top-level `404.html`. Do not add a `404.html`.
- `vite preview` does not apply `_headers`. `vite build --mode e2e` is refused unless
  `CMG_ALLOW_E2E_STUB_BUILD=1`; that build replaces Clerk with a test stub, is written to
  `dist-e2e`, and must never be deployed.

## 5. Environment variables

Set these in the Cloudflare Pages project, **separately for Preview and Production**.
Neither is secret; never add a Clerk secret key anywhere.

| Variable                     | Preview                          | Production                                   |
| ---------------------------- | -------------------------------- | -------------------------------------------- |
| `PNPM_VERSION`               | `11.24.0`                        | `11.24.0`                                    |
| `VITE_CLERK_PUBLISHABLE_KEY` | Clerk development key (`pk_test_…`) | `pk_test_…` while on `pages.dev`; `pk_live_…` once a custom domain and Clerk production instance exist |

`PNPM_VERSION` is required because the Pages build image defaults to pnpm 10.11.1 and does
not read the `packageManager` field. Node.js is taken from `.node-version`.

Locally, the only configuration is `VITE_CLERK_PUBLISHABLE_KEY` in the git-ignored
`.env.local`. No account identifier, API token, or credential is needed in the repository.

## 6. Deployment mechanism: Cloudflare Pages Git integration

There is no deploy command, Wrangler configuration, or CI deploy step, by design.
Cloudflare Pages builds from GitHub:

- **Production branch: `main`.** With automatic production deployments enabled, a push or
  merge to `main` publishes production.
- **Previews:** by default Pages builds every commit on every non-production branch, which
  spends the monthly build quota. Set preview branch control to **Custom** and include only
  `release/*`. Preview URLs are `<hash>.<project>.pages.dev` and
  `<branch>.<project>.pages.dev`, and are public by default.
- GitHub Actions (`.github/workflows/ci.yml`) runs lint, typecheck, unit tests, the build,
  and browser tests on pull requests and on `main`. It does not deploy.

Until the Pages project exists, pushing a branch or opening a pull request runs CI only.

## 7. Release process

1. Work on a `release/*` branch; open a pull request into `main`; wait for CI.
2. Cloudflare builds the branch preview. Verify it (section 8).
3. Merge the pull request into `main`. **This publishes production** when automatic
   production deployments are enabled.
4. Verify production with the same checklist.

First release only: create the Pages project with **automatic production deployments
disabled**, verify a preview of the release branch, then enable them and merge. Connecting
the repository while `main` still contains the uncompressed DuckDB modules would make the
first production build fail on the 25 MiB limit.

## 8. Preview verification checklist

- The build log shows pnpm 11.24.0 and Node 24.20.0, and no oversized-asset error.
- Response headers on `/` include the CSP and the other generated headers; `/assets/*`
  is served with immutable caching.
- A direct visit to `/check` loads the application (not a 404).
- "Local analysis is ready." appears; the browser console shows no CSP violation.
- Choose two CSV files, analyze, and confirm the anonymous results and locked detail.
- **Cancel Analysis** on a large file returns to setup without a reload.
- Sign in from the locked results: the URL stays `/check`, the page does not reload, the
  summary remains, and full results appear. Repeat with "Continue with Google".
- The account menu shows exactly one "Sign out". Signing out on `/check` keeps the
  analysis and returns the locked view; signing out on `/` stays on `/`.
- Download both reports and open them.
- In the network panel, requests go only to the site and to Clerk; none contains catalog
  values.
- Repeat the engine start and an analysis in Safari and Firefox.

## 9. Rollback

In the Pages project open **Deployments**, find the last good production deployment, open
its menu, and choose **Rollback to this deployment**. Only successfully built production
deployments are valid targets; preview deployments are not.

**The first production deployment has nothing to roll back to.** If it is bad, fix forward
or revert the merge commit on `main`, which triggers a new production build. The
application keeps no server-side data, so no release needs a data migration.

## 10. Known limitations to re-verify before leaving `pages.dev`

- **Clerk's Safari ITP workaround.** After sign-in, Clerk's components wrap the destination
  URL; when the server-reported client cookie expiry is within eight days
  (`client.isEligibleForTouch()`), the destination becomes the cross-origin Frontend API
  `/v1/client/touch` endpoint. That is a full page navigation, so the in-memory analysis is
  lost and the user returns to an empty `/check`, signed in. The text Clerk ships with this
  code attributes it to Safari limiting such cookies to seven days, which is below the
  eight-day threshold, so on a production instance it should be expected on **every**
  sign-in in Safari and other WebKit browsers, not occasionally. Development instances
  report no cookie expiry, so it does not occur on `pages.dev`. Clerk's prebuilt sign-in
  offers no option to skip it; sign-out is unaffected because the application signs out
  with a callback. Test sign-in from an active analysis in Safari before launching on a
  production instance.
- Decompression and engine start were measured only in desktop Chrome.
- The largest export measured is 100,000 products; the largest cancelled and completed
  analysis is 400,000 rows.

## References

- Cloudflare Pages limits: <https://developers.cloudflare.com/pages/platform/limits/>
- Pages Functions pricing (static requests free): <https://developers.cloudflare.com/pages/functions/pricing/>
- Build image (Node and pnpm versions): <https://developers.cloudflare.com/pages/configuration/build-image/>
- Git integration: <https://developers.cloudflare.com/pages/configuration/git-integration/>
- Branch build controls: <https://developers.cloudflare.com/pages/configuration/branch-build-controls/>
- Preview deployments: <https://developers.cloudflare.com/pages/configuration/preview-deployments/>
- Serving pages (single-page application fallback): <https://developers.cloudflare.com/pages/configuration/serving-pages/>
- Rollbacks: <https://developers.cloudflare.com/pages/configuration/rollbacks/>
- Clerk pricing: <https://clerk.com/pricing>
- Clerk production deployment: <https://clerk.com/docs/guides/development/deployment/production>
- Clerk environments and instances: <https://clerk.com/docs/guides/development/managing-environments>
