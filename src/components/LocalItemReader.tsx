'use client'

import { useState } from 'react'
import BookReader from './BookReader'
import { log } from '@/lib/logger'

interface LocalItemReaderProps {
  identifier: string
  fileName: string
  title?: string
  children: React.ReactNode
}

export default function LocalItemReader({ identifier, fileName, title, children }: LocalItemReaderProps) {
  const [isReaderOpen, setIsReaderOpen] = useState(false)

  const handleOpenReader = (e: React.MouseEvent) => {
    e.preventDefault()
    log.debug('Opening reader', 'local-item-reader', { identifier, fileName, title })
    setIsReaderOpen(true)
  }

  const handleCloseReader = () => {
    setIsReaderOpen(false)
  }

  return (
    <>
      <div onClick={handleOpenReader} style={{ cursor: 'pointer' }}>
        {children}
      </div>
      
      {isReaderOpen && (
        <BookReader
          identifier={identifier}
          fileName={fileName}
          title={title}
          onClose={handleCloseReader}
        />
      )}
    </>
  )
}