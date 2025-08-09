'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'

interface Item {
  identifier: string
  title: string
  description?: string
  mediatype?: string
  creator?: string
  date?: string
  downloads?: number
  collection?: string[]
  downloaded?: boolean
  files?: Array<{
    name: string
    size: number
    format?: string
  }>
}

interface ItemsListProps {
  items: Item[]
}

export default function ItemsList({ items = [] }: ItemsListProps) {
  const [downloadingItems, setDownloadingItems] = useState<Set<string>>(new Set())
  const [isLoading, setIsLoading] = useState(false)
  const [itemsWithFiles, setItemsWithFiles] = useState<Item[]>(items)

  useEffect(() => {
    let mounted = true

    const fetchFiles = async () => {
      if (!items?.length) return
      
      setIsLoading(true)
      try {
        const updatedItems = await Promise.all(
          items.map(async (item) => {
            if (!item?.identifier) return item

            try {
              const response = await fetch(`/api/metadata/${item.identifier}`)
              if (response.ok) {
                const data = await response.json()
                return { ...item, files: data.files }
              }
            } catch (error) {
              console.error(`Error fetching files for ${item.identifier}:`, error)
            }
            return item
          })
        )
        if (mounted) {
          setItemsWithFiles(updatedItems.filter(Boolean))
        }
      } catch (error) {
        console.error('Error fetching files:', error)
      } finally {
        if (mounted) {
          setIsLoading(false)
        }
      }
    }

    fetchFiles()

    return () => {
      mounted = false
    }
  }, [items])

  const handleDownload = async (identifier: string) => {
    if (downloadingItems.has(identifier)) return

    setDownloadingItems(prev => {
      const newSet = new Set(prev)
      newSet.add(identifier)
      return newSet
    })
    
    try {
      const item = itemsWithFiles.find(item => item.identifier === identifier)
      if (!item) return

      // Find first non-derivative file
      const file = item.files?.find(f => !f.name.match(/(_thumb\.|_itemimage\.|__ia_thumb\.|_files\.|_meta\.|\.gif$|\b(thumb|small|medium|large)\d*\.|_spectrogram\.)/i))?.name

      const response = await fetch('/api/download', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          identifier,
          title: item.title || identifier,
          file
        }),
      })

      if (!response.ok) {
        throw new Error('Download failed')
      }

      setItemsWithFiles(prev =>
        prev.map(item =>
          item.identifier === identifier
            ? { ...item, downloaded: true }
            : item
        )
      )
    } catch (error) {
      console.error('Download error:', error)
    } finally {
      setDownloadingItems(prev => {
        const next = new Set(prev)
        next.delete(identifier)
        return next
      })
    }
  }

  if (isLoading && !itemsWithFiles.length) {
    return (
      <div className="loading-state">
        <p>Loading items...</p>
      </div>
    )
  }

  if (!itemsWithFiles?.length) {
    return (
      <div className="empty-state">
        <p>No items found</p>
      </div>
    )
  }

  return (
    <div className="items-grid">
      {itemsWithFiles.map((item) => (
        <div key={item.identifier} className="item-card">
          <div className="item-thumbnail">
            <Image
              src={`https://archive.org/services/img/${item.identifier}`}
              alt={item.title}
              width={160}
              height={160}
              className="thumbnail-img"
              unoptimized
              onError={(e) => {
                const target = e.target as HTMLImageElement
                target.src = '/placeholder.svg'
              }}
            />
          </div>
          <div className="item-info">
            <Link
              href={`/archive/local/items/${item.identifier}`}
              className="item-title"
            >
              {item.title}
            </Link>
            {item.creator && (
              <div className="item-creator">by {item.creator}</div>
            )}
            {item.date && <div className="item-date">{item.date}</div>}
            <div className="item-meta">
              {item.mediatype && (
                <span className="item-mediatype">{item.mediatype}</span>
              )}
              {item.downloads !== undefined && (
                <span className="item-downloads">
                  {item.downloads.toLocaleString()} downloads
                </span>
              )}
              {item.downloaded && (
                <span className="item-downloaded">Downloaded</span>
              )}
            </div>
            <div className="download-section">
              {!item.downloaded ? (
                <button
                  onClick={() => handleDownload(item.identifier)}
                  className="download-button"
                  disabled={downloadingItems.has(item.identifier)}
                >
                  {downloadingItems.has(item.identifier) ? 'Downloading...' : 'Download to Library'}
                </button>
              ) : (
                <Link
                  href={`/archive/local/items/${item.identifier}`}
                  className="view-files-button"
                >
                  View Files
                </Link>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
