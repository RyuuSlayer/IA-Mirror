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

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold mb-6">Browse Internet Archive</h1>
      <BrowseResults
        initialQuery={query}
        initialMediaType={mediatype}
        initialSort={sort}
        initialHideDownloaded={hideDownloaded}
        initialHideIgnored={hideIgnored}
      />
    </div>
  )
}
