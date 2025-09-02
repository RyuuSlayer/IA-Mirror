import BrowseResults from '@/components/BrowseResults'

interface SearchParams {
  q?: string
  mediatype?: string
  sort?: string
  hideDownloaded?: string
  hideIgnored?: string
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
  const hideIgnored = params.hideIgnored === 'true'
  const initialPage = typeof params.page === 'string' ? parseInt(params.page, 10) : 1

  return (
    <main className="container mx-auto p-4">
      <header className="mb-6">
        <h1 className="text-3xl font-bold">Browse Internet Archive</h1>
        <p className="mt-2 text-gray-600">Search and discover content from the Internet Archive</p>
      </header>
      <section aria-label="Search results">
        <BrowseResults
        initialQuery={query}
        initialMediaType={mediatype}
        initialSort={sort}
        initialHideDownloaded={hideDownloaded}
        initialHideIgnored={hideIgnored}
        initialPage={initialPage}
      />
      </section>
    </main>
  )
}
