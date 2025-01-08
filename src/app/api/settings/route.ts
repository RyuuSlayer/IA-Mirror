import { NextResponse, NextRequest } from 'next/server'
import fs from 'fs'
import path from 'path'

const CONFIG_FILE = path.join(process.cwd(), 'config.json')

interface Settings {
  storagePath: string
  maxConcurrentDownloads: number
  skipDerivativeFiles: boolean
  skipHashCheck: boolean
}

const DEFAULT_SETTINGS: Settings = {
  storagePath: '',
  maxConcurrentDownloads: 3,
  skipDerivativeFiles: false,
  skipHashCheck: false
}

function readSettings(): Settings {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const data = fs.readFileSync(CONFIG_FILE, 'utf8')
      return JSON.parse(data)
    }
  } catch (error) {
    console.error('Error reading settings:', error)
  }
  return DEFAULT_SETTINGS
}

function writeSettings(settings: Settings): boolean {
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(settings, null, 2))
    return true
  } catch (error) {
    console.error('Error writing settings:', error)
    return false
  }
}

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
      return NextResponse.json(
        { error: 'Storage path is required' },
        { status: 400 }
      )
    }

    if (maxConcurrentDownloads !== undefined && (
      typeof maxConcurrentDownloads !== 'number' ||
      maxConcurrentDownloads < 1
    )) {
      return NextResponse.json(
        { error: 'Max concurrent downloads must be a positive number' },
        { status: 400 }
      )
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
      return NextResponse.json(
        { error: 'Failed to save settings' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error saving settings:', error)
    return NextResponse.json(
      { error: 'Failed to save settings' },
      { status: 500 }
    )
  }
}
