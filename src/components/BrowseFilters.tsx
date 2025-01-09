'use client'

import { useState, useCallback } from 'react'
import { useRouter, usePathname } from 'next/navigation'

interface BrowseFiltersProps {
  query: string
  mediatype: string
  sort: string
  hideDownloaded?: boolean
  onSearch: (query: string) => void
  onMediaTypeChange: (mediatype: string) => void
  onSortChange: (sort: string) => void
  onHideDownloadedChange?: (hide: boolean) => void
}

export default function BrowseFilters({
  query,
  mediatype,
  sort,
  hideDownloaded,
  onSearch,
  onMediaTypeChange,
  onSortChange,
  onHideDownloadedChange,
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

  const handleHideDownloadedChange = useCallback(
    (checked: boolean) => {
      if (onHideDownloadedChange) {
        onHideDownloadedChange(checked)
      }
      updateSearchParams({ hideDownloaded: checked.toString() })
    },
    [onHideDownloadedChange, updateSearchParams]
  )

  const clearSearch = useCallback(() => {
    setSearchInput('')
    onSearch('')
    updateSearchParams({ q: '' })
  }, [onSearch, updateSearchParams])

  return (
    <div className="browse-filters">
      <div className="search-bar">
        <form onSubmit={handleSubmit} className="search-form">
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search items..."
            className="search-input"
          />
          <button type="submit" className="search-button">
            Search
          </button>
        </form>
      </div>

      <div className="filters">
        <select
          value={mediatype}
          onChange={(e) => handleMediaTypeChange(e.target.value)}
          className="mediatype-select"
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
          className="sort-select"
        >
          <option value="-downloads">Most Downloads</option>
          <option value="downloads">Least Downloads</option>
          <option value="-date">Newest First</option>
          <option value="date">Oldest First</option>
          <option value="title">Title A-Z</option>
          <option value="-title">Title Z-A</option>
        </select>

        {hideDownloaded !== undefined && onHideDownloadedChange && (
          <label className="hide-downloaded-label">
            <input
              type="checkbox"
              checked={hideDownloaded}
              onChange={(e) => handleHideDownloadedChange(e.target.checked)}
              className="hide-downloaded-checkbox"
            />
            Hide Downloaded Items
          </label>
        )}
      </div>

      {query && (
        <div className="active-filters">
          <span className="filter-label">Search: {query}</span>
          <button
            onClick={clearSearch}
            className="clear-filter"
            title="Clear search"
          >
            ×
          </button>
        </div>
      )}
    </div>
  )
}
