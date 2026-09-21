import { ClerkProvider, UserButton, useAuth, useClerk } from "@clerk/react"
import { LockKeyhole, LogOut } from "lucide-react"
import { useCallback, useEffect, useState, type ReactNode } from "react"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { AuthStateProvider } from "@/features/auth/auth-context"
import { resolveAuthStatus } from "@/features/auth/auth-status"
import {
  clerkProviderAppearance,
  clerkProviderLocalization,
  clerkUserButtonAppearance,
} from "@/features/auth/clerk-appearance"
import {
  clerkRouterPush,
  clerkRouterReplace,
  createSignInModalOptions,
  stayOnCurrentRouteAfterSignOut,
} from "@/features/auth/clerk-navigation"

type AuthenticationProviderProps = {
  publishableKey?: string
  children: ReactNode
}

function SignInPrivacyMessage() {
  return (
    <div className="flex gap-3 rounded-md border border-brand-soft-border bg-brand-soft p-3">
      <LockKeyhole className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden="true" />
      <p className="text-sm leading-[22px]">
        <span className="font-medium text-text-primary">
          Signing in only creates your Catalog Margin Guard account.
        </span>{" "}
        <span className="mt-1 block text-text-secondary">
          Your supplier and catalog files remain on your computer and are not uploaded.
        </span>
      </p>
    </div>
  )
}

function ClerkAuthBridge({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn } = useAuth()
  const clerk = useClerk()
  const status = resolveAuthStatus(isLoaded, isSignedIn)
  const requestSignIn = useCallback(() => {
    clerk.openSignIn(createSignInModalOptions())
  }, [clerk])
  const signOut = useCallback(() => {
    clerk.signOut(stayOnCurrentRouteAfterSignOut).catch(() => {
      // The Clerk session is unchanged when sign-out is rejected; the user can retry.
      if (import.meta.env.DEV) {
        console.warn("[Catalog Margin Guard] Sign-out did not complete.")
      }
    })
  }, [clerk])

  useEffect(() => {
    if (status === "authenticated") {
      // Clerk resolving a session is the external event that closes the auth surface.
      clerk.closeSignIn()
    }
  }, [clerk, status])

  return (
    <AuthStateProvider
      status={status}
      requestSignIn={requestSignIn}
      accountMenu={
        <UserButton
          appearance={clerkUserButtonAppearance}
          userProfileMode="modal"
          fallback={
            <div className="size-10 animate-pulse rounded-md bg-surface-subtle motion-reduce:animate-none" />
          }
        >
          <UserButton.MenuItems>
            <UserButton.Action label="manageAccount" />
            {/* Replaces Clerk's built-in item (hidden via appearance), which always navigates after sign-out. */}
            <UserButton.Action
              label="Sign out"
              labelIcon={<LogOut className="size-4" aria-hidden="true" />}
              onClick={signOut}
            />
          </UserButton.MenuItems>
        </UserButton>
      }
    >
      {children}
    </AuthStateProvider>
  )
}

function UnconfiguredAuthProvider({ children }: { children: ReactNode }) {
  const [isSignInOpen, setIsSignInOpen] = useState(false)
  const requestSignIn = useCallback(() => setIsSignInOpen(true), [])

  return (
    <AuthStateProvider status="anonymous" requestSignIn={requestSignIn}>
      {children}
      <Dialog open={isSignInOpen} onOpenChange={setIsSignInOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sign in is not configured</DialogTitle>
            <DialogDescription>
              Authentication is unavailable in this environment. You can still use the
              anonymous catalog workflow.
            </DialogDescription>
          </DialogHeader>
          <SignInPrivacyMessage />
        </DialogContent>
      </Dialog>
    </AuthStateProvider>
  )
}

function AuthenticationProvider({
  publishableKey,
  children,
}: AuthenticationProviderProps) {
  const configuredKey = publishableKey?.trim()

  if (!configuredKey) {
    return <UnconfiguredAuthProvider>{children}</UnconfiguredAuthProvider>
  }

  return (
    <ClerkProvider
      publishableKey={configuredKey}
      appearance={clerkProviderAppearance}
      localization={clerkProviderLocalization}
      routerPush={clerkRouterPush}
      routerReplace={clerkRouterReplace}
      // Identity traffic only: no SDK usage telemetry leaves the browser.
      telemetry={false}
    >
      <ClerkAuthBridge>{children}</ClerkAuthBridge>
    </ClerkProvider>
  )
}

export { AuthenticationProvider }
