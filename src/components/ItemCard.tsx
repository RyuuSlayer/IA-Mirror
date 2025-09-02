'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { log } from '@/lib/logger'

interface ItemCardProps {
  item: {
    identifier: string
    title: string
    description?: string
    mediatype?: string
    size?: string | number
    date?: string
    creator?: string
    thumbnail?: string
  }
}

export default function ItemCard({ item }: ItemCardProps) {
  const [downloading, setDownloading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const blobUrlRef = useRef<string | null>(null)
  const linkElementRef = useRef<HTMLAnchorElement | null>(null)

  const handleDownload = async () => {
    if (downloading) return

    try {
      setDownloading(true)
      setError(null)

      const response = await fetch(`/api/download/${item.identifier}`)
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Download failed')
      }

      // Create a blob from the response
      const blob = await response.blob()
      
      // Create a download link
      const url = window.URL.createObjectURL(blob)
      blobUrlRef.current = url
      
      const a = document.createElement('a')
      linkElementRef.current = a
      a.href = url
      
      // Safe access to blob.type with null check
      const fileExtension = blob.type ? blob.type.split('/')[1] || 'bin' : 'bin'
      a.download = `${item.identifier}.${fileExtension}`
      
      document.body.appendChild(a)
      a.click()
      
      // Immediate cleanup
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      blobUrlRef.current = null
      linkElementRef.current = null
    } catch (error) {
      log.error('Download error', 'item-card', { identifier: item.identifier, error: error instanceof Error ? error.message : String(error) }, error instanceof Error ? error : undefined)
      setError(error instanceof Error ? error.message : 'Download failed')
    } finally {
      setDownloading(false)
    }
  }

  // Cleanup effect for component unmount
  useEffect(() => {
    return () => {
      // Cleanup any remaining blob URLs
      if (blobUrlRef.current) {
        window.URL.revokeObjectURL(blobUrlRef.current)
        blobUrlRef.current = null
      }
      
      // Cleanup any remaining DOM elements
      if (linkElementRef.current && document.body.contains(linkElementRef.current)) {
        document.body.removeChild(linkElementRef.current)
        linkElementRef.current = null
      }
    }
  }, [])

  const formatSize = (size: string | number | undefined) => {
    if (typeof size === 'number') {
      return `${Math.round(size / 1024 / 1024)} MB`
    }
    return size || 'Unknown size'
  }

  return (
    <div className="item-card">
      <Link href={`/archive/local/items/${item.identifier}`} className="item-link">
        <div className="item-thumbnail">
          {item.thumbnail && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={item.thumbnail}
              alt={item.title}
              className="thumbnail-img"
              onError={(e) => {
                e.currentTarget.src = '/placeholder.svg'
              }}
            />
          )}
        </div>

        <div className="item-info">
          <h3 className="item-title">{item.title}</h3>
          {item.description && (
            <p className="item-description">
              {item.description.length > 200
                ? `${item.description.substring(0, 200)}...`
                : item.description}
            </p>
          )}
        </div>
      </Link>

      <div className="item-metadata">
        {item.mediatype && (
          <span className="item-mediatype">{item.mediatype}</span>
        )}
        {item.size && (
          <span className="item-size">{formatSize(item.size)}</span>
        )}
      </div>

      <button
        className="download-button"
        onClick={handleDownload}
        disabled={downloading}
      >
        {downloading ? 'Downloading...' : 'Download'}
      </button>

      {error && <p className="error-message">{error}</p>}
    </div>
  )
}
