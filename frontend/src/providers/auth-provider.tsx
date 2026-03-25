'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import { useRouter } from 'next/navigation'
import { authApi, type UserProfile } from '@/lib/api-client'

interface AuthState {
  user: UserProfile | null
  isLoading: boolean
  isAuthenticated: boolean
}

interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<void>
  register: (payload: {
    email: string
    password: string
    first_name: string
    last_name: string
  }) => Promise<void>
  logout: () => Promise<void>
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter()
  const [state, setState] = useState<AuthState>({
    user: null,
    isLoading: true,
    isAuthenticated: false,
  })

  const refreshUser = useCallback(async () => {
    try {
      if (!authApi.isAuthenticated()) {
        setState({ user: null, isLoading: false, isAuthenticated: false })
        return
      }
      const user = await authApi.getMe()
      setState({ user, isLoading: false, isAuthenticated: true })
    } catch {
      setState({ user: null, isLoading: false, isAuthenticated: false })
    }
  }, [])

  useEffect(() => {
    refreshUser()
  }, [refreshUser])

  const login = useCallback(
    async (email: string, password: string) => {
      await authApi.login(email, password)
      const user = await authApi.getMe()
      setState({ user, isLoading: false, isAuthenticated: true })
      router.push('/')
    },
    [router]
  )

  const register = useCallback(
    async (payload: {
      email: string
      password: string
      first_name: string
      last_name: string
    }) => {
      await authApi.register(payload)
      // Auto-login after register
      await authApi.login(payload.email, payload.password)
      const user = await authApi.getMe()
      setState({ user, isLoading: false, isAuthenticated: true })
      router.push('/')
    },
    [router]
  )

  const logout = useCallback(async () => {
    await authApi.logout()
    setState({ user: null, isLoading: false, isAuthenticated: false })
    router.push('/login')
  }, [router])

  return (
    <AuthContext.Provider
      value={{ ...state, login, register, logout, refreshUser }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
