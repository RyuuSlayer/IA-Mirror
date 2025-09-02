import { Suspense } from 'react'
import SearchBar from '@/components/SearchBar'
import BrowseResults from '@/components/BrowseResults'
import BrowseFilters from '@/components/BrowseFilters'

interface SearchParams {
  q?: string
  mediatype?: string
  sort?: string
  hideDownloaded?: string
  page?: string
}

export default async function BrowsePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const params = await searchParams
  const query = typeof params.q === 'string' ? params.q : ''
  const mediatype = typeof params.mediatype === 'string' ? params.mediatype : ''
  const sort = typeof params.sort === 'string' ? params.sort : '-downloads'
  const hideDownloaded = params.hideDownloaded === 'true'

  return (
    <main className="container-ia">
      <header className="mb-6">
        <h1 className="text-3xl font-bold text-[#2C2C2C]">Browse Internet Archive</h1>
        <p className="mt-2 text-gray-600">Search and discover content from the Internet Archive</p>
      </header>
      <section aria-label="Search results">
        <BrowseResults
        initialQuery={query}
        initialMediaType={mediatype}
        initialSort={sort}
        initialHideDownloaded={hideDownloaded}
      />
      </section>
    </main>
  )
}
