import { useCallback, useState, type ReactNode } from "react"

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

type AuthenticationProviderProps = {
  publishableKey?: string
  children: ReactNode
}

/** Deterministic browser-test adapter. Vite aliases this module only in e2e mode. */
function AuthenticationProvider({ children }: AuthenticationProviderProps) {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isSignInOpen, setIsSignInOpen] = useState(false)
  const requestSignIn = useCallback(() => setIsSignInOpen(true), [])

  return (
    <AuthStateProvider
      status={isAuthenticated ? "authenticated" : "anonymous"}
      requestSignIn={requestSignIn}
      accountMenu={
        <Button
          type="button"
          variant="ghost"
          size="small"
          onClick={() => setIsAuthenticated(false)}
        >
          Sign out
        </Button>
      }
    >
      {children}
      <Dialog open={isSignInOpen} onOpenChange={setIsSignInOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sign in free</DialogTitle>
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
            <Button
              type="button"
              onClick={() => {
                setIsAuthenticated(true)
                setIsSignInOpen(false)
              }}
            >
              Complete sign in
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AuthStateProvider>
  )
}

export { AuthenticationProvider }
