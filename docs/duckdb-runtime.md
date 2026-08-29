# DuckDB-Wasm Runtime Foundation

This document records the Phase 4 runtime decisions. It does not define file ingestion or analysis behavior.

## Runtime and assets

- Package: `@duckdb/duckdb-wasm@1.32.0`, explicitly pinned to the latest published non-prerelease npm package available when this phase was implemented.
- Vite imports the EH and MVP WASM modules and worker scripts with `?url`.
- Vite fingerprints and emits those files into the production `dist/assets` directory.
- Runtime selection uses DuckDB-Wasm's `selectBundle` feature detection in this order: EH, then MVP.
- No DuckDB runtime asset is loaded from a third-party CDN.
- The runtime module is dynamically imported only when the `/check` workflow prepares local analysis. The landing page does not initialize the engine or fetch WASM.

The database uses DuckDB-Wasm's default in-memory session. The service does not call `open()` with a persistent path and does not use OPFS, IndexedDB, local storage, or session storage.

## Versioning note

DuckDB's documentation reports the current DuckDB WebAssembly client/database version as `1.5.5`. That is not a published version of the `@duckdb/duckdb-wasm` npm package. At verification time, npm's tags were:

```text
latest → 1.33.1-dev57.0
next   → 1.33.1-dev64.0
```

Both tagged versions are semver prereleases. The registry had no `@duckdb/duckdb-wasm@1.5.5` and no stable `1.33.0` package, while the official GitHub release notes said the `v1.33.0` release was intended to correct an npm publishing problem. The project therefore pins the last published stable npm package, `1.32.0`, rather than following the temporarily inconsistent `latest` tag.

## Lifecycle ownership

`src/lib/duckdb/duckdb-engine.ts` is the single application-level owner of:

- lazy initialization
- concurrent initialization deduplication
- connection tracking and closure
- `SELECT 42 AS value` health checks
- reset into a clean in-memory engine
- database/worker termination
- sanitized lifecycle state and errors

React only requests readiness from this service. It does not construct DuckDB databases, workers, or connections.

## COI/threading decision

The COI bundle is deferred. The baseline deliberately does not add the COI WASM/worker artifacts or COOP/COEP headers, and works with `crossOriginIsolated === false`.

Enabling COI later would require:

1. adding the COI WASM, main worker, and pthread worker to the local Vite bundle definition;
2. adding compatible COOP/COEP response headers;
3. testing DuckDB fallback when isolation is unavailable;
4. fully regressing Clerk email sign-in, Google popup auth, sign-in dialogs, user menus, bot-protection resources, and supported browsers on a deployed preview.

Do not enable those headers until the deployed Clerk flows are proven compatible. Threading remains an optional performance optimization rather than a product prerequisite.
