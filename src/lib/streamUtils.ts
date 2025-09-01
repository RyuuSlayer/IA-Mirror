import fs from 'fs'
import { Readable, Writable, Transform } from 'stream'
import { pipeline } from 'stream/promises'
import debug from 'debug'

const log = debug('ia-mirror:lib:stream-utils')

/**
 * Interface for stream cleanup options
 */
export interface StreamCleanupOptions {
  removeFileOnError?: boolean
  timeout?: number
  retries?: number
  retryDelay?: number
}

/**
 * Interface for stream operation result
 */
export interface StreamOperationResult {
  success: boolean
  error?: Error
  bytesProcessed?: number
}

/**
 * Safely closes a stream with proper error handling
 */
export function safeCloseStream(stream: NodeJS.ReadableStream | NodeJS.WritableStream): Promise<void> {
  return new Promise((resolve) => {
    if (!stream || stream.destroyed) {
      resolve()
      return
    }

    const cleanup = () => {
      stream.removeAllListeners('error')
      stream.removeAllListeners('close')
      resolve()
    }

    stream.on('error', cleanup)
    stream.on('close', cleanup)

    try {
      if ('destroy' in stream && typeof stream.destroy === 'function') {
        stream.destroy()
      } else if ('end' in stream && typeof stream.end === 'function') {
        ;(stream as NodeJS.WritableStream).end()
      }
    } catch (error) {
      log('Error closing stream:', error)
      cleanup()
    }
  })
}

/**
 * Creates a write stream with comprehensive error handling and cleanup
 */
export function createSafeWriteStream(
  filePath: string,
  options: StreamCleanupOptions = {}
): { stream: fs.WriteStream; cleanup: (error?: Error) => Promise<void> } {
  const { removeFileOnError = true, timeout = 30000 } = options
  
  const stream = fs.createWriteStream(filePath)
  let isCompleted = false
  let timeoutHandle: NodeJS.Timeout | null = null

  // Set up timeout if specified
  if (timeout > 0) {
    timeoutHandle = setTimeout(() => {
      if (!isCompleted) {
        const error = new Error(`Write stream timeout after ${timeout}ms`)
        cleanup(error)
      }
    }, timeout)
  }

  const cleanup = async (error?: Error): Promise<void> => {
    if (isCompleted) return
    isCompleted = true

    // Clear timeout
    if (timeoutHandle) {
      clearTimeout(timeoutHandle)
      timeoutHandle = null
    }

    try {
      // Close the stream
      await safeCloseStream(stream)

      // Remove file on error if requested
      if (error && removeFileOnError && fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath)
          log(`Removed partial file: ${filePath}`)
        } catch (unlinkError) {
          log(`Failed to remove partial file: ${unlinkError}`)
        }
      }
    } catch (cleanupError) {
      log(`Error during stream cleanup: ${cleanupError}`)
    }
  }

  // Set up error handling
  stream.on('error', (error) => {
    log(`Write stream error: ${error.message}`)
    cleanup(error)
  })

  return { stream, cleanup }
}

/**
 * Safely pipes streams with comprehensive error handling
 */
export async function safePipeStreams(
  source: Readable,
  destination: Writable,
  options: StreamCleanupOptions = {}
): Promise<StreamOperationResult> {
  const { timeout = 30000, retries = 0, retryDelay = 1000 } = options
  let attempt = 0
  let bytesProcessed = 0

  const attemptPipe = async (): Promise<StreamOperationResult> => {
    try {
      // Track bytes processed
      const trackingTransform = new Transform({
        transform(chunk, encoding, callback) {
          bytesProcessed += chunk.length
          callback(null, chunk)
        }
      })

      // Set up timeout
      const timeoutPromise = timeout > 0 ? new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error(`Pipeline timeout after ${timeout}ms`)), timeout)
      }) : new Promise<never>(() => {})

      // Use pipeline for proper error handling and cleanup
      const pipelinePromise = pipeline(source, trackingTransform, destination)

      await Promise.race([pipelinePromise, timeoutPromise])

      return { success: true, bytesProcessed }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error))
      log(`Pipeline error (attempt ${attempt + 1}): ${err.message}`)
      
      // Retry if configured
      if (attempt < retries) {
        attempt++
        log(`Retrying pipeline operation (attempt ${attempt + 1}/${retries + 1})`)
        
        // Wait before retry
        if (retryDelay > 0) {
          await new Promise(resolve => setTimeout(resolve, retryDelay))
        }
        
        return attemptPipe()
      }
      
      return { success: false, error: err, bytesProcessed }
    }
  }

  return attemptPipe()
}

/**
 * Creates a read stream with error handling and timeout
 */
export function createSafeReadStream(
  filePath: string,
  options: StreamCleanupOptions = {}
): { stream: fs.ReadStream; cleanup: () => Promise<void> } {
  const { timeout = 30000 } = options
  
  const stream = fs.createReadStream(filePath)
  let isCompleted = false
  let timeoutHandle: NodeJS.Timeout | null = null

  // Set up timeout if specified
  if (timeout > 0) {
    timeoutHandle = setTimeout(() => {
      if (!isCompleted) {
        log(`Read stream timeout after ${timeout}ms`)
        cleanup()
      }
    }, timeout)
  }

  const cleanup = async (): Promise<void> => {
    if (isCompleted) return
    isCompleted = true

    // Clear timeout
    if (timeoutHandle) {
      clearTimeout(timeoutHandle)
      timeoutHandle = null
    }

    try {
      await safeCloseStream(stream)
    } catch (error) {
      log(`Error during read stream cleanup: ${error}`)
    }
  }

  // Set up error handling
  stream.on('error', (error) => {
    log(`Read stream error: ${error.message}`)
    cleanup()
  })

  stream.on('end', () => {
    cleanup()
  })

  return { stream, cleanup }
}

/**
 * Utility to handle file operations with automatic cleanup
 */
export async function withFileCleanup<T>(
  operation: () => Promise<T>,
  filePaths: string[],
  cleanupOnError = true
): Promise<T> {
  try {
    return await operation()
  } catch (error) {
    if (cleanupOnError) {
      // Clean up files on error
      for (const filePath of filePaths) {
        try {
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath)
            log(`Cleaned up file: ${filePath}`)
          }
        } catch (cleanupError) {
          log(`Failed to clean up file ${filePath}: ${cleanupError}`)
        }
      }
    }
    throw error
  }
}