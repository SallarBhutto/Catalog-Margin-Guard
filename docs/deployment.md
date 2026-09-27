# Catalog Margin Guard — Deployment

This is the single source of truth for building, previewing, releasing, and rolling back
Catalog Margin Guard. Other documents describe architecture and link here for process.

External limits below were checked against the linked official pages on **2026-09-27**.
**Re-check every link in [References](#references), including provider pricing, before
each major release.** Providers change free tiers without notice.

## 1. Operating-cost rule

Hosting, deployments, previews, SSL, authentication, browser processing, and file delivery
must stay inside free tiers. The only purchased item is the domain registration.

- The application is **entirely static**. Do not add Pages Functions, Workers logic, R2, KV,
  D1, a database, a backend, or any paid service. A `functions/` directory or a
  `_worker.js` file would turn requests into metered Workers requests and is not allowed.
- All analysis runs in the visitor's browser (DuckDB-Wasm). Nothing about a catalog is sent
  to Cloudflare or Clerk.

| Service          | Tier used         | Role                                              |
| ---------------- | ----------------- | ------------------------------------------------- |
| GitHub           | Free, public repo | Source, pull requests, CI (Actions)               |
| Cloudflare       | Free              | DNS for the domain, Pages hosting, previews, SSL, one redirect rule |
| Clerk            | Hobby (free)      | Sign-in only: development instance for previews, production instance for the site |
| Google Cloud     | Free              | Our own OAuth client for production Google sign-in |

## 2. Domains

| Host                          | Purpose                                             |
| ----------------------------- | --------------------------------------------------- |
| `catalogmarginguard.com`      | **Canonical production site**, served by Cloudflare Pages |
| `www.catalogmarginguard.com`  | 301 redirect to `https://catalogmarginguard.com`, preserving path and query |
| `<project>.pages.dev` and `<branch>.<project>.pages.dev` | Preview deployments (public by default) |
| `clerk.catalogmarginguard.com` and other Clerk records | Assigned by Clerk for the production instance; see section 3 |

### DNS layout

The domain's nameservers point to Cloudflare, so DNS is managed in the Cloudflare zone.

| Record | Name                       | Value                              | Proxy      | Source of the value |
| ------ | -------------------------- | ---------------------------------- | ---------- | ------------------- |
| CNAME  | `catalogmarginguard.com`   | `<project>.pages.dev`              | Proxied    | Created by Cloudflare when the custom domain is added to the Pages project |
| CNAME  | `www`                      | `<project>.pages.dev`              | Proxied    | Same; a Redirect Rule then sends `www` to the apex (section 7, step 6) |
| CNAME  | Clerk records (typically `clerk`, `accounts`, and email records) | **Exactly as shown on Clerk's Domains page** | **DNS only** | Clerk Dashboard → Domains. Do not invent these values. Clerk documents that its records must not be proxied. |

## 3. Clerk instances and keys

- **Preview deployments (`pages.dev`)** use the Clerk **development** instance and its
  `pk_test_` key. Clerk documents that a production instance needs a domain you own and
  that production keys do not work on host-provided domains such as `pages.dev`.
  Development instances are capped at 100 users, show "Development mode", and use Clerk's
  shared Google OAuth credentials. That is acceptable for previews only.
- **Production (`catalogmarginguard.com`)** uses the Clerk **production** instance and its
  `pk_live_` key. Creating it requires the domain's DNS records (section 2) and our own
  Google OAuth credentials (section 7). Users do not transfer between instances.
- **Free tier.** The production instance stays on the Hobby plan, which included 50,000
  monthly retained users per application when checked; exceeding that requires Pro.
  **Monitor usage in the Clerk dashboard and act before the ceiling.**
- **No paid feature may be required.** Paid-only when checked: MFA, passkeys, custom
  password rules, user bans, allowlists/blocklists, simultaneous sessions, and removing
  Clerk branding. The application uses none of them and runs in single-session mode.
  **Clerk branding stays visible because removing it is paid.**
- Clerk SDK telemetry is disabled. No Clerk secret key exists anywhere in this project.

### Key enforcement in the build

`deployment/release-policy.ts` reads the branch Cloudflare injects as `CF_PAGES_BRANCH`:

- branch `main` (production): the build **fails** unless the key is `pk_live_`;
- any other branch (preview): the build **fails** unless the key is `pk_test_`;
- a missing or invalid key fails any Cloudflare build;
- local builds accept either key and warn about a development key.

The Content Security Policy is derived from the key (section 4), so a production build
automatically allows the production Frontend API host that Clerk assigns; nothing is
hard-coded before Clerk supplies it.

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
  `VITE_CLERK_PUBLISHABLE_KEY`, so each environment's build carries its own policy.
- **`dist/assets/duckdb-*.wasm.gz`** replace the raw modules. The browser decompresses the
  selected one with `DecompressionStream`; a browser without it sees an "unsupported
  browser" message. **The build fails if any output file exceeds 25 MiB.**
- The DuckDB worker URL carries a hash of the generated headers, so a policy change is
  never masked by a cached worker script.
- There is **no `_redirects` file and no `404.html`**. Cloudflare Pages serves
  `index.html` for unknown paths such as `/check`, so direct visits work on every domain.
  The `www` redirect is a Cloudflare Redirect Rule, not a file.
- `vite preview` does not apply `_headers`. `vite build --mode e2e` is refused unless
  `CMG_ALLOW_E2E_STUB_BUILD=1`; that build replaces Clerk with a test stub, is written to
  `dist-e2e`, and must never be deployed.
- No canonical `<link>`, Open Graph tags, web manifest, sitemap, or `robots.txt` exist yet.
  They are **deferred**; when added they must use `https://catalogmarginguard.com`.

## 5. Environment variables

Set in the Cloudflare Pages project, **separately for Preview and Production**. Neither
value is secret.

| Variable                     | Preview                          | Production                          |
| ---------------------------- | -------------------------------- | ----------------------------------- |
| `PNPM_VERSION`               | `11.24.0`                        | `11.24.0`                           |
| `VITE_CLERK_PUBLISHABLE_KEY` | development instance, `pk_test_…` | production instance, `pk_live_…`   |

`PNPM_VERSION` is required because the Pages build image defaults to pnpm 10.11.1 and does
not read the `packageManager` field. Node.js is taken from `.node-version`. Cloudflare
injects `CF_PAGES_BRANCH`, which the release policy reads.

Locally, the only configuration is `VITE_CLERK_PUBLISHABLE_KEY` in the git-ignored
`.env.local`.

## 6. Cloudflare Pages free-tier constraints

| Constraint                     | Free limit                      | How this project stays inside it |
| ------------------------------ | ------------------------------- | -------------------------------- |
| Builds per month               | 500                             | Every push to a built branch consumes one. Preview branch control limits which branches build. |
| Concurrent builds              | 1                               | Builds queue; do not push in bursts. |
| Build timeout                  | 20 minutes                      | The build takes well under a minute. |
| Files per site                 | 20,000                          | About 20 files. |
| Maximum size of a single asset | 25 MiB                          | DuckDB modules ship compressed (about 7.3 and 8.3 MiB); the build fails otherwise. |
| Static asset requests          | Free and unlimited              | The site serves only static assets. |
| Pages Functions requests       | Count against the Workers quota | Not used; must stay unused. |
| Custom domains per project     | 100                             | Two. |
| Preview deployments            | Unlimited active                | Public by default. |
| Redirect Rules                 | Available on the Free plan      | One rule (`www` → apex). |

Exceeding the build quota pauses builds; it does not bill. A charge can only come from
deliberately adding a paid Cloudflare product or plan.

## 7. First-time setup (ordered)

**Cloudflare**

1. Add `catalogmarginguard.com` as a zone; change the registrar's nameservers to the ones
   Cloudflare assigns and wait until the zone is active.
2. Workers & Pages → Create → Pages → Connect to Git → `SallarBhutto/Catalog-Margin-Guard`.
   Production branch `main`; build command `pnpm build`; output directory `dist`.
3. Settings → Environment variables: for **Preview**, `PNPM_VERSION=11.24.0` and the
   `pk_test_` key; for **Production**, `PNPM_VERSION=11.24.0` and, once step 10 is done,
   the `pk_live_` key.
4. Settings → Builds: **disable automatic production branch deployments** until the first
   preview is verified. Preview branch control → Custom → `release/*`.
5. Custom domains → add `catalogmarginguard.com`, then `www.catalogmarginguard.com`.
   Cloudflare creates the two proxied CNAMEs.
6. Rules → Redirect Rules → create: when the request URL matches wildcard `https://www.*`,
   redirect to `https://${1}`, status 301, preserve query string (Cloudflare's documented
   "redirect from WWW to root" example).

**Clerk**

7. In the application, create the **production instance** (the dashboard offers it from the
   instance switcher) and enter `catalogmarginguard.com` as its domain.
8. Domains page: add each DNS record Clerk lists to the Cloudflare zone, **DNS only**
   (grey cloud), with exactly the names and values shown. Wait for Clerk to verify them.
9. SSO connections → Google → **Use custom credentials**. Copy the **Authorized Redirect
   URI** Clerk shows.

**Google Cloud**

10. Create an OAuth client (web application). Authorized JavaScript origins:
    `https://catalogmarginguard.com` and `https://www.catalogmarginguard.com`. Authorized
    redirect URI: the value copied from Clerk in step 9. Paste the Client ID and Client
    Secret back into Clerk, then copy the production **publishable key** (`pk_live_…`) into
    the Cloudflare Production variable (step 3).

Nothing in these steps requires a paid plan on any provider.

## 8. Release process

1. Work on a `release/*` branch; open a pull request into `main`; wait for CI.
2. Cloudflare builds the branch preview on `pages.dev` with the development instance.
   Verify it (section 9).
3. Enable automatic production deployments (first release only), then merge the pull
   request into `main`. **This publishes `catalogmarginguard.com`.**
4. Verify production with section 9, including the Safari check in section 10.

## 9. Verification checklist

- The build log shows pnpm 11.24.0 and Node 24.20.0, no oversized-asset error, and no
  release-policy error.
- Response headers on `/` include the CSP and the other generated headers; `/assets/*`
  is served with immutable caching. On production the CSP names the Clerk production
  Frontend API host, not an `accounts.dev` host.
- A direct visit to `/check` loads the application (not a 404). On production,
  `https://www.catalogmarginguard.com/check?x=1` redirects with 301 to the apex with the
  path and query preserved.
- "Local analysis is ready." appears; the console shows no CSP violation.
- Choose two CSV files, analyze, confirm the anonymous results and locked detail.
- **Cancel Analysis** on a large file returns to setup without a reload.
- Sign in from the locked results: the URL stays `/check`, the page does not reload, the
  summary remains, and full results appear. Repeat with "Continue with Google" (on
  production this exercises our own OAuth client).
- The account menu shows exactly one "Sign out". Signing out on `/check` keeps the
  analysis and returns the locked view; signing out on `/` stays on `/`.
- Download both reports and open them.
- Requests go only to the site and to Clerk; none contains catalog values.
- Repeat the engine start and an analysis in Safari and Firefox.

## 10. Safari / WebKit sign-in: known behavior and launch requirement

Clerk's prebuilt sign-in decorates its post-sign-in destination with `decorateUrl`, which
Clerk documents as its Safari ITP workaround: when the client reports
`isEligibleForTouch()` (client cookie due to expire within eight days), the destination
becomes the Frontend API `/v1/client/touch` URL, a full-page navigation through Clerk's
origin. Clerk states ITP caps such cookies at seven days, so on a production instance this
should be expected on every sign-in from Safari and other WebKit browsers. It cannot occur
on development instances, which report no cookie expiry.

Clerk exposes a `navigate` callback only on `setActive()`, which the prebuilt modal calls
internally; the modal and `openSignIn()` accept no such callback, so there is no supported
way to keep the in-memory analysis through that navigation. The application therefore:

- reads the public `client.isEligibleForTouch()` and, when true for an anonymous visitor,
  shows a warning on the "Reveal My Results" panel that signing in will reload the page
  and clear the analysis, and a notice on the setup screen inviting the user to sign in
  before choosing files;
- keeps sign-out unaffected (it uses a callback, so Clerk does not navigate).

**Launch requirement:** on the production instance, in Safari, run an analysis, sign in
from the locked results, and confirm the warning appeared beforehand and the page behaves
as described. Then sign in first, analyze, and confirm nothing reloads. This has not been
tested; only the stubbed condition has.

## 11. Rollback

In the Pages project open **Deployments**, find the last good production deployment, open
its menu, and choose **Rollback to this deployment**. Only successfully built production
deployments are valid targets; previews are not. **The first production deployment has
nothing to roll back to**: fix forward or revert the merge commit on `main`. The
application keeps no server-side data.

## References

- Cloudflare Pages limits: <https://developers.cloudflare.com/pages/platform/limits/>
- Pages Functions pricing (static requests free): <https://developers.cloudflare.com/pages/functions/pricing/>
- Build image (Node and pnpm versions): <https://developers.cloudflare.com/pages/configuration/build-image/>
- Build configuration (`CF_PAGES_BRANCH`): <https://developers.cloudflare.com/pages/configuration/build-configuration/>
- Git integration: <https://developers.cloudflare.com/pages/configuration/git-integration/>
- Branch build controls: <https://developers.cloudflare.com/pages/configuration/branch-build-controls/>
- Preview deployments: <https://developers.cloudflare.com/pages/configuration/preview-deployments/>
- Custom domains: <https://developers.cloudflare.com/pages/configuration/custom-domains/>
- Redirect from WWW to root: <https://developers.cloudflare.com/rules/url-forwarding/examples/redirect-www-to-root/>
- Serving pages (single-page application fallback): <https://developers.cloudflare.com/pages/configuration/serving-pages/>
- Rollbacks: <https://developers.cloudflare.com/pages/configuration/rollbacks/>
- Clerk pricing: <https://clerk.com/pricing>
- Clerk production deployment: <https://clerk.com/docs/guides/development/deployment/production>
- Clerk environments and instances: <https://clerk.com/docs/guides/development/managing-environments>
- Clerk Google social connection: <https://clerk.com/docs/guides/configure/auth-strategies/social-connections/google>
