import { NextResponse } from 'next/server'
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
      return NextResponse.json(
        { error: 'Failed to clear completed downloads' },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error('Error clearing completed downloads:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
