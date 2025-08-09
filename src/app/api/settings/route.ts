import { NextResponse, NextRequest } from 'next/server'
import path from 'path'
import fs from 'fs'
import { createErrorResponse, createSuccessResponse } from '@/lib/utils'
import { readSettings, writeSettings, Settings } from '@/lib/config'

const CONFIG_FILE = path.join(process.cwd(), 'config.json')

export async function GET() {
  try {
    const settings = readSettings()
    return NextResponse.json({
      storagePath: settings.storagePath || '',
      maxConcurrentDownloads: settings.maxConcurrentDownloads || 3,
      skipDerivativeFiles: settings.skipDerivativeFiles || false,
      skipHashCheck: settings.skipHashCheck || false
    })
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to read settings' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const { storagePath, maxConcurrentDownloads, skipDerivativeFiles, skipHashCheck } = await request.json()
    
    // Validate settings
    if (storagePath === undefined) {
      return createErrorResponse('Storage path is required', 400)
    }

    if (maxConcurrentDownloads !== undefined && (
      typeof maxConcurrentDownloads !== 'number' ||
      maxConcurrentDownloads < 1
    )) {
      return createErrorResponse('Max concurrent downloads must be a positive number', 400)
    }

    // Create settings directory if it doesn't exist
    const settingsDir = path.dirname(CONFIG_FILE)
    if (!fs.existsSync(settingsDir)) {
      fs.mkdirSync(settingsDir, { recursive: true })
    }

    // Save settings
    const settings: Settings = {
      storagePath,
      maxConcurrentDownloads: maxConcurrentDownloads || 3,
      skipDerivativeFiles: skipDerivativeFiles || false,
      skipHashCheck: skipHashCheck || false
    }

    const success = writeSettings(settings)

    if (!success) {
      return createErrorResponse('Failed to save settings', 500)
    }

    return createSuccessResponse()
  } catch (error) {
    console.error('Error saving settings:', error)
    return createErrorResponse('Failed to save settings', 500)
  }
}
