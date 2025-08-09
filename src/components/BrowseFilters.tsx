'use client'

import { useState, useCallback } from 'react'
import { useRouter, usePathname } from 'next/navigation'

interface BrowseFiltersProps {
  query: string
  mediatype: string
  sort: string
  pageSize: number
  hideDownloaded?: boolean
  hideIgnored?: boolean
  onSearch: (query: string) => void
  onMediaTypeChange: (mediatype: string) => void
  onSortChange: (sort: string) => void
  onPageSizeChange: (pageSize: number) => void
  onHideDownloadedChange?: (hide: boolean) => void
  onHideIgnoredChange?: (hide: boolean) => void
}

export default function BrowseFilters({
  query,
  mediatype,
  sort,
  pageSize,
  hideDownloaded,
  hideIgnored,
  onSearch,
  onMediaTypeChange,
  onSortChange,
  onPageSizeChange,
  onHideDownloadedChange,
  onHideIgnoredChange,
}: BrowseFiltersProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [searchInput, setSearchInput] = useState(query)

  const updateSearchParams = useCallback(
    (updates: Record<string, string>) => {
      const params = new URLSearchParams(window.location.search)
      Object.entries(updates).forEach(([key, value]) => {
        if (value) {
          params.set(key, value)
        } else {
          params.delete(key)
        }
      })
      router.push(`${pathname}?${params.toString()}`)
    },
    [pathname, router]
  )

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault()
      // Always trigger search, even if empty
      onSearch(searchInput)
      if (searchInput) {
        updateSearchParams({ q: searchInput })
      } else {
        // Remove the q parameter if search is empty
        const params = new URLSearchParams(window.location.search)
        params.delete('q')
        router.push(`${pathname}?${params.toString()}`)
      }
    },
    [searchInput, onSearch, updateSearchParams, router, pathname]
  )

  const handleMediaTypeChange = useCallback(
    (value: string) => {
      onMediaTypeChange(value)
      if (value) {
        updateSearchParams({ mediatype: value })
      } else {
        // Remove the mediatype parameter if "All Media Types" is selected
        const params = new URLSearchParams(window.location.search)
        params.delete('mediatype')
        router.push(`${pathname}?${params.toString()}`)
      }
    },
    [onMediaTypeChange, updateSearchParams, router, pathname]
  )

  const handleSortChange = useCallback(
    (value: string) => {
      onSortChange(value)
      updateSearchParams({ sort: value })
    },
    [onSortChange, updateSearchParams]
  )

  const handlePageSizeChange = useCallback(
    (value: number) => {
      onPageSizeChange(value)
      updateSearchParams({ pageSize: value.toString() })
    },
    [onPageSizeChange, updateSearchParams]
  )

  const handleHideDownloadedChange = useCallback(
    (checked: boolean) => {
      if (onHideDownloadedChange) {
        onHideDownloadedChange(checked)
      }
      updateSearchParams({ hideDownloaded: checked.toString() })
    },
    [onHideDownloadedChange, updateSearchParams]
  )

  const handleHideIgnoredChange = useCallback(
    (checked: boolean) => {
      if (onHideIgnoredChange) {
        onHideIgnoredChange(checked)
      }
      updateSearchParams({ hideIgnored: checked.toString() })
    },
    [onHideIgnoredChange, updateSearchParams]
  )

  const clearSearch = useCallback(() => {
    setSearchInput('')
    onSearch('')
    updateSearchParams({ q: '' })
  }, [onSearch, updateSearchParams])

  return (
    <div className="mb-8">
      <div className="mb-6">
        <form onSubmit={handleSubmit} className="flex flex-wrap gap-3">
          <div className="flex-1 min-w-[200px]">
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search items..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md 
                focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <button 
            type="submit" 
            className="px-6 py-2 bg-[#428BCA] text-white rounded-md hover:bg-[#357EBD] 
              transition-colors duration-200"
          >
            Search
          </button>
        </form>
      </div>

      <div className="flex flex-wrap gap-4">
        <select
          value={mediatype}
          onChange={(e) => handleMediaTypeChange(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-md bg-white
            focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="">All Media Types</option>
          <option value="texts">Books</option>
          <option value="movies">Videos</option>
          <option value="audio">Audio</option>
          <option value="software">Software</option>
          <option value="image">Images</option>
          <option value="etree">Concerts</option>
          <option value="data">Data</option>
          <option value="web">Web</option>
          <option value="collection">Collections</option>
        </select>

        <select
          value={sort}
          onChange={(e) => handleSortChange(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-md bg-white
            focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="-downloads">Most Downloads</option>
          <option value="downloads">Least Downloads</option>
          <option value="-date">Newest First</option>
          <option value="date">Oldest First</option>
          <option value="title">Title A-Z</option>
          <option value="-title">Title Z-A</option>
        </select>

        <select
          value={pageSize}
          onChange={(e) => {
                const value = Number(e.target.value)
                const validValue = isNaN(value) ? 20 : Math.max(1, Math.min(100, value))
                handlePageSizeChange(validValue)
              }}
          className="px-3 py-2 border border-gray-300 rounded-md bg-white
            focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="10">10 per page</option>
          <option value="20">20 per page</option>
          <option value="50">50 per page</option>
          <option value="100">100 per page</option>
        </select>

        {hideDownloaded !== undefined && onHideDownloadedChange && (
          <label className="flex items-center gap-2 text-gray-700">
            <input
              type="checkbox"
              checked={hideDownloaded}
              onChange={(e) => handleHideDownloadedChange(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-blue-500
                focus:ring-2 focus:ring-blue-500"
            />
            Hide Downloaded Items
          </label>
        )}

        {hideIgnored !== undefined && onHideIgnoredChange && (
          <label className="flex items-center gap-2 text-gray-700">
            <input
              type="checkbox"
              checked={hideIgnored}
              onChange={(e) => handleHideIgnoredChange(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-blue-500
                focus:ring-2 focus:ring-blue-500"
            />
            Hide Ignored Items
          </label>
        )}
      </div>

      {query && (
        <div className="mt-4 flex items-center gap-2 text-sm text-gray-600">
          <span>Search: {query}</span>
          <button
            onClick={clearSearch}
            className="p-1 hover:text-gray-900"
            title="Clear search"
          >
            ×
          </button>
        </div>
      )}
    </div>
  )
}
