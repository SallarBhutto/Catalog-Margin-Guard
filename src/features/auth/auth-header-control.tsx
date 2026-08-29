import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { useAuthState } from "@/features/auth/auth-context"

function AuthHeaderControl() {
  const { status, requestSignIn, accountMenu } = useAuthState()

  if (status === "loading") {
    return (
      <div
        className="flex size-10 items-center justify-center rounded-md bg-surface-subtle"
        aria-label="Checking account status"
      >
        <Spinner aria-hidden="true" />
      </div>
    )
  }

  if (status === "authenticated") return accountMenu

  return (
    <Button type="button" variant="ghost" size="small" onClick={requestSignIn}>
      Sign in
    </Button>
  )
}

export { AuthHeaderControl }
