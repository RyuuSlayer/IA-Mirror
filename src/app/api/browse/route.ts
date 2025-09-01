import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { getLocalItems } from '@/lib/localItems'
import { searchItems } from '@/lib/archive'
import { getConfig } from '@/lib/config'
import debug from 'debug'
import { 
  validateNumericParam, 
  validateStringParam, 
  validateMediaType,
  validateSortParam,
  checkRateLimit,
  sanitizeInput
} from '@/lib/security'
import { readJsonFile } from '@/lib/utils'
import type { BrowseResponse, SearchParams, ApiResponse } from '@/types/api'

const log = debug('ia-mirror:api:browse')
const ignoredItemsPath = path.join(process.cwd(), 'ignored-items.json')

// Load ignored items from file
function loadIgnoredItems(): Set<string> {
  try {
    const items = readJsonFile(ignoredItemsPath)
    if (items && Array.isArray(items)) {
      return new Set(items)
    }
  } catch (error) {
    console.error('Error loading ignored items:', error)
  }
  return new Set()
}

function isDerivativeFile(file: any) {
  return file.source === 'derivative' || file.original
}

export async function GET(request: NextRequest): Promise<NextResponse<BrowseResponse | ApiResponse>> {
  try {
    // Rate limiting
    const clientIP = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
    if (!checkRateLimit(`browse:${clientIP}`, 100, 60000)) {
      return NextResponse.json(
        { error: 'Rate limit exceeded' },
        { status: 429 }
      )
    }

    const { searchParams: urlSearchParams } = new URL(request.url, `${request.headers.get('x-forwarded-proto') || 'http'}://${request.headers.get('host') || 'localhost:3000'}`)
    
    // Validate and sanitize input parameters
    const rawQuery = urlSearchParams.get('q')
    const query = rawQuery ? sanitizeInput(validateStringParam(rawQuery, 500) || '') : ''
    
    const rawMediatype = urlSearchParams.get('mediatype')
    const mediatype = validateMediaType(rawMediatype) || ''
    
    const rawSort = urlSearchParams.get('sort')
    const sort = validateSortParam(rawSort)
    
    const hideDownloaded = urlSearchParams.get('hideDownloaded') === 'true'
    const hideIgnored = urlSearchParams.get('hideIgnored') === 'true'
    
    const page = validateNumericParam(urlSearchParams.get('page'), 1, 1000) || 1
    const size = validateNumericParam(urlSearchParams.get('size'), 1, 100) || 20

    // Always skip derivative files

    // If no query, return local items
    if (!query) {
      const localItems = await getLocalItems({ mediatype, sort, hideDownloaded })
      
      const start = (page - 1) * size
      const items = localItems.items.slice(start, start + size)

      const response: BrowseResponse = {
        items,
        total: localItems.total,
        page,
        size,
        pages: Math.ceil(localItems.total / size)
      }
      return NextResponse.json(response)
    }

    // Search Internet Archive
    const searchOptions = {
      query,
      mediatype,
      sort,
      page,
      size
    }
    const searchResults = await searchItems(searchOptions)

    // Get local items to check which are downloaded
    const localItems = await getLocalItems({ mediatype })
    const localIdentifiers = new Set(localItems.items.map(item => item.identifier))
    
    // Get ignored items
    const ignoredIdentifiers = loadIgnoredItems()

    // Mark downloaded and ignored items, then filter
    const items = searchResults.items
      .map(item => ({
        ...item,
        downloaded: localIdentifiers.has(item.identifier),
        ignored: ignoredIdentifiers.has(item.identifier)
      }))
      .filter(item => {
        if (hideDownloaded && item.downloaded) return false
        if (hideIgnored && item.ignored) return false
        return true
      })

    const response: BrowseResponse = {
      items,
      total: searchResults.total,
      page,
      size,
      pages: Math.ceil(searchResults.total / size)
    }
    return NextResponse.json(response)

  } catch (error) {
    console.error('Browse API error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch items' },
      { status: 500 }
    )
  }
}
