import fs from 'fs'
import path from 'path'
import { readJsonFile } from './utils'
import { writeJsonFileAtomic } from './streamingJson'
import debug from 'debug'

const log = debug('ia-mirror:cache')

interface CacheEntry<T> {
  data: T
  timestamp: number
  ttl: number // Time to live in milliseconds
}

interface CacheConfig {
  maxSize?: number // Maximum number of entries
  defaultTTL?: number // Default TTL in milliseconds
  cleanupInterval?: number // Cleanup interval in milliseconds
}

class Cache<T> {
  private cache = new Map<string, CacheEntry<T>>()
  private config: Required<CacheConfig>
  private cleanupTimer?: NodeJS.Timeout
  private hits = 0
  private misses = 0

  constructor(config: CacheConfig = {}) {
    this.config = {
      maxSize: config.maxSize ?? 1000,
      defaultTTL: config.defaultTTL ?? 5 * 60 * 1000, // 5 minutes
      cleanupInterval: config.cleanupInterval ?? 60 * 1000 // 1 minute
    }
    
    // Start cleanup timer
    this.startCleanup()
  }

  set(key: string, data: T, ttl?: number): void {
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl: ttl ?? this.config.defaultTTL
    }

    // Remove oldest entries if cache is full
    if (this.cache.size >= this.config.maxSize) {
      const oldestKey = this.cache.keys().next().value
      if (oldestKey) {
        this.cache.delete(oldestKey)
      }
    }

    this.cache.set(key, entry)
    log(`Cached entry for key: ${key}`)
  }

  get(key: string): T | null {
    const entry = this.cache.get(key)
    if (!entry) {
      this.misses++
      return null
    }

    // Check if entry has expired
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key)
      log(`Cache entry expired for key: ${key}`)
      this.misses++
      return null
    }

    log(`Cache hit for key: ${key}`)
    this.hits++
    return entry.data
  }

  has(key: string): boolean {
    return this.get(key) !== null
  }

  delete(key: string): boolean {
    const deleted = this.cache.delete(key)
    if (deleted) {
      log(`Deleted cache entry for key: ${key}`)
    }
    return deleted
  }

  clear(): void {
    this.cache.clear()
    log('Cache cleared')
  }

  size(): number {
    return this.cache.size
  }

  private startCleanup(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanup()
    }, this.config.cleanupInterval)
  }

  private cleanup(): void {
    const now = Date.now()
    let removedCount = 0

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key)
        removedCount++
      }
    }

    if (removedCount > 0) {
      log(`Cleaned up ${removedCount} expired cache entries`)
    }
  }

  getStats() {
    const total = this.hits + this.misses
    const hitRate = total > 0 ? ((this.hits / total) * 100).toFixed(2) + '%' : '0%'
    
    return {
      size: this.cache.size,
      hits: this.hits,
      misses: this.misses,
      hitRate,
      maxSize: this.config.maxSize
    }
  }

  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer)
    }
    this.clear()
  }
}

// Persistent file-based cache for larger data
class FileCache<T> {
  private cacheDir: string
  private memoryCache: Cache<T>
  private hits = 0
  private misses = 0

  constructor(cacheDir: string, config: CacheConfig = {}) {
    this.cacheDir = cacheDir
    this.memoryCache = new Cache<T>(config)
    
    // Ensure cache directory exists
    if (!fs.existsSync(cacheDir)) {
      fs.mkdirSync(cacheDir, { recursive: true })
    }
  }

  private getCacheFilePath(key: string): string {
    // Create a safe filename from the key
    const safeKey = key.replace(/[^a-zA-Z0-9-_]/g, '_')
    return path.join(this.cacheDir, `${safeKey}.json`)
  }

  private getCacheMetaPath(key: string): string {
    const safeKey = key.replace(/[^a-zA-Z0-9-_]/g, '_')
    return path.join(this.cacheDir, `${safeKey}.meta.json`)
  }

  async set(key: string, data: T, ttl?: number): Promise<void> {
    const defaultTTL = 30 * 60 * 1000 // 30 minutes for file cache
    const actualTTL = ttl ?? defaultTTL
    
    // Set in memory cache first
    this.memoryCache.set(key, data, actualTTL)

    try {
      // Save to file
      const filePath = this.getCacheFilePath(key)
      const metaPath = this.getCacheMetaPath(key)
      
      const meta = {
        timestamp: Date.now(),
        ttl: actualTTL
      }

      await writeJsonFileAtomic(filePath, data)
      await writeJsonFileAtomic(metaPath, meta)
      
      log(`File cached entry for key: ${key}`)
    } catch (error) {
      log(`Failed to cache to file for key ${key}:`, error)
    }
  }

  async get(key: string): Promise<T | null> {
    // Try memory cache first
    const memoryResult = this.memoryCache.get(key)
    if (memoryResult !== null) {
      this.hits++
      return memoryResult
    }

    try {
      // Try file cache
      const filePath = this.getCacheFilePath(key)
      const metaPath = this.getCacheMetaPath(key)

      if (!fs.existsSync(filePath) || !fs.existsSync(metaPath)) {
        this.misses++
        return null
      }

      const meta = await readJsonFile(metaPath)
      if (!meta || typeof meta.timestamp !== 'number' || typeof meta.ttl !== 'number') {
        this.misses++
        return null
      }

      // Check if file cache entry has expired
      if (Date.now() - meta.timestamp > meta.ttl) {
        // Clean up expired files
        try {
          fs.unlinkSync(filePath)
          fs.unlinkSync(metaPath)
        } catch (cleanupError) {
          log(`Failed to cleanup expired cache files for key ${key}:`, cleanupError)
        }
        log(`File cache entry expired for key: ${key}`)
        this.misses++
        return null
      }

      const data = await readJsonFile(filePath)
      if (data !== null) {
        // Restore to memory cache
        this.memoryCache.set(key, data, meta.ttl - (Date.now() - meta.timestamp))
        log(`File cache hit for key: ${key}`)
        this.hits++
        return data
      }
    } catch (error) {
      log(`Failed to read from file cache for key ${key}:`, error)
    }

    this.misses++
    return null
  }

