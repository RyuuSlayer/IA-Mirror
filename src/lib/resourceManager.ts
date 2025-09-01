import debug from 'debug'

const log = debug('ia-mirror:lib:resource-manager')

/**
 * Interface for disposable resources
 */
export interface Disposable {
  dispose(): Promise<void> | void
}

/**
 * Interface for resource cleanup function
 */
export type CleanupFunction = () => Promise<void> | void

/**
 * Resource manager for handling cleanup of long-running operations
 */
export class ResourceManager implements Disposable {
  private resources: Set<Disposable> = new Set()
  private cleanupFunctions: Set<CleanupFunction> = new Set()
  private timers: Set<NodeJS.Timeout> = new Set()
  private intervals: Set<NodeJS.Timeout> = new Set()
  private isDisposed = false

  /**
   * Add a disposable resource to be managed
   */
  addResource(resource: Disposable): void {
    if (this.isDisposed) {
      log('Warning: Adding resource to disposed manager')
      return
    }
    this.resources.add(resource)
  }

  /**
   * Add a cleanup function to be called on disposal
   */
  addCleanup(cleanup: CleanupFunction): void {
    if (this.isDisposed) {
      log('Warning: Adding cleanup to disposed manager')
      return
    }
    this.cleanupFunctions.add(cleanup)
  }

  /**
   * Create a managed timeout that will be automatically cleared on disposal
   */
  setTimeout(callback: () => void, delay: number): NodeJS.Timeout {
    if (this.isDisposed) {
      throw new Error('Cannot create timeout on disposed resource manager')
    }

    const timer = setTimeout(() => {
      this.timers.delete(timer)
      callback()
    }, delay)

    this.timers.add(timer)
    return timer
  }

  /**
   * Create a managed interval that will be automatically cleared on disposal
   */
  setInterval(callback: () => void, delay: number): NodeJS.Timeout {
    if (this.isDisposed) {
      throw new Error('Cannot create interval on disposed resource manager')
    }

    const interval = setInterval(callback, delay)
    this.intervals.add(interval)
    return interval
  }

  /**
   * Clear a specific timeout
   */
  clearTimeout(timer: NodeJS.Timeout): void {
    clearTimeout(timer)
    this.timers.delete(timer)
  }

  /**
   * Clear a specific interval
   */
  clearInterval(interval: NodeJS.Timeout): void {
    clearInterval(interval)
    this.intervals.delete(interval)
  }

  /**
   * Remove a resource from management
   */
  removeResource(resource: Disposable): void {
    this.resources.delete(resource)
  }

  /**
   * Remove a cleanup function from management
   */
  removeCleanup(cleanup: CleanupFunction): void {
    this.cleanupFunctions.delete(cleanup)
  }

  /**
   * Dispose of all managed resources
   */
  async dispose(): Promise<void> {
    if (this.isDisposed) {
      return
    }

    this.isDisposed = true
    const errors: Error[] = []

    // Clear all timers
    for (const timer of this.timers) {
      try {
        clearTimeout(timer)
      } catch (error) {
        errors.push(error instanceof Error ? error : new Error(String(error)))
      }
    }
    this.timers.clear()

    // Clear all intervals
    for (const interval of this.intervals) {
      try {
        clearInterval(interval)
      } catch (error) {
        errors.push(error instanceof Error ? error : new Error(String(error)))
      }
    }
    this.intervals.clear()

    // Run cleanup functions
    for (const cleanup of this.cleanupFunctions) {
      try {
        await cleanup()
      } catch (error) {
        errors.push(error instanceof Error ? error : new Error(String(error)))
        log('Error in cleanup function:', error)
      }
    }
    this.cleanupFunctions.clear()

    // Dispose of resources
    for (const resource of this.resources) {
      try {
        await resource.dispose()
      } catch (error) {
        errors.push(error instanceof Error ? error : new Error(String(error)))
        log('Error disposing resource:', error)
      }
    }
    this.resources.clear()

    // If there were errors, log them but don't throw
    if (errors.length > 0) {
      log(`Resource disposal completed with ${errors.length} errors`)
      for (const error of errors) {
        log('Disposal error:', error.message)
      }
    }
  }

  /**
   * Get the number of managed resources
   */
  get resourceCount(): number {
    return this.resources.size + this.cleanupFunctions.size + this.timers.size + this.intervals.size
  }

  /**
   * Check if the manager has been disposed
   */
  get disposed(): boolean {
    return this.isDisposed
  }
}

/**
 * Utility function to create a disposable wrapper around a resource
 */
export function createDisposable(disposeFunction: CleanupFunction): Disposable {
  return {
    dispose: disposeFunction
  }
}

/**
 * Utility function to run an operation with automatic resource cleanup
 */
export async function withResourceManager<T>(
  operation: (manager: ResourceManager) => Promise<T>
): Promise<T> {
  const manager = new ResourceManager()
  
  try {
    return await operation(manager)
  } finally {
    await manager.dispose()
  }
}

/**
 * Utility function to create a timeout with automatic cleanup
 */
export function createManagedTimeout(
  callback: () => void,
  delay: number,
  manager?: ResourceManager
): { timer: NodeJS.Timeout; cleanup: () => void } {
  if (manager) {
    const timer = manager.setTimeout(callback, delay)
    return {
      timer,
      cleanup: () => manager.clearTimeout(timer)
    }
  }

  const timer = setTimeout(callback, delay)
  return {
    timer,
    cleanup: () => clearTimeout(timer)
  }
}

/**
 * Utility function to create an interval with automatic cleanup
 */
export function createManagedInterval(
  callback: () => void,
  delay: number,
  manager?: ResourceManager
): { interval: NodeJS.Timeout; cleanup: () => void } {
  if (manager) {
    const interval = manager.setInterval(callback, delay)
    return {
      interval,
      cleanup: () => manager.clearInterval(interval)
    }
  }

  const interval = setInterval(callback, delay)
  return {
    interval,
    cleanup: () => clearInterval(interval)
  }
}

/**
 * Global resource manager for application-wide resource tracking
 */
export const globalResourceManager = new ResourceManager()

/**
 * Register cleanup for process termination
 */
if (typeof process !== 'undefined') {
  const handleExit = async () => {
    log('Process termination detected, cleaning up resources...')
    await globalResourceManager.dispose()
  }

  process.on('exit', () => {
    // Synchronous cleanup only
    log('Process exit, performing synchronous cleanup')
  })

  process.on('SIGINT', handleExit)
  process.on('SIGTERM', handleExit)
  process.on('uncaughtException', async (error) => {
    log('Uncaught exception, cleaning up resources:', error)
    await globalResourceManager.dispose()
    process.exit(1)
  })

  process.on('unhandledRejection', async (reason) => {
    log('Unhandled rejection, cleaning up resources:', reason)
    await globalResourceManager.dispose()
    process.exit(1)
  })
}