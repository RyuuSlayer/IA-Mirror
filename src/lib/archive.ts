import debug from 'debug'
import type { SearchParams, SearchResult } from '@/types/api'

const log = debug('ia-mirror:lib:archive')

interface SearchResponse {
  items: SearchResult[]
  total: number
}

export async function searchItems({
  query,
  mediatype,
  sort = '-downloads',
  page = 1,
  size = 20
}: SearchParams): Promise<SearchResponse> {
  try {
    const iaUrl = new URL('https://archive.org/advancedsearch.php')
    const searchQuery = []
    
    // Add main query if not empty
    if (query.trim()) {
      const trimmedQuery = query.trim()
      // Check if this is a field-specific query (contains colon)
      const isFieldQuery = /^\w+:/.test(trimmedQuery)
      
      if (isFieldQuery) {
        // Don't quote field-specific queries like "collection:identifier"
        searchQuery.push(trimmedQuery)
      } else {
        // Escape special characters and wrap in quotes if contains spaces
        const processedQuery = trimmedQuery.includes(' ') 
          ? `"${trimmedQuery.replace(/["\\]/g, '\\$&')}"` 
          : trimmedQuery
        searchQuery.push(processedQuery)
      }
    }
    
    // Add mediatype filter if specified and not empty
    if (mediatype && mediatype.trim()) {
      searchQuery.push(`mediatype:${mediatype.trim()}`)
    }

    // If no query and no mediatype, show all items
    if (searchQuery.length === 0) {
      searchQuery.push('*:*')
    }

    iaUrl.searchParams.set('q', searchQuery.join(' AND '))
    iaUrl.searchParams.set('fl[]', 'identifier,title,description,mediatype,creator,date,downloads,collection')
    iaUrl.searchParams.set('sort[]', sort)
    iaUrl.searchParams.set('rows', size.toString())
    iaUrl.searchParams.set('page', page.toString())
    iaUrl.searchParams.set('output', 'json')

    log('Search URL:', iaUrl.toString())

    const response = await fetch(iaUrl.toString())
    if (!response.ok) {
      throw new Error(`Failed to fetch from IA: ${response.status}`)
    }

    const data = await response.json()
    return {
      items: data.response.docs,
      total: data.response.numFound
    }
  } catch (error) {
    log('Search error:', error)
    throw error
  }
}
