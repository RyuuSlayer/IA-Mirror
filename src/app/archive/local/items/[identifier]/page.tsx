import { notFound } from 'next/navigation'
import { Metadata } from 'next'
import Image from 'next/image'
import { formatDescriptionForHTML } from '@/lib/utils'
import ItemThumbnail from '@/components/ItemThumbnail'
import LocalItemReader from '@/components/LocalItemReader'

interface ItemMetadata {
  identifier: string
  title: string
  description?: string
  mediatype?: string
  creator?: string
  date?: string
  collections?: string[]
  files?: Array<{
    name: string
    size: number
    format?: string
    source?: string
  }>
  thumbnailFile?: string
}

interface Props {
  params: Promise<{ identifier: string }>
}

// Force dynamic rendering
export const dynamic = 'force-dynamic'
export const revalidate = 0

// Get metadata for an item
async function getMetadata(identifier: string): Promise<ItemMetadata> {
  try {
    const response = await fetch(`http://localhost:3000/api/metadata/${identifier}`, {
      cache: 'no-store',
      next: { revalidate: 0 }
    })

    if (!response.ok) {
      if (response.status === 404) {
        notFound()
      }
      const errorText = await response.text()
      throw new Error(`Failed to fetch metadata for ${identifier}: ${response.status} ${response.statusText}${errorText ? ` - ${errorText}` : ''}`)
    }

    return response.json()
  } catch (error) {
    if (error instanceof Error && error.message.includes('ECONNREFUSED')) {
      throw new Error(`Unable to connect to local server. Please ensure the application is running.`)
    }
    throw error
  }
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const params = await props.params
  const identifier = params.identifier
  try {
    const metadata = await getMetadata(identifier)
    return {
      title: metadata.title || identifier,
      description: metadata.description || `View ${identifier} on Internet Archive Mirror`,
    }
  } catch (error) {
    return {
      title: identifier,
      description: `View ${identifier} on Internet Archive Mirror`,
    }
  }
}

export default async function ItemPage(props: Props) {
  const params = await props.params
  const identifier = params.identifier
  try {
    const metadata = await getMetadata(identifier)
    
    return (
      <div className="min-h-screen bg-[#FAFAFA]">
        <main className="max-w-7xl mx-auto px-4 py-8">
          {/* Breadcrumb */}
          <div className="mb-6 flex items-center text-sm text-gray-600">
            <a href="/archive/local" className="hover:text-blue-600">Local Library</a>
            <span className="mx-2">/</span>
            {metadata.mediatype && (
              <>
                <span className="text-gray-600">{metadata.mediatype}</span>
                <span className="mx-2">/</span>
              </>
            )}
            <span className="text-gray-800">{metadata.title}</span>
          </div>

          {/* Title */}
          <h1 className="text-3xl font-bold text-[#2C2C2C] mb-8">{metadata.title}</h1>

          <div className="flex flex-col lg:flex-row gap-8">
            {/* Left sidebar */}
            <aside className="lg:w-1/3">
              <div className="bg-white rounded-lg shadow-sm p-4">
                <div className="aspect-square relative overflow-hidden rounded-lg">
                  <ItemThumbnail
                    identifier={identifier}
                    thumbnailFile={metadata.thumbnailFile}
                    title={metadata.title}
                    fill={true}
                  />
                </div>
              </div>
            </aside>

            {/* Main content */}
            <main className="lg:w-2/3">
              {/* Metadata section */}
              <section className="bg-white rounded-lg shadow-sm p-6 mb-6">
                <h2 className="text-xl font-semibold mb-4">Details</h2>
                <dl className="grid grid-cols-1 md:grid-cols-[200px_1fr] gap-x-4 gap-y-4">
                  <dt className="text-gray-600">Identifier</dt>
                  <dd className="text-gray-900">{metadata.identifier || identifier}</dd>
                  
                  <dt className="text-gray-600">Title</dt>
                  <dd className="text-gray-900">{metadata.title}</dd>
                  
                  {metadata.creator && (
                    <>
                      <dt className="text-gray-600">Creator</dt>
                      <dd className="text-gray-900">{metadata.creator}</dd>
                    </>
                  )}
                  
                  {metadata.date && (
                    <>
                      <dt className="text-gray-600">Publication Date</dt>
                      <dd className="text-gray-900">{metadata.date}</dd>
                    </>
                  )}
                  
                  {metadata.description && (
                    <>
                      <dt className="text-gray-600">Description</dt>
                      <dd 
                        className="text-gray-900 prose prose-sm max-w-none"
                        dangerouslySetInnerHTML={{ 
                          __html: formatDescriptionForHTML(metadata.description) 
                        }} 
                      />
                    </>
                  )}
                  
                  <dt className="text-gray-600">Collections</dt>
                  <dd className="text-gray-900">
                    {Array.isArray(metadata.collections) && metadata.collections.length > 0 ? (
                      <ul className="list-disc pl-4 space-y-1">
                        {metadata.collections.map((collection, index) => (
                          <li key={index}>{collection}</li>
                        ))}
                      </ul>
                    ) : metadata.collections && !Array.isArray(metadata.collections) ? (
                      <ul className="list-disc pl-4">
                        <li>{metadata.collections}</li>
                      </ul>
                    ) : (
                      'None'
                    )}
                  </dd>
                </dl>
              </section>

              {/* Files section */}
              {metadata.files && metadata.files.length > 0 && (
                <section className="bg-white rounded-lg shadow-sm p-6">
                  <h2 className="text-xl font-semibold mb-4">Available Files</h2>
                  <div className="space-y-2">
                    {metadata.files.map((file, index) => {
                      // Check if file is an ebook format
                      const isEbook = file.name.toLowerCase().match(/\.(pdf|epub|djvu|mobi|azw|azw3|txt|html|htm)$/i)
                      
                      return (
                        <div key={index} className="p-4 rounded-lg border border-gray-200 hover:border-blue-500 hover:shadow-sm transition-all">
                          <div className="flex items-center justify-between">
                            <div className="min-w-0 flex-grow">
                              <div className="text-blue-600 font-medium truncate">
                                {file.name}
                              </div>
                              <div className="text-sm text-gray-500 flex items-center gap-2">
                                {file.size && (
                                  <span>{(file.size / (1024 * 1024)).toFixed(1)} MB</span>
                                )}
                                {file.format && (
                                  <>
                                    <span>•</span>
                                    <span>{file.format}</span>
                                  </>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {isEbook && (
                                <LocalItemReader
                                  identifier={identifier}
                                  fileName={file.name}
                                  title={metadata.title}
                                >
                                  <div
                                    className="p-2 text-purple-600 hover:text-purple-800 hover:bg-purple-50 rounded transition-colors"
                                    title="Read as eBook"
                                  >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                                    </svg>
                                  </div>
                                </LocalItemReader>
                              )}
                              <a
                                href={`/api/metadata/${identifier}?download=${encodeURIComponent(file.name)}`}
                                className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                                download
                                title="Download file"
                              >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                 </svg>
                               </a>
                             </div>
                           </div>
                         </div>
                       )
                      })}
                  </div>
                </section>
              )}
            </main>
          </div>
        </main>
      </div>
    )
  } catch (error) {
    console.error('Error fetching item:', error)
    throw error
  }
}
