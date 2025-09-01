import { NextRequest, NextResponse } from 'next/server'
import { getCSRFTokenFromRequest, validateCSRFToken, generateCSRFToken } from '@/lib/security'

// Routes that require CSRF protection (POST, PUT, DELETE operations)
const CSRF_PROTECTED_ROUTES = [
  '/api/download',
  '/api/downloads',
  '/api/settings',
  '/api/ignored'
]

// Routes that are exempt from CSRF protection
const CSRF_EXEMPT_ROUTES = [
  '/api/browse',
  '/api/metadata',
  '/api/items',
  '/api/files',
  '/api/maintenance'
]

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const method = request.method

  // Only apply CSRF protection to state-changing methods
  if (!['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
    return NextResponse.next()
  }

  // Check if route requires CSRF protection
  const requiresCSRF = CSRF_PROTECTED_ROUTES.some(route => pathname.startsWith(route))
  const isExempt = CSRF_EXEMPT_ROUTES.some(route => pathname.startsWith(route))

  if (!requiresCSRF || isExempt) {
    return NextResponse.next()
  }

  // Get CSRF token from request
  const token = getCSRFTokenFromRequest(request)
  
  // Get expected token from session/cookie
  const expectedToken = request.cookies.get('csrf-token')?.value

  if (!expectedToken) {
    return NextResponse.json(
      { error: 'CSRF token missing from session' },
      { status: 403 }
    )
  }

  if (!token || !validateCSRFToken(token, expectedToken)) {
    return NextResponse.json(
      { error: 'Invalid or missing CSRF token' },
      { status: 403 }
    )
  }

  return NextResponse.next()
}

// Configure which routes the middleware should run on
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|public/).*)',
  ],
}