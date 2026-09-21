import { createHash } from "node:crypto"
import { readdir, stat } from "node:fs/promises"
import path from "node:path"
import { gzipSync } from "node:zlib"

import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig, loadEnv, type Plugin } from "vite"

import {
  COMPRESSED_MODULE_SUFFIX,
  describeOversizedAssets,
  findOversizedAssets,
  isDuckDBModuleAsset,
  type BuiltAsset,
} from "./deployment/build-assets"
import {
  createDeploymentHeaders,
  parseClerkPublishableKey,
} from "./deployment/security-headers"

/** Emits the host `_headers` file with a CSP that matches the configured Clerk instance. */
function deploymentHeaders(mode: string): Plugin {
  return {
    name: "catalog-margin-guard:deployment-headers",
    apply: "build",
    generateBundle() {
      const publishableKey = loadEnv(
        mode,
        import.meta.dirname,
        "VITE_",
      ).VITE_CLERK_PUBLISHABLE_KEY
      const clerk = parseClerkPublishableKey(publishableKey)

      if (!clerk) {
        this.warn(
          "VITE_CLERK_PUBLISHABLE_KEY is missing or invalid: this build has sign-in disabled and a CSP without Clerk.",
        )
      } else if (clerk.environment === "development") {
        this.warn(
          "This build uses a Clerk development instance (pk_test_): capped at 100 users and not meant for production workloads. See docs/deployment.md.",
        )
      }

      this.emitFile({
        type: "asset",
        fileName: "_headers",
        source: createDeploymentHeaders(publishableKey),
      })
    },
  }
}

/**
 * Replaces each DuckDB WebAssembly module with a gzip-compressed copy (`*.wasm.gz`). The
 * matching URLs are rewritten by `renderBuiltUrl` below and the browser decompresses the
 * selected module (see `src/lib/duckdb/duckdb-module-source.ts`).
 */
function compressDuckDBModules(): Plugin {
  return {
    name: "catalog-margin-guard:compress-duckdb-modules",
    apply: "build",
    generateBundle(_options, bundle) {
      for (const [fileName, output] of Object.entries(bundle)) {
        if (output.type !== "asset" || !isDuckDBModuleAsset(fileName)) continue

        const source =
          typeof output.source === "string"
            ? Buffer.from(output.source)
            : Buffer.from(output.source)
        delete bundle[fileName]
        this.emitFile({
          type: "asset",
          fileName: `${fileName}${COMPRESSED_MODULE_SUFFIX}`,
          source: gzipSync(source, { level: 9 }),
        })
      }
    },
  }
}

async function listBuiltAssets(
  directory: string,
  root = directory,
): Promise<BuiltAsset[]> {
  const entries = await readdir(directory, { withFileTypes: true })
  const nested = await Promise.all(
    entries.map(async (entry): Promise<BuiltAsset[]> => {
      const absolute = path.join(directory, entry.name)
      if (entry.isDirectory()) return listBuiltAssets(absolute, root)
      return [
        { fileName: path.relative(root, absolute), bytes: (await stat(absolute)).size },
      ]
    }),
  )
  return nested.flat()
}

/** Fails the build when any deployable file exceeds the static host's per-file limit. */
function enforceAssetSizeLimit(): Plugin {
  let outDir = "dist"
  return {
    name: "catalog-margin-guard:asset-size-limit",
    apply: "build",
    configResolved(config) {
      outDir = path.resolve(config.root, config.build.outDir)
    },
    async closeBundle() {
      const oversized = findOversizedAssets(await listBuiltAssets(outDir))
      if (oversized.length > 0) throw new Error(describeOversizedAssets(oversized))
    },
  }
}

export default defineConfig(({ command, mode }) => {
  const isStubBuild = command === "build" && mode === "e2e"
  if (isStubBuild && process.env.CMG_ALLOW_E2E_STUB_BUILD !== "1") {
    // The e2e mode swaps real authentication for a test stub and must never be shipped.
    throw new Error(
      'Refusing to build in "e2e" mode: it replaces Clerk with a test stub. Local verification builds must set CMG_ALLOW_E2E_STUB_BUILD=1 and are written to dist-e2e, never dist.',
    )
  }

  // A worker is governed by the CSP delivered with its own script, and that script is cached
  // as immutable. Putting the policy version in the worker URL makes every policy change
  // fetch the worker again instead of reusing a response that carries the old policy.
  const deploymentPolicyVersion = createHash("sha256")
    .update(
      createDeploymentHeaders(
        loadEnv(mode, import.meta.dirname, "VITE_").VITE_CLERK_PUBLISHABLE_KEY,
      ),
    )
    .digest("hex")
    .slice(0, 12)

  return {
    define: {
      "import.meta.env.VITE_DEPLOYMENT_POLICY_VERSION": JSON.stringify(
        deploymentPolicyVersion,
      ),
    },
    plugins: [
      react(),
      tailwindcss(),
      compressDuckDBModules(),
      deploymentHeaders(mode),
      enforceAssetSizeLimit(),
    ],
    resolve: {
      alias: [
        ...(mode === "e2e"
          ? [
              {
                find: "@/features/auth/authentication-provider",
                replacement: path.resolve(
                  import.meta.dirname,
                  "./tests/e2e/support/authentication-provider.tsx",
                ),
              },
            ]
          : []),
        {
          find: "@",
          replacement: path.resolve(import.meta.dirname, "./src"),
        },
      ],
    },
    experimental: {
      renderBuiltUrl(filename) {
        return isDuckDBModuleAsset(filename)
          ? `/${filename}${COMPRESSED_MODULE_SUFFIX}`
          : undefined
      },
    },
    build: {
      // A stub-authentication build can never land in the deployable directory.
      outDir: isStubBuild ? "dist-e2e" : "dist",
      sourcemap: true,
      target: "es2022",
    },
  }
})
