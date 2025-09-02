import fs from 'fs'
import path from 'path'
import { readJsonFile } from './utils'
import { writeJsonFileAtomic } from './streamingJson'
import logger from './logger'

const CONFIG_FILE = path.join(process.cwd(), 'config.json')

/**
 * Ensures that a default config.json file exists
 * Creates one with sensible defaults if it doesn't exist
 */
function ensureConfigExists(): void {
  if (!fs.existsSync(CONFIG_FILE)) {
    const defaultConfig = {
      storagePath: path.join(process.cwd(), 'cache'),
      maxConcurrentDownloads: 3,
      skipHashCheck: false,
      baseUrl: 'http://localhost:3000',
      enableFileLogging: false
    }
    
    let tempFile: string | null = null
    
    try {
      // Create directory if it doesn't exist
      const configDir = path.dirname(CONFIG_FILE)
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true })
      }
      
      // Use atomic write for config creation
      if (!writeJsonFileAtomic(CONFIG_FILE, defaultConfig)) {
        throw new Error('Failed to write default config')
      }
      
      logger.info('Created default config.json with sensible defaults', 'Config')
    } catch (error) {
      logger.warn('Could not create default config.json', 'Config', { error: error.message })
    }
  }
}

interface Config {
  cacheDir: string
  maxConcurrentDownloads: number
  skipHashCheck: boolean
  baseUrl: string
}

export interface Settings {
  storagePath: string
  maxConcurrentDownloads: number
  skipHashCheck: boolean
  baseUrl: string
  enableFileLogging: boolean
}

export function readSettings(): Settings {
  // Ensure config file exists with defaults
  ensureConfigExists()
  
  const settings = readJsonFile(CONFIG_FILE)
  
  if (settings) {
    return {
      storagePath: settings.storagePath || path.join(process.cwd(), 'cache'),
      maxConcurrentDownloads: settings.maxConcurrentDownloads || 3,
      skipHashCheck: settings.skipHashCheck || false,
      baseUrl: settings.baseUrl || 'http://localhost:3000'
    }
  }
  
  return { 
    storagePath: path.join(process.cwd(), 'cache'),
    maxConcurrentDownloads: 3,
    skipHashCheck: false,
    baseUrl: 'http://localhost:3000'
  }
}

export function writeSettings(settings: Settings): boolean {
  try {
    return writeJsonFileAtomic(CONFIG_FILE, settings)
  } catch (error) {
    logger.error('Error writing settings', 'Config', { error: error.message }, error)
    return false
  }
}

export async function getConfig(): Promise<Config> {
  const settings = readSettings()
  
  // Use storage path from config, or fallback to environment variable or default
  const cacheDir = settings.storagePath || process.env.CACHE_DIR || path.join(process.cwd(), 'cache')

  // Ensure cache directory exists
  if (!fs.existsSync(cacheDir)) {
    try {
      fs.mkdirSync(cacheDir, { recursive: true })
    } catch (error) {
      logger.error('Failed to create cache directory', 'Config', { cacheDir, error: error.message }, error)
      // If we can't create the configured directory, fall back to default
      return {
        cacheDir: path.join(process.cwd(), 'cache'),
        maxConcurrentDownloads: settings.maxConcurrentDownloads,
        skipHashCheck: settings.skipHashCheck,
        baseUrl: settings.baseUrl
      }
    }
  }

  return {
    cacheDir,
    maxConcurrentDownloads: settings.maxConcurrentDownloads,
    skipHashCheck: settings.skipHashCheck,
    baseUrl: settings.baseUrl
  }
}

export function getBaseUrl(): string {
  const settings = readSettings()
  return settings.baseUrl
}
