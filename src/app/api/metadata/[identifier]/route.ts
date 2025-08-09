import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import debug from 'debug'
import { getConfig } from '@/lib/config'

const log = debug('ia-mirror:metadata')

// Map of Internet Archive media types to folder names
const MEDIA_TYPE_FOLDERS: { [key: string]: string } = {
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

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ identifier: string }> }
) {
  try {
    const params = await context.params
    const { identifier } = params
    
    if (!identifier) {
      log('No identifier provided')
      return NextResponse.json(
        { error: 'Identifier is required' },
        { status: 400 }
      )
    }

    // Get storage directory from config
    const config = await getConfig()
    const STORAGE_DIR = config.cacheDir
    
    log('Fetching metadata for:', identifier)
    log('Storage directory:', STORAGE_DIR)

    // Find the item path
    let itemPath = null
    for (const folder of Object.values(MEDIA_TYPE_FOLDERS)) {
      const potentialPath = path.join(STORAGE_DIR, folder, identifier)
      log('Checking path:', potentialPath)
      if (fs.existsSync(potentialPath)) {
        itemPath = potentialPath
        break
      }
    }

    if (!itemPath) {
      log('Item not found locally')
      return NextResponse.json(
        { error: 'Item not found' },
        { status: 404 }
      )
    }

    // Check if it's a download request
    const url = new URL(request.url)
    const download = url.searchParams.get('download')
    
    if (download) {
      try {
        const downloadPath = path.join(itemPath, download)
        log('Attempting to read file:', downloadPath)
        
        // Basic path traversal protection
        if (!downloadPath.startsWith(itemPath)) {
          log('Invalid file path detected:', downloadPath)
          return NextResponse.json(
            { error: 'Invalid file path' },
            { status: 400 }
          )
        }
        
        if (!fs.existsSync(downloadPath)) {
          log('File not found:', downloadPath)
          return NextResponse.json(
            { error: 'File not found' },
            { status: 404 }
          )
        }

        // Read file as buffer
        const fileBuffer = fs.readFileSync(downloadPath)
        
        // Get file extension and mime type
        const ext = path.extname(download).toLowerCase()
        const mimeType = getMimeType(ext)
        
        // Set appropriate headers
        const headers = new Headers()
        headers.set('Content-Type', mimeType)
        headers.set('Content-Disposition', `inline; filename="${download}"`)
        headers.set('Content-Length', fileBuffer.length.toString())
        
        return new NextResponse(fileBuffer, {
          status: 200,
          headers,
        })
      } catch (err) {
        console.error('Error reading file:', err)
        return NextResponse.json(
          { error: 'Failed to read file' },
          { status: 500 }
        )
      }
    }

    // If not a download request, return metadata
    const metadataPath = path.join(itemPath, 'metadata.json')
    let metadata: any = {}

    console.log('Checking metadata for:', identifier)
    console.log('Metadata path:', metadataPath)
    console.log('Force refresh:', request.headers.get('force-refresh'))

    // Try to fetch fresh metadata from Internet Archive if force refresh
    if (request.headers.get('force-refresh') === 'true') {
      try {
        console.log('Fetching fresh metadata from Internet Archive')
        const iaResponse = await fetch(`https://archive.org/metadata/${identifier}`)
        if (iaResponse.ok) {
          metadata = await iaResponse.json()
          console.log('Got fresh metadata:', JSON.stringify(metadata, null, 2))
          // Save the fresh metadata
          fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2))
          console.log('Saved fresh metadata to:', metadataPath)
        } else {
          console.error('Failed to fetch fresh metadata:', await iaResponse.text())
        }
      } catch (error) {
        console.error('Error fetching fresh metadata:', error)
        // Fall back to local metadata if fetch fails
      }
    }

    // If not force refresh or if force refresh failed, use local metadata
    if (Object.keys(metadata).length === 0 && fs.existsSync(metadataPath)) {
      try {
        console.log('Reading local metadata from:', metadataPath)
        const rawMetadata = fs.readFileSync(metadataPath, 'utf8')
        metadata = JSON.parse(rawMetadata)
        console.log('Got local metadata:', JSON.stringify(metadata, null, 2))
      } catch (error) {
        console.error('Error reading local metadata:', error)
        return NextResponse.json(
          { error: 'Failed to read metadata' },
          { status: 500 }
        )
      }
    }

    if (!metadata || Object.keys(metadata).length === 0) {
      console.error('No metadata found for:', identifier)
      return NextResponse.json(
        { error: 'No metadata found' },
        { status: 404 }
      )
    }

    // Add local file information
    if (metadata.files) {
      console.log('Processing files in metadata')
      metadata.files = metadata.files.map((file: any) => {
        const filePath = path.join(itemPath, file.name)
        const exists = fs.existsSync(filePath)
        console.log('Checking file:', file.name, 'exists:', exists)
        return {
          ...file,
          local: exists
        }
      })
    } else {
      console.log('No files array in metadata')
      // If no files in metadata, create array from local files
      const files = fs.readdirSync(itemPath)
        .filter(f => !f.startsWith('.') && f !== 'metadata.json')
        .map(filename => {
          const filePath = path.join(itemPath, filename)
          if (!fs.existsSync(filePath)) return null
          const stats = fs.statSync(filePath)
          return {
            name: filename,
            size: stats.size,
            format: getFormatFromFilename(filename),
            source: 'original',
            local: true
          }
        })
        .filter(file => file !== null)
      metadata.files = files
    }

    // Get the folder name to determine mediatype
    const folder = path.basename(path.dirname(itemPath))
    const mediatype = Object.keys(MEDIA_TYPE_FOLDERS).find(key => MEDIA_TYPE_FOLDERS[key] === folder)

    // Find a suitable thumbnail file
    let thumbnailFile = null
    for (const file of metadata.files) {
      if (file.name.toLowerCase().endsWith('.jpg') ||
        file.name.toLowerCase().endsWith('.jpeg') ||
        file.name.toLowerCase().endsWith('.png')) {
        thumbnailFile = file.name
        break
      }
    }

    // Return flattened metadata for the API response
    return NextResponse.json({
      identifier: metadata.metadata?.identifier || identifier,
      title: metadata.metadata?.title || identifier,
      mediatype: metadata.metadata?.mediatype || mediatype || 'texts',
      creator: metadata.metadata?.creator,
      date: metadata.metadata?.date,
      description: metadata.metadata?.description,
      collections: Array.isArray(metadata.metadata?.collection) 
        ? metadata.metadata.collection 
        : metadata.metadata?.collection 
          ? [metadata.metadata.collection]
          : [],
      downloads: metadata.metadata?.downloads || 0,
      files: metadata.files || [],
      thumbnailFile
    })

  } catch (error) {
    log('Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

function getMimeType(ext: string): string {
  const mimeTypes: { [key: string]: string } = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.pdf': 'application/pdf',
    '.txt': 'text/plain',
    '.html': 'text/html',
    '.htm': 'text/html',
    '.json': 'application/json',
    '.cbr': 'application/x-cbr',
    '.cbz': 'application/x-cbz',
    '.epub': 'application/epub+zip',
    '.xml': 'application/xml',
    '.zip': 'application/zip',
    '.gz': 'application/gzip'
  }
  return mimeTypes[ext] || 'application/octet-stream'
}

function getFormatFromFilename(filename: string): string {
  const ext = path.extname(filename).toLowerCase()
  const formats: { [key: string]: string } = {
    '.pdf': 'Text PDF',
    '.epub': 'EPUB',
    '.cbr': 'Comic Book RAR',
    '.cbz': 'Comic Book ZIP',
    '.txt': 'Text',
    '.xml': filename.includes('_scandata') ? 'Scandata' : 'XML',
    '.jpg': 'JPEG',
    '.jpeg': 'JPEG',
    '.png': 'PNG',
    '.zip': filename.includes('_jp2') ? 'Single Page Processed JP2 ZIP' : 'ZIP',
    '.gz': 'GZIP'
  }
  return formats[ext] || 'Unknown'
}
