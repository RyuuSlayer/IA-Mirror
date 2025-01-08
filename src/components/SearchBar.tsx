'use client'

import { useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'

interface SearchBarProps {
  defaultValue?: string
}

export default function SearchBar({ defaultValue = '' }: SearchBarProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [query, setQuery] = useState(defaultValue)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const params = new URLSearchParams(window.location.search)
    if (query) {
      params.set('q', query)
    } else {
      params.delete('q')
    }
    router.push(`${pathname}?${params.toString()}`)
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
