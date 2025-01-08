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
    <div className="pagination">
      {currentPage > 1 && (
        <Link href={getPageUrl(currentPage - 1)} className="page-link">
          Previous
        </Link>
      )}

      {pages.map(page => (
        <Link
          key={page}
          href={getPageUrl(page)}
          className={`page-link ${page === currentPage ? 'active' : ''}`}
        >
          {page}
        </Link>
      ))}

      {currentPage < totalPages && (
        <Link href={getPageUrl(currentPage + 1)} className="page-link">
          Next
        </Link>
      )}
    </div>
  )
}
