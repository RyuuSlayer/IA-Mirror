const fs = require('fs')
const { Readable, Writable, Transform } = require('stream')
const { pipeline } = require('stream/promises')
const debug = require('debug')('ia-mirror:lib:stream-utils')

/**
 * Safely closes a stream with proper error handling
 */
function safeCloseStream(stream) {
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
      if (stream.destroy && typeof stream.destroy === 'function') {
        stream.destroy()
      } else if (stream.end && typeof stream.end === 'function') {
        stream.end()
      }
    } catch (error) {
      debug('Error closing stream:', error)
      cleanup()
    }
  })
}

/**
 * Creates a write stream with comprehensive error handling and cleanup
 */
function createSafeWriteStream(filePath, options = {}) {
  const { removeFileOnError = true, timeout = 30000 } = options
  
  const stream = fs.createWriteStream(filePath)
  let isCompleted = false
  let timeoutHandle = null

  // Set up timeout if specified
  if (timeout > 0) {
    timeoutHandle = setTimeout(() => {
      if (!isCompleted) {
        const error = new Error(`Write stream timeout after ${timeout}ms`)
        cleanup(error)
      }
    }, timeout)
  }

  const cleanup = async (error) => {
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
          debug(`Removed partial file: ${filePath}`)
        } catch (unlinkError) {
          debug(`Failed to remove partial file: ${unlinkError}`)
        }
      }
    } catch (cleanupError) {
      debug(`Error during stream cleanup: ${cleanupError}`)
    }
  }

  // Set up error handling
  stream.on('error', (error) => {
    debug(`Write stream error: ${error.message}`)
    cleanup(error)
  })

  return { stream, cleanup }
}

/**
 * Safely pipes streams with comprehensive error handling
 */
async function safePipeStreams(source, destination, options = {}) {
  const { timeout = 30000, retries = 0, retryDelay = 1000 } = options
  let attempt = 0
  let bytesProcessed = 0

  const attemptPipe = async () => {
    try {
      // Track bytes processed
      const trackingTransform = new Transform({
        transform(chunk, encoding, callback) {
          bytesProcessed += chunk.length
          callback(null, chunk)
        }
      })

      // Set up timeout
      const timeoutPromise = timeout > 0 ? new Promise((_, reject) => {
        setTimeout(() => reject(new Error(`Pipeline timeout after ${timeout}ms`)), timeout)
      }) : new Promise(() => {})

      // Use pipeline for proper error handling and cleanup
      const pipelinePromise = pipeline(source, trackingTransform, destination)

      await Promise.race([pipelinePromise, timeoutPromise])

      return { success: true, bytesProcessed }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error))
      debug(`Pipeline error (attempt ${attempt + 1}): ${err.message}`)
      
      // Retry if configured
      if (attempt < retries) {
        attempt++
        debug(`Retrying pipeline operation (attempt ${attempt + 1}/${retries + 1})`)
        
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
function createSafeReadStream(filePath, options = {}) {
  const { timeout = 30000 } = options
  
  const stream = fs.createReadStream(filePath)
  let isCompleted = false
  let timeoutHandle = null

  // Set up timeout if specified
  if (timeout > 0) {
    timeoutHandle = setTimeout(() => {
      if (!isCompleted) {
        debug(`Read stream timeout after ${timeout}ms`)
        cleanup()
      }
    }, timeout)
  }

  const cleanup = async () => {
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
      debug(`Error during read stream cleanup: ${error}`)
    }
  }

  // Set up error handling
  stream.on('error', (error) => {
    debug(`Read stream error: ${error.message}`)
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
async function withFileCleanup(operation, filePaths, cleanupOnError = true) {
  try {
    return await operation()
  } catch (error) {
    if (cleanupOnError) {
      // Clean up files on error
      for (const filePath of filePaths) {
        try {
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath)
            debug(`Cleaned up file: ${filePath}`)
          }
        } catch (cleanupError) {
          debug(`Failed to clean up file ${filePath}: ${cleanupError}`)
        }
      }
    }
    throw error
  }
}

module.exports = {
  safeCloseStream,
  createSafeWriteStream,
  safePipeStreams,
  createSafeReadStream,
  withFileCleanup
}