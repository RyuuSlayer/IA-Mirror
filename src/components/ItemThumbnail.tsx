'use client'

import Image from 'next/image'

interface ItemThumbnailProps {
  identifier: string
  thumbnailFile?: string
  title?: string
  className?: string
  width?: number
  height?: number
  fill?: boolean
}

export default function ItemThumbnail({ 
  identifier, 
  thumbnailFile, 
  title, 
  className = "object-cover",
  width,
  height,
  fill = false
}: ItemThumbnailProps) {
  const imageProps = fill 
    ? { fill: true }
    : { width: width || 400, height: height || 400 }

  return (
    <Image
      src={thumbnailFile ? `/api/metadata/${identifier}?download=${encodeURIComponent(thumbnailFile)}` : `https://archive.org/services/img/${identifier}`}
      alt={title || 'Item thumbnail'}
      {...imageProps}
      className={className}
      priority
      unoptimized={true}
      onError={(e) => {
        const target = e.target as HTMLImageElement
        if (target.src.includes('/api/metadata/')) {
          target.src = `https://archive.org/services/img/${identifier}`
        } else {
          target.src = '/placeholder.svg'
        }
      }}
    />
  )
}