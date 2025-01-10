import { NextRequest, NextResponse } from 'next/server'
import { spawn } from 'child_process'
import path from 'path'
import fs from 'fs'
import { getConfig } from '@/lib/config'

const DOWNLOADS_FILE = path.join(process.cwd(), 'downloads.json')
const CONFIG_FILE = path.join(process.cwd(), 'config.json')

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

interface DownloadItem {
  identifier: string
  title: string
  status: 'queued' | 'downloading' | 'completed' | 'failed'
  progress?: number
  error?: string
  startedAt?: string
  completedAt?: string
  pid?: number
  file?: string
  destinationPath?: string
  mediaType?: string
  isDerivative?: boolean
}

interface Settings {
  storagePath: string
  maxConcurrentDownloads: number
  skipDerivativeFiles: boolean
  cacheDir: string
}

function readSettings(): Settings {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const data = fs.readFileSync(CONFIG_FILE, 'utf8')
      return JSON.parse(data)
    }
  } catch (error) {
    console.error('Error reading settings:', error)
  }
  return { storagePath: '', maxConcurrentDownloads: 3, skipDerivativeFiles: false, cacheDir: '' }
}

function readDownloads(): DownloadItem[] {
  try {
    if (fs.existsSync(DOWNLOADS_FILE)) {
      const data = fs.readFileSync(DOWNLOADS_FILE, 'utf8')
      // Handle empty file case
      if (!data.trim()) {
        return []
      }
      return JSON.parse(data)
    }
    return []
  } catch (error) {
    console.error('Error reading downloads:', error)
    return []
  }
}

function writeDownloads(downloads: DownloadItem[]) {
  try {
    fs.writeFileSync(DOWNLOADS_FILE, JSON.stringify(downloads, null, 2))
  } catch (error) {
    console.error('Error writing downloads:', error)
  }
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
    const response = await fetch(`https://archive.org/metadata/${identifier}`)
    if (!response.ok) {
      throw new Error(`Failed to fetch metadata: ${response.status}`)
    }
    return await response.json()
  } catch (error) {
    console.error('Error fetching metadata:', error)
    return null
  }
}

// Track active download processes
const activeProcesses: { [key: string]: ReturnType<typeof spawn> } = {}

async function startDownload(downloadItem: DownloadItem) {
  const config = await getConfig()
  
  // Get metadata to find the file to download if not specified
  if (!downloadItem.file) {
    const metadata = await fetchMetadata(downloadItem.identifier)
    if (!metadata?.files?.length) {
      throw new Error('No files found in metadata')
    }

    // Find first non-derivative file
    downloadItem.file = metadata.files.find(f => !isDerivativeFile(f.name))?.name
    if (!downloadItem.file) {
      // If no non-derivative files found, use the first file
      downloadItem.file = metadata.files[0].name
    }
  }

  // Start download process
  const downloadProcess = spawn('node', [
    path.join(process.cwd(), 'scripts', 'download.js'),
    downloadItem.identifier,
    config.cacheDir,
    downloadItem.mediaType || 'other',
    downloadItem.file // Pass the specific file to download
  ])

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
    console.log(`Download stdout: ${output}`)
    
    // Try to parse progress from output
    const progressMatch = output.match(/Progress: (\d+)%/)
    if (progressMatch) {
      const progress = parseInt(progressMatch[1])
      updateDownloadStatus(downloadItem.identifier, { progress })
    }
  })

  downloadProcess.stderr.on('data', (data) => {
    const error = data.toString()
    console.error(`Download stderr: ${error}`)
    updateDownloadStatus(downloadItem.identifier, { error })
  })

  downloadProcess.on('close', (code) => {
    console.log(`Download process exited with code ${code}`)
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
    await startDownload({...nextQueued, mediaType: nextQueued.mediaType || 'other'})
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

export async function GET(request: NextRequest) {
  try {
    const config = await getConfig()
    const downloads = readDownloads()

    // Map downloads to include destination paths
    const downloadsWithPaths = downloads.map(download => {
      // Get media type from download or use default
      const mediaType = download.mediaType || 'other'
      const folderName = MEDIA_TYPE_FOLDERS[mediaType] || mediaType

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
    console.error('Error in GET /api/download:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const config = await getConfig()
    const { identifier, title, file, action, isDerivative } = await request.json()
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
      // Try to kill the process if it exists
      const process = activeProcesses[identifier]
      if (process) {
        try {
          process.kill()
          delete activeProcesses[identifier]
        } catch (error) {
          console.error('Error killing process:', error)
        }
      }
      
      const updatedDownloads = downloads.map(d => 
        d.identifier === identifier
          ? { ...d, status: 'failed', error: 'Download cancelled by user', pid: undefined }
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
      await startDownload({...download, mediaType})
      return NextResponse.json({ success: true })
    }

    if (action === 'queue') {
      // Check if already downloading
      const existingDownload = downloads.find(d => 
        d.identifier === identifier && d.file === file
      )
      
      if (existingDownload) {
        if (existingDownload.status === 'downloading') {
          return NextResponse.json(
            { error: 'Already downloading' },
            { status: 400 }
          )
        }

        // Update existing download
        existingDownload.status = 'queued'
        existingDownload.error = undefined
        existingDownload.progress = undefined
        existingDownload.completedAt = undefined
        existingDownload.startedAt = new Date().toISOString()
        existingDownload.file = file
        existingDownload.mediaType = mediaType
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
          mediaType,
          isDerivative
        }
        downloads.push(newDownload)
        writeDownloads(downloads)
      }

      // Try to start the download if possible
      await startNextQueuedDownload()
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    console.error('Error in POST /api/download:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
