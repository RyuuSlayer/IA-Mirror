import fs from 'fs'
import { createSafeReadStream } from './streamUtils'
import debug from 'debug'

const log = debug('ia-mirror:lib:streaming-json')

/**
 * Interface for streaming JSON read options
 */
export interface StreamingJsonOptions {
  timeout?: number
  maxSize?: number // Maximum file size to process (in bytes)
}

/**
 * Reads a JSON file using streaming for better memory efficiency
 * Falls back to synchronous reading for small files or when streaming fails
 */
export async function readJsonFileStreaming(
  filePath: string, 
  options: StreamingJsonOptions = {}
): Promise<any> {
  const { timeout = 30000, maxSize = 50 * 1024 * 1024 } = options // 50MB default max
  
  try {
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return null
    }
    
    // Get file stats
    const stats = fs.statSync(filePath)
    
    // For small files (< 1MB), use synchronous reading for better performance
    if (stats.size < 1024 * 1024) {
      log(`Using sync read for small file: ${filePath} (${stats.size} bytes)`)
      const content = fs.readFileSync(filePath, 'utf8')
      return JSON.parse(content)
    }
    
    // Check if file is too large
    if (stats.size > maxSize) {
      throw new Error(`File too large: ${stats.size} bytes (max: ${maxSize})`)
    }
    
    log(`Using streaming read for large file: ${filePath} (${stats.size} bytes)`)
    
    // Use streaming for larger files
    const { stream, cleanup } = createSafeReadStream(filePath, { timeout })
    
    return new Promise((resolve, reject) => {
      let data = ''
      let hasError = false
      
      const handleError = (error: Error) => {
        if (hasError) return
        hasError = true
        log(`Stream error reading ${filePath}:`, error)
        cleanup()
        reject(error)
      }
      
      const handleComplete = () => {
        if (hasError) return
        
        try {
          const parsed = JSON.parse(data)
          cleanup()
          resolve(parsed)
        } catch (parseError) {
          handleError(parseError as Error)
        }
      }
      
      stream.on('data', (chunk: string | Buffer) => {
        if (hasError) return
        data += typeof chunk === 'string' ? chunk : chunk.toString('utf8')
      })
      
      stream.on('end', handleComplete)
      stream.on('error', handleError)
      
      // Set up timeout
      const timeoutHandle = setTimeout(() => {
        handleError(new Error(`Timeout reading file: ${filePath}`))
      }, timeout)
      
      // Clear timeout when done
      stream.on('end', () => clearTimeout(timeoutHandle))
      stream.on('error', () => clearTimeout(timeoutHandle))
    })
    
  } catch (error) {
    log(`Error reading JSON file ${filePath}:`, error)
    
    // Fallback to synchronous reading if streaming fails
    try {
      log(`Falling back to sync read for: ${filePath}`)
      const content = fs.readFileSync(filePath, 'utf8')
      return JSON.parse(content)
    } catch (fallbackError) {
      log(`Fallback also failed for ${filePath}:`, fallbackError)
      return null
    }
  }
}

/**
 * Synchronous JSON file reader with better error handling
 * Used as fallback and for small files
 */
export function readJsonFileSync(filePath: string): any {
  try {
    if (!fs.existsSync(filePath)) {
      return null
    }
    
    const content = fs.readFileSync(filePath, 'utf8')
    return JSON.parse(content)
  } catch (error) {
    log(`Error reading JSON file ${filePath}:`, error)
    return null
  }
}

/**
 * Writes JSON data to file with atomic operations
 * Creates a temporary file first to ensure data integrity
 */
export function writeJsonFileAtomic(filePath: string, data: any): boolean {
  let tempFile: string | null = null
  
  try {
    // Create a temporary file first to ensure atomic writes
    tempFile = `${filePath}.tmp`
    const jsonContent = JSON.stringify(data, null, 2)
    
    // Write to temporary file first
    fs.writeFileSync(tempFile, jsonContent, { encoding: 'utf8', mode: 0o644 })
    
    // Verify the file was written correctly by reading it back
    const writtenContent = fs.readFileSync(tempFile, 'utf8')
    JSON.parse(writtenContent) // Validate JSON structure
    
    // Atomically move temp file to final location
    fs.renameSync(tempFile, filePath)
    tempFile = null // Mark as successfully moved
    
    return true
  } catch (error) {
    log(`Error writing JSON file ${filePath}:`, error)
    
    // Clean up temporary file if it exists
    if (tempFile && fs.existsSync(tempFile)) {
      try {
        fs.unlinkSync(tempFile)
      } catch (cleanupError) {
        log(`Error cleaning up temporary file:`, cleanupError)
      }
    }
    
    return false
  }
}