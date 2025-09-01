import fs from 'fs'
import path from 'path'
import debug from 'debug'
import type { DownloadItem } from '@/types/api'
import { readJsonFile } from './utils'

const log = debug('ia-mirror:lib:downloads')

const DOWNLOADS_FILE = path.join(process.cwd(), 'downloads.json')

export function readDownloads(): DownloadItem[] {
  const downloads = readJsonFile(DOWNLOADS_FILE)
  return downloads || []
}

export function writeDownloads(downloads: DownloadItem[]): boolean {
  let tempFile: string | null = null
  
  try {
    // Create a temporary file first to ensure atomic writes
    tempFile = `${DOWNLOADS_FILE}.tmp`
    const downloadsJson = JSON.stringify(downloads, null, 2)
    
    // Write to temporary file first
    fs.writeFileSync(tempFile, downloadsJson, { encoding: 'utf8', mode: 0o644 })
    
    // Verify the file was written correctly by reading it back
    const writtenContent = fs.readFileSync(tempFile, 'utf8')
    JSON.parse(writtenContent) // Validate JSON structure
    
    // Atomically move temp file to final location
    fs.renameSync(tempFile, DOWNLOADS_FILE)
    tempFile = null // Mark as successfully moved
    
    return true
  } catch (error) {
    console.error('Error writing downloads:', error)
    
    // Clean up temporary file if it exists
    if (tempFile && fs.existsSync(tempFile)) {
      try {
        fs.unlinkSync(tempFile)
      } catch (cleanupError) {
        console.error('Error cleaning up temporary file:', cleanupError)
      }
    }
    
    return false
  }
}

export function findDownloadByIdentifier(identifier: string): DownloadItem | undefined {
  const downloads = readDownloads()
  return downloads.find(d => d.identifier === identifier)
}

export function updateDownloadStatus(identifier: string, updates: Partial<DownloadItem>): boolean {
  try {
    const downloads = readDownloads()
    const downloadIndex = downloads.findIndex(d => d.identifier === identifier)
    
    if (downloadIndex === -1) {
      return false
    }
    
    downloads[downloadIndex] = { ...downloads[downloadIndex], ...updates }
    return writeDownloads(downloads)
  } catch (error) {
    console.error('Error updating download status:', error)
    return false
  }
}

export async function queueDownloadDirect(identifier: string, title: string, file: string, mediatype: string, isDerivative: boolean = false): Promise<boolean> {
  try {
    const downloads = readDownloads()
    
    // Check if already downloading
    const existingDownload = downloads.find(d => 
      d.identifier === identifier && d.file === file
    )
    
    if (existingDownload) {
      if (existingDownload.status === 'downloading') {
        console.log(`Already downloading ${identifier}/${file}`)
        return false
      }

      // Update existing download
      existingDownload.status = 'queued'
      existingDownload.error = undefined
      existingDownload.progress = undefined
      existingDownload.completedAt = undefined
      existingDownload.startedAt = new Date().toISOString()
      existingDownload.file = file
      existingDownload.mediatype = mediatype
      existingDownload.isDerivative = isDerivative
      writeDownloads(downloads)
    } else {
      // Create new download
      const newDownload: DownloadItem = {
        identifier,
        title,
        status: 'queued',
        startedAt: new Date().toISOString(),
        file,
        mediatype,
        isDerivative
      }
      downloads.push(newDownload)
      writeDownloads(downloads)
    }

    console.log(`Successfully queued file ${file} for ${identifier}`)
    
    // Try to start the download if possible
    await startNextQueuedDownload()
    
    return true
  } catch (error) {
    console.error('Error queuing download directly:', error)
    return false
  }
}

// Import startNextQueuedDownload function to trigger downloads
async function startNextQueuedDownload() {
  try {
    // Make a request to trigger the download queue processing
    const response = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/download`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        action: 'start-next'
      })
    })
    
    if (!response.ok) {
      console.error('Failed to trigger download queue processing:', response.status)
    }
  } catch (error) {
    console.error('Error triggering download queue processing:', error)
  }
}