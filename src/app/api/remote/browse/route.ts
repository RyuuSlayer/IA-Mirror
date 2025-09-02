import { NextRequest, NextResponse } from 'next/server'
import { getLocalItems } from '@/lib/localItems'
import { searchItems } from '@/lib/archive'
import fs from 'fs'
import path from 'path'
import debug from 'debug'
import { readJsonFile } from '@/lib/utils'
import { log as logger } from '@/lib/logger'
import type { BrowseResponse, SearchParams, ApiResponse } from '@/types/api'

const debugLog = debug('ia-mirror:api:remote:browse')
const ignoredItemsPath = path.join(process.cwd(), 'ignored-items.json')

// Load ignored items from file
function loadIgnoredItems(): Set<string> {
  try {
    const items = readJsonFile(ignoredItemsPath)
    if (items && Array.isArray(items)) {
      return new Set(items)
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    logger.error('Error loading ignored items', 'remote-browse-api', { error: errorMessage }, error instanceof Error ? error : undefined)
  }
  return new Set()
}

export async function GET(request: NextRequest): Promise<NextResponse<BrowseResponse | ApiResponse>> {
  try {
    const { searchParams } = new URL(request.url, `${request.headers.get('x-forwarded-proto') || 'http'}://${request.headers.get('host') || 'localhost:3000'}`)
    const query = searchParams.get('q') || ''
    const mediatype = searchParams.get('mediatype') || ''
    const sort = searchParams.get('sort') || '-downloads'
    const hideDownloaded = searchParams.get('hideDownloaded') === 'true'
    const hideIgnored = searchParams.get('hideIgnored') === 'true'
    const pageParam = searchParams.get('page') || '1'
  const sizeParam = searchParams.get('size') || '20'
  
  const page = Math.max(1, parseInt(pageParam, 10) || 1)
  const size = Math.max(1, Math.min(500, parseInt(sizeParam, 10) || 20))

    // Set a practical upper limit for page numbers to prevent API issues
    const MAX_PRACTICAL_PAGE = 10000
    
    if (page > MAX_PRACTICAL_PAGE) {
      return NextResponse.json({
        error: `Page ${page} exceeds the maximum practical limit (${MAX_PRACTICAL_PAGE}). Please try a lower page number.`,
        maxPages: MAX_PRACTICAL_PAGE
      }, { status: 400 })
    }
    
    // For moderately high pages, do a quick search to get total count
    if (page > 50) {
      try {
        // Do a quick search with page 1 to get total count
        const quickSearch = await searchItems({
          query,
          mediatype,
          sort,
          page: 1,
          size: 1
        })
        
        const maxPages = Math.min(Math.ceil(quickSearch.total / size), MAX_PRACTICAL_PAGE)
        if (page > maxPages) {
          return NextResponse.json({
            error: `Page ${page} exceeds maximum available pages (${maxPages})`,
            maxPages,
            total: quickSearch.total
          }, { status: 400 })
        }
      } catch (validationError) {
        // If even the validation search fails, return a generic error for high page numbers
        return NextResponse.json({
          error: `Page ${page} is too high. Please try a lower page number.`,
          maxPages: 0
        }, { status: 400 })
      }
    }

    // Search Internet Archive
    const searchResults = await searchItems({
      query,
      mediatype,
      sort,
      page,
      size
    })

    // Get local items to check which are downloaded
    const { items: localItems } = await getLocalItems({ showAll: true }) // Get all local items regardless of type
    const localIdentifiers = new Set(localItems.map(item => item.identifier))
    
    // Get ignored items
    const ignoredIdentifiers = loadIgnoredItems()

    // Mark downloaded and ignored items
    const items = searchResults.items.map(item => ({
      ...item,
      downloaded: localIdentifiers.has(item.identifier),
      ignored: ignoredIdentifiers.has(item.identifier)
    }))

    // Filter items based on preferences
    const filteredItems = items.filter(item => {
      if (hideDownloaded && item.downloaded) return false
      if (hideIgnored && item.ignored) return false
      return true
    })

    // Calculate pagination values
    const total = searchResults.total // Keep the total from search results
    const totalPages = Math.ceil(total / size)

    return NextResponse.json({
      items: filteredItems,
      total,
      page,
      size,
      pages: totalPages
    })

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    logger.error('Browse API error', 'remote-browse-api', { error: errorMessage }, error instanceof Error ? error : undefined)
    return NextResponse.json(
      { error: 'Failed to fetch items' },
      { status: 500 }
    )
  }
}
