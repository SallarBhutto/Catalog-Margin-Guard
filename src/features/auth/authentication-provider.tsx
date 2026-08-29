import { ClerkProvider, SignIn, UserButton, useAuth } from "@clerk/react"
import { LockKeyhole } from "lucide-react"
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
  clerkSignInAppearance,
  clerkUserButtonAppearance,
} from "@/features/auth/clerk-appearance"

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
  const [isSignInOpen, setIsSignInOpen] = useState(false)
  const status = resolveAuthStatus(isLoaded, isSignedIn)
  const requestSignIn = useCallback(() => setIsSignInOpen(true), [])

  useEffect(() => {
    if (status === "authenticated") {
      // Clerk resolving a session is the external event that closes the auth surface.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsSignInOpen(false)
    }
  }, [status])

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
        />
      }
    >
      {children}
      <Dialog open={isSignInOpen} onOpenChange={setIsSignInOpen}>
        <DialogContent className="max-h-[calc(100svh-2rem)] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Sign in free</DialogTitle>
            <DialogDescription>
              Unlock complete results and tools without leaving your current workflow.
            </DialogDescription>
          </DialogHeader>
          <SignInPrivacyMessage />
          <SignIn
            routing="hash"
            withSignUp
            oauthFlow="popup"
            appearance={clerkSignInAppearance}
          />
        </DialogContent>
      </Dialog>
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
    <ClerkProvider publishableKey={configuredKey} appearance={clerkProviderAppearance}>
      <ClerkAuthBridge>{children}</ClerkAuthBridge>
    </ClerkProvider>
  )
}

export { AuthenticationProvider }
