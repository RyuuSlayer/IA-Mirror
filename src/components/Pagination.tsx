'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useRef, useEffect } from 'react'

interface PaginationProps {
  currentPage: number
  totalPages: number
  baseUrl: string
  query: string
  mediatype: string
  sort: string
  hideDownloaded: boolean
  hideIgnored?: boolean
}

export default function Pagination({
  currentPage,
  totalPages,
  baseUrl,
  query,
  mediatype,
  sort,
  hideDownloaded,
  hideIgnored = false,
}: PaginationProps) {
  const router = useRouter()
  const [jumpToPage, setJumpToPage] = useState('')
  const [showJumpInput, setShowJumpInput] = useState(false)
  const jumpInputRef = useRef<HTMLInputElement>(null)
  const getPageUrl = (page: number) => {
    const params = new URLSearchParams({
      page: page.toString(),
      ...(query && { q: query }),
      ...(mediatype && { mediatype }),
      ...(sort && { sort }),
      ...(hideDownloaded && { hideDownloaded: 'true' }),
      ...(hideIgnored && { hideIgnored: 'true' }),
    })
    return `${baseUrl}?${params}`
  }

  const handleJumpToPage = (e: React.FormEvent) => {
    e.preventDefault()
    const pageNum = parseInt(jumpToPage, 10)
    if (pageNum >= 1 && pageNum <= totalPages) {
      router.push(getPageUrl(pageNum))
    }
    setJumpToPage('')
    setShowJumpInput(false)
  }

  const getVisiblePages = () => {
    const delta = 2
    const range = []
    const rangeWithDots = []
    
    for (let i = Math.max(2, currentPage - delta); i <= Math.min(totalPages - 1, currentPage + delta); i++) {
      range.push(i)
    }
    
    if (currentPage - delta > 2) {
      rangeWithDots.push(1, '...')
    } else {
      rangeWithDots.push(1)
    }
    
    rangeWithDots.push(...range)
    
    if (currentPage + delta < totalPages - 1) {
      rangeWithDots.push('...', totalPages)
    } else if (totalPages > 1) {
      rangeWithDots.push(totalPages)
    }
    
    return rangeWithDots
  }

  useEffect(() => {
    if (showJumpInput && jumpInputRef.current) {
      jumpInputRef.current.focus()
    }
  }, [showJumpInput])

  const visiblePages = getVisiblePages()

  return (
    <nav className="pagination" role="navigation" aria-label="Pagination navigation">
      <div className="flex flex-col sm:flex-row items-center gap-4">
        {/* Main pagination controls */}
        <ul className="flex items-center space-x-2">
          {/* First page button */}
          {currentPage > 1 && (
            <li>
              <Link 
                href={getPageUrl(1)} 
                className="page-link focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded px-3 py-2 bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"
                aria-label="Go to first page"
                title="First page"
              >
                ««
              </Link>
            </li>
          )}

          {/* Previous page button */}
          {currentPage > 1 && (
            <li>
              <Link 
                href={getPageUrl(currentPage - 1)} 
                className="page-link focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded px-3 py-2 bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"
                aria-label={`Go to previous page, page ${currentPage - 1}`}
              >
                Previous
              </Link>
            </li>
          )}

          {/* Page numbers */}
          {visiblePages.map((page, index) => (
            <li key={index}>
              {page === '...' ? (
                <span className="px-3 py-2 text-gray-500" aria-hidden="true">…</span>
              ) : (
                <Link
                  href={getPageUrl(page as number)}
                  className={`page-link focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded px-3 py-2 border ${
                    page === currentPage 
                      ? 'bg-blue-600 text-white border-blue-600 active' 
                      : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                  aria-label={page === currentPage ? `Current page, page ${page}` : `Go to page ${page}`}
                  aria-current={page === currentPage ? 'page' : undefined}
                >
                  {page}
                </Link>
              )}
            </li>
          ))}

          {/* Next page button */}
          {currentPage < totalPages && (
            <li>
              <Link 
                href={getPageUrl(currentPage + 1)} 
                className="page-link focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded px-3 py-2 bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"
                aria-label={`Go to next page, page ${currentPage + 1}`}
              >
                Next
              </Link>
            </li>
          )}

          {/* Last page button */}
          {currentPage < totalPages && (
            <li>
              <Link 
                href={getPageUrl(totalPages)} 
                className="page-link focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded px-3 py-2 bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"
                aria-label="Go to last page"
                title="Last page"
              >
                »»
              </Link>
            </li>
          )}
        </ul>

        {/* Jump to page functionality for large datasets */}
        {totalPages > 10 && (
          <div className="flex items-center gap-2">
            {!showJumpInput ? (
              <button
                onClick={() => setShowJumpInput(true)}
                className="px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                aria-label="Jump to specific page"
              >
                Jump to page
              </button>
            ) : (
              <form onSubmit={handleJumpToPage} className="flex items-center gap-2">
                <label htmlFor="jump-to-page" className="text-sm text-gray-600">
                  Go to:
                </label>
                <input
                  ref={jumpInputRef}
                  id="jump-to-page"
                  type="number"
                  min="1"
                  max={totalPages}
                  value={jumpToPage}
                  onChange={(e) => setJumpToPage(e.target.value)}
                  className="w-16 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="#"
                  aria-label={`Enter page number (1-${totalPages})`}
                />
                <button
                  type="submit"
                  className="px-2 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  aria-label="Go to entered page"
                >
                  Go
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowJumpInput(false)
                    setJumpToPage('')
                  }}
                  className="px-2 py-1 text-sm bg-gray-300 text-gray-700 rounded hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  aria-label="Cancel jump to page"
                >
                  Cancel
                </button>
              </form>
            )}
          </div>
        )}
      </div>
    </nav>
  )
}
