import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { readJsonFile } from '@/lib/utils'
import { log } from '@/lib/logger'
import type { ApiResponse } from '@/types/api'

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
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    log.error('Error loading ignored items', 'ignored-api', { error: errorMessage }, error instanceof Error ? error : undefined)
  }
  return new Set()
}

// Save ignored items to file
function saveIgnoredItems(ignoredItems: Set<string>) {
  try {
    const items = Array.from(ignoredItems)
    fs.writeFileSync(ignoredItemsPath, JSON.stringify(items, null, 2))
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    log.error('Error saving ignored items', 'ignored-api', { error: errorMessage }, error instanceof Error ? error : undefined)
    throw error
  }
}

// GET - Get all ignored items
export async function GET(): Promise<NextResponse<string[] | ApiResponse>> {
  try {
    const ignoredItems = loadIgnoredItems()
    return NextResponse.json(Array.from(ignoredItems))
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    log.error('Error getting ignored items', 'ignored-api', { error: errorMessage }, error instanceof Error ? error : undefined)
    return NextResponse.json(
      { error: 'Failed to get ignored items' },
      { status: 500 }
    )
  }
}

// POST - Add or remove ignored item
export async function POST(request: NextRequest): Promise<NextResponse<ApiResponse>> {
  try {
    const { identifier, action } = await request.json()
    
    if (!identifier || typeof identifier !== 'string') {
      return NextResponse.json(
        { error: 'Invalid identifier' },
        { status: 400 }
      )
    }

    const ignoredItems = loadIgnoredItems()
    
    if (action === 'ignore') {
      ignoredItems.add(identifier)
    } else if (action === 'unignore') {
      ignoredItems.delete(identifier)
    } else {
      return NextResponse.json(
        { error: 'Invalid action. Use "ignore" or "unignore"' },
        { status: 400 }
      )
    }
    
    saveIgnoredItems(ignoredItems)
    
    return NextResponse.json({ 
      success: true, 
      ignored: ignoredItems.has(identifier)
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    log.error('Error updating ignored items', 'ignored-api', { error: errorMessage }, error instanceof Error ? error : undefined)
    return NextResponse.json(
      { error: 'Failed to update ignored items' },
      { status: 500 }
    )
  }
}