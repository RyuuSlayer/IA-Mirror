import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

const DOWNLOADS_FILE = path.join(process.cwd(), 'downloads.json')

interface DownloadItem {
  identifier: string
  title: string
  status: 'queued' | 'downloading' | 'completed' | 'failed'
  progress?: number
  error?: string
  startedAt?: string
  completedAt?: string
  pid?: number
}

function readDownloads(): DownloadItem[] {
  try {
    if (fs.existsSync(DOWNLOADS_FILE)) {
      const data = fs.readFileSync(DOWNLOADS_FILE, 'utf8')
      return JSON.parse(data)
    }
  } catch (error) {
    console.error('Error reading downloads:', error)
  }
  return []
}

function writeDownloads(downloads: DownloadItem[]): boolean {
  try {
    fs.writeFileSync(DOWNLOADS_FILE, JSON.stringify(downloads, null, 2))
    return true
  } catch (error) {
    console.error('Error writing downloads:', error)
    return false
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { identifier: string } }
) {
  try {
    const { identifier } = params
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
  { params }: { params: { identifier: string } }
) {
  try {
    const { identifier } = params
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
