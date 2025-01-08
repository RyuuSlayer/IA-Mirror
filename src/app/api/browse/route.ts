import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { getLocalItems } from '@/lib/localItems'
import { searchItems } from '@/lib/archive'
import { getConfig } from '@/lib/config'
import debug from 'debug'

const log = debug('ia-mirror:api:browse')

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
    const page = parseInt(searchParams.get('page') || '1')
    const size = parseInt(searchParams.get('size') || '20')

    // Get config to check skipDerivativeFiles setting
    const config = await getConfig()
    const skipDerivativeFiles = config.skipDerivativeFiles || false

    // If no query, return local items
    if (!query) {
      const localItems = await getLocalItems({ mediatype, sort, hideDownloaded })
      
      // Filter out derivative files if setting is enabled
      const filteredItems = localItems.map(item => {
        if (skipDerivativeFiles && item.files) {
          item.files = item.files.filter(file => !isDerivativeFile(file))
        }
        return item
      })

      const start = (page - 1) * size
      const items = filteredItems.slice(start, start + size)

      return NextResponse.json({
        items,
        total: filteredItems.length,
        page,
        size,
        pages: Math.ceil(filteredItems.length / size)
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
    const localIdentifiers = new Set(localItems.map(item => item.identifier))

    // Mark downloaded items and filter if hideDownloaded is true
    const items = searchResults.items
      .map(item => {
        // Filter out derivative files if setting is enabled
        if (skipDerivativeFiles && item.files) {
          item.files = item.files.filter(file => !isDerivativeFile(file))
        }
        return {
          ...item,
          downloaded: localIdentifiers.has(item.identifier)
        }
      })
      .filter(item => !hideDownloaded || !item.downloaded)

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
