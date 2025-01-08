import { NextResponse } from 'next/server'
import debug from 'debug'
import { getLocalItems } from '@/lib/localItems'

const log = debug('ia-mirror:api:items')

export async function GET() {
  try {
    // Get all items from all media types
    const items = await getLocalItems({})
    log('Returning items:', items)
    return NextResponse.json(items)
  } catch (error) {
    log('Error getting items:', error)
    return NextResponse.json(
      { error: 'Failed to get items' },
      { status: 500 }
    )
  }
}
