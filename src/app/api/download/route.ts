import { NextRequest, NextResponse } from 'next/server'
import { spawn } from 'child_process'
import path from 'path'
import fs from 'fs'
import { getConfig } from '@/lib/config'
import { readDownloads, writeDownloads } from '@/lib/downloads'
import { 
  sanitizeInput, 
  validateStringParam,
  checkRateLimit
} from '@/lib/security'
import { 
  ValidationError, 
  NetworkError, 
  FileSystemError, 
  ProcessError, 
  MetadataError, 
  DownloadError,
  handleApiError
} from '@/lib/errors'
import { getMetadataCache, generateMetadataCacheKey } from '@/lib/cache'
import { log } from '@/lib/logger'
import type { DownloadItem, DownloadRequest, ApiResponse } from '@/types/api'
// Map of media types to folder names
const MEDIA_TYPE_FOLDERS = {
  'texts': 'books',
  'movies': 'videos',
  'audio': 'audio',
  'software': 'software',
  'image': 'images',
  'etree': 'concerts',
  'data': 'data',
  'web': 'web',
  'collection': 'collections',
  'account': 'accounts'
}



function updateDownloadStatus(identifier: string, updates: Partial<DownloadItem>) {
  const downloads = readDownloads()
  const index = downloads.findIndex(d => d.identifier === identifier)
  if (index !== -1) {
    downloads[index] = {
      ...downloads[index],
      ...updates
    }
    writeDownloads(downloads)
  }
}

function getActiveDownloadsCount(downloads: DownloadItem[]): number {
  // First clean up any stale downloads
  const cleanedDownloads = cleanStaleDownloads(downloads)
  // Then count actually running downloads
  return cleanedDownloads.filter(d => d.status === 'downloading').length
}

function isDerivativeFile(filename: string): boolean {
  // Common patterns for derivative files
  const derivativePatterns = [
    /_thumb\./i,      // Thumbnails
    /_itemimage\./i,  // Item images
    /__ia_thumb\./i,  // IA thumbnails
    /_files\./i,      // File listings
    /_meta\./i,       // Metadata files
    /\.gif$/i,        // GIF versions
    /\b(thumb|small|medium|large)\d*\./i,  // Size variants
    /_spectrogram\./i // Audio spectrograms
  ]

  return derivativePatterns.some(pattern => pattern.test(filename))
}

async function fetchMetadata(identifier: string) {
  try {
    const cacheKey = generateMetadataCacheKey(identifier)
    const metadataCache = getMetadataCache()
    
    // Try cache first
    const cachedMetadata = await metadataCache.get(cacheKey)
    if (cachedMetadata) {
      log.debug('Using cached metadata for download', 'download', { identifier })
      return cachedMetadata
    }
    
    // Fetch from Internet Archive
    log.info('Fetching metadata from IA for download', 'download', { identifier })
    const response = await fetch(`https://archive.org/metadata/${identifier}`)
    if (!response.ok) {
      throw new Error(`Failed to fetch metadata: ${response.status}`)
    }
    
    const metadata = await response.json()
    
    // Cache the result
    await metadataCache.set(cacheKey, metadata)
    
    return metadata
  } catch (error) {
    log.error('Error fetching metadata', 'download', { identifier, error: error.message }, error)
    return null
  }
}

// Track active download processes
const activeProcesses: { [key: string]: ReturnType<typeof spawn> } = {}

