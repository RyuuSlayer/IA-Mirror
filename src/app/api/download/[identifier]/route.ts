import { NextRequest, NextResponse } from 'next/server'
import path from 'path'
import fs from 'fs'
import debug from 'debug'
import { getConfig } from '@/lib/config'
import { createSafeReadStream } from '@/lib/streamUtils'
import { 
  sanitizeFilePath, 
  validateIdentifier, 
  validateFileName,
  checkRateLimit
} from '@/lib/security'
import type { FileInfo, ApiResponse } from '@/types/api'

const log = debug('ia-mirror:api:download')

function isDerivativeFile(file: any) {
  return file.source === 'derivative' || file.original
}

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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ identifier: string }> }
): Promise<NextResponse<FileInfo[] | ApiResponse>> {
  try {
    // Get configuration
    const config = await getConfig()
    const cacheDir = config.cacheDir

    // Rate limiting
    const clientIP = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
    if (!checkRateLimit(`download:${clientIP}`, 30, 60000)) {
      return NextResponse.json(
        { error: 'Rate limit exceeded' },
        { status: 429 }
      )
    }

    const resolvedParams = await params
    const identifier = resolvedParams.identifier
    const searchParams = request.nextUrl.searchParams
    const fileName = searchParams.get('file')
    const fileMetadata = searchParams.get('metadata')

    // Validate identifier
    if (!identifier || !validateIdentifier(identifier)) {
      return NextResponse.json({ error: 'Valid identifier is required' }, { status: 400 })
    }

    // Validate file name
    if (!fileName || !validateFileName(fileName)) {
      return NextResponse.json({ error: 'Valid file name is required' }, { status: 400 })
    }

    // Always skip derivative files
    if (fileMetadata) {
      try {
        const metadata = JSON.parse(fileMetadata)
        if (isDerivativeFile(metadata)) {
          return NextResponse.json(
            { error: 'Skipping derivative file' },
            { status: 400 }
          )
        }
      } catch (error) {
        log('Error parsing file metadata:', error)
      }
    }

    log('Downloading file:', { identifier, fileName })

    // Find the item in media type folders
    let itemPath = null
    for (const folder of Object.values(MEDIA_TYPE_FOLDERS)) {
      const potentialPath = path.join(cacheDir, folder, identifier)
      if (fs.existsSync(potentialPath)) {
        itemPath = potentialPath
        break
      }
    }

    if (!itemPath) {
      log('Item not found:', identifier)
      return NextResponse.json({ error: 'Item not found' }, { status: 404 })
    }

    // Sanitize file path to prevent directory traversal
    const filePath = sanitizeFilePath(fileName, itemPath)
    if (!filePath) {
      log('Path traversal attempt detected:', fileName)
      return NextResponse.json({ error: 'Invalid file path' }, { status: 400 })
    }
    
    log('File path:', filePath)

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      log('File not found:', filePath)
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }

    // Read file stats
    const stats = fs.statSync(filePath)
    if (!stats.isFile()) {
      log('Not a file:', filePath)
      return NextResponse.json({ error: 'Not a file' }, { status: 400 })
    }

    // Determine content type
    const ext = path.extname(fileName).toLowerCase()
    const contentType = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.pdf': 'application/pdf',
      '.txt': 'text/plain',
      '.html': 'text/html',
      '.mp3': 'audio/mpeg',
      '.mp4': 'video/mp4',
    }[ext] || 'application/octet-stream'

    // Create a streaming response
    const { stream } = createSafeReadStream(filePath, { timeout: 60000 })
    
    // Convert Node.js ReadStream to Web ReadableStream
    const readableStream = new ReadableStream({
      start(controller) {
        stream.on('data', (chunk) => {
          controller.enqueue(new Uint8Array(chunk))
        })
        
        stream.on('end', () => {
          controller.close()
        })
        
        stream.on('error', (error) => {
          log('Stream error:', error)
          controller.error(error)
        })
      },
      
      cancel() {
        stream.destroy()
      }
    })

    // Return streaming response with appropriate headers
    return new NextResponse(readableStream, {
      headers: {
        'Content-Type': contentType,
        'Content-Length': String(stats.size),
        'Content-Disposition': `inline; filename="${fileName}"`,
        'Cache-Control': 'public, max-age=31536000',
      },
    })

  } catch (error) {
    log('Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
