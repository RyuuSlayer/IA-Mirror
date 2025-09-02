'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { searchItems } from '@/lib/archive'
import { retryFetch, RETRY_CONFIGS } from '@/lib/retryFetch'
import type { SearchResult, SearchResponse } from '@/types/api'
import ItemThumbnail from './ItemThumbnail'
import SkeletonLoader from './SkeletonLoader'
import ErrorBoundary from './ErrorBoundary'
import VirtualizedList, { useVirtualizedPagination } from './VirtualizedList'
import { log } from '@/lib/logger'

interface VirtualizedBrowseResultsProps {
  query: string
  mediatype: string
  sort: string
  hideDownloaded: boolean
  hideIgnored: boolean
  pageSize?: number
}

export default function VirtualizedBrowseResults({
  query,
  mediatype,
  sort,
  hideDownloaded,
  hideIgnored,
  pageSize = 50
}: VirtualizedBrowseResultsProps) {
  const [error, setError] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'grid' | 'row'>('grid')

  // Fetch function for virtualized pagination
  const fetchItems = useCallback(async (page: number, size: number) => {
    try {
      setError(null)
      
      const params = new URLSearchParams({
        q: query,
        mediatype,
        sort,
        page: page.toString(),
        size: size.toString(),
        hideDownloaded: hideDownloaded.toString(),
        hideIgnored: hideIgnored.toString()
      })

      const response = await retryFetch(
        `/api/remote/browse?${params}`,
        RETRY_CONFIGS.search
      )

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data: SearchResponse = await response.json()
      
      if (data.error) {
        throw new Error(data.error)
      }

      return {
        items: data.items || [],
        total: data.total || 0
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
      log.error('Search failed', 'virtualized-browse-results', { error: errorMessage, query, mediatype, sort }, error)
      setError(errorMessage)
      throw error
    }
  }, [query, mediatype, sort, hideDownloaded, hideIgnored])

  const {
    items,
    loading,
    hasNextPage,
    total,
    loadMore,
    reset
  } = useVirtualizedPagination({
    fetchItems,
    pageSize,
    initialPage: 1
  })

  // Reset when search parameters change
  useEffect(() => {
    reset()
  }, [query, mediatype, sort, hideDownloaded, hideIgnored, reset])

  // Render individual item
  const renderItem = useCallback((item: SearchResult, index: number) => {
    if (viewMode === 'grid') {
      return (
        <div className="p-4 border-b border-gray-200">
          <ItemThumbnail
            item={item}
            showDownloadButton={true}
            showIgnoreButton={true}
            priority={index < 10}
          />
        </div>
      )
    } else {
      return (
        <div className="p-4 border-b border-gray-200 flex items-center gap-4">
          <div className="flex-shrink-0 w-16 h-16">
            <ItemThumbnail
              item={item}
              showDownloadButton={false}
              showIgnoreButton={false}
              priority={index < 10}
              compact={true}
            />
          </div>
          <div className="flex-grow min-w-0">
            <h3 className="font-medium text-gray-900 truncate">{item.title}</h3>
            <p className="text-sm text-gray-600 truncate">{item.description}</p>
            <div className="flex items-center gap-2 mt-1">
              {item.mediatype && (
                <span className="px-2 py-1 text-xs rounded bg-gray-100 text-gray-600">
                  {item.mediatype}
                </span>
              )}
              {item.date && (
                <span className="px-2 py-1 text-xs rounded bg-gray-100 text-gray-600">
                  {item.date}
                </span>
              )}
            </div>
          </div>
          <div className="flex-shrink-0">
            <ItemThumbnail
              item={item}
              showDownloadButton={true}
              showIgnoreButton={true}
              priority={false}
              actionsOnly={true}
            />
          </div>
        </div>
      )
    }
  }, [viewMode])

  const itemHeight = useMemo(() => {
    return viewMode === 'grid' ? 300 : 120
  }, [viewMode])

  if (error) {
    return (
      <ErrorBoundary>
        <div className="text-center py-8">
          <div className="text-red-600 mb-4">
            <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 19.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">Search Error</h3>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={() => {
              setError(null)
              reset()
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Try Again
          </button>
        </div>
      </ErrorBoundary>
    )
  }

  return (
    <ErrorBoundary>
      <div className="space-y-4">
        {/* Results header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <p className="text-sm text-gray-600">
              {total > 0 ? (
                <>Showing {items.length} of {total.toLocaleString()} results</>
              ) : (
                'No results found'
              )}
              {query && ` for "${query}"`}
            </p>
            {loading && (
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                Loading...
              </div>
            )}
          </div>
          
          {/* View mode toggle */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">View:</span>
            <button
              onClick={() => setViewMode('grid')}
              className={`px-3 py-1 text-sm rounded ${
                viewMode === 'grid'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              Grid
            </button>
            <button
              onClick={() => setViewMode('row')}
              className={`px-3 py-1 text-sm rounded ${
                viewMode === 'row'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              List
            </button>
          </div>
        </div>

        {/* Virtualized results */}
        {items.length > 0 || loading ? (
          <VirtualizedList
            items={items}
            itemHeight={itemHeight}
            containerHeight={600}
            renderItem={renderItem}
            loading={loading}
            onLoadMore={loadMore}
            hasNextPage={hasNextPage}
            className="border border-gray-200 rounded-lg overflow-hidden"
          />
        ) : (
          <div className="text-center py-12">
            <div className="text-gray-400 mb-4">
              <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Results Found</h3>
            <p className="text-gray-600">
              {query ? (
                <>No items found matching "<strong>{query}</strong>". Try adjusting your search terms or filters.</>
              ) : (
                'No items found. Try adjusting your filters.'
              )}
            </p>
          </div>
        )}
      </div>
    </ErrorBoundary>
  )
}