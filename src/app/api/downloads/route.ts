import { NextRequest, NextResponse } from 'next/server'
import { createErrorResponse } from '@/lib/utils'
import { getBaseUrl } from '@/lib/config'
import { readDownloads, writeDownloads } from '@/lib/downloads'
import { log } from '@/lib/logger'
import type { DownloadItem } from '@/types/api'
import type { DownloadRequest, ApiResponse } from '@/types/api'

export async function GET(): Promise<NextResponse<DownloadItem[] | ApiResponse>> {
  const downloads = readDownloads()
  return NextResponse.json(downloads)
}

export async function POST(request: NextRequest): Promise<NextResponse<ApiResponse>> {
  try {
    const body: DownloadRequest = await request.json()
    const { identifier, title, mediatype } = body
    
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

    // Get the configured base URL
    const baseUrl = getBaseUrl()

    // Trigger queue processing with absolute URL
    fetch(`${baseUrl}/api/downloads/process`, { method: 'GET' })
      .catch(error => log.error('Error triggering queue processing', 'downloads-api', { error: error.message }, error))

    return NextResponse.json(newDownload)
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    log.error('Error adding download', 'downloads-api', { error: errorMessage }, error instanceof Error ? error : undefined)
    return createErrorResponse('Internal server error', 500)
  }
}
