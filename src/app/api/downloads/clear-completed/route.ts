import { NextRequest, NextResponse } from 'next/server'
import { readDownloads, writeDownloads } from '@/lib/downloads'
import { createErrorResponse } from '@/lib/utils'
import { log } from '@/lib/logger'
import type { DownloadItem, ApiResponse } from '@/types/api'

export async function POST(request: NextRequest): Promise<NextResponse<ApiResponse>> {
  try {
    const downloads = readDownloads()
    
    // Filter out completed downloads
    const updatedDownloads = downloads.filter(
      download => download.status !== 'completed'
    )
    
    if (writeDownloads(updatedDownloads)) {
      return NextResponse.json({ 
        message: 'Completed downloads cleared',
        removed: downloads.length - updatedDownloads.length 
      })
    } else {
      return createErrorResponse('Failed to clear completed downloads', 500)
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    log.error('Error clearing completed downloads', 'clear-completed-api', { error: errorMessage }, error instanceof Error ? error : undefined)
    return createErrorResponse('Internal server error', 500)
  }
}
