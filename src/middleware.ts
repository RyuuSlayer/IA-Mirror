import { NextRequest, NextResponse } from 'next/server'
import { getCSRFTokenFromRequest, validateCSRFToken, generateCSRFToken, checkRateLimit } from '@/lib/security'
import { log } from '@/lib/logger'

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
  '/api/maintenance',
  '/api/health'
]

// Admin routes that require additional authentication
const ADMIN_ROUTES = [
  '/api/settings',
  '/api/maintenance',
  '/api/downloads/clear-completed',
  '/api/downloads/process'
]

// Public routes that don't require any authentication
const PUBLIC_ROUTES = [
  '/api/health',
  '/api/csrf-token',
  '/api/browse',
  '/api/metadata',
  '/api/items',
  '/api/files'
]

// Rate limiting configuration
const RATE_LIMITS = {
  '/api/download': { maxRequests: 10, windowMs: 60000 }, // 10 downloads per minute
  '/api/remote/download': { maxRequests: 5, windowMs: 60000 }, // 5 remote downloads per minute
  '/api/settings': { maxRequests: 20, windowMs: 60000 }, // 20 settings changes per minute
  '/api/browse': { maxRequests: 100, windowMs: 60000 }, // 100 browse requests per minute
  default: { maxRequests: 200, windowMs: 60000 } // Default rate limit
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const method = request.method
  const userAgent = request.headers.get('user-agent') || ''
  const ip = getClientIP(request)
  const startTime = Date.now()

  // Log request for monitoring
  log.info(`${method} ${pathname} from ${ip}`, 'middleware', { userAgent, pathname, method })

  // Create response with security headers
  const response = NextResponse.next()
  addSecurityHeaders(response)

  // Check for suspicious requests
  if (isSuspiciousRequest(request)) {
    log.warn(`Suspicious request blocked: ${method} ${pathname} from ${ip}`, 'security', { userAgent, pathname, method })
    return new NextResponse('Forbidden', { status: 403 })
  }

  // Apply rate limiting
  const rateLimitKey = `${ip}:${pathname}`
  const rateLimit = getRateLimitForPath(pathname)
  
  if (!checkRateLimit(rateLimitKey, rateLimit.maxRequests, rateLimit.windowMs)) {
    log.warn(`Rate limit exceeded: ${method} ${pathname} from ${ip}`, 'security', { userAgent, pathname, method })
    return new NextResponse('Too Many Requests', { 
      status: 429,
      headers: {
        'Retry-After': '60'
      }
    })
  }

  // Handle admin routes
  if (isAdminRoute(pathname)) {
    const authResult = checkAdminAuth(request)
    if (!authResult.success) {
      log.warn(`Admin access denied: ${method} ${pathname} from ${ip}`, 'security', { reason: authResult.reason })
      return new NextResponse('Unauthorized', { status: 401 })
    }
  }

  // Apply CSRF protection to state-changing methods
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
    const csrfResult = validateCSRFProtection(request, pathname)
    if (!csrfResult.success) {
      log.warn(`CSRF validation failed: ${method} ${pathname} from ${ip}`, 'security', { reason: csrfResult.reason })
      return new NextResponse(JSON.stringify({ error: csrfResult.reason }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      })
    }
  }

  // Add request timing header
  const processingTime = Date.now() - startTime
  response.headers.set('X-Processing-Time', `${processingTime}ms`)

  return response
}

/**
 * Helper function to get client IP address
 */
function getClientIP(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for')
  const realIP = request.headers.get('x-real-ip')
  const cfConnectingIP = request.headers.get('cf-connecting-ip')
  
  if (cfConnectingIP) return cfConnectingIP
  if (realIP) return realIP
  if (forwarded) return forwarded.split(',')[0].trim()
  
  return (request as any).ip || 'unknown'
}

/**
 * Add security headers to response
 */
function addSecurityHeaders(response: NextResponse): void {
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('X-XSS-Protection', '1; mode=block')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
  
  // Only add HSTS in production
  if (process.env.NODE_ENV === 'production') {
    response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
  }
}

/**
 * Check if request is suspicious
 */
function isSuspiciousRequest(request: NextRequest): boolean {
  const userAgent = request.headers.get('user-agent') || ''
  const { pathname } = request.nextUrl
  
  // Block requests with no user agent
  if (!userAgent.trim()) {
    return true
  }
  
  // Block common bot patterns
  const suspiciousPatterns = [
    /curl/i,
    /wget/i,
    /python-requests/i,
    /bot/i,
    /crawler/i,
    /spider/i
  ]
  
  if (suspiciousPatterns.some(pattern => pattern.test(userAgent))) {
    // Allow legitimate bots for public routes
    return !PUBLIC_ROUTES.some(route => pathname.startsWith(route))
  }
  
  // Block requests with suspicious path patterns
  const suspiciousPathPatterns = [
    /\.\./,
    /\/\/+/,
    /%2e%2e/i,
    /%00/,
    /\.(php|asp|jsp)$/i
  ]
  
  return suspiciousPathPatterns.some(pattern => pattern.test(pathname))
}

/**
 * Get rate limit configuration for a specific path
 */
function getRateLimitForPath(pathname: string): { maxRequests: number; windowMs: number } {
  for (const [path, limit] of Object.entries(RATE_LIMITS)) {
    if (path !== 'default' && pathname.startsWith(path)) {
      return limit
    }
  }
  return RATE_LIMITS.default
}

/**
 * Check if route is an admin route
 */
function isAdminRoute(pathname: string): boolean {
  return ADMIN_ROUTES.some(route => pathname.startsWith(route))
}

/**
 * Check admin authentication
 */
function checkAdminAuth(request: NextRequest): { success: boolean; reason?: string } {
  // For now, implement basic IP-based restriction
  // In a real application, you would check for proper authentication tokens
  const ip = getClientIP(request)
  
  // Allow localhost and private networks
  const allowedIPs = [
    '127.0.0.1',
    '::1',
    'localhost'
  ]
  
  const isPrivateIP = /^(10\.|172\.(1[6-9]|2[0-9]|3[01])\.|192\.168\.)/.test(ip)
  
  if (allowedIPs.includes(ip) || isPrivateIP) {
    return { success: true }
  }
  
  // Check for admin token in headers or cookies
  const adminToken = request.headers.get('x-admin-token') || request.cookies.get('admin-token')?.value
  
  if (adminToken && adminToken === process.env.ADMIN_TOKEN) {
    return { success: true }
  }
  
  return { success: false, reason: 'Admin access required' }
}

/**
 * Validate CSRF protection
 */
function validateCSRFProtection(request: NextRequest, pathname: string): { success: boolean; reason?: string } {
  // Check if route requires CSRF protection
  const requiresCSRF = CSRF_PROTECTED_ROUTES.some(route => pathname.startsWith(route))
  const isExempt = CSRF_EXEMPT_ROUTES.some(route => pathname.startsWith(route))
  
  if (!requiresCSRF || isExempt) {
    return { success: true }
  }
  
  // Get CSRF token from request
  const token = getCSRFTokenFromRequest(request)
  
  // Get expected token from session/cookie
  const expectedToken = request.cookies.get('csrf-token')?.value
  
  if (!expectedToken) {
    return { success: false, reason: 'CSRF token missing from session' }
  }
  
  if (!token || !validateCSRFToken(token, expectedToken)) {
    return { success: false, reason: 'Invalid or missing CSRF token' }
  }
  
  return { success: true }
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