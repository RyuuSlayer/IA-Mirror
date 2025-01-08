import fs from 'fs'
import path from 'path'

const CONFIG_FILE = path.join(process.cwd(), 'config.json')

interface Config {
  cacheDir: string
  maxConcurrentDownloads: number
  skipDerivativeFiles: boolean
}

interface Settings {
  storagePath: string
  maxConcurrentDownloads: number
  skipDerivativeFiles: boolean
}

function readSettings(): Settings {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const data = fs.readFileSync(CONFIG_FILE, 'utf8')
      const settings = JSON.parse(data)
      return {
        storagePath: settings.storagePath || '',
        maxConcurrentDownloads: settings.maxConcurrentDownloads || 3,
        skipDerivativeFiles: settings.skipDerivativeFiles || false
      }
    }
  } catch (error) {
    console.error('Error reading settings:', error)
  }
  return { 
    storagePath: '',
    maxConcurrentDownloads: 3,
    skipDerivativeFiles: false
  }
}

export async function getConfig(): Promise<Config> {
  const settings = readSettings()
  
  // Use storage path from config, or fallback to environment variable or default
  const cacheDir = settings.storagePath || process.env.CACHE_DIR || 'C:\\archiveorg'

  // Ensure cache directory exists
  if (!fs.existsSync(cacheDir)) {
    try {
      fs.mkdirSync(cacheDir, { recursive: true })
    } catch (error) {
      console.error('Failed to create cache directory:', error)
      // If we can't create the configured directory, fall back to default
      return {
        cacheDir: 'C:\\archiveorg',
        maxConcurrentDownloads: settings.maxConcurrentDownloads,
        skipDerivativeFiles: settings.skipDerivativeFiles
      }
    }
  }

  return {
    cacheDir,
    maxConcurrentDownloads: settings.maxConcurrentDownloads,
    skipDerivativeFiles: settings.skipDerivativeFiles
  }
}
