import { NextResponse } from 'next/server'
import { createErrorResponse } from '@/lib/utils'
import { readDownloads, writeDownloads, DownloadItem } from '@/lib/downloads'

export async function POST() {
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
    console.error('Error clearing completed downloads:', error)
    return createErrorResponse('Internal server error', 500)
  }
}
