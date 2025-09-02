import { NextRequest, NextResponse } from 'next/server'
import { spawn } from 'child_process'
import path from 'path'
import { getConfig } from '@/lib/config'
import { readDownloads, writeDownloads } from '@/lib/downloads'
import { log } from '@/lib/logger'
import type { DownloadItem, ApiResponse } from '@/types/api'

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
    item.mediatype || 'other' // Use mediatype from item
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
    log.debug('Download stdout received', 'download-process', { identifier: item.identifier, output })
    
    // Try to parse progress from output
    const progressMatch = output.match(/Progress: (\d+)%/)
    if (progressMatch) {
      const progressValue = parseInt(progressMatch[1], 10)
      const progress = isNaN(progressValue) ? 0 : Math.max(0, Math.min(100, progressValue))
      updateDownloadStatus(item.identifier, { progress })
    }
  })

  downloadProcess.stderr.on('data', (data) => {
    const error = data.toString()
    log.error('Download stderr received', 'download-process', { identifier: item.identifier, error })
    updateDownloadStatus(item.identifier, { error })
  })

  downloadProcess.on('close', (code) => {
    log.info('Download process completed', 'download-process', { identifier: item.identifier, exitCode: code, status: code === 0 ? 'success' : 'failed' })
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

export async function GET(): Promise<NextResponse<ApiResponse>> {
  try {
    const downloads = readDownloads()
    const queuedDownload = downloads.find(d => d.status === 'queued')
    
    if (queuedDownload) {
      log.info('Starting queued download', 'download-process', { identifier: queuedDownload.identifier })
      await startDownload(queuedDownload)
      return NextResponse.json({ success: true, message: 'Download started' })
    }
    
    return NextResponse.json({ success: true, message: 'No queued downloads' })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    log.error('Error processing download queue', 'download-process', { error: errorMessage }, error instanceof Error ? error : undefined)
    return NextResponse.json(
      { error: 'Failed to process download queue' },
      { status: 500 }
    )
  }
}
