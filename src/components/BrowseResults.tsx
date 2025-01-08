'use client'

import { useState, useEffect, useRef } from 'react'
import ItemsList from './ItemsList'
import BrowseFilters from './BrowseFilters'

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
}

interface SearchResponse {
  items: Item[]
  total: number
  page: number
  size: number
  pages: number
}

export default function BrowseResults({
  initialQuery = '',
  initialMediaType = '',
  initialSort = '-downloads',
  initialHideDownloaded = false,
}: BrowseResultsProps) {
  const [query, setQuery] = useState(initialQuery)
  const [mediatype, setMediatype] = useState(initialMediaType)
  const [sort, setSort] = useState(initialSort)
  const [hideDownloaded, setHideDownloaded] = useState(initialHideDownloaded)
  const [page, setPage] = useState(1)
  const [results, setResults] = useState<Item[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  useEffect(() => {
    const fetchResults = async () => {
      // Cancel any ongoing search
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }

      // Create new abort controller for this search
      const abortController = new AbortController()
      abortControllerRef.current = abortController

      try {
        setLoading(true)
        setError(null)

        const params = new URLSearchParams({
          q: query,
          mediatype,
          sort,
          hideDownloaded: hideDownloaded.toString(),
          page: page.toString(),
          size: '20',
        })

        const response = await fetch(`/api/remote/browse?${params}`, {
          signal: abortController.signal
        })
        
        if (!response.ok) {
          throw new Error('Failed to fetch results')
        }

        const data: SearchResponse = await response.json()
        // Only update state if this search hasn't been aborted
        if (!abortController.signal.aborted) {
          setResults(data.items)
          setTotal(data.total)
        }
      } catch (error) {
        // Only update error state if this search hasn't been aborted
        if (error instanceof Error && error.name === 'AbortError') {
          console.log('Search aborted')
        } else {
          console.error('Search error:', error)
          setError(error instanceof Error ? error.message : 'Failed to fetch results')
          setResults([])
          setTotal(0)
        }
      } finally {
        // Only update loading state if this search hasn't been aborted
        if (!abortController.signal.aborted) {
          setLoading(false)
        }
      }
    }

    fetchResults()

    // Cleanup function to abort any ongoing search when component unmounts
    // or when search parameters change
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [query, mediatype, sort, hideDownloaded, page])

  const handleSearch = (newQuery: string) => {
    setQuery(newQuery)
    setPage(1)
  }

  const handleMediaTypeChange = (newMediaType: string) => {
    setMediatype(newMediaType)
    setPage(1)
  }

  const handleSortChange = (newSort: string) => {
    setSort(newSort)
    setPage(1)
  }

  const handleHideDownloadedChange = (newHideDownloaded: boolean) => {
    setHideDownloaded(newHideDownloaded)
    setPage(1)
  }

  if (error) {
    return (
      <div className="error-state">
        <p>Error: {error}</p>
      </div>
    )
  }

  return (
    <div className="browse-results">
      <BrowseFilters
        query={query}
        mediatype={mediatype}
        sort={sort}
        hideDownloaded={hideDownloaded}
        onSearch={handleSearch}
        onMediaTypeChange={handleMediaTypeChange}
        onSortChange={handleSortChange}
        onHideDownloadedChange={handleHideDownloadedChange}
      />

      {loading ? (
        <div className="loading-state">
          <p>Loading...</p>
        </div>
      ) : (
        <>
          <div className="results-info">
            {total > 0 && (
              <p>
                Showing {results.length} of {total} items
                {query && ` matching "${query}"`}
              </p>
            )}
          </div>

          <ItemsList items={results} />

          {total > 20 && (
            <div className="pagination">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                Previous
              </button>
              <span>
                Page {page} of {Math.ceil(total / 20)}
              </span>
              <button
                onClick={() => setPage(p => Math.min(Math.ceil(total / 20), p + 1))}
                disabled={page === Math.ceil(total / 20)}
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
