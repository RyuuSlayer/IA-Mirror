'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { List, RowComponentProps, ListImperativeAPI } from 'react-window'
import type { LocalItem, SearchResult } from '@/types/api'

interface VirtualizedListProps {
  items: (LocalItem | SearchResult)[]
  itemHeight: number
  containerHeight: number
  renderItem: (item: LocalItem | SearchResult, index: number) => React.ReactNode
  loading?: boolean
  onLoadMore?: () => void
  hasNextPage?: boolean
  className?: string
}

interface ItemData {
  items: (LocalItem | SearchResult)[]
  renderItem: (item: LocalItem | SearchResult, index: number) => React.ReactNode
  onLoadMore?: () => void
  hasNextPage?: boolean
}

const VirtualizedItem = ({ index, style, ...rowProps }: { index: number; style: React.CSSProperties } & ItemData) => {
    const { items, renderItem, onLoadMore, hasNextPage } = rowProps
  const item = items[index]

  // Trigger load more when approaching the end
  useEffect(() => {
    if (onLoadMore && hasNextPage && index >= items.length - 5) {
      onLoadMore()
    }
  }, [index, items.length, onLoadMore, hasNextPage])

  if (!item) {
    return (
      <div style={style} className="flex items-center justify-center">
        <div className="animate-pulse bg-gray-200 rounded h-20 w-full"></div>
      </div>
    )
  }

  return (
    <div style={style}>
      {renderItem(item, index)}
    </div>
  )
}

export default function VirtualizedList({
  items,
  itemHeight,
  containerHeight,
  renderItem,
  loading = false,
  onLoadMore,
  hasNextPage = false,
  className = ''
}: VirtualizedListProps) {
  const listRef = useRef<ListImperativeAPI>(null)
  const [isScrolling, setIsScrolling] = useState(false)

  const itemData = useMemo(() => ({
    items,
    renderItem,
    onLoadMore,
    hasNextPage: hasNextPage ?? false
  }), [items, renderItem, onLoadMore, hasNextPage])

  const onItemsRendered = useCallback(({ startIndex, stopIndex }: { startIndex: number; stopIndex: number }) => {
    // Trigger load more when approaching the end
    if (onLoadMore && hasNextPage && stopIndex >= items.length - 5) {
      onLoadMore()
    }
  }, [onLoadMore, hasNextPage, items.length])

  const handleScroll = useCallback(() => {
    setIsScrolling(true)
    const timeoutId = setTimeout(() => setIsScrolling(false), 150)
    return () => clearTimeout(timeoutId)
  }, [])

  // Calculate total height including loading items
  const totalItems = items.length + (loading ? 3 : 0)

  return (
    <div className={`relative ${className}`}>
      {items.length === 0 && !loading ? (
        <div className="flex items-center justify-center h-32 text-gray-500">
          No items found
        </div>
      ) : (
        <List
          listRef={listRef}
          defaultHeight={containerHeight}
          rowCount={totalItems}
          rowHeight={itemHeight}
          rowProps={itemData}
          rowComponent={VirtualizedItem}
          onRowsRendered={onItemsRendered}
          className="scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100"
          style={{ height: containerHeight }}
        />
      )}
      
      {/* Scrolling indicator */}
      {isScrolling && (
        <div className="absolute top-4 right-4 bg-black bg-opacity-75 text-white px-2 py-1 rounded text-sm">
          Scrolling...
        </div>
      )}
      
      {/* Loading indicator */}
      {loading && (
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-white shadow-lg rounded-lg px-4 py-2 flex items-center gap-2">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
          <span className="text-sm text-gray-600">Loading more items...</span>
        </div>
      )}
    </div>
  )
}

// Hook for managing virtualized pagination
export function useVirtualizedPagination({
  fetchItems,
  pageSize = 50,
  initialPage = 1
}: {
  fetchItems: (page: number, size: number) => Promise<{ items: any[], total: number }>
  pageSize?: number
  initialPage?: number
}) {
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [hasNextPage, setHasNextPage] = useState(true)
  const [currentPage, setCurrentPage] = useState(initialPage)
  const [total, setTotal] = useState(0)

  const loadMore = useCallback(async () => {
    if (loading || !hasNextPage) return

    setLoading(true)
    try {
      const result = await fetchItems(currentPage, pageSize)
      
      setItems(prev => {
        // Avoid duplicates by checking if items already exist
        const existingIds = new Set(prev.map(item => item.identifier || item.id))
        const newItems = result.items.filter(item => !existingIds.has(item.identifier || item.id))
        return [...prev, ...newItems]
      })
      
      setTotal(result.total)
      setCurrentPage(prev => prev + 1)
      setHasNextPage(items.length + result.items.length < result.total)
    } catch (error) {
      console.error('Error loading more items:', error)
    } finally {
      setLoading(false)
    }
  }, [currentPage, pageSize, loading, hasNextPage, fetchItems, items.length])

  const reset = useCallback(() => {
    setItems([])
    setCurrentPage(initialPage)
    setHasNextPage(true)
    setTotal(0)
  }, [initialPage])

  // Load initial data
  useEffect(() => {
    if (items.length === 0 && !loading) {
      loadMore()
    }
  }, [items.length, loading, loadMore])

  return {
    items,
    loading,
    hasNextPage,
    total,
    loadMore,
    reset
  }
}