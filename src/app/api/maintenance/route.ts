import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { getConfig, getBaseUrl } from '@/lib/config'
import { readJsonFile } from '@/lib/utils'
import { retryFetch, RETRY_CONFIGS } from '@/lib/retry'
import { queueDownloadDirect } from '@/lib/downloads'
import { getMetadataCache, generateMetadataCacheKey } from '@/lib/cache'
import { log } from '@/lib/logger'
import type { MaintenanceRequest, MaintenanceResult, MaintenanceIssue, MetadataFile, ApiResponse } from '@/types/api'

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

function isDerivativeFile(file: MetadataFile): boolean {
  // Check metadata-based derivative detection
  if (file.source === 'derivative' || (file.original !== undefined && file.original !== '')) {
    return true
  }
  
  // Check filename-based derivative patterns
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
  
  return derivativePatterns.some(pattern => pattern.test(file.name))
}

function sanitizeFilename(filename: string): string {
  // Replace colons with underscores, matching the download behavior
  return filename.replace(/:/g, '_')
}

function findFileInDirectory(directory: string, originalFilename: string): string | null {
  // Handle paths with subdirectories
  const subDirs = path.dirname(originalFilename)
  const baseFilename = path.basename(originalFilename)
  const targetDir = subDirs === '.' ? directory : path.join(directory, subDirs)
  
  // Try both original filename and sanitized version
  const sanitizedFilename = sanitizeFilename(baseFilename)
  
  log.debug('Looking for file', 'maintenance', { 
    directory, 
    originalFilename, 
    subDirs,
    targetDir,
    baseFilename,
    sanitizedFilename 
  })
  
  try {
    // Check if the subdirectory exists
    if (!fs.existsSync(targetDir)) {
      log.warn('Target directory does not exist', 'maintenance', { targetDir })
      return null
    }

    const files = fs.readdirSync(targetDir)
    log.debug('Directory contents', 'maintenance', { targetDir, files })
    
    // Case-insensitive search for Windows
    const foundFile = files.find(f => 
      f.toLowerCase() === baseFilename.toLowerCase() || 
      f.toLowerCase() === sanitizedFilename.toLowerCase()
    )
    
    if (foundFile) {
      log.debug('Found file', 'maintenance', { foundFile, targetDir })
      // Return the full path relative to the item directory
      return subDirs === '.' ? foundFile : path.join(subDirs, foundFile)
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    log.error('Error reading directory', 'maintenance', { targetDir, error: errorMessage }, error instanceof Error ? error : undefined)
  }

  log.debug('File not found in either format', 'maintenance', { originalFilename, sanitizedFilename })
  return null
}

async function queueDownload(identifier: string, filename: string, isDerivative: boolean = false) {
  try {
    log.info('Attempting to queue download', 'maintenance', { identifier, filename, isDerivative })
    const displayName = path.basename(filename)
    
    // Get media type from identifier
    const mediaType = identifier.split('/')[0]
    
    const success = await queueDownloadDirect(
      identifier,
      `${identifier} - ${displayName}`,
      filename,
      mediaType,
      isDerivative
    )
    
    if (success) {
      log.info('Download queued successfully', 'maintenance', { identifier, filename })
      return true
    } else {
      log.error('Failed to queue download', 'maintenance', { identifier, filename })
      return false
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    log.error('Error queueing download', 'maintenance', { identifier, filename, error: errorMessage }, error instanceof Error ? error : undefined)
    return false
  }
}

function getItemPath(identifier: string, storagePath: string): string {
  // Get the media type from the identifier (e.g., "texts/item123" -> "texts")
  const mediaType = identifier.split('/')[0]
  // Map it to the correct folder name
  const folderName = (MEDIA_TYPE_FOLDERS as any)[mediaType] || mediaType
  // Construct the full path
  const fullPath = path.join(storagePath, folderName, identifier)
  log.debug('Resolved path', 'maintenance', { mediaType, folderName, fullPath, identifier })
  return fullPath
}

async function getStoragePath(): Promise<string> {
  try {
    const baseUrl = getBaseUrl()
    const response = await retryFetch(`${baseUrl}/api/settings`, {}, RETRY_CONFIGS.METADATA)
    const settings = await response.json()
    return settings.storagePath
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    log.error('Error getting storage path', 'maintenance', { error: errorMessage }, error instanceof Error ? error : undefined)
    return ''
  }
}

function calculateFileHash(filePath: string, algorithm: 'md5' | 'sha1'): string {
  const hash = crypto.createHash(algorithm)
  const data = fs.readFileSync(filePath)
  hash.update(data)
  return hash.digest('hex')
}

function verifyFile(filePath: string, file: MetadataFile, skipHashCheck: boolean): { valid: boolean, error?: string } {
  try {
    // First check if file exists
    if (!fs.existsSync(filePath)) {
      return { valid: false, error: 'File missing' }
    }

    // Skip hash checks if configured
    if (skipHashCheck) {
      return { valid: true }
    }

    // When hash checking is enabled, we need at least one hash to verify
    if (!file.md5 && !file.sha1) {
      return { valid: false, error: 'No hash available for verification' }
    }

    // If MD5 is available, check it first (faster than SHA1)
    if (file.md5) {
      const md5 = calculateFileHash(filePath, 'md5')
      if (md5 !== file.md5) {
        return { valid: false, error: `MD5 mismatch (expected: ${file.md5}, actual: ${md5})` }
      }
    }

    // If SHA1 is available, verify it too
    if (file.sha1) {
      const sha1 = calculateFileHash(filePath, 'sha1')
      if (sha1 !== file.sha1) {
        return { valid: false, error: `SHA1 mismatch (expected: ${file.sha1}, actual: ${sha1})` }
      }
    }

    return { valid: true }
  } catch (error) {
    return { valid: false, error: `Error verifying file: ${error instanceof Error ? error.message : String(error)}` }
  }
}

export async function POST(request: NextRequest): Promise<NextResponse<MaintenanceResult | ApiResponse>> {
  try {
    const body: MaintenanceRequest = await request.json()
    const { action, identifier, filename } = body
    log.info('Maintenance API called', 'maintenance', { action, identifier, filename })
    
    const storagePath = await getStoragePath()
    
    if (!storagePath) {
      return NextResponse.json(
        { error: 'Storage path not configured' },
        { status: 400 }
      )
    }

    const results: MaintenanceResult = { success: true, message: 'Maintenance operation completed' }

    if (action === 'refresh-metadata') {
      // Refresh metadata for all items
      const metadataCache = getMetadataCache()
      
      for (const folder of Object.values(MEDIA_TYPE_FOLDERS)) {
        const folderPath = path.join(storagePath, folder)
        if (!fs.existsSync(folderPath)) continue

        const items = fs.readdirSync(folderPath)
        for (const item of items) {
          const itemPath = path.join(folderPath, item)
          if (!fs.statSync(itemPath).isDirectory()) continue

          try {
            // Clear cache for this item first
            const cacheKey = generateMetadataCacheKey(item)
            await metadataCache.delete(cacheKey)
            
            const baseUrl = getBaseUrl()
            const response = await retryFetch(`${baseUrl}/api/metadata/${item}`, {
              method: 'GET',
              headers: { 'force-refresh': 'true' }
            }, RETRY_CONFIGS.METADATA)
            log.info('Successfully refreshed metadata', 'maintenance', { item })
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error'
            log.error('Error refreshing metadata', 'maintenance', { item, error: errorMessage }, error instanceof Error ? error : undefined)
          }
        }
      }
      results.message = 'Metadata refresh completed'
    }
    else if (action === 'verify-files') {
      // Get settings to check skipHashCheck
      const config = await getConfig()
      const skipHashCheck = config.skipHashCheck

      const issues: MaintenanceIssue[] = []
      
      // Check all items
      for (const folder of Object.values(MEDIA_TYPE_FOLDERS)) {
        const folderPath = path.join(storagePath, folder)
        if (!fs.existsSync(folderPath)) continue

        const items = fs.readdirSync(folderPath)
        for (const item of items) {
          const itemPath = path.join(folderPath, item)
          if (!fs.statSync(itemPath).isDirectory()) continue

          const metadataPath = path.join(itemPath, 'metadata.json')
          if (!fs.existsSync(metadataPath)) continue

          const metadata = readJsonFile(metadataPath)
          if (!metadata) {
            continue
          }
          
          try {
            
            const files = (metadata.files || []) as MetadataFile[]

            for (const file of files) {
              // Always skip derivative files
              if (isDerivativeFile(file)) {
                continue
              }

              const existingFilename = findFileInDirectory(itemPath, file.name)
              if (!existingFilename) {
                issues.push({ 
                  identifier: item,
                  type: 'missing-file',
                  description: `File ${file.name} is missing`,
                  item, 
                  file: file.name,
                  error: 'File missing',
                  isDerivative: isDerivativeFile(file)
                })
                continue
              }

              // Verify file integrity (respecting skipHashCheck setting)
              const filePath = path.join(itemPath, existingFilename)
              log.debug('Verifying file', 'maintenance', { filePath, skipHashCheck })
              const verification = verifyFile(filePath, file, skipHashCheck)
              if (!verification.valid) {
                issues.push({
                  identifier: item,
                  type: 'corrupted-file',
                  description: `File ${file.name} failed verification`,
                  item,
                  file: file.name,
                  error: verification.error,
                  isDerivative: isDerivativeFile(file)
                })
              }
            }
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error'
            log.error('Error checking files', 'maintenance', { item, error: errorMessage }, error instanceof Error ? error : undefined)
          }
        }
      }

      results.issues = issues
      results.type = 'verify-files'
      results.message = issues.length === 0 ? 
        'All files verified successfully' : 
        `Found ${issues.length} issue(s)`
    }
    else if (action === 'redownload-mismatched') {
      // Get settings first
      const config = await getConfig()
      const { readSettings } = await import('@/lib/config')
      const settings = readSettings()

      // Queue all mismatched files for redownload
      const baseUrl = getBaseUrl()
      const response = await retryFetch(`${baseUrl}/api/maintenance`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'verify-files' }),
      }, RETRY_CONFIGS.CRITICAL)

      const verifyResults = await response.json()
      const issues = verifyResults.issues || []
      const queuedFiles = []
      const failedFiles = []

      for (const issue of issues) {
        if (issue.file) {
          // Skip derivative files if the setting is enabled
          // Always skip derivative files
        if (issue.isDerivative) {
          continue
        }

          const success = await queueDownload(issue.item, issue.file, issue.isDerivative)
          if (success) {
            queuedFiles.push(`${issue.item}/${issue.file}`)
          } else {
            failedFiles.push(`${issue.item}/${issue.file}`)
          }
        }
      }

      results.message = `Queued ${queuedFiles.length} files for redownload`
      if (failedFiles.length > 0) {
        results.error = `Failed to queue ${failedFiles.length} files`
      }
      results.queuedFiles = queuedFiles
      results.failedFiles = failedFiles
    }
    else if (action === 'redownload-single') {
      // Queue a single file for redownload
      if (!identifier || !filename) {
        log.error('Missing identifier or filename for redownload-single', 'maintenance', { identifier, filename })
        return NextResponse.json(
          { error: 'Identifier and filename are required' },
          { status: 400 }
        )
      }

      log.info('Attempting to redownload single file', 'maintenance', { identifier, filename })

      // Special handling for metadata files
      const metadataFiles = [
        '_files.xml',
        '_meta.sqlite',
        '_meta.xml'
      ]
      
      // Check if this is a metadata file
      const isMetadataFile = metadataFiles.some(suffix => filename.endsWith(suffix))
      if (isMetadataFile) {
        log.info('Handling metadata file download', 'maintenance', { filename, identifier })
        const success = await queueDownload(identifier, filename, false)
        if (success) {
          log.info('Successfully queued metadata file for redownload', 'maintenance', { identifier, filename })
          results.message = `Queued ${identifier}/${filename} for redownload`
          results.success = true
        } else {
          log.error('Failed to queue metadata file for redownload', 'maintenance', { identifier, filename })
          results.error = `Failed to queue ${identifier}/${filename}`
          results.success = false
        }
        return NextResponse.json(results)
      }

      // For non-metadata files, proceed with normal metadata check
      const baseUrl = getBaseUrl()
      log.debug('Fetching metadata', 'maintenance', { url: `${baseUrl}/api/metadata/${identifier}`, identifier })
      const metadataResponse = await retryFetch(`${baseUrl}/api/metadata/${identifier}`, {}, RETRY_CONFIGS.METADATA)

      const metadata = await metadataResponse.json()
      log.debug('Received metadata', 'maintenance', { identifier, metadataKeys: Object.keys(metadata) })
      log.debug('Looking for file in metadata files', 'maintenance', { filename, identifier })
      
      if (!metadata.files) {
        log.error('No files array in metadata', 'maintenance', { identifier })
        return NextResponse.json(
          { error: 'No files found in metadata' },
          { status: 404 }
        )
      }

      log.debug('Number of files in metadata', 'maintenance', { count: metadata.files.length, identifier })
      const file = metadata.files.find((f: MetadataFile) => {
        log.debug('Comparing file', 'maintenance', { fileName: f.name, target: filename })
        return f.name === filename
      })
      
      if (!file) {
        log.error('File not found in metadata', 'maintenance', { filename, identifier })
        return NextResponse.json(
          { error: 'File not found in metadata' },
          { status: 404 }
        )
      }

      const success = await queueDownload(identifier, filename, isDerivativeFile(file))
      if (success) {
        log.info('Successfully queued file for redownload', 'maintenance', { identifier, filename })
        results.message = `Queued ${identifier}/${filename} for redownload`
        results.success = true
      } else {
        log.error('Failed to queue file for redownload', 'maintenance', { identifier, filename })
        results.error = `Failed to queue ${identifier}/${filename}`
        results.success = false
      }
    }
    else if (action === 'find-derivatives') {
      const issues: MaintenanceIssue[] = []
      
      // Check all items
      for (const folder of Object.values(MEDIA_TYPE_FOLDERS)) {
        const folderPath = path.join(storagePath, folder)
        if (!fs.existsSync(folderPath)) continue

        const items = fs.readdirSync(folderPath)
        for (const item of items) {
          const itemPath = path.join(folderPath, item)
          if (!fs.statSync(itemPath).isDirectory()) continue

          const metadataPath = path.join(itemPath, 'metadata.json')
          if (!fs.existsSync(metadataPath)) continue

          const metadata = readJsonFile(metadataPath)
          if (!metadata) {
            continue
          }
          
          try {
            
            const files = (metadata.files || []) as MetadataFile[]

            for (const file of files) {
              if (isDerivativeFile(file)) {
                const existingFilename = findFileInDirectory(itemPath, file.name)
                if (existingFilename) {
                  issues.push({ 
                    identifier: item,
                    type: 'missing-file',
                    description: `Derivative file ${file.name} found`,
                    item: path.join(folder, item), // Include media type folder in path
                    file: file.name,
                    size: fs.statSync(path.join(itemPath, existingFilename)).size,
                    isDerivative: true
                  })
                }
              }
            }
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error'
            log.error('Error checking derivatives', 'maintenance', { item, error: errorMessage }, error instanceof Error ? error : undefined)
          }
        }
      }

      results.issues = issues
      results.type = 'derivatives'
      results.message = issues.length === 0 ? 
        'No derivative files found' : 
        `Found ${issues.length} derivative file(s)`
    }
    else if (action === 'remove-derivatives') {
      // Get all derivative files from verify-files action
      const baseUrl = getBaseUrl()
      const response = await retryFetch(`${baseUrl}/api/maintenance`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'find-derivatives' }),
      }, RETRY_CONFIGS.CRITICAL)

      const verifyResults = await response.json()
      const issues = verifyResults.issues || []
      const deletedFiles = []
      const failedFiles = []

      for (const issue of issues) {
        if (issue.file) {
          try {
            const itemPath = path.join(storagePath, issue.item)
            
            // Find the actual file on disk (handles case sensitivity and sanitized names)
            const existingFilename = findFileInDirectory(itemPath, issue.file)
            if (!existingFilename) {
              failedFiles.push(`${issue.item}/${issue.file} (not found)`)
              continue
            }

            const filePath = path.join(itemPath, existingFilename)
            log.info('Attempting to delete derivative file', 'maintenance', { filePath, item: issue.item, file: issue.file })
            
            if (fs.existsSync(filePath)) {
              fs.unlinkSync(filePath)
              deletedFiles.push(`${issue.item}/${issue.file}`)
              log.info('Successfully deleted derivative file', 'maintenance', { filePath, item: issue.item, file: issue.file })
            } else {
              failedFiles.push(`${issue.item}/${issue.file} (not found)`)
              log.warn('Derivative file not found for deletion', 'maintenance', { filePath, item: issue.item, file: issue.file })
            }
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error'
            log.error('Error deleting derivative file', 'maintenance', { item: issue.item, file: issue.file, error: errorMessage }, error instanceof Error ? error : undefined)
            const errorMessageForFailed = error instanceof Error ? error.message : String(error)
            failedFiles.push(`${issue.item}/${issue.file} (${errorMessageForFailed})`)
          }
        }
      }

      results.message = `Deleted ${deletedFiles.length} derivative files`
      if (failedFiles.length > 0) {
        results.error = `Failed to delete ${failedFiles.length} files`
      }
      results.deletedFiles = deletedFiles
      results.failedFiles = failedFiles
    }
    else if (action === 'remove-single-derivative') {
      if (!identifier || !filename) {
        return NextResponse.json(
          { error: 'Identifier and filename are required' },
          { status: 400 }
        )
      }

      try {
        const itemPath = path.join(storagePath, identifier)
        
        // Find the actual file on disk (handles case sensitivity and sanitized names)
        const existingFilename = findFileInDirectory(itemPath, filename)
        if (!existingFilename) {
          results.error = `File not found: ${identifier}/${filename}`
          results.success = false
          return NextResponse.json(results)
        }

        const filePath = path.join(itemPath, existingFilename)
        log.info('Attempting to delete single derivative', 'maintenance', { filePath, identifier, filename })
        
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath)
          log.info('Successfully deleted single derivative', 'maintenance', { filePath, identifier, filename })
          results.message = `Deleted ${identifier}/${filename}`
          results.success = true
        } else {
          log.warn('Single derivative file not found for deletion', 'maintenance', { filePath, identifier, filename })
          results.error = `File not found: ${identifier}/${filename}`
          results.success = false
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        log.error('Error deleting single derivative', 'maintenance', { identifier, filename, error: errorMessage }, error instanceof Error ? error : undefined)
        const errorMessageForResult = error instanceof Error ? error.message : String(error)
        results.error = `Failed to delete ${identifier}/${filename}: ${errorMessageForResult}`
        results.success = false
      }
    }

    return NextResponse.json(results)
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    log.error('Maintenance API error', 'maintenance', { error: errorMessage }, error instanceof Error ? error : undefined)
    const errorMessageForResponse = error instanceof Error ? error.message : String(error)
    return NextResponse.json(
        { error: errorMessageForResponse },
      { status: 500 }
    )
  }
}
