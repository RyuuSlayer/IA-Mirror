import { NextRequest, NextResponse } from 'next/server'
import { createErrorResponse } from '@/lib/utils'
import { readDownloads, writeDownloads, DownloadItem } from '@/lib/downloads'

export async function GET() {
  const downloads = readDownloads()
  return NextResponse.json(downloads)
}

export async function POST(request: NextRequest) {
  try {
    const { identifier, title, mediatype } = await request.json()
    
    if (!identifier || !title) {
      return createErrorResponse('Identifier and title are required', 400)
    }

    const downloads = readDownloads()
    
    // Check if download already exists
    if (downloads.some(d => d.identifier === identifier)) {
      return createErrorResponse('Download already exists', 400)
    }

    // Add new download to queue
    const newDownload: DownloadItem = {
      identifier,
      title,
      status: 'queued',
      startedAt: new Date().toISOString(),
      mediatype
    }

    downloads.push(newDownload)
    writeDownloads(downloads)

    // Get the base URL from the request
    const protocol = request.headers.get('x-forwarded-proto') || 'http'
    const host = request.headers.get('host') || 'localhost:3000'
    const baseUrl = `${protocol}://${host}`

    // Trigger queue processing with absolute URL
    fetch(`${baseUrl}/api/downloads/process`, { method: 'GET' })
      .catch(error => console.error('Error triggering queue processing:', error))

    return NextResponse.json(newDownload)
  } catch (error) {
    console.error('Error adding download:', error)
    return createErrorResponse('Internal server error', 500)
  }
}
