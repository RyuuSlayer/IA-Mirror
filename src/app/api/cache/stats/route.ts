import { NextResponse } from 'next/server'
import { 
  searchCache, 
  apiCache, 
  healthCache, 
  getMetadataCache,
  getCacheStats 
} from '@/lib/cache'
import type { ApiResponse } from '@/types/api'

interface CacheStatsResponse {
  searchCache: {
    size: number
    hits: number
    misses: number
    hitRate: string
  }
  apiCache: {
    size: number
    hits: number
    misses: number
    hitRate: string
  }
  healthCache: {
    size: number
    hits: number
    misses: number
    hitRate: string
  }
  metadataCache: {
    size: number
    hits: number
    misses: number
    hitRate: string
  }
  timestamp: string
}

export async function GET(): Promise<NextResponse<ApiResponse<CacheStatsResponse>>> {
  try {
    const metadataCache = getMetadataCache()
    
    const searchStats = getCacheStats(searchCache)
    const apiStats = getCacheStats(apiCache)
    const healthStats = getCacheStats(healthCache)
    const metadataStats = await metadataCache.getStats()
    
    const stats: CacheStatsResponse = {
      searchCache: {
        size: searchStats.size,
        hits: searchStats.hits,
        misses: searchStats.misses,
        hitRate: searchStats.hitRate
      },
      apiCache: {
        size: apiStats.size,
        hits: apiStats.hits,
        misses: apiStats.misses,
        hitRate: apiStats.hitRate
      },
      healthCache: {
        size: healthStats.size,
        hits: healthStats.hits,
        misses: healthStats.misses,
        hitRate: healthStats.hitRate
      },
      metadataCache: {
        size: metadataStats.size,
        hits: metadataStats.hits,
        misses: metadataStats.misses,
        hitRate: metadataStats.hitRate
      },
      timestamp: new Date().toISOString()
    }
    
    return NextResponse.json({
      success: true,
      data: stats
    })
  } catch (error) {
    console.error('Error getting cache stats:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get cache stats'
      },
      { status: 500 }
    )
  }
}

export async function DELETE(): Promise<NextResponse<ApiResponse<{ cleared: string[] }>>> {
  try {
    const metadataCache = getMetadataCache()
    
    // Clear all caches
    searchCache.clear()
    apiCache.clear()
    healthCache.clear()
    await metadataCache.clear()
    
    return NextResponse.json({
      success: true,
      data: {
        cleared: ['searchCache', 'apiCache', 'healthCache', 'metadataCache']
      }
    })
  } catch (error) {
    console.error('Error clearing caches:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to clear caches'
      },
      { status: 500 }
    )
  }
}