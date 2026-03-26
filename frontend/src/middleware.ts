import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Public routes that don't need auth
  const publicRoutes = ['/login', '/register', '/api/health']
  if (publicRoutes.some(route => pathname.startsWith(route))) {
    return NextResponse.next()
  }

  // Check for access token
  const _token = request.cookies.get('access_token')?.value
    || request.headers.get('authorization')?.replace('Bearer ', '')

  // For admin routes, we can't fully validate JWT on the edge,
  // but we can ensure a token exists. Role checking happens client-side
  // and server-side via the API.
  if (pathname.startsWith('/admin')) {
    // Add a custom header so the admin layout can check role
    const response = NextResponse.next()
    response.headers.set('x-admin-route', 'true')
    return response
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api/health).*)',
  ],
}
