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
  collection?: string[]
  downloadDate: string
}

export default function LocalItemsList() {
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchItems = async () => {
      try {
        const response = await fetch('/api/items')
        if (!response.ok) {
          throw new Error('Failed to fetch local items')
        }
        const data = await response.json()
        setItems(data)
      } catch (error) {
        console.error('Error fetching local items:', error)
        setError(error instanceof Error ? error.message : 'Failed to fetch local items')
      } finally {
        setLoading(false)
      }
    }

    fetchItems()
  }, [])

  if (loading) {
    return (
      <div className="loading-state">
        <p>Loading your local items...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="error-state">
        <p>Error: {error}</p>
      </div>
    )
  }

  if (!items?.length) {
    return (
      <div className="empty-state">
        <p>No items in your local archive yet.</p>
        <p>Browse the Internet Archive to download some items!</p>
      </div>
    )
  }

  return (
    <div className="items-grid">
      {items.map((item) => (
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
                target.src = '/placeholder.png'
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
              <span className="item-downloaded">
                Downloaded {new Date(item.downloadDate).toLocaleDateString()}
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
