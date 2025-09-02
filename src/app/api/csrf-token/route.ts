import { NextRequest, NextResponse } from 'next/server'
import { generateCSRFToken, checkRateLimit } from '@/lib/security'
import { log } from '@/lib/logger'
import type { CsrfTokenResponse } from '@/types/api'

export async function GET(request: NextRequest): Promise<NextResponse<CsrfTokenResponse>> {
  try {
    // Rate limiting for CSRF token requests
    const clientIP = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
    if (!checkRateLimit(`csrf:${clientIP}`, 10, 60000)) {
      return NextResponse.json(
        { error: 'Rate limit exceeded' } as any,
        { status: 429 }
      )
    }

    // Generate a new CSRF token
    const token = generateCSRFToken()
    
    // Create response with token
    const response = NextResponse.json({ token })
    
    // Set the token as an HTTP-only cookie
    response.cookies.set('csrf-token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 60 * 60 * 24, // 24 hours
      path: '/'
    })
    
    return response
  } catch (error) {
    log.error('CSRF token generation error', 'csrf-api', { error: error.message }, error)
    return NextResponse.json(
      { error: 'Failed to generate CSRF token' } as any,
      { status: 500 }
    )
  }
}