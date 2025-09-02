'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useSearchParams, useRouter } from 'next/navigation'
import BrowseFilters from './BrowseFilters'
import ErrorBoundary from './ErrorBoundary'
import SkeletonLoader from './SkeletonLoader'
import Pagination from './Pagination'
import debounce from 'lodash/debounce'
import { retryFetch, RETRY_CONFIGS } from '@/lib/retry'
import { localItemsCache, cachedFetch, preloadAdjacentPages } from '@/lib/paginationCache'
import { log } from '@/lib/logger'
import type { LocalItem, PaginatedResponse } from '@/types/api'

type Item = LocalItem
type ItemsResponse = PaginatedResponse<LocalItem>

export default function LocalItemsList() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [items, setItems] = useState<Item[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'grid' | 'row'>('grid')

  // Get current search params
  const currentSearch = searchParams.get('q') || ''
  const currentMediaType = searchParams.get('mediatype') || ''
  const currentSort = searchParams.get('sort') || '-downloads'
  const pageParam = searchParams.get('page') || '1'
  const pageSizeParam = searchParams.get('pageSize') || '20'
  
  const currentPage = Math.max(1, parseInt(pageParam, 10) || 1)
  const currentPageSize = Math.max(1, Math.min(500, parseInt(pageSizeParam, 10) || 20))
  const showAll = searchParams.get('showAll') === 'true'

  useEffect(() => {
    const fetchItems = async () => {
      try {
        const params = {
          q: currentSearch || '',
          mediatype: currentMediaType || '',
          sort: currentSort,
          page: currentPage.toString(),
          pageSize: currentPageSize.toString(),
          showAll: showAll.toString()
        }

        const data = await cachedFetch(
          localItemsCache,
          params,
          async () => {
            const urlParams = new URLSearchParams()
            if (currentSearch) urlParams.set('search', currentSearch)
            if (currentMediaType) urlParams.set('mediatype', currentMediaType)
            urlParams.set('sort', currentSort)
            urlParams.set('page', currentPage.toString())
            urlParams.set('pageSize', currentPageSize.toString())
            urlParams.set('showAll', showAll.toString())

            const response = await retryFetch(`/api/items?${urlParams.toString()}`, {}, RETRY_CONFIGS.METADATA)
            if (!response.ok) {
              const errorText = await response.text()
              throw new Error(`Failed to fetch local items: ${response.status} ${response.statusText}${errorText ? ` - ${errorText}` : ''}`)
            }
            const result: ItemsResponse = await response.json()
            return {
              items: result.items || [],
              total: result.total || 0,
              pages: Math.ceil((result.total || 0) / currentPageSize)
            }
          }
        )

        setItems(data.items)
        setTotal(data.total)
        
        // Preload adjacent pages in the background
        preloadAdjacentPages(
          localItemsCache,
          params,
          async (preloadParams) => {
            const urlParams = new URLSearchParams()
            if (preloadParams.q) urlParams.set('search', preloadParams.q)
            if (preloadParams.mediatype) urlParams.set('mediatype', preloadParams.mediatype)
            urlParams.set('sort', preloadParams.sort)
            urlParams.set('page', preloadParams.page)
            urlParams.set('pageSize', preloadParams.pageSize)
            urlParams.set('showAll', preloadParams.showAll)

            const response = await retryFetch(`/api/items?${urlParams.toString()}`, {}, RETRY_CONFIGS.METADATA)
            const result = await response.json()
            return {
              items: result.items || [],
              total: result.total || 0,
              pages: Math.ceil((result.total || 0) / parseInt(preloadParams.pageSize, 10))
            }
          },
          { maxPreload: 1 }
        ).catch(() => {}) // Ignore preload errors
        
      } catch (error) {
        log.error('Error fetching local items', 'local-items-list', { error: error instanceof Error ? error.message : String(error) }, error instanceof Error ? error : undefined)
        const errorMessage = error instanceof Error ? error.message : 'Failed to fetch local items'
        setError(`Unable to load local items: ${errorMessage}`)
      } finally {
        setLoading(false)
      }
    }

    fetchItems()
  }, [currentSearch, currentMediaType, currentSort, currentPage, currentPageSize, showAll])

  const handleSearch = (query: string) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('q', query)
    params.set('page', '1') // Reset to first page on search
    router.push(`?${params.toString()}`)
  }

  const handleMediaTypeChange = (mediatype: string) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('mediatype', mediatype)
    params.set('page', '1')
    router.push(`?${params.toString()}`)
  }

  const handleSortChange = (sort: string) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('sort', sort)
    params.set('page', '1')
    router.push(`?${params.toString()}`)
  }

  const handlePageSizeChange = (pageSize: number) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('pageSize', pageSize.toString())
    params.set('page', '1') // Reset to first page when changing page size
    router.push(`?${params.toString()}`)
  }

  const handleShowAllChange = () => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('showAll', (!showAll).toString())
    router.push(`?${params.toString()}`)
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div 
          className="flex flex-col items-center justify-center py-8"
          role="status"
          aria-live="polite"
          aria-label="Loading content"
        >
          <div className="animate-spin rounded-full h-8 w-8 border-4 border-[#428BCA] border-t-transparent mb-4"></div>
          <p className="text-gray-600">Loading your local items...</p>
        </div>
        
        {/* Skeleton loaders */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <SkeletonLoader variant="card" count={6} />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div 
        className="error-state"
        role="alert"
        aria-live="assertive"
        aria-atomic="true"
      >
        <p>Error: {error}</p>
      </div>
    )
  }

  if (!items?.length) {
    return (
      <div 
        className="empty-state"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        <p>No items in your local archive yet.</p>
        <p>Browse the Internet Archive to download some items!</p>
      </div>
    )
  }

  return (
    <ErrorBoundary>
      <div className="browse-results">
        <section aria-label="Search and filter options">
          <BrowseFilters
        query={currentSearch}
        mediatype={currentMediaType}
        sort={currentSort}
        pageSize={currentPageSize}
        onSearch={handleSearch}
        onMediaTypeChange={handleMediaTypeChange}
        onSortChange={handleSortChange}
        onPageSizeChange={handlePageSizeChange}
      />
        </section>

        <section aria-label="View options and results">
          {/* View mode toggle */}
          <div className="mb-4 flex justify-between items-center">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => setViewMode('grid')}
            className={`p-2 rounded ${
              viewMode === 'grid'
                ? 'bg-gray-200 text-gray-800'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
            title="Grid view"
            aria-label="Switch to grid view"
            aria-pressed={viewMode === 'grid'}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
            </svg>
          </button>
          <button
            onClick={() => setViewMode('row')}
            className={`p-2 rounded ${
              viewMode === 'row'
                ? 'bg-gray-200 text-gray-800'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
            title="Row view"
            aria-label="Switch to row view"
            aria-pressed={viewMode === 'row'}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>
      </div>

      <div className="results-info mb-4">
        {total > 0 && (
          <p className="text-sm text-gray-600">
            Showing {((currentPage - 1) * currentPageSize) + 1} to {Math.min(currentPage * currentPageSize, total)} of {total} items
            {currentSearch && ` matching "${currentSearch}"`}
          </p>
        )}
      </div>

      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {items.map((item) => (
            <div key={item.identifier} className="item-card border rounded-lg p-4 hover:shadow-lg transition-shadow">
              <div className="item-thumbnail mb-4">
                <Image
                  src={item.thumbnailFile ? `/api/metadata/${item.identifier}?download=${encodeURIComponent(item.thumbnailFile)}` : `https://archive.org/services/img/${item.identifier}`}
                  alt={item.title}
                  width={160}
                  height={160}
                  className="thumbnail-img rounded-lg w-full h-40 object-cover"
                  unoptimized
                  onError={(e) => {
                    const target = e.target as HTMLImageElement
                    if (target.src.includes('/api/metadata/')) {
                       target.src = `https://archive.org/services/img/${item.identifier}`
                     } else {
                       target.src = '/placeholder.svg'
                     }
                  }}
                />
              </div>
              <div className="item-info">
                <Link
                  href={`/archive/local/items/${item.identifier}`}
                  className="item-title text-lg font-semibold hover:text-blue-500"
                >
                  {item.title}
                </Link>
                {item.creator && (
                  <div className="item-creator text-sm text-gray-600">by {item.creator}</div>
                )}
                {item.date && <div className="item-date text-sm text-gray-500">{item.date}</div>}
                <div className="item-meta mt-2 text-sm">
                  {item.mediatype && (
                    <span className="item-mediatype bg-gray-100 px-2 py-1 rounded mr-2">
                      {item.mediatype}
                    </span>
                  )}
                  <span className="item-downloaded text-gray-500">
                    Downloaded {new Date(item.downloadDate).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {items.map((item) => (
            <div key={item.identifier} className="bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow duration-200 p-4 flex gap-4">
              <div className="flex-shrink-0 w-32 h-32">
                <Image
                  src={item.thumbnailFile ? `/api/metadata/${item.identifier}?download=${encodeURIComponent(item.thumbnailFile)}` : `https://archive.org/services/img/${item.identifier}`}
                  alt={item.title}
                  width={128}
                  height={128}
                  className="w-full h-full object-cover rounded"
                  unoptimized
                  onError={(e) => {
                    const target = e.target as HTMLImageElement
                    if (target.src.includes('/api/metadata/')) {
                       target.src = `https://archive.org/services/img/${item.identifier}`
                     } else {
                       target.src = '/placeholder.svg'
                     }
                  }}
                />
              </div>
              <div className="flex-grow min-w-0">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <Link 
                      href={`/archive/local/items/${item.identifier}`}
                      className="text-lg font-semibold text-blue-600 hover:text-blue-800 line-clamp-2"
                    >
                      {item.title}
                    </Link>
                    {item.creator && (
                      <p className="text-sm text-gray-600 mt-1">
                        by {item.creator}
                      </p>
                    )}
                    {item.description && (
                      <p className="text-sm text-gray-600 mt-2 line-clamp-2">
                        {item.description}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 mt-3">
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
                  <span className="px-2 py-1 text-xs rounded bg-gray-100 text-gray-600">
                    Downloaded {new Date(item.downloadDate).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination controls */}
      {total > 0 && (
        <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">
              Showing {((currentPage - 1) * currentPageSize) + 1} to {Math.min(currentPage * currentPageSize, total)} of {total} results
              {currentSearch && ` matching "${currentSearch}"`}
            </span>
            <select
              value={currentPageSize}
              onChange={(e) => {
                const value = Number(e.target.value)
                const validValue = isNaN(value) ? 20 : Math.max(1, Math.min(500, value))
                handlePageSizeChange(validValue)
              }}
              className="ml-2 px-2 py-1 text-sm border rounded"
            >
              <option value="10">10 per page</option>
              <option value="20">20 per page</option>
              <option value="50">50 per page</option>
              <option value="100">100 per page</option>
              <option value="200">200 per page</option>
              <option value="500">500 per page</option>
            </select>
          </div>
          <Pagination
            currentPage={currentPage}
            totalPages={Math.ceil(total / currentPageSize)}
            baseUrl="/archive/local"
            query={currentSearch}
            mediatype={currentMediaType}
            sort={currentSort}
          />
        </div>
      )}
        </section>
      </div>
    </ErrorBoundary>
  )
}
