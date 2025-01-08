import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { getConfig } from '@/lib/config'

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

interface MetadataFile {
  name: string
  source?: string
  size?: number | string
  original?: string
  md5?: string
  sha1?: string
}

function isDerivativeFile(file: MetadataFile): boolean {
  return file.source === 'derivative' || (file.original !== undefined && file.original !== '')
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
  
  console.log('Looking for file:', { 
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
      console.log('Target directory does not exist:', targetDir)
      return null
    }

    const files = fs.readdirSync(targetDir)
    console.log('Directory contents:', files)
    
    // Case-insensitive search for Windows
    const foundFile = files.find(f => 
      f.toLowerCase() === baseFilename.toLowerCase() || 
      f.toLowerCase() === sanitizedFilename.toLowerCase()
    )
    
    if (foundFile) {
      console.log('Found file:', foundFile)
      // Return the full path relative to the item directory
      return subDirs === '.' ? foundFile : path.join(subDirs, foundFile)
    }
  } catch (error) {
    console.error('Error reading directory:', error)
  }

  console.log('File not found in either format')
  return null
}

async function queueDownload(identifier: string, filename: string, isDerivative: boolean = false) {
  try {
    console.log('Attempting to queue download:', { identifier, filename, isDerivative })
    // Extract just the filename without the path for the title
    const displayName = path.basename(filename)
    
    console.log('Making request to download API')
    // Use full URL for server-side API call
    const response = await fetch('http://localhost:3000/api/download', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        identifier,
        title: `${identifier} - ${displayName}`,
        file: filename,  // Keep the full path for downloading
        isDerivative
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Download queue error:', errorText)
      throw new Error(`Failed to queue download: ${errorText}`)
    }

    console.log('Successfully queued download')
    return true
  } catch (error) {
    console.error('Error queueing download:', error)
    return false
  }
}

function getItemPath(identifier: string, storagePath: string): string {
  // Get the media type from the identifier (e.g., "texts/item123" -> "texts")
  const mediaType = identifier.split('/')[0]
  // Map it to the correct folder name
  const folderName = MEDIA_TYPE_FOLDERS[mediaType] || mediaType
  // Construct the full path
  const fullPath = path.join(storagePath, folderName, identifier)
  console.log('Resolved path:', { mediaType, folderName, fullPath, identifier })
  return fullPath
}

async function getStoragePath(): Promise<string> {
  try {
    const response = await fetch('http://localhost:3000/api/settings')
    if (!response.ok) {
      throw new Error('Failed to fetch settings')
    }
    const settings = await response.json()
    return settings.storagePath
  } catch (error) {
    console.error('Error getting storage path:', error)
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

    // If MD5 is available, check it first (faster than SHA1)
    if (file.md5) {
      const md5 = calculateFileHash(filePath, 'md5')
      if (md5 !== file.md5) {
        return { valid: false, error: 'MD5 mismatch' }
      }
    }

    // If SHA1 is available, verify it too
    if (file.sha1) {
      const sha1 = calculateFileHash(filePath, 'sha1')
      if (sha1 !== file.sha1) {
        return { valid: false, error: 'SHA1 mismatch' }
      }
    }

    return { valid: true }
  } catch (error) {
    return { valid: false, error: `Error verifying file: ${error.message}` }
  }
}