  async has(key: string): Promise<boolean> {
    return (await this.get(key)) !== null
  }

  async delete(key: string): Promise<boolean> {
    this.memoryCache.delete(key)
    
    try {
      const filePath = this.getCacheFilePath(key)
      const metaPath = this.getCacheMetaPath(key)
      
      let deleted = false
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath)
        deleted = true
      }
      if (fs.existsSync(metaPath)) {
        fs.unlinkSync(metaPath)
        deleted = true
      }
      
      if (deleted) {
        log(`Deleted file cache entry for key: ${key}`)
      }
      return deleted
    } catch (error) {
      log(`Failed to delete file cache for key ${key}:`, error)
      return false
    }
  }

  clear(): void {
    this.memoryCache.clear()
    
    try {
      const files = fs.readdirSync(this.cacheDir)
      for (const file of files) {
        if (file.endsWith('.json')) {
          fs.unlinkSync(path.join(this.cacheDir, file))
        }
      }
      log('File cache cleared')
    } catch (error) {
      log('Failed to clear file cache:', error)
    }
  }

  async getStats() {
    const total = this.hits + this.misses
    const hitRate = total > 0 ? ((this.hits / total) * 100).toFixed(2) + '%' : '0%'
    
    return {
      size: this.memoryCache.size(),
      hits: this.hits,
      misses: this.misses,
      hitRate,
      maxSize: this.memoryCache.getStats().maxSize,
      cacheDir: this.cacheDir
    }
  }

  destroy(): void {
    this.memoryCache.destroy()
  }
}

// Cache instances for different types of data
const CACHE_TTL = {
  METADATA: 30 * 60 * 1000, // 30 minutes
  SEARCH: 5 * 60 * 1000,    // 5 minutes
  API_RESPONSE: 2 * 60 * 1000, // 2 minutes
  HEALTH_CHECK: 30 * 1000   // 30 seconds
}

// Memory caches for frequently accessed data
export const searchCache = new Cache<any>({
  maxSize: 500,
  defaultTTL: CACHE_TTL.SEARCH
})

export const apiCache = new Cache<any>({
  maxSize: 200,
  defaultTTL: CACHE_TTL.API_RESPONSE
})

export const healthCache = new Cache<any>({
  maxSize: 10,
  defaultTTL: CACHE_TTL.HEALTH_CHECK
})

// File cache for metadata (larger data)
let metadataFileCache: FileCache<any> | null = null

export function getMetadataCache(): FileCache<any> {
  if (!metadataFileCache) {
    const cacheDir = path.join(process.cwd(), '.cache', 'metadata')
    metadataFileCache = new FileCache(cacheDir, {
      maxSize: 100, // Memory cache size
      defaultTTL: CACHE_TTL.METADATA
    })
  }
  return metadataFileCache
}

// Utility functions for cache key generation
export function generateCacheKey(prefix: string, params: Record<string, any>): string {
  const sortedParams = Object.keys(params)
    .sort()
    .map(key => `${key}=${params[key]}`)
    .join('&')
  return `${prefix}:${sortedParams}`
}

export function generateSearchCacheKey(
  query: string,
  mediatype?: string,
  sort?: string,
  page?: number,
  size?: number
): string {
  const params = [
    `q:${query}`,
    mediatype && `mt:${mediatype}`,
    sort && `s:${sort}`,
    page && `p:${page}`,
    size && `sz:${size}`
  ].filter(Boolean).join('|')
  
  return `search:${params}`
}

export function generateMetadataCacheKey(identifier: string): string {
  return `metadata:${identifier}`
}

export function generateApiCacheKey(endpoint: string, params?: Record<string, any>): string {
  const paramStr = params ? JSON.stringify(params) : ''
  return `api:${endpoint}:${paramStr}`
}

export function getCacheStats(cache: Cache<any>) {
  return cache.getStats()
}

// Cache warming and preloading utilities
export async function warmCache(): Promise<void> {
  log('Starting cache warming...')
  // This could be extended to preload frequently accessed data
  log('Cache warming completed')
}

// Cache cleanup on startup
export async function clearCacheOnStartup(): Promise<void> {
  log('Clearing all caches on startup...')
  
  // Clear in-memory caches
  searchCache.clear()
  apiCache.clear()
  healthCache.clear()
  
  // Clear file-based metadata cache
  const metadataCache = getMetadataCache()
  await metadataCache.clear()
  
  log('All caches cleared on startup')
}

// Cache statistics helper
export function getAllCacheStats() {
  return {
    search: searchCache.getStats(),
    apiResponse: apiCache.getStats(),
    health: healthCache.getStats(),
    metadata: {
      available: metadataFileCache !== null
    }
  }
}

// Cleanup function for graceful shutdown
export function destroyAllCaches(): void {
  searchCache.destroy()
  apiCache.destroy()
  healthCache.destroy()
  if (metadataFileCache) {
    metadataFileCache.destroy()
  }
  log('All caches destroyed')
}

export { Cache, FileCache, CACHE_TTL }