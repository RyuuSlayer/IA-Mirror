import { notFound } from 'next/navigation'
import { Metadata } from 'next'
import Image from 'next/image'
import { formatDescription } from '@/lib/utils'

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
  params: { identifier: string }
}

// Force dynamic rendering
export const dynamic = 'force-dynamic'
export const revalidate = 0

// Get metadata for an item
async function getMetadata(identifier: string): Promise<ItemMetadata> {
  const response = await fetch(`http://localhost:3000/api/metadata/${identifier}`, {
    cache: 'no-store',
    next: { revalidate: 0 }
  })

  if (!response.ok) {
    if (response.status === 404) {
      notFound()
    }
    throw new Error('Failed to fetch item metadata')
  }

  return response.json()
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
      <div className="item-page">
        <header className="item-header">
          <div className="breadcrumb">
            <a href="/archive/local">Local Library</a> {metadata.mediatype && (
              <>&gt; <span className="mediatype">{metadata.mediatype}</span></>
            )} &gt; {metadata.title}
          </div>
          <h1>{metadata.title}</h1>
        </header>

        <div className="item-content">
          <aside className="item-sidebar">
            <div className="item-image">
              {/* Use next/image for the thumbnail */}
              <Image
                src={metadata.thumbnailFile ? `/api/metadata/${identifier}?download=${encodeURIComponent(metadata.thumbnailFile)}` : '/images/placeholder.svg'}
                alt={metadata.title || 'Item thumbnail'}
                width={300}
                height={300}
                className="thumbnail"
                priority
                unoptimized={true}
              />
            </div>
          </aside>

          <main className="item-main">
            <section className="metadata-section">
              <h2>Details</h2>
              <dl className="metadata-list">
                <dt>Identifier</dt>
                <dd>{metadata.identifier || identifier}</dd>
                
                <dt>Title</dt>
                <dd>{metadata.title}</dd>
                
                {metadata.creator && (
                  <>
                    <dt>Creator</dt>
                    <dd>{metadata.creator}</dd>
                  </>
                )}
                
                {metadata.date && (
                  <>
                    <dt>Publication Date</dt>
                    <dd>{metadata.date}</dd>
                  </>
                )}
                
                {metadata.description && (
                  <>
                    <dt>Description</dt>
                    <dd 
                      dangerouslySetInnerHTML={{ 
                        __html: formatDescription(metadata.description) 
                      }} 
                    />
                  </>
                )}
                
                <dt>Collections</dt>
                <dd>
                  {Array.isArray(metadata.collections) && metadata.collections.length > 0 ? (
                    <ul className="collections-list">
                      {metadata.collections.map((collection, index) => (
                        <li key={index}>{collection}</li>
                      ))}
                    </ul>
                  ) : metadata.collections && !Array.isArray(metadata.collections) ? (
                    <ul className="collections-list">
                      <li>{metadata.collections}</li>
                    </ul>
                  ) : (
                    'None'
                  )}
                </dd>
              </dl>
            </section>

            {metadata.files && metadata.files.length > 0 && (
              <section className="files-section">
                <h2>Available Files</h2>
                <div className="files-grid">
                  {metadata.files.map((file, index) => (
                    <a
                      key={index}
                      href={`/api/metadata/${identifier}?download=${encodeURIComponent(file.name)}`}
                      className="file-item"
                      download
                    >
                      <div className="file-info">
                        <span className="file-name">{file.name}</span>
                        <span className="file-size">
                          {(file.size / (1024 * 1024)).toFixed(1)} MB
                        </span>
                        {file.format && (
                          <span className="file-format">{file.format}</span>
                        )}
                      </div>
                    </a>
                  ))}
                </div>
              </section>
            )}
          </main>
        </div>
      </div>
    )
  } catch (error) {
    console.error('Error fetching item:', error)
    throw error
  }
}
