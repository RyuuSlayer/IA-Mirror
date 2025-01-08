import { NextRequest, NextResponse } from 'next/server'
import path from 'path'
import fs from 'fs'
import debug from 'debug'
import { getConfig } from '@/lib/config'

const log = debug('ia-mirror:api:download')

// Use environment variable or default to S:\Internet Archive
const cacheDir = process.env.CACHE_DIR || 'S:\\Internet Archive'

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
  { params }: { params: { identifier: string } }
) {
  try {
    const resolvedParams = await Promise.resolve(params)
    const identifier = resolvedParams.identifier
    const searchParams = request.nextUrl.searchParams
    const fileName = searchParams.get('file')
    const fileMetadata = searchParams.get('metadata')

    if (!fileName) {
      return NextResponse.json({ error: 'No file specified' }, { status: 400 })
    }

    // Get config to check skipDerivativeFiles setting
    const config = await getConfig()
    const skipDerivativeFiles = config.skipDerivativeFiles || false

    // Check if this is a derivative file that should be skipped
    if (skipDerivativeFiles && fileMetadata) {
      try {
        const metadata = JSON.parse(fileMetadata)
        if (isDerivativeFile(metadata)) {
          return NextResponse.json(
            { error: 'Skipping derivative file based on settings' },
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

    // Get the file path
    const filePath = path.join(itemPath, fileName)
    log('File path:', filePath)

    // Check if file exists and is within the item directory
    if (!fs.existsSync(filePath) || !filePath.startsWith(itemPath)) {
      log('File not found:', filePath)
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }

    // Read file stats
    const stats = fs.statSync(filePath)
    if (!stats.isFile()) {
      log('Not a file:', filePath)
      return NextResponse.json({ error: 'Not a file' }, { status: 400 })
    }

    // Read file
    const fileBuffer = fs.readFileSync(filePath)

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

    // Return file with appropriate headers
    return new NextResponse(fileBuffer, {
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
