import { NextResponse, NextRequest } from 'next/server'
import debug from 'debug'
import { getLocalItems } from '@/lib/localItems'

const log = debug('ia-mirror:api:items')

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') || searchParams.get('q') || ''
    const mediatype = searchParams.get('mediatype') || ''
    const sort = searchParams.get('sort') || '-downloads'
    const page = parseInt(searchParams.get('page') || '1')
    const pageSize = parseInt(searchParams.get('pageSize') || '20')
    const showAll = searchParams.get('showAll') === 'true'

    // Get items with search, sort, and pagination
    const result = await getLocalItems({
      search,
      mediatype,
      sort,
      page,
      pageSize,
      showAll
    })

    log('Returning items:', result)
    return NextResponse.json(result)
  } catch (error) {
    log('Error getting items:', error)
    return NextResponse.json(
      { error: 'Failed to get items' },
      { status: 500 }
    )
  }
}
