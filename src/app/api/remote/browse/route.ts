import { NextRequest, NextResponse } from 'next/server'
import { getLocalItems } from '@/lib/localItems'
import { searchItems } from '@/lib/archive'
import debug from 'debug'

const log = debug('ia-mirror:api:remote:browse')

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const query = searchParams.get('q') || ''
    const mediatype = searchParams.get('mediatype') || ''
    const sort = searchParams.get('sort') || '-downloads'
    const hideDownloaded = searchParams.get('hideDownloaded') === 'true'
    const page = parseInt(searchParams.get('page') || '1')
    const size = parseInt(searchParams.get('size') || '20')

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

    // Mark downloaded items and filter if hideDownloaded is true
    const items = searchResults.items.map(item => ({
      ...item,
      downloaded: localIdentifiers.has(item.identifier)
    }))

    // Filter downloaded items if hideDownloaded is true
    const filteredItems = hideDownloaded 
      ? items.filter(item => !item.downloaded)
      : items

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
