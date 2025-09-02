/**
 * Retry utility for network requests with exponential backoff
 */

import { log } from '@/lib/logger'

export interface RetryOptions {
  maxRetries?: number
  initialDelay?: number
  maxDelay?: number
  backoffFactor?: number
  retryCondition?: (error: any) => boolean
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxRetries: 3,
  initialDelay: 1000, // 1 second
  maxDelay: 30000, // 30 seconds
  backoffFactor: 2,
  retryCondition: (error: any) => {
    // Retry on network errors, timeouts, and 5xx server errors
    if (error instanceof TypeError && error.message.includes('fetch')) {
      return true // Network error
    }
    if (error.name === 'AbortError') {
      return false // Don't retry aborted requests
    }
    if (error.status >= 500 && error.status < 600) {
      return true // Server errors
    }
    if (error.status === 429) {
      return true // Rate limiting
    }
    return false
  }
}

/**
 * Retry a function with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options }
  let lastError: any
  
  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error
      
      // Don't retry on the last attempt
      if (attempt === opts.maxRetries) {
        break
      }
      
      // Check if we should retry this error
      if (!opts.retryCondition(error)) {
        break
      }
      
      // Calculate delay with exponential backoff
      const delay = Math.min(
        opts.initialDelay * Math.pow(opts.backoffFactor, attempt),
        opts.maxDelay
      )
      
      log.warn(`Request failed (attempt ${attempt + 1}/${opts.maxRetries + 1}), retrying in ${delay}ms`, 'retry', { attempt: attempt + 1, maxRetries: opts.maxRetries + 1, delay, error: error.message }, error)
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }
  
  throw lastError
}

/**
 * Retry a fetch request with exponential backoff
 */
export async function retryFetch(
  url: string | URL | Request,
  init?: RequestInit,
  options: RetryOptions = {}
): Promise<Response> {
  return retryWithBackoff(async () => {
    const response = await fetch(url, init)
    
    // Check if response indicates an error that should be retried
    if (!response.ok) {
      const error = new Error(`HTTP ${response.status}: ${response.statusText}`)
      ;(error as any).status = response.status
      ;(error as any).response = response
      throw error
    }
    
    return response
  }, options)
}

/**
 * Retry a fetch request and parse JSON response
 */
export async function retryFetchJson<T = any>(
  url: string | URL | Request,
  init?: RequestInit,
  options: RetryOptions = {}
): Promise<T> {
  const response = await retryFetch(url, init, options)
  return response.json()
}

/**
 * Create a retry wrapper for any async function
 */
export function withRetry<TArgs extends any[], TReturn>(
  fn: (...args: TArgs) => Promise<TReturn>,
  options: RetryOptions = {}
) {
  return async (...args: TArgs): Promise<TReturn> => {
    return retryWithBackoff(() => fn(...args), options)
  }
}

/**
 * Specific retry configurations for different types of requests
 */
export const RETRY_CONFIGS = {
  // For critical API calls that must succeed
  CRITICAL: {
    maxRetries: 5,
    initialDelay: 1000,
    maxDelay: 60000,
    backoffFactor: 2
  },
  
  // For file downloads that can be retried
  DOWNLOAD: {
    maxRetries: 3,
    initialDelay: 2000,
    maxDelay: 30000,
    backoffFactor: 2
  },
  
  // For metadata fetching
  METADATA: {
    maxRetries: 3,
    initialDelay: 1000,
    maxDelay: 15000,
    backoffFactor: 1.5
  },
  
  // For health checks
  HEALTH_CHECK: {
    maxRetries: 2,
    initialDelay: 500,
    maxDelay: 5000,
    backoffFactor: 2
  }
} as const