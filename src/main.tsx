import "@fontsource-variable/inter"
import { StrictMode } from "react"
import { createRoot } from "react-dom/client"

import App from "@/app/App"
import { AppErrorBoundary } from "@/app/app-error-boundary"
import { AuthenticationProvider } from "@/features/auth/authentication-provider"
import "@/index.css"

const rootElement = document.getElementById("root")

if (!rootElement) throw new Error("Application root element was not found")

createRoot(rootElement).render(
  <StrictMode>
    <AppErrorBoundary>
      <AuthenticationProvider publishableKey={import.meta.env.VITE_CLERK_PUBLISHABLE_KEY}>
        <App />
      </AuthenticationProvider>
    </AppErrorBoundary>
  </StrictMode>,
)
