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

export async function GET() {
  const downloads = readDownloads()
  return NextResponse.json(downloads)
}

export async function POST(request: NextRequest) {
  try {
    const { identifier, title } = await request.json()
    
    if (!identifier || !title) {
      return NextResponse.json(
        { error: 'Identifier and title are required' },
        { status: 400 }
      )
    }

    const downloads = readDownloads()
    
    // Check if download already exists
    if (downloads.some(d => d.identifier === identifier)) {
      return NextResponse.json(
        { error: 'Download already exists' },
        { status: 400 }
      )
    }

    // Add new download to queue
    const newDownload: DownloadItem = {
      identifier,
      title,
      status: 'queued',
      startedAt: new Date().toISOString()
    }

    downloads.push(newDownload)
    writeDownloads(downloads)

    return NextResponse.json(newDownload)
  } catch (error) {
    console.error('Error adding download:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
