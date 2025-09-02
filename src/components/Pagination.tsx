'use client'

import Link from 'next/link'

interface PaginationProps {
  currentPage: number
  totalPages: number
  baseUrl: string
  query: string
  mediatype: string
  sort: string
  hideDownloaded: boolean
}

export default function Pagination({
  currentPage,
  totalPages,
  baseUrl,
  query,
  mediatype,
  sort,
  hideDownloaded,
}: PaginationProps) {
  const getPageUrl = (page: number) => {
    const params = new URLSearchParams({
      page: page.toString(),
      ...(query && { q: query }),
      ...(mediatype && { mediatype }),
      ...(sort && { sort }),
      ...(hideDownloaded && { hideDownloaded: 'true' }),
    })
    return `${baseUrl}?${params}`
  }

  const pages = []
  for (let i = Math.max(1, currentPage - 2); i <= Math.min(totalPages, currentPage + 2); i++) {
    pages.push(i)
  }

  return (
    <nav className="pagination" role="navigation" aria-label="Pagination navigation">
      <ul className="flex items-center space-x-2">
        {currentPage > 1 && (
          <li>
            <Link 
              href={getPageUrl(currentPage - 1)} 
              className="page-link focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded px-3 py-2"
              aria-label={`Go to previous page, page ${currentPage - 1}`}
            >
              Previous
            </Link>
          </li>
        )}

        {currentPage > 3 && (
          <>
            <li>
              <Link
                href={getPageUrl(1)}
                className="page-link focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded px-3 py-2"
                aria-label="Go to first page, page 1"
              >
                1
              </Link>
            </li>
            {currentPage > 4 && (
              <li>
                <span className="px-3 py-2 text-gray-500" aria-hidden="true">…</span>
              </li>
            )}
          </>
        )}

        {pages.map(page => (
          <li key={page}>
            <Link
              href={getPageUrl(page)}
              className={`page-link focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded px-3 py-2 ${
                page === currentPage ? 'active' : ''
              }`}
              aria-label={page === currentPage ? `Current page, page ${page}` : `Go to page ${page}`}
              aria-current={page === currentPage ? 'page' : undefined}
            >
              {page}
            </Link>
          </li>
        ))}

        {currentPage < totalPages - 2 && (
          <>
            {currentPage < totalPages - 3 && (
              <li>
                <span className="px-3 py-2 text-gray-500" aria-hidden="true">…</span>
              </li>
            )}
            <li>
              <Link
                href={getPageUrl(totalPages)}
                className="page-link focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded px-3 py-2"
                aria-label={`Go to last page, page ${totalPages}`}
              >
                {totalPages}
              </Link>
            </li>
          </>
        )}

        {currentPage < totalPages && (
          <li>
            <Link 
              href={getPageUrl(currentPage + 1)} 
              className="page-link focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded px-3 py-2"
              aria-label={`Go to next page, page ${currentPage + 1}`}
            >
              Next
            </Link>
          </li>
        )}
      </ul>
    </nav>
  )
}
