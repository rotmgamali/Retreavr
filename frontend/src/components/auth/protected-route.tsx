'use client'

import { useAuth } from '@/providers/auth-provider'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useRef, type ReactNode } from 'react'
import { Spinner } from '@/components/animations/spinner'

interface ProtectedRouteProps {
  children: ReactNode
  requiredRoles?: string[]
}

export function ProtectedRoute({ children, requiredRoles }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, user } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const redirectingRef = useRef(false)

  useEffect(() => {
    if (!isLoading && !isAuthenticated && !redirectingRef.current) {
      redirectingRef.current = true
      router.replace('/login')
    }
    // Reset the guard when auth state changes back to authenticated
    if (isAuthenticated) {
      redirectingRef.current = false
    }
  }, [isLoading, isAuthenticated, router, pathname])

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Spinner className="h-8 w-8" />
      </div>
    )
  }

  if (!isAuthenticated) return null

  if (requiredRoles && user && !requiredRoles.includes(user.role)) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-2">
        <h2 className="text-lg font-semibold">Access Denied</h2>
        <p className="text-muted-foreground">You don&apos;t have permission to view this page.</p>
      </div>
    )
  }

  return <>{children}</>
}
