import { NextRequest, NextResponse } from 'next/server'
import { getLocalItems } from '@/lib/localItems'
import { searchItems } from '@/lib/archive'
import fs from 'fs'
import path from 'path'
import debug from 'debug'
import type { BrowseResponse, SearchParams, ApiResponse } from '@/types/api'

const log = debug('ia-mirror:api:remote:browse')
const ignoredItemsPath = path.join(process.cwd(), 'ignored-items.json')

// Load ignored items from file
function loadIgnoredItems(): Set<string> {
  try {
    if (fs.existsSync(ignoredItemsPath)) {
      const data = fs.readFileSync(ignoredItemsPath, 'utf8')
      const items = JSON.parse(data)
      return new Set(items)
    }
  } catch (error) {
    console.error('Error loading ignored items:', error)
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
  const size = Math.max(1, Math.min(100, parseInt(sizeParam, 10) || 20))

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
    console.error('Browse API error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch items' },
      { status: 500 }
    )
  }
}
