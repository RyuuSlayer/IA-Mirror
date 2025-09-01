import { NextResponse, NextRequest } from 'next/server'
import path from 'path'
import fs from 'fs'
import { createErrorResponse, createSuccessResponse } from '@/lib/utils'
import { readSettings, writeSettings, Settings } from '@/lib/config'
import { 
  sanitizeFilePath, 
  validateNumericParam, 
  validateStringParam,
  checkRateLimit,
  sanitizeInput
} from '@/lib/security'
import type { ApiResponse } from '@/types/api'

const CONFIG_FILE = path.join(process.cwd(), 'config.json')

export async function GET(request: NextRequest): Promise<NextResponse<Settings | ApiResponse>> {
  try {
    // Rate limiting for settings read
    const clientIP = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
    if (!checkRateLimit(`settings-read:${clientIP}`, 30, 60000)) {
      return NextResponse.json(
        { error: 'Rate limit exceeded' },
        { status: 429 }
      )
    }

    const settings = readSettings()
    return NextResponse.json({
      storagePath: settings.storagePath || '',
      maxConcurrentDownloads: settings.maxConcurrentDownloads || 3,
      skipHashCheck: settings.skipHashCheck || false,
      baseUrl: settings.baseUrl || 'http://localhost:3000'
    })
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to read settings' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest): Promise<NextResponse<ApiResponse>> {
  try {
    // Rate limiting for settings write
    const clientIP = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
    if (!checkRateLimit(`settings-write:${clientIP}`, 10, 60000)) {
      return NextResponse.json(
        { error: 'Rate limit exceeded' },
        { status: 429 }
      )
    }

    const body: Partial<Settings> = await request.json()
    const { storagePath: rawStoragePath, maxConcurrentDownloads: rawMaxDownloads, skipHashCheck, baseUrl } = body
    
    console.log('Settings API received:', { rawStoragePath, rawMaxDownloads, skipHashCheck })
    
    // Validate and sanitize inputs
    if (rawStoragePath === undefined) {
      return createErrorResponse('Storage path is required', 400)
    }

    // Validate storage path
    const validatedStoragePath = validateStringParam(rawStoragePath, 500)
    if (!validatedStoragePath) {
      return createErrorResponse('Invalid storage path', 400)
    }

    // Sanitize the storage path to prevent directory traversal
    const storagePath = sanitizeFilePath(validatedStoragePath, process.cwd())
    if (!storagePath) {
      return createErrorResponse('Invalid storage path format', 400)
    }

    // Validate max concurrent downloads
    const maxConcurrentDownloads = validateNumericParam(rawMaxDownloads?.toString() || '3', 1, 50)
    if (rawMaxDownloads !== undefined && !maxConcurrentDownloads) {
      return createErrorResponse('Max concurrent downloads must be a number between 1 and 50', 400)
    }

    // Validate skipHashCheck is boolean
    if (skipHashCheck !== undefined && typeof skipHashCheck !== 'boolean') {
      return createErrorResponse('Skip hash check must be a boolean', 400)
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
      skipHashCheck: skipHashCheck !== undefined ? skipHashCheck : false,
      baseUrl: baseUrl || 'http://localhost:3000'
    }
    console.log('Settings object to save:', settings)

    const success = writeSettings(settings)
    console.log('Write settings result:', success)

    if (!success) {
      return createErrorResponse('Failed to save settings', 500)
    }

    return createSuccessResponse()
  } catch (error) {
    console.error('Error saving settings:', error)
    return createErrorResponse('Failed to save settings', 500)
  }
}