async function startDownload(downloadItem: DownloadItem) {
  try {
    const config = await getConfig()
    
    // Get metadata to find the file to download if not specified
    if (!downloadItem.file) {
      const metadata = await fetchMetadata(downloadItem.identifier)
      if (!metadata?.files?.length) {
        throw new MetadataError('No files found in metadata', downloadItem.identifier)
      }

      // Find first non-derivative file
      downloadItem.file = metadata.files.find((f: any) => !isDerivativeFile(f.name))?.name
      if (!downloadItem.file) {
        // If no non-derivative files found, use the first file
        downloadItem.file = metadata.files[0].name
      }
    }

    // Validate required paths
    const scriptPath = path.join(process.cwd(), 'scripts', 'download.js')
    if (!fs.existsSync(scriptPath)) {
      throw new FileSystemError('Download script not found', scriptPath, 'read')
    }
    
    if (!fs.existsSync(config.cacheDir)) {
      throw new FileSystemError('Cache directory not found', config.cacheDir, 'access')
    }

    // Start download process
    const downloadProcess = spawn('node', [
      scriptPath,
      downloadItem.identifier,
      config.cacheDir,
      downloadItem.mediatype || 'other',
      downloadItem.file || '' // Pass the specific file to download
    ])

    // Check if process started successfully
    if (!downloadProcess.pid) {
      throw new ProcessError('Failed to start download process', undefined, undefined)
    }

    // Store the process
    activeProcesses[downloadItem.identifier] = downloadProcess

    // Update download with process ID
    updateDownloadStatus(downloadItem.identifier, {
      status: 'downloading',
      pid: downloadProcess.pid,
      error: undefined
    })

  // Handle process events
  downloadProcess.stdout.on('data', (data) => {
    const output = data.toString()
    log.debug('Download stdout', 'download', { identifier: downloadItem.identifier, output: output.trim() })
    
    // Try to parse progress from output
    const progressMatch = output.match(/Progress: (\d+)%/)
    if (progressMatch) {
      const progressValue = parseInt(progressMatch[1], 10)
        const progress = isNaN(progressValue) ? 0 : Math.max(0, Math.min(100, progressValue))
      updateDownloadStatus(downloadItem.identifier, { progress })
    }
  })

  downloadProcess.stderr.on('data', (data) => {
    const error = data.toString()
    log.warn('Download stderr', 'download', { identifier: downloadItem.identifier, error: error.trim() })
    updateDownloadStatus(downloadItem.identifier, { error })
  })

    downloadProcess.on('close', (code) => {
      log.info('Download process exited', 'download', { identifier: downloadItem.identifier, exitCode: code, success: code === 0 })
      // Remove from active processes
      delete activeProcesses[downloadItem.identifier]
      updateDownloadStatus(downloadItem.identifier, {
        status: code === 0 ? 'completed' : 'failed',
        error: code === 0 ? undefined : `Process exited with code ${code}`,
        completedAt: new Date().toISOString(),
        pid: undefined,
        progress: code === 0 ? 100 : undefined
      })

      // Check for queued downloads to start
      startNextQueuedDownload()
    })

    downloadProcess.on('error', (error) => {
      log.error('Download process error', 'download', { identifier: downloadItem.identifier, error: error.message }, error)
      delete activeProcesses[downloadItem.identifier]
      updateDownloadStatus(downloadItem.identifier, {
        status: 'failed',
        error: `Process error: ${error.message}`,
        pid: undefined
      })
    })
  } catch (error) {
    log.error('Error starting download', 'download', { identifier: downloadItem.identifier, error: error.message }, error)
    
    // Update download status with specific error
    let errorMessage = 'Unknown error'
    if (error instanceof MetadataError) {
      errorMessage = `Metadata error: ${error.message}`
    } else if (error instanceof FileSystemError) {
      errorMessage = `File system error: ${error.message}`
    } else if (error instanceof ProcessError) {
      errorMessage = `Process error: ${error.message}`
    } else if (error instanceof Error) {
      errorMessage = error.message
    }
    
    updateDownloadStatus(downloadItem.identifier, {
      status: 'failed',
      error: errorMessage,
      pid: undefined
    })
    
    throw error
  }
}

async function startNextQueuedDownload() {
  const downloads = readDownloads()
  const config = await getConfig()
  const activeDownloads = getActiveDownloadsCount(downloads)
  
  if (activeDownloads >= config.maxConcurrentDownloads) {
    return
  }

  const nextQueued = downloads.find(d => d.status === 'queued')
  if (nextQueued) {
    await startDownload({...nextQueued, mediatype: nextQueued.mediatype || 'other'})
  }
}

function isProcessRunning(pid: number): boolean {
  try {
    // Send signal 0 to check if process exists
    process.kill(pid, 0)
    return true
  } catch (error) {
    return false
  }
}

function cleanStaleDownloads(downloads: DownloadItem[]): DownloadItem[] {
  return downloads.map(download => {
    // If download is marked as downloading but process isn't running
    if (download.status === 'downloading' && download.pid && !isProcessRunning(download.pid)) {
      return {
        ...download,
        status: 'failed',
        error: 'Download process terminated unexpectedly',
        completedAt: new Date().toISOString()
      }
    }
    return download
  })
}

