import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { getLocalItems } from '@/lib/localItems'
import { searchItems } from '@/lib/archive'
import { getConfig } from '@/lib/config'
import debug from 'debug'

const log = debug('ia-mirror:api:browse')
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

function isDerivativeFile(file: any) {
  return file.source === 'derivative' || file.original
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const query = searchParams.get('q') || ''
    const mediatype = searchParams.get('mediatype') || ''
    const sort = searchParams.get('sort') || '-downloads'
    const hideDownloaded = searchParams.get('hideDownloaded') === 'true'
    const hideIgnored = searchParams.get('hideIgnored') === 'true'
    const pageParam = searchParams.get('page') || '1'
  const sizeParam = searchParams.get('size') || '20'
  
  const page = Math.max(1, parseInt(pageParam, 10) || 1)
  const size = Math.max(1, Math.min(100, parseInt(sizeParam, 10) || 20))

    // Always skip derivative files

    // If no query, return local items
    if (!query) {
      const localItems = await getLocalItems({ mediatype, sort, hideDownloaded })
      
      const start = (page - 1) * size
      const items = localItems.items.slice(start, start + size)

      return NextResponse.json({
        items,
        total: localItems.total,
        page,
        size,
        pages: Math.ceil(localItems.total / size)
      })
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

    return NextResponse.json({
      items,
      total: searchResults.total,
      page,
      size,
      pages: Math.ceil(searchResults.total / size)
    })

  } catch (error) {
    console.error('Browse API error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch items' },
      { status: 500 }
    )
  }
}
