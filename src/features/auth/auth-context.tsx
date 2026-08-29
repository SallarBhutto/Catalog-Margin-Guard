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
  accountMenu: ReactNode
}

type AuthStateProviderProps = {
  status: AuthStatus
  requestSignIn: () => void
  accountMenu?: ReactNode
  children: ReactNode
}

const AuthContext = createContext<AuthContextValue | null>(null)

function AuthStateProvider({
  status,
  requestSignIn,
  accountMenu = null,
  children,
}: AuthStateProviderProps) {
  const capabilities = getAccessCapabilities(status)
  const value = useMemo(
    () => ({ status, capabilities, requestSignIn, accountMenu }),
    [accountMenu, capabilities, requestSignIn, status],
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
