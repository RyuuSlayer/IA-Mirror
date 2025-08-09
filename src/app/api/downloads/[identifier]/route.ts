import { NextRequest, NextResponse } from 'next/server'
import { readDownloads, writeDownloads, DownloadItem } from '@/lib/downloads'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ identifier: string }> }
) {
  try {
    const resolvedParams = await params
    const { identifier } = resolvedParams
    const downloads = readDownloads()
    
    const downloadIndex = downloads.findIndex(d => d.identifier === identifier)
    if (downloadIndex === -1) {
      return NextResponse.json(
        { error: 'Download not found' },
        { status: 404 }
      )
    }

    const download = downloads[downloadIndex]
    
    // If download is in progress, kill the process
    if (download.status === 'downloading' && download.pid) {
      try {
        process.kill(download.pid)
      } catch (error) {
        console.error('Error killing process:', error)
      }
    }

    // Remove from downloads list
    downloads.splice(downloadIndex, 1)
    writeDownloads(downloads)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting download:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ identifier: string }> }
) {
  try {
    const resolvedParams = await params
    const { identifier } = resolvedParams
    const updates = await request.json()
    
    const downloads = readDownloads()
    const downloadIndex = downloads.findIndex(d => d.identifier === identifier)
    
    if (downloadIndex === -1) {
      return NextResponse.json(
        { error: 'Download not found' },
        { status: 404 }
      )
    }

    // Update download status
    downloads[downloadIndex] = {
      ...downloads[downloadIndex],
      ...updates,
    }

    writeDownloads(downloads)

    return NextResponse.json(downloads[downloadIndex])
  } catch (error) {
    console.error('Error updating download:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
