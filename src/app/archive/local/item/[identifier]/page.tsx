import { notFound } from 'next/navigation'
import Image from 'next/image'
import fs from 'fs'
import path from 'path'

const cacheDir = process.env.CACHE_DIR || 'C:\\archiveorg'

async function getItemMetadata(identifier: string) {
  const metadataPath = path.join(cacheDir, identifier, 'metadata.json')
  
  if (!fs.existsSync(metadataPath)) {
    return null
  }

  try {
    const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'))
    return metadata
  } catch (error) {
    console.error('Error reading metadata:', error)
    return null
  }
}

export default async function ItemPage({
  params,
}: {
  params: { identifier: string }
}) {
  const metadata = await getItemMetadata(params.identifier)
  
  if (!metadata) {
    notFound()
  }

  return (
    <div className="container-ia">
      <div className="item-details">
        <div className="item-header">
          <h1>{metadata.title}</h1>
          {metadata.thumbnail && (
            <div className="item-thumbnail-large">
              <Image
                src={metadata.thumbnail}
                alt={metadata.title}
                width={400}
                height={400}
                className="thumbnail"
              />
            </div>
          )}
        </div>

        <div className="item-metadata">
          {metadata.description && (
            <div className="metadata-section">
              <h2>Description</h2>
              <p>{metadata.description}</p>
            </div>
          )}

          <div className="metadata-section">
            <h2>Details</h2>
            <dl className="metadata-list">
              <dt>Identifier</dt>
              <dd>{metadata.identifier}</dd>

              {metadata.mediatype && (
                <>
                  <dt>Media Type</dt>
                  <dd>{metadata.mediatype}</dd>
                </>
              )}

              {metadata.date && (
                <>
                  <dt>Date</dt>
                  <dd>{metadata.date}</dd>
                </>
              )}

              {metadata.creator && (
                <>
                  <dt>Creator</dt>
                  <dd>{metadata.creator}</dd>
                </>
              )}

              {metadata.collection && (
                <>
                  <dt>Collection</dt>
                  <dd>
                    {Array.isArray(metadata.collection)
                      ? metadata.collection.join(', ')
                      : metadata.collection}
                  </dd>
                </>
              )}
            </dl>
          </div>

          {metadata.files && metadata.files.length > 0 && (
            <div className="metadata-section">
              <h2>Files</h2>
              <ul className="files-list">
                {metadata.files.map((file: any) => (
                  <li key={file.name} className="file-item">
                    <a
                      href={`/api/download/${metadata.identifier}/${file.name}`}
                      download
                      className="file-link"
                    >
                      {file.name}
                      {file.size && (
                        <span className="file-size">
                          ({formatFileSize(file.size)})
                        </span>
                      )}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function formatFileSize(bytes: number) {
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let size = bytes
  let unitIndex = 0
  
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024
    unitIndex++
  }
  
  return `${size.toFixed(1)} ${units[unitIndex]}`
}
