'use client'

// Cache interface for pagination data
interface CacheEntry<T> {
  data: T
  timestamp: number
  expiresAt: number
}

interface PaginationCacheOptions {
  maxSize?: number
  defaultTTL?: number // Time to live in milliseconds
}

class PaginationCache<T> {
  private cache = new Map<string, CacheEntry<T>>()
  private maxSize: number
  private defaultTTL: number

  constructor(options: PaginationCacheOptions = {}) {
    this.maxSize = options.maxSize || 100
    this.defaultTTL = options.defaultTTL || 5 * 60 * 1000 // 5 minutes
  }

  // Generate cache key from parameters
  private generateKey(params: Record<string, any>): string {
    const sortedParams = Object.keys(params)
      .sort()
      .map(key => `${key}:${params[key]}`)
      .join('|')
    return sortedParams
  }

  // Set cache entry
  set(params: Record<string, any>, data: T, ttl?: number): void {
    const key = this.generateKey(params)
    const now = Date.now()
    const expiresAt = now + (ttl || this.defaultTTL)

    // Remove oldest entries if cache is full
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value
      if (oldestKey) {
        this.cache.delete(oldestKey)
      }
    }

    this.cache.set(key, {
      data,
      timestamp: now,
      expiresAt
    })
  }

  // Get cache entry
  get(params: Record<string, any>): T | null {
    const key = this.generateKey(params)
    const entry = this.cache.get(key)

    if (!entry) {
      return null
    }

    // Check if entry has expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key)
      return null
    }

    return entry.data
  }

  // Check if cache has entry
  has(params: Record<string, any>): boolean {
    return this.get(params) !== null
  }

  // Clear cache
  clear(): void {
    this.cache.clear()
  }

  // Remove expired entries
  cleanup(): void {
    const now = Date.now()
    for (const [key, entry] of Array.from(this.cache.entries())) {
      if (now > entry.expiresAt) {
        this.cache.delete(key)
      }
    }
  }

  // Get cache statistics
  getStats(): {
    size: number
    maxSize: number
    hitRate: number
    entries: Array<{ key: string; timestamp: number; expiresAt: number }>
  } {
    const entries = Array.from(this.cache.entries()).map(([key, entry]) => ({
      key,
      timestamp: entry.timestamp,
      expiresAt: entry.expiresAt
    }))

    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hitRate: 0, // Would need to track hits/misses for accurate calculation
      entries
    }
  }

  // Invalidate cache entries matching pattern
  invalidatePattern(pattern: Partial<Record<string, any>>): void {
    const patternKeys = Object.keys(pattern)
    
    for (const [key] of Array.from(this.cache.entries())) {
      const keyParams = this.parseKey(key)
      const matches = patternKeys.every(patternKey => 
        keyParams[patternKey] === pattern[patternKey]
      )
      
      if (matches) {
        this.cache.delete(key)
      }
    }
  }

  // Parse cache key back to parameters
  private parseKey(key: string): Record<string, any> {
    const params: Record<string, any> = {}
    const pairs = key.split('|')
    
    for (const pair of pairs) {
      const [k, v] = pair.split(':')
      if (k && v !== undefined) {
        params[k] = v
      }
    }
    
    return params
  }
}

// Global cache instances
export const searchCache = new PaginationCache<{
  items: any[]
  total: number
  pages: number
}>({
  maxSize: 200,
  defaultTTL: 10 * 60 * 1000 // 10 minutes for search results
})

export const localItemsCache = new PaginationCache<{
  items: any[]
  total: number
  pages: number
}>({
  maxSize: 100,
  defaultTTL: 5 * 60 * 1000 // 5 minutes for local items
})

// Cache-aware fetch function
export async function cachedFetch<T>(
  cache: PaginationCache<T>,
  params: Record<string, any>,
  fetchFn: () => Promise<T>,
  ttl?: number
): Promise<T> {
  // Try to get from cache first
  const cached = cache.get(params)
  if (cached) {
    return cached
  }

  // Fetch fresh data
  const data = await fetchFn()
  
  // Store in cache
  cache.set(params, data, ttl)
  
  return data
}

// Preload adjacent pages
export async function preloadAdjacentPages<T>(
  cache: PaginationCache<T>,
  currentParams: Record<string, any>,
  fetchFn: (params: Record<string, any>) => Promise<T>,
  options: {
    preloadNext?: boolean
    preloadPrevious?: boolean
    maxPreload?: number
  } = {}
): Promise<void> {
  const {
    preloadNext = true,
    preloadPrevious = true,
    maxPreload = 2
  } = options

  const currentPage = parseInt(currentParams.page || '1', 10)
  const promises: Promise<void>[] = []

  // Preload next pages
  if (preloadNext) {
    for (let i = 1; i <= maxPreload; i++) {
      const nextPage = currentPage + i
      const nextParams = { ...currentParams, page: nextPage.toString() }
      
      if (!cache.has(nextParams)) {
        promises.push(
          fetchFn(nextParams)
            .then(data => cache.set(nextParams, data))
            .catch(() => {}) // Ignore preload errors
        )
      }
    }
  }

  // Preload previous pages
  if (preloadPrevious) {
    for (let i = 1; i <= maxPreload; i++) {
      const prevPage = currentPage - i
      if (prevPage >= 1) {
        const prevParams = { ...currentParams, page: prevPage.toString() }
        
        if (!cache.has(prevParams)) {
          promises.push(
            fetchFn(prevParams)
              .then(data => cache.set(prevParams, data))
              .catch(() => {}) // Ignore preload errors
          )
        }
      }
    }
  }

  // Execute all preload requests in parallel
  await Promise.allSettled(promises)
}

// Cleanup expired entries periodically
if (typeof window !== 'undefined') {
  setInterval(() => {
    searchCache.cleanup()
    localItemsCache.cleanup()
  }, 60 * 1000) // Cleanup every minute
}

export { PaginationCache }