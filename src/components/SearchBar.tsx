'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, usePathname } from 'next/navigation'

interface SearchBarProps {
  defaultValue?: string
}

export default function SearchBar({ defaultValue = '' }: SearchBarProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [query, setQuery] = useState(defaultValue)
  const [debouncedQuery, setDebouncedQuery] = useState(defaultValue)

  // Debounce the search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query)
    }, 300) // 300ms delay

    return () => clearTimeout(timer)
  }, [query])

  // Perform search when debounced query changes
  const performSearch = useCallback((searchQuery: string) => {
    const params = new URLSearchParams(window.location.search)
    if (searchQuery) {
      params.set('q', searchQuery)
    } else {
      params.delete('q')
    }
    router.push(`${pathname}?${params.toString()}`)
  }, [router, pathname])

  useEffect(() => {
    // Only perform search if the debounced query is different from the initial value
    // and if we're not on the initial load
    if (debouncedQuery !== defaultValue || debouncedQuery === '') {
      performSearch(debouncedQuery)
    }
  }, [debouncedQuery, performSearch, defaultValue])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // Immediately perform search on form submit
    performSearch(query)
  }

  return (
    <form onSubmit={handleSubmit} className="search-box">
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search your local archive..."
        className="search-input"
      />
      <button type="submit" className="search-button">
        Search
      </button>
    </form>
  )
}
