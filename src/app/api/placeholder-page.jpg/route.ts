import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  // Create a simple SVG placeholder for unsupported file types
  const svg = `
    <svg width="800" height="1200" xmlns="http://www.w3.org/2000/svg">
      <rect width="800" height="1200" fill="#f8f9fa"/>
      <rect x="50" y="50" width="700" height="1100" fill="white" stroke="#dee2e6" stroke-width="2"/>
      
      <!-- Book icon -->
      <g transform="translate(350, 400)">
        <path d="M50 25C50 11.1929 38.8071 0 25 0C11.1929 0 0 11.1929 0 25V75C0 88.8071 11.1929 100 25 100C38.8071 100 50 88.8071 50 75V25Z" fill="#6366f1"/>
        <path d="M75 25C75 11.1929 86.1929 0 100 0C113.807 0 125 11.1929 125 25V75C125 88.8071 113.807 100 100 100C86.1929 100 75 88.8071 75 75V25Z" fill="#6366f1"/>
        <rect x="25" y="0" width="75" height="100" fill="#6366f1"/>
      </g>
      
      <!-- Text -->
      <text x="400" y="600" text-anchor="middle" font-family="Arial, sans-serif" font-size="24" fill="#6b7280">
        eBook Preview
      </text>
      <text x="400" y="640" text-anchor="middle" font-family="Arial, sans-serif" font-size="16" fill="#9ca3af">
        This file type requires special processing
      </text>
      <text x="400" y="680" text-anchor="middle" font-family="Arial, sans-serif" font-size="16" fill="#9ca3af">
        Download the file to view its contents
      </text>
      
      <!-- Download icon -->
      <g transform="translate(375, 720)">
        <path d="M25 0L25 30M15 20L25 30L35 20" stroke="#6b7280" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M10 35L40 35" stroke="#6b7280" stroke-width="2" stroke-linecap="round"/>
      </g>
    </svg>
  `

  return new NextResponse(svg, {
    headers: {
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'public, max-age=3600'
    }
  })
}