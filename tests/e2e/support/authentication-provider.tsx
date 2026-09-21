import { useCallback, useState, type ReactNode } from "react"

import { navigateTo } from "@/app/app-router"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { AuthStateProvider } from "@/features/auth/auth-context"
import {
  createSignInModalOptions,
  type SignInModalOptions,
} from "@/features/auth/clerk-navigation"

type AuthenticationProviderProps = {
  publishableKey?: string
  children: ReactNode
}

/**
 * Deterministic browser-test adapter. Vite aliases this module only in e2e mode.
 *
 * It reproduces Clerk's navigation contract: after sign-in and sign-up it navigates to the
 * destination Clerk would resolve, through the same client-side router callback the real
 * provider hands to Clerk. Clerk defaults that destination to `/`, so a missing fallback
 * or a broken router integration surfaces here as a lost analysis instead of passing
 * silently. Sign-out performs no navigation, matching the real callback-based sign-out.
 */
function AuthenticationProvider({ children }: AuthenticationProviderProps) {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [modalOptions, setModalOptions] = useState<SignInModalOptions | null>(null)
  const [authMode, setAuthMode] = useState<"sign-in" | "sign-up">("sign-in")
  const requestSignIn = useCallback(() => {
    setAuthMode("sign-in")
    setModalOptions(createSignInModalOptions())
  }, [])

  const completeAuthentication = () => {
    const destination =
      (authMode === "sign-in"
        ? modalOptions?.fallbackRedirectUrl
        : modalOptions?.signUpFallbackRedirectUrl) ?? "/"
    setIsAuthenticated(true)
    setModalOptions(null)
    setAuthMode("sign-in")
    navigateTo(destination)
  }

  // The real provider signs out with a callback, so Clerk performs no navigation.
  const signOut = () => setIsAuthenticated(false)

  return (
    <AuthStateProvider
      status={isAuthenticated ? "authenticated" : "anonymous"}
      requestSignIn={requestSignIn}
      accountMenu={
        <Button type="button" variant="ghost" size="small" onClick={signOut}>
          Sign out
        </Button>
      }
    >
      {children}
      <Dialog
        open={modalOptions !== null}
        onOpenChange={(open) => {
          if (!open) {
            setModalOptions(null)
            setAuthMode("sign-in")
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {authMode === "sign-in" ? "Sign in free" : "Create your free account"}
            </DialogTitle>
            <DialogDescription>
              Browser-test authentication preserves the current local analysis.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-md border border-brand-soft-border bg-brand-soft p-3 text-sm leading-[22px]">
            <p className="font-medium text-text-primary">
              Signing in only creates your Catalog Margin Guard account.
            </p>
            <p className="mt-1 text-text-secondary">
              Your supplier and catalog files remain on your computer and are not
              uploaded.
            </p>
          </div>
          <DialogFooter>
            {authMode === "sign-in" ? (
              <Button
                type="button"
                variant="ghost"
                onClick={() => setAuthMode("sign-up")}
              >
                Create account
              </Button>
            ) : (
              <Button
                type="button"
                variant="ghost"
                onClick={() => setAuthMode("sign-in")}
              >
                Back to sign in
              </Button>
            )}
            <Button type="button" onClick={completeAuthentication}>
              {authMode === "sign-in" ? "Complete sign in" : "Complete sign up"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AuthStateProvider>
  )
}

export { AuthenticationProvider }
