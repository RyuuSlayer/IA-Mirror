import fs from 'fs'
import path from 'path'
import { readJsonFile } from './utils'

const CONFIG_FILE = path.join(process.cwd(), 'config.json')

interface Config {
  cacheDir: string
  maxConcurrentDownloads: number
  skipHashCheck: boolean
}

export interface Settings {
  storagePath: string
  maxConcurrentDownloads: number
  skipHashCheck: boolean
}

export function readSettings(): Settings {
  const settings = readJsonFile(CONFIG_FILE)
  
  if (settings) {
    return {
      storagePath: settings.storagePath || '',
      maxConcurrentDownloads: settings.maxConcurrentDownloads || 3,
      skipHashCheck: settings.skipHashCheck || false
    }
  }
  
  return { 
    storagePath: '',
    maxConcurrentDownloads: 3,
    skipHashCheck: false
  }
}

export function writeSettings(settings: Settings): boolean {
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(settings, null, 2))
    return true
  } catch (error) {
    console.error('Error writing settings:', error)
    return false
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
        skipHashCheck: settings.skipHashCheck
      }
    }
  }

  return {
    cacheDir,
    maxConcurrentDownloads: settings.maxConcurrentDownloads,
    skipHashCheck: settings.skipHashCheck
  }
}
