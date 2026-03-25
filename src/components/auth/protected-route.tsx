'use client'

import { useAuth } from '@/providers/auth-provider'
import { useRouter } from 'next/navigation'
import { useEffect, type ReactNode } from 'react'
import { Spinner } from '@/components/animations/spinner'

interface ProtectedRouteProps {
  children: ReactNode
  requiredRoles?: string[]
}

export function ProtectedRoute({ children, requiredRoles }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, user } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login')
    }
  }, [isLoading, isAuthenticated, router])

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