export async function GET(request: NextRequest): Promise<NextResponse<DownloadItem[] | ApiResponse>> {
  try {
    const config = await getConfig()
    const downloads = readDownloads()

    // Map downloads to include destination paths
    const downloadsWithPaths = downloads.map(download => {
      // Get media type from download or use default
      const mediaType = download.mediatype || 'other'
      const folderName = (MEDIA_TYPE_FOLDERS as any)[mediaType] || mediaType

      // Only construct destination path if we have required values
      let destinationPath = undefined
      if (config.cacheDir && folderName && download.identifier) {
        destinationPath = download.file
          ? path.join(config.cacheDir, folderName, download.identifier, download.file)
          : path.join(config.cacheDir, folderName, download.identifier)
      }

      return {
        ...download,
        destinationPath
      }
    })

    return NextResponse.json(downloadsWithPaths)
  } catch (error) {
    log.error('Error in GET /api/download', 'download', { error: error.message }, error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest): Promise<NextResponse<ApiResponse>> {
  try {
    const config = await getConfig()
    let body: DownloadRequest
    
    try {
      body = await request.json()
    } catch (error) {
      throw new ValidationError('Invalid JSON in request body')
    }
    
    const { identifier, title, file, action, isDerivative } = body
    
    if (!action) {
      throw new ValidationError('Action is required')
    }
    
    const downloads = readDownloads()

    if (action === 'clear') {
      // Only remove completed and failed downloads, keep active ones
      const activeDownloads = downloads.filter(d => 
        d.status === 'downloading' || d.status === 'queued'
      )
      writeDownloads(activeDownloads)
      return NextResponse.json({ success: true })
    }

    if (action === 'cancel') {
      if (!identifier) {
        throw new ValidationError('Identifier is required for cancel action')
      }
      
      // Try to kill the process if it exists
      const process = activeProcesses[identifier]
      if (process) {
        try {
          process.kill()
          delete activeProcesses[identifier]
        } catch (error) {
          throw new ProcessError(`Failed to kill download process: ${error instanceof Error ? error.message : 'Unknown error'}`, process.pid)
        }
      }
      
      const updatedDownloads = downloads.map(d => 
        d.identifier === identifier
          ? { ...d, status: 'failed' as const, error: 'Download cancelled by user', pid: undefined }
          : d
      )
      
      writeDownloads(updatedDownloads)
      return NextResponse.json({ success: true })
    }

    // Get media type from Internet Archive metadata first
    const metadata = await fetchMetadata(identifier)
    const mediaType = metadata?.metadata?.mediatype || 'other'

    if (action === 'retry') {
      const download = downloads.find(d => d.identifier === identifier)
      if (!download) {
        return NextResponse.json({ error: 'Download not found' }, { status: 404 })
      }

      // Start download process
      await startDownload({...download, mediatype: mediaType})
      return NextResponse.json({ success: true })
    }

    if (action === 'start-next') {
      // Try to start the next queued download
      await startNextQueuedDownload()
      return NextResponse.json({ success: true })
    }

    if (action === 'start-all') {
      // Start all queued downloads up to the concurrent limit
      const config = await getConfig()
      const activeDownloads = getActiveDownloadsCount(downloads)
      const queuedDownloads = downloads.filter(d => d.status === 'queued')
      
      const slotsAvailable = config.maxConcurrentDownloads - activeDownloads
      const downloadsToStart = queuedDownloads.slice(0, slotsAvailable)
      
      for (const download of downloadsToStart) {
        await startDownload({...download, mediatype: download.mediatype || 'other'})
      }
      
      return NextResponse.json({ success: true, started: downloadsToStart.length })
    }

    if (action === 'pause-all') {
      // Cancel all downloading items (pause functionality)
      const downloadingItems = downloads.filter(d => d.status === 'downloading')
      
      for (const download of downloadingItems) {
        const process = activeProcesses[download.identifier]
        if (process) {
          try {
            process.kill()
            delete activeProcesses[download.identifier]
          } catch (error) {
            log.error('Error killing process', 'download', { identifier: download.identifier, error: error.message }, error)
          }
        }
      }
      
      const updatedDownloads = downloads.map(d => 
        d.status === 'downloading'
          ? { ...d, status: 'queued' as const, pid: undefined, progress: undefined }
          : d
      )
      
      writeDownloads(updatedDownloads)
      return NextResponse.json({ success: true, paused: downloadingItems.length })
    }

    if (action === 'cancel-all') {
      // Cancel all active downloads (queued and downloading)
      const activeItems = downloads.filter(d => d.status === 'downloading' || d.status === 'queued')
      
      // Kill all active processes
      for (const download of activeItems) {
        if (download.status === 'downloading') {
          const process = activeProcesses[download.identifier]
          if (process) {
            try {
              process.kill()
              delete activeProcesses[download.identifier]
            } catch (error) {
              log.error('Error killing process', 'download', { identifier: download.identifier, error: error.message }, error)
            }
          }
        }
      }
      
      const updatedDownloads = downloads.map(d => 
        (d.status === 'downloading' || d.status === 'queued')
          ? { ...d, status: 'failed' as const, error: 'Download cancelled by user', pid: undefined }
          : d
      )
      
      writeDownloads(updatedDownloads)
      return NextResponse.json({ success: true, cancelled: activeItems.length })
    }

    if (action === 'queue') {
      // Validate required fields
      if (!identifier || !title) {
        throw new ValidationError('Identifier and title are required for queue action')
      }

      // Check if already downloading
      const existingDownload = downloads.find(d => 
        d.identifier === identifier && d.file === file
      )
      
      if (existingDownload) {
        if (existingDownload.status === 'downloading') {
          throw new ValidationError('Download already in progress')
        }

        // Update existing download
        existingDownload.status = 'queued'
        existingDownload.error = undefined
        existingDownload.progress = undefined
        existingDownload.completedAt = undefined
        existingDownload.startedAt = new Date().toISOString()
        existingDownload.file = file
        existingDownload.mediatype = mediaType
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
          mediatype: mediaType,
          isDerivative
        }
        downloads.push(newDownload)
        writeDownloads(downloads)
      }

      // Try to start the download if possible
      try {
        await startNextQueuedDownload()
      } catch (error) {
        log.error('Error starting download', 'download', { identifier, error: error.message }, error)
        // Don't throw here - the download is queued even if it fails to start immediately
      }
      return NextResponse.json({ success: true })
    }

    throw new ValidationError(`Invalid action: ${action}`)
  } catch (error) {
    log.error('Error in POST /api/download', 'download', { error: error.message }, error)
    return handleApiError(error)
  }
}
