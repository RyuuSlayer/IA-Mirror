'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useSearchParams, useRouter } from 'next/navigation'
import BrowseFilters from './BrowseFilters'
import debounce from 'lodash/debounce'

interface Item {
  identifier: string
  title: string
  description?: string
  mediatype?: string
  creator?: string
  date?: string
  collection?: string[]
  downloadDate: string
}

interface ItemsResponse {
  items: Item[]
  total: number
}

export default function LocalItemsList() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [items, setItems] = useState<Item[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Get current search params
  const currentSearch = searchParams.get('q') || ''
  const currentMediaType = searchParams.get('mediatype') || ''
  const currentSort = searchParams.get('sort') || '-downloads'
  const currentPage = parseInt(searchParams.get('page') || '1')
  const currentPageSize = parseInt(searchParams.get('pageSize') || '20')
  const showAll = searchParams.get('showAll') === 'true'

  useEffect(() => {
    const fetchItems = async () => {
      try {
        const params = new URLSearchParams()
        if (currentSearch) params.set('search', currentSearch)
        if (currentMediaType) params.set('mediatype', currentMediaType)
        params.set('sort', currentSort)
        params.set('page', currentPage.toString())
        params.set('pageSize', currentPageSize.toString())
        params.set('showAll', showAll.toString())

        const response = await fetch(`/api/items?${params.toString()}`)
        if (!response.ok) {
          throw new Error('Failed to fetch local items')
        }
        const data: ItemsResponse = await response.json()
        setItems(data.items)
        setTotal(data.total)
      } catch (error) {
        console.error('Error fetching local items:', error)
        setError(error instanceof Error ? error.message : 'Failed to fetch local items')
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

  const handleShowAllChange = () => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('showAll', (!showAll).toString())
    router.push(`?${params.toString()}`)
  }

  if (loading) {
    return (
      <div className="loading-state">
        <p>Loading your local items...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="error-state">
        <p>Error: {error}</p>
      </div>
    )
  }

  if (!items?.length) {
    return (
      <div className="empty-state">
        <p>No items in your local archive yet.</p>
        <p>Browse the Internet Archive to download some items!</p>
      </div>
    )
  }

  return (
    <div className="browse-results">
      <BrowseFilters
        query={currentSearch}
        mediatype={currentMediaType}
        sort={currentSort}
        onSearch={handleSearch}
        onMediaTypeChange={handleMediaTypeChange}
        onSortChange={handleSortChange}
      />

      <div className="results-info mb-4">
        {total > 0 && (
          <p>
            Showing {items.length} of {total} items
            {currentSearch && ` matching "${currentSearch}"`}
          </p>
        )}
      </div>

      <div className="items-grid grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {items.map((item) => (
          <div key={item.identifier} className="item-card border rounded-lg p-4 hover:shadow-lg transition-shadow">
            <div className="item-thumbnail mb-4">
              <Image
                src={`https://archive.org/services/img/${item.identifier}`}
                alt={item.title}
                width={160}
                height={160}
                className="thumbnail-img rounded-lg w-full h-40 object-cover"
                unoptimized
                onError={(e) => {
                  const target = e.target as HTMLImageElement
                  target.src = '/placeholder.png'
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

      {!showAll && total > currentPageSize && (
        <div className="pagination flex justify-center items-center space-x-2 mt-6">
          <button
            onClick={() => {
              const params = new URLSearchParams(searchParams.toString())
              params.set('page', (currentPage - 1).toString())
              router.push(`?${params.toString()}`)
            }}
            disabled={currentPage === 1}
            className="px-4 py-2 rounded-lg bg-gray-100 disabled:opacity-50"
          >
            Previous
          </button>
          <span className="text-gray-600">
            Page {currentPage} of {Math.ceil(total / currentPageSize)}
          </span>
          <button
            onClick={() => {
              const params = new URLSearchParams(searchParams.toString())
              params.set('page', (currentPage + 1).toString())
              router.push(`?${params.toString()}`)
            }}
            disabled={currentPage >= Math.ceil(total / currentPageSize)}
            className="px-4 py-2 rounded-lg bg-gray-100 disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}
    </div>
  )
}
