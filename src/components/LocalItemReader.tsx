'use client'

import { useState } from 'react'
import BookReader from './BookReader'

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
    console.log('LocalItemReader - Opening reader for:', { identifier, fileName, title })
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