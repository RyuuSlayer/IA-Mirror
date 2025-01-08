import debug from 'debug'

const log = debug('ia-mirror:lib:archive')

interface SearchParams {
  query: string
  mediatype?: string
  sort?: string
  page?: number
  size?: number
}

interface SearchResult {
  identifier: string
  title: string
  description?: string
  mediatype?: string
  creator?: string
  date?: string
  downloads?: number
  collection?: string[]
}

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
      // Escape special characters and wrap in quotes if contains spaces
      const processedQuery = query.trim().includes(' ') 
        ? `"${query.trim().replace(/["\\]/g, '\\$&')}"` 
        : query.trim()
      searchQuery.push(processedQuery)
    }
    
    // Add mediatype filter if specified
    if (mediatype) {
      searchQuery.push(`mediatype:${mediatype}`)
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
