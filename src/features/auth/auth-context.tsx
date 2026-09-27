/* eslint-disable react-refresh/only-export-components -- Provider and hooks are one small app boundary. */
import { createContext, useContext, useMemo, type ReactNode } from "react"

import {
  getAccessCapabilities,
  type AccessCapabilities,
  type AuthStatus,
} from "@/app/access-policy"

type AuthContextValue = {
  status: AuthStatus
  capabilities: AccessCapabilities
  requestSignIn: () => void
  /**
   * True when the identity provider has announced that completing sign-in will navigate
   * this document (Clerk's Safari ITP cookie refresh). The current in-memory analysis
   * would be lost, so the interface must say so before the user starts.
   */
  signInWillReloadPage: boolean
  accountMenu: ReactNode
}

type AuthStateProviderProps = {
  status: AuthStatus
  requestSignIn: () => void
  signInWillReloadPage?: boolean
  accountMenu?: ReactNode
  children: ReactNode
}

const AuthContext = createContext<AuthContextValue | null>(null)

function AuthStateProvider({
  status,
  requestSignIn,
  signInWillReloadPage = false,
  accountMenu = null,
  children,
}: AuthStateProviderProps) {
  const capabilities = getAccessCapabilities(status)
  const value = useMemo(
    () => ({ status, capabilities, requestSignIn, signInWillReloadPage, accountMenu }),
    [accountMenu, capabilities, requestSignIn, signInWillReloadPage, status],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

function useAuthState() {
  const value = useContext(AuthContext)

  if (!value) {
    throw new Error("useAuthState must be used within an AuthStateProvider")
  }

  return value
}

function useAccessCapabilities() {
  return useAuthState().capabilities
}

export { AuthStateProvider, useAccessCapabilities, useAuthState }