export async function POST(request: NextRequest) {
  try {
    const { action, identifier, filename } = await request.json()
    console.log('Maintenance API called with:', { action, identifier, filename })
    
    const storagePath = await getStoragePath()
    
    if (!storagePath) {
      return NextResponse.json(
        { error: 'Storage path not configured' },
        { status: 400 }
      )
    }

    const results: any = { success: true }

    if (action === 'refresh-metadata') {
      // Refresh metadata for all items
      for (const folder of Object.values(MEDIA_TYPE_FOLDERS)) {
        const folderPath = path.join(storagePath, folder)
        if (!fs.existsSync(folderPath)) continue

        const items = fs.readdirSync(folderPath)
        for (const item of items) {
          const itemPath = path.join(folderPath, item)
          if (!fs.statSync(itemPath).isDirectory()) continue

          try {
            const response = await fetch(`http://localhost:3000/api/metadata/${item}`, {
              method: 'GET',
              headers: { 'force-refresh': 'true' }
            })
            if (!response.ok) {
              console.error(`Failed to refresh metadata for ${item}:`, await response.text())
            }
          } catch (error) {
            console.error(`Error refreshing metadata for ${item}:`, error)
          }
        }
      }
      results.message = 'Metadata refresh completed'
    }
    else if (action === 'verify-files') {
      // Get settings to check skipDerivativeFiles and skipHashCheck
      const settingsResponse = await fetch('http://localhost:3000/api/settings')
      if (!settingsResponse.ok) {
        throw new Error('Failed to fetch settings')
      }
      const settings = await settingsResponse.json()

      const issues: any[] = []
      
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

          try {
            const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'))
            const files = (metadata.files || []) as MetadataFile[]

            for (const file of files) {
              // Skip derivative files if the setting is enabled
              if (settings.skipDerivativeFiles && isDerivativeFile(file)) {
                continue
              }

              const existingFilename = findFileInDirectory(itemPath, file.name)
              if (!existingFilename) {
                issues.push({ 
                  item, 
                  file: file.name,
                  error: 'File missing',
                  isDerivative: isDerivativeFile(file)
                })
                continue
              }

              // Verify file integrity (respecting skipHashCheck setting)
              const filePath = path.join(itemPath, existingFilename)
              const verification = verifyFile(filePath, file, settings.skipHashCheck)
              if (!verification.valid) {
                issues.push({
                  item,
                  file: file.name,
                  error: verification.error,
                  isDerivative: isDerivativeFile(file)
                })
              }
            }
          } catch (error) {
            console.error(`Error checking files for ${item}:`, error)
          }
        }
      }

      results.issues = issues
      results.type = 'verify'
      results.message = issues.length === 0 ? 
        'All files verified successfully' : 
        `Found ${issues.length} issue(s)`
    }
    else if (action === 'redownload-mismatched') {
      // Queue all mismatched files for redownload
      const response = await fetch('http://localhost:3000/api/maintenance', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'verify-files' }),
      })

      if (!response.ok) {
        throw new Error('Failed to verify files')
      }

      const verifyResults = await response.json()
      const issues = verifyResults.issues || []
      const queuedFiles = []
      const failedFiles = []

      for (const issue of issues) {
        if (issue.file) {
          // Skip derivative files if the setting is enabled
          if (settings.skipDerivativeFiles && issue.isDerivative) {
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
        console.error('Missing identifier or filename for redownload-single')
        return NextResponse.json(
          { error: 'Identifier and filename are required' },
          { status: 400 }
        )
      }

      console.log('Attempting to redownload single file:', { identifier, filename })

      // Special handling for metadata files
      const metadataFiles = [
        '_files.xml',
        '_meta.sqlite',
        '_meta.xml'
      ]
      
      // Check if this is a metadata file
      const isMetadataFile = metadataFiles.some(suffix => filename.endsWith(suffix))
      if (isMetadataFile) {
        console.log('Handling metadata file download:', filename)
        const success = await queueDownload(identifier, filename, false)
        if (success) {
          console.log('Successfully queued metadata file for redownload:', { identifier, filename })
          results.message = `Queued ${identifier}/${filename} for redownload`
        } else {
          console.error('Failed to queue metadata file for redownload:', { identifier, filename })
          results.error = `Failed to queue ${identifier}/${filename}`
        }
        return NextResponse.json(results)
      }

      // For non-metadata files, proceed with normal metadata check
      console.log('Fetching metadata from:', `http://localhost:3000/api/metadata/${identifier}`)
      const metadataResponse = await fetch(`http://localhost:3000/api/metadata/${identifier}`)
      if (!metadataResponse.ok) {
        console.error('Failed to fetch metadata:', await metadataResponse.text())
        return NextResponse.json(
          { error: 'Failed to fetch metadata' },
          { status: 500 }
        )
      }

      const metadata = await metadataResponse.json()
      console.log('Received metadata:', JSON.stringify(metadata, null, 2))
      console.log('Looking for file in metadata files:', filename)
      
      if (!metadata.files) {
        console.error('No files array in metadata')
        return NextResponse.json(
          { error: 'No files found in metadata' },
          { status: 404 }
        )
      }

      console.log('Number of files in metadata:', metadata.files.length)
      const file = metadata.files.find((f: MetadataFile) => {
        console.log('Comparing file:', f.name, 'with target:', filename)
        return f.name === filename
      })
      
      if (!file) {
        console.error('File not found in metadata:', filename)
        console.log('Available files:', metadata.files.map((f: MetadataFile) => f.name))
        return NextResponse.json(
          { error: 'File not found in metadata' },
          { status: 404 }
        )
      }

      console.log('Found file in metadata:', file)
      
      // Get settings
      const config = await getConfig()
      const settings = config.settings || {}

      // Skip derivative files if the setting is enabled
      if (settings.skipDerivativeFiles && isDerivativeFile(file)) {
        console.log('Skipping derivative file:', filename)
        return NextResponse.json({
          message: `Skipped ${identifier}/${filename} (derivative file)`,
          skipped: true
        })
      }

      const success = await queueDownload(identifier, filename, isDerivativeFile(file))
      if (success) {
        console.log('Successfully queued file for redownload:', { identifier, filename })
        results.message = `Queued ${identifier}/${filename} for redownload`
      } else {
        console.error('Failed to queue file for redownload:', { identifier, filename })
        results.error = `Failed to queue ${identifier}/${filename}`
      }
      return NextResponse.json(results)
    }
    else if (action === 'find-derivatives') {
      const issues: any[] = []
      
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

          try {
            const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'))
            const files = (metadata.files || []) as MetadataFile[]

            for (const file of files) {
              if (isDerivativeFile(file)) {
                const existingFilename = findFileInDirectory(itemPath, file.name)
                if (existingFilename) {
                  issues.push({ 
                    item, 
                    file: file.name,
                    size: fs.statSync(path.join(itemPath, existingFilename)).size,
                    original: file.original || 'Unknown'
                  })
                }
              }
            }
          } catch (error) {
            console.error(`Error checking derivatives for ${item}:`, error)
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
      // Remove all derivative files
      const response = await fetch('http://localhost:3000/api/maintenance', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'find-derivatives' }),
      })

      if (!response.ok) {
        throw new Error('Failed to find derivative files')
      }

      const findResults = await response.json()
      const issues = findResults.issues || []
      const removedFiles = []
      const failedFiles = []

      for (const issue of issues) {
        if (issue.file) {
          try {
            const itemPath = path.join(storagePath, MEDIA_TYPE_FOLDERS[issue.item.split('/')[0]] || '', issue.item)
            const existingFilename = findFileInDirectory(itemPath, issue.file)
            
            if (existingFilename) {
              const filePath = path.join(itemPath, existingFilename)
              fs.unlinkSync(filePath)
              removedFiles.push(`${issue.item}/${issue.file}`)
            }
          } catch (error) {
            console.error(`Failed to remove ${issue.item}/${issue.file}:`, error)
            failedFiles.push(`${issue.item}/${issue.file}`)
          }
        }
      }

      results.message = `Removed ${removedFiles.length} derivative file(s)`
      if (failedFiles.length > 0) {
        results.error = `Failed to remove ${failedFiles.length} file(s)`
      }
      results.removedFiles = removedFiles
      results.failedFiles = failedFiles
    }
    else if (action === 'remove-single-derivative') {
      if (!identifier || !filename) {
        return NextResponse.json(
          { error: 'Identifier and filename are required' },
          { status: 400 }
        )
      }

      console.log('Removing single derivative:', { identifier, filename, storagePath })

      // Get metadata to verify it's a derivative
      const metadataResponse = await fetch(`http://localhost:3000/api/metadata/${identifier}`)
      if (!metadataResponse.ok) {
        console.error('Failed to fetch metadata:', await metadataResponse.text())
        return NextResponse.json(
          { error: 'Failed to fetch metadata' },
          { status: 500 }
        )
      }

      const metadata = await metadataResponse.json()
      console.log('Got metadata:', metadata)
      
      const file = (metadata.files || []).find((f: MetadataFile) => f.name === filename)
      console.log('Found file in metadata:', file)
      
      if (!file) {
        return NextResponse.json(
          { error: 'File not found in metadata' },
          { status: 404 }
        )
      }

      if (!isDerivativeFile(file)) {
        return NextResponse.json(
          { error: 'File is not a derivative' },
          { status: 400 }
        )
      }

      try {
        // For Windows paths, don't use path.join as it will mess up the drive letter
        const mediaType = metadata.mediatype // Get mediatype from metadata response
        const itemId = identifier // The full identifier is the item ID
        const folderName = MEDIA_TYPE_FOLDERS[mediaType] || mediaType // e.g. "books" for "texts"
        
        console.log('Raw identifier:', identifier)
        console.log('Storage path:', storagePath)
        console.log('Media type:', mediaType)
        console.log('Folder name:', folderName)
        console.log('Item ID:', itemId)
        
        // Ensure we have all required components
        if (!mediaType || !itemId || !folderName) {
          console.error('Missing path component:', { mediaType, itemId, folderName })
          return NextResponse.json(
            { error: 'Invalid identifier format' },
            { status: 400 }
          )
        }
        
        // Construct Windows path with explicit backslashes
        const itemPath = `${storagePath}\\${folderName}\\${itemId}`
        
        console.log('Final item path:', itemPath)
        
        const existingFilename = findFileInDirectory(itemPath, filename)
        console.log('Existing filename:', existingFilename)
        
        if (existingFilename) {
          const filePath = path.join(itemPath, existingFilename)
          console.log('Deleting file:', filePath)
          fs.unlinkSync(filePath)
          console.log('File deleted successfully')
          results.message = `Removed derivative file ${filename}`
          results.success = true
        } else {
          console.log('File not found for deletion')
          results.message = `File ${filename} not found`
          results.success = false
        }
      } catch (error) {
        console.error(`Failed to remove ${identifier}/${filename}:`, error)
        return NextResponse.json(
          { error: `Failed to remove file: ${error.message}` },
          { status: 500 }
        )
      }
    }

    return NextResponse.json(results)
  } catch (error) {
    console.error('Maintenance error:', error)
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}
