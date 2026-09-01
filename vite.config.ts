import path from "node:path"

import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss()],
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
  build: {
    sourcemap: true,
    target: "es2022",
  },
}))
