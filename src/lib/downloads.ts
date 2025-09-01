import fs from 'fs'
import path from 'path'
import debug from 'debug'
import type { DownloadItem } from '@/types/api'
import { readJsonFile } from './utils'
import { writeJsonFileAtomic } from './streamingJson'
import { FileSystemError, ValidationError } from './errors'

const log = debug('ia-mirror:lib:downloads')

const DOWNLOADS_FILE = path.join(process.cwd(), 'downloads.json')

export function readDownloads(): DownloadItem[] {
  const downloads = readJsonFile(DOWNLOADS_FILE)
  return downloads || []
}

export function writeDownloads(downloads: DownloadItem[]): boolean {
  if (!Array.isArray(downloads)) {
    throw new ValidationError('Downloads must be an array')
  }
  
  try {
    return writeJsonFileAtomic(DOWNLOADS_FILE, downloads)
  } catch (error) {
    console.error('Error writing downloads:', error)
    
    // Throw specific error based on the type of failure
    if (error instanceof SyntaxError) {
      throw new ValidationError(`Invalid JSON structure: ${error.message}`)
    } else if (error instanceof Error && error.message.includes('ENOENT')) {
      throw new FileSystemError(`Directory not found: ${path.dirname(DOWNLOADS_FILE)}`)
    } else if (error instanceof Error && error.message.includes('EACCES')) {
      throw new FileSystemError(`Permission denied writing to: ${DOWNLOADS_FILE}`)
    } else if (error instanceof Error && error.message.includes('ENOSPC')) {
      throw new FileSystemError('No space left on device')
    } else {
      throw new FileSystemError(`Failed to write downloads file: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }
}

export function findDownloadByIdentifier(identifier: string): DownloadItem | undefined {
  const downloads = readDownloads()
  return downloads.find(d => d.identifier === identifier)
}

export function updateDownloadStatus(identifier: string, updates: Partial<DownloadItem>): boolean {
  if (!identifier) {
    throw new ValidationError('Identifier is required')
  }
  
  if (!updates || typeof updates !== 'object') {
    throw new ValidationError('Updates must be a valid object')
  }
  
  try {
    const downloads = readDownloads()
    const downloadIndex = downloads.findIndex(d => d.identifier === identifier)
    
    if (downloadIndex === -1) {
      throw new ValidationError(`Download with identifier '${identifier}' not found`)
    }
    
    downloads[downloadIndex] = { ...downloads[downloadIndex], ...updates }
    writeDownloads(downloads)
    return true
  } catch (error) {
    if (error instanceof ValidationError || error instanceof FileSystemError) {
      throw error
    }
    console.error('Error updating download status:', error)
    throw new FileSystemError(`Failed to update download status: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

export async function queueDownloadDirect(identifier: string, title: string, file: string, mediatype: string, isDerivative: boolean = false): Promise<boolean> {
  // Validate required parameters
  if (!identifier) {
    throw new ValidationError('Identifier is required')
  }
  if (!title) {
    throw new ValidationError('Title is required')
  }
  if (!file) {
    throw new ValidationError('File is required')
  }
  if (!mediatype) {
    throw new ValidationError('Media type is required')
  }
  
  try {
    const downloads = readDownloads()
    
    // Check if already downloading
    const existingDownload = downloads.find(d => 
      d.identifier === identifier && d.file === file
    )
    
    if (existingDownload) {
      if (existingDownload.status === 'downloading') {
        throw new ValidationError(`Already downloading ${identifier}/${file}`)
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
    try {
      await startNextQueuedDownload()
    } catch (error) {
      console.error('Error starting next download:', error)
      // Don't throw here - the download is queued even if starting fails
    }
    
    return true
  } catch (error) {
    if (error instanceof ValidationError || error instanceof FileSystemError) {
      throw error
    }
    console.error('Error queuing download directly:', error)
    throw new FileSystemError(`Failed to queue download: ${error instanceof Error ? error.message : 'Unknown error'}`)
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