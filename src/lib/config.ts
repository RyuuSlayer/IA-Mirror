import fs from 'fs'
import path from 'path'
import { readJsonFile } from './utils'

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
      baseUrl: 'http://localhost:3000'
    }
    
    let tempFile: string | null = null
    
    try {
      // Create directory if it doesn't exist
      const configDir = path.dirname(CONFIG_FILE)
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true })
      }
      
      // Use atomic write for config creation
      tempFile = `${CONFIG_FILE}.tmp`
      const configJson = JSON.stringify(defaultConfig, null, 2)
      
      fs.writeFileSync(tempFile, configJson, { encoding: 'utf8', mode: 0o644 })
      
      // Verify the file was written correctly
      const writtenContent = fs.readFileSync(tempFile, 'utf8')
      JSON.parse(writtenContent) // Validate JSON structure
      
      // Atomically move temp file to final location
      fs.renameSync(tempFile, CONFIG_FILE)
      tempFile = null // Mark as successfully moved
      
      console.log('Created default config.json with sensible defaults')
    } catch (error) {
      console.warn('Could not create default config.json:', error)
      
      // Clean up temporary file if it exists
      if (tempFile && fs.existsSync(tempFile)) {
        try {
          fs.unlinkSync(tempFile)
        } catch (cleanupError) {
          console.error('Error cleaning up temporary config file:', cleanupError)
        }
      }
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
  let tempFile: string | null = null
  
  try {
    // Create a temporary file first to ensure atomic writes
    tempFile = `${CONFIG_FILE}.tmp`
    const settingsJson = JSON.stringify(settings, null, 2)
    
    // Write to temporary file first
    fs.writeFileSync(tempFile, settingsJson, { encoding: 'utf8', mode: 0o644 })
    
    // Verify the file was written correctly by reading it back
    const writtenContent = fs.readFileSync(tempFile, 'utf8')
    JSON.parse(writtenContent) // Validate JSON structure
    
    // Atomically move temp file to final location
    fs.renameSync(tempFile, CONFIG_FILE)
    tempFile = null // Mark as successfully moved
    
    return true
  } catch (error) {
    console.error('Error writing settings:', error)
    
    // Clean up temporary file if it exists
    if (tempFile && fs.existsSync(tempFile)) {
      try {
        fs.unlinkSync(tempFile)
      } catch (cleanupError) {
        console.error('Error cleaning up temporary file:', cleanupError)
      }
    }
    
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
      console.error('Failed to create cache directory:', error)
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
