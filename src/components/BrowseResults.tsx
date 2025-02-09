'use client'

import { useState, useEffect, useRef } from 'react'
import Image from 'next/image'
import Link from 'next/link'

interface BrowseResultsProps {
  initialQuery?: string
  initialMediaType?: string
  initialSort?: string
  initialHideDownloaded?: boolean
}

interface Item {
  identifier: string
  title: string
  description?: string
  mediatype?: string
  creator?: string
  date?: string
  downloads?: number
  collection?: string[]
  downloaded?: boolean
  thumbnailUrl?: string
}

interface SearchResponse {
  items: Item[]
  total: number
  page: number
  size: number
  pages: number
}

const mediaTypes = [
  { value: '', label: 'All Media Types' },
  { value: 'texts', label: 'Books' },
  { value: 'movies', label: 'Videos' },
  { value: 'audio', label: 'Audio' },
  { value: 'software', label: 'Software' },
  { value: 'image', label: 'Images' },
  { value: 'etree', label: 'Concerts' },
  { value: 'data', label: 'Data' },
  { value: 'web', label: 'Web' },
  { value: 'collection', label: 'Collections' },
]

export default function BrowseResults({
  initialQuery = '',
  initialMediaType = '',
  initialSort = '-downloads',
  initialHideDownloaded = false,
}: BrowseResultsProps) {
  const [query, setQuery] = useState(initialQuery)
  const [mediatype, setMediatype] = useState(initialMediaType)
  const [sort, setSort] = useState(initialSort)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [results, setResults] = useState<Item[]>([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [hideDownloaded, setHideDownloaded] = useState(initialHideDownloaded)
  const [downloadingItems, setDownloadingItems] = useState<Set<string>>(new Set())
  const [viewMode, setViewMode] = useState<'grid' | 'row'>('grid')
  const abortControllerRef = useRef<AbortController | null>(null)

  useEffect(() => {
    const fetchResults = async () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }

      const abortController = new AbortController()
      abortControllerRef.current = abortController

      try {
        setLoading(true)
        setError(null)

        const params = new URLSearchParams({
          q: query,
          mediatype,
          sort,
          page: page.toString(),
          size: pageSize.toString(),
          hideDownloaded: hideDownloaded.toString(),
        })

        const response = await fetch(`/api/remote/browse?${params}`, {
          signal: abortController.signal
        })
        
        if (!response.ok) {
          throw new Error('Failed to fetch results')
        }

        const data: SearchResponse = await response.json()
        if (!abortController.signal.aborted) {
          setResults(data.items)
          setTotal(data.total)
          setTotalPages(data.pages)
        }
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          return
        }
        setError('Failed to fetch results')
        console.error('Search error:', error)
      } finally {
        if (!abortController.signal.aborted) {
          setLoading(false)
        }
      }
    }

    fetchResults()

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [query, mediatype, sort, page, pageSize, hideDownloaded])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setPage(1)
  }

  const handleMediaTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setMediatype(e.target.value)
    setPage(1)
  }

  const handleSortChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSort(e.target.value)
    setPage(1)
  }

  const handlePageSizeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setPageSize(Number(e.target.value))
    setPage(1)
  }

  const handleDownload = async (identifier: string, title: string, mediatype: string | undefined) => {
    if (downloadingItems.has(identifier)) return

    try {
      setDownloadingItems(prev => new Set([...prev, identifier]))

      const response = await fetch('/api/downloads', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          identifier,
          title,
          mediatype: mediatype || 'other' // Ensure we always send a mediatype
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to start download')
      }

      // Keep the downloading state for a short while to show feedback
      setTimeout(() => {
        setDownloadingItems(prev => {
          const next = new Set(prev)
          next.delete(identifier)
          return next
        })
      }, 2000)
    } catch (error) {
      console.error('Download error:', error)
      setDownloadingItems(prev => {
        const next = new Set(prev)
        next.delete(identifier)
        return next
      })
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold mb-6">Browse Internet Archive</h1>

      {/* Search and Filters */}
      <div className="mb-8 space-y-4">
        <form onSubmit={handleSearch} className="flex gap-4">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search..."
            className="flex-1 px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#428BCA]"
          />
          <button
            type="submit"
            className="px-6 py-2 bg-[#428BCA] text-white rounded-md hover:bg-[#357EBD] transition-colors"
          >
            Search
          </button>
        </form>

        <div className="flex flex-wrap gap-4">
          <select
            value={mediatype}
            onChange={handleMediaTypeChange}
            className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#428BCA]"
          >
            {mediaTypes.map(type => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>

          <select
            value={sort}
            onChange={handleSortChange}
            className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#428BCA]"
          >
            <option value="-downloads">Most Downloads</option>
            <option value="downloads">Least Downloads</option>
            <option value="-date">Newest First</option>
            <option value="date">Oldest First</option>
            <option value="titleSorter">Title A-Z</option>
            <option value="-titleSorter">Title Z-A</option>
          </select>

          <select
            value={pageSize}
            onChange={handlePageSizeChange}
            className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#428BCA]"
          >
            <option value="20">20 per page</option>
            <option value="50">50 per page</option>
            <option value="100">100 per page</option>
          </select>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={hideDownloaded}
              onChange={(e) => setHideDownloaded(e.target.checked)}
              className="form-checkbox h-5 w-5 text-[#428BCA] rounded border-gray-300 focus:ring-[#428BCA]"
            />
            <span className="text-gray-700">Hide downloaded items</span>
          </label>
        </div>
      </div>

      {/* View mode toggle and filters */}
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
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>
        
        <div className="flex items-center space-x-4">
          {/* Existing filters */}
        </div>
      </div>

      {/* Results Count */}
      {total > 0 && (
        <div className="mb-4 text-gray-600">
          Showing {(page - 1) * pageSize + 1}-{Math.min(page * pageSize, total)} of {total} results
        </div>
      )}

      {/* Results grid/list */}
      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {results.map((item) => (
            <div key={item.identifier} className="bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow duration-200">
              <div className="aspect-video relative bg-gray-100">
                <Image
                  src={`https://archive.org/services/img/${item.identifier}`}
                  alt={item.title}
                  fill
                  className="object-contain"
                  unoptimized
                />
              </div>

              <div className="p-4">
                <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">
                  {item.mediatype}
                </div>
                <h3 className="text-lg font-medium leading-snug mb-2 line-clamp-2">
                  <Link
                    href={`/archive/remote/details/${item.identifier}`}
                    className="text-[#428BCA] hover:underline"
                  >
                    {item.title}
                  </Link>
                </h3>
                {item.creator && (
                  <p className="text-sm text-gray-600 mb-2">by {item.creator}</p>
                )}
                <div className="flex justify-between items-center">
                  <p className="text-sm text-gray-500">
                    {item.downloads?.toLocaleString()} downloads
                  </p>
                  {!item.downloaded ? (
                    <button
                      onClick={() => handleDownload(item.identifier, item.title, item.mediatype)}
                      disabled={downloadingItems.has(item.identifier)}
                      className={`px-3 py-1 text-white text-sm rounded transition-colors ${
                        downloadingItems.has(item.identifier)
                          ? 'bg-gray-400 cursor-not-allowed'
                          : 'bg-[#428BCA] hover:bg-[#357EBD]'
                      }`}
                    >
                      {downloadingItems.has(item.identifier) ? 'Adding...' : 'Download'}
                    </button>
                  ) : (
                    <span className="px-3 py-1 bg-green-500 text-white text-sm rounded">
                      Downloaded
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {results.map((item) => (
            <div key={item.identifier} className="bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow duration-200 p-4 flex gap-4">
              <div className="flex-shrink-0 w-32 h-32">
                <Image
                  src={`https://archive.org/services/img/${item.identifier}`}
                  alt={item.title}
                  width={128}
                  height={128}
                  className="w-full h-full object-cover rounded"
                  unoptimized
                  onError={(e) => {
                    const target = e.target as HTMLImageElement
                    target.src = '/placeholder.png'
                  }}
                />
              </div>
              <div className="flex-grow min-w-0">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <Link 
                      href={`/archive/remote/items/${item.identifier}`}
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
                  <div className="flex-shrink-0">
                    <button
                      onClick={() => handleDownload(item.identifier, item.title, item.mediatype)}
                      disabled={downloadingItems.has(item.identifier) || item.downloaded}
                      className={`px-3 py-1 rounded text-sm ${
                        item.downloaded
                          ? 'bg-green-100 text-green-800'
                          : downloadingItems.has(item.identifier)
                          ? 'bg-gray-100 text-gray-600 cursor-not-allowed'
                          : 'bg-blue-600 text-white hover:bg-blue-700'
                      }`}
                    >
                      {item.downloaded 
                        ? 'Downloaded' 
                        : downloadingItems.has(item.identifier)
                        ? 'Adding...'
                        : 'Download'}
                    </button>
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
                  {item.downloads !== undefined && (
                    <span className="px-2 py-1 text-xs rounded bg-gray-100 text-gray-600">
                      {item.downloads.toLocaleString()} downloads
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {total > 0 && (
        <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">
              Showing {((page - 1) * pageSize) + 1} to {Math.min(page * pageSize, total)} of {total} results
            </span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value))
                setPage(1) // Reset to first page when changing page size
              }}
              className="ml-2 px-2 py-1 text-sm border rounded"
            >
              <option value="10">10 per page</option>
              <option value="20">20 per page</option>
              <option value="50">50 per page</option>
              <option value="100">100 per page</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className={`px-3 py-1 text-sm rounded ${
                page === 1 
                  ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                  : 'bg-white text-gray-700 hover:bg-gray-100'
              }`}
            >
              Previous
            </button>
            <span className="text-sm text-gray-600">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className={`px-3 py-1 text-sm rounded ${
                page >= totalPages
                  ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                  : 'bg-white text-gray-700 hover:bg-gray-100'
              }`}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
