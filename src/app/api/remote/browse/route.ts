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
    const items = hideDownloaded 
      ? searchResults.items.filter(item => !localIdentifiers.has(item.identifier))
      : searchResults.items.map(item => ({
          ...item,
          downloaded: localIdentifiers.has(item.identifier)
        }))

    // Adjust total count if we're hiding downloaded items
    const total = hideDownloaded 
      ? items.length  // Use filtered count when hiding downloaded items
      : searchResults.total

    return NextResponse.json({
      items,
      total,
      page,
      size,
      pages: Math.ceil(total / size)
    })

  } catch (error) {
    console.error('Browse API error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch items' },
      { status: 500 }
    )
  }
}
