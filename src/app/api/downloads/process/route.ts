import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { spawn } from 'child_process'
import { getConfig } from '@/lib/config'

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
  mediatype?: string
  metadata?: any
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

function updateDownloadStatus(identifier: string, updates: Partial<DownloadItem>) {
  const downloads = readDownloads()
  const index = downloads.findIndex(d => d.identifier === identifier)
  if (index !== -1) {
    downloads[index] = { ...downloads[index], ...updates }
    writeDownloads(downloads)
  }
}

async function startDownload(item: DownloadItem) {
  const config = await getConfig()
  
  // Start download process with mediatype
  const downloadProcess = spawn('node', [
    path.join(process.cwd(), 'scripts', 'download.js'),
    item.identifier,
    config.cacheDir,
    item.mediatype || item.metadata?.metadata?.mediatype || 'other' // Try to get mediatype from item or metadata
  ])

  // Update download with process ID
  updateDownloadStatus(item.identifier, {
    status: 'downloading',
    pid: downloadProcess.pid,
    error: undefined
  })

  // Handle process events
  downloadProcess.stdout.on('data', (data) => {
    const output = data.toString()
    console.log(`Download stdout [${item.identifier}]:`, output)
    
    // Try to parse progress from output
    const progressMatch = output.match(/Progress: (\d+)%/)
    if (progressMatch) {
      const progress = parseInt(progressMatch[1])
      updateDownloadStatus(item.identifier, { progress })
    }
  })

  downloadProcess.stderr.on('data', (data) => {
    const error = data.toString()
    console.error(`Download stderr [${item.identifier}]:`, error)
    updateDownloadStatus(item.identifier, { error })
  })

  downloadProcess.on('close', (code) => {
    console.log(`Download process for ${item.identifier} exited with code ${code}`)
    updateDownloadStatus(item.identifier, {
      status: code === 0 ? 'completed' : 'failed',
      error: code === 0 ? undefined : `Process exited with code ${code}`,
      completedAt: new Date().toISOString(),
      pid: undefined,
      progress: code === 0 ? 100 : undefined
    })
  })

  return downloadProcess
}

export async function GET() {
  try {
    const downloads = readDownloads()
    const queuedDownload = downloads.find(d => d.status === 'queued')
    
    if (queuedDownload) {
      console.log('Starting download for:', queuedDownload.identifier)
      await startDownload(queuedDownload)
      return NextResponse.json({ success: true, message: 'Download started' })
    }
    
    return NextResponse.json({ success: true, message: 'No queued downloads' })
  } catch (error) {
    console.error('Error processing download queue:', error)
    return NextResponse.json(
      { error: 'Failed to process download queue' },
      { status: 500 }
    )
  }
}
