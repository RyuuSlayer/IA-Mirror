import { NextResponse } from 'next/server'

export async function GET() {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
  
  const robots = `User-agent: *
Allow: /
Allow: /archive/local
Allow: /archive/remote/browse

# Disallow API routes and admin areas
Disallow: /api/
Disallow: /settings
Disallow: /downloads

# Sitemap
Sitemap: ${baseUrl}/sitemap.xml`
  
  return new NextResponse(robots, {
    headers: {
      'Content-Type': 'text/plain',
      'Cache-Control': 'public, max-age=86400, s-maxage=86400'
    }
  })
}