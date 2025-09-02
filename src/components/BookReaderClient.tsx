'use client'

import { useEffect, useRef } from 'react'
import jQuery from 'jquery'
import Link from 'next/link'
import { log } from '@/lib/logger'

// Make jQuery available globally for BookReader
if (typeof window !== 'undefined') {
  (window as any).$ = jQuery;
  (window as any).jQuery = jQuery;
}

interface BookReaderClientProps {
  identifier: string
  fileName: string
  title?: string
}

export default function BookReaderClient({ identifier, fileName, title }: BookReaderClientProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const bookReaderRef = useRef<any>(null)

  useEffect(() => {
    const initBookReader = async () => {
      try {
        if (!containerRef.current) return

        // Dynamically import BookReader after jQuery is available
        const { default: BookReader } = await import('@internetarchive/bookreader/dist/esm/BookReader.js')

        const fileExtension = fileName.split('.').pop()?.toLowerCase()
        log.debug('BookReaderClient initialization', 'bookreader', { identifier, fileName, fileExtension })
        
        // Handle different file types
        const downloadUrl = `/api/metadata/${identifier}?download=${encodeURIComponent(fileName)}`
        
        if (fileExtension === 'pdf') {
          // For PDF files, we'll use an embedded PDF viewer
          log.info('PDF detected, creating iframe', 'bookreader', { identifier, fileName, downloadUrl })
          if (containerRef.current) {
            containerRef.current.innerHTML = `
              <div class="w-full h-full">
                <div class="bg-green-100 p-2 text-center text-sm font-bold">PDF DETECTED: ${fileName}</div>
                <iframe 
                  src="${downloadUrl}" 
                  class="w-full h-full border-0"
                  title="${title || fileName}"
                  onload="window.logPdfLoad && window.logPdfLoad('${fileName}')"
                  onerror="window.logPdfError && window.logPdfError('${fileName}')"
                ></iframe>
              </div>
            `
          }
          return
        } else {
          // For other file types, try to use the Internet Archive BookReader
          // This works best with books that have been processed by IA and have page images
          
          // Use the imported BookReader
          
          // Check if we have page images available by trying to fetch metadata
          const metadataResponse = await fetch(`/api/metadata/${identifier}`)
          const metadata = await metadataResponse.json()
          
          // Look for page images in the files
          const pageImages = metadata.files?.filter((file: any) => 
            file.name.match(/page\d+\.(jpg|jpeg|png|gif)$/i) ||
            file.name.match(/\d+\.(jpg|jpeg|png|gif)$/i)
          ) || []
          
          if (pageImages.length > 0) {
             // We have page images, use BookReader
             const options = {
               el: containerRef.current,
               data: pageImages.map((img: any, index: number) => {
                 const imgUrl = `/api/metadata/${identifier}?download=${encodeURIComponent(img.name)}`
                 return {
                   width: 800,
                   height: 1200,
                   uri: imgUrl,
                   pageNum: index + 1
                 }
               }),
               bookTitle: title || fileName,
               thumbnail: pageImages[0] ? `/api/metadata/${identifier}?download=${encodeURIComponent(pageImages[0].name)}` : undefined,
               metadata: [
                 { label: 'Title', value: title || fileName },
                 { label: 'Identifier', value: identifier },
                 { label: 'Source', value: 'Local Archive' }
               ],
               ui: 'full',
               imagesBaseURL: '',
               server: '',
               bookId: identifier
             }
             
             const br = new BookReader(options)
             br.init()
             bookReaderRef.current = br
          } else {
            // No page images found, show download option
            if (containerRef.current) {
              containerRef.current.innerHTML = `
                <div class="flex items-center justify-center h-full bg-gray-50">
                  <div class="text-center p-8 max-w-md">
                    <div class="mb-4">
                      <svg class="w-16 h-16 mx-auto text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                      </svg>
                    </div>
                    <h3 class="text-lg font-semibold text-gray-900 mb-2">File Viewer</h3>
                    <p class="text-gray-600 mb-4">This ${fileExtension?.toUpperCase() || 'unknown'} file requires specialized software to view. Download the file to open with an appropriate application.</p>
                    <a 
                      href="${downloadUrl}"
                      class="inline-flex items-center px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                      download
                    >
                      <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                      </svg>
                      Download File
                    </a>
                  </div>
                </div>
              `
            }
          }
        }
        
      } catch (error) {
        log.error('Failed to initialize BookReader', 'bookreader', { identifier, fileName, error: error.message }, error)
        
        const fileExtension = fileName.split('.').pop()
        
        // Show error message in container
        if (containerRef.current) {
          containerRef.current.innerHTML = `
            <div class="flex items-center justify-center h-full">
              <div class="text-center">
                <div class="text-red-600 text-lg mb-2">Failed to load BookReader</div>
                <div class="text-gray-600">File type: ${fileExtension?.toUpperCase() || 'Unknown'}</div>
                <div class="text-gray-600">Error: ${error}</div>
                <div class="mt-4">
                  <a 
                    href="/api/metadata/${identifier}?download=${encodeURIComponent(fileName)}"
                    class="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                    download
                  >
                    Download File Instead
                  </a>
                </div>
              </div>
            </div>
          `
        }
      }
    }

    initBookReader()
    
    // Cleanup function
    return () => {
      if (bookReaderRef.current && typeof bookReaderRef.current.destroy === 'function') {
        try {
          bookReaderRef.current.destroy()
        } catch (error) {
          log.warn('Error destroying BookReader', 'bookreader', { identifier, fileName, error: error.message }, error)
        }
      }
      bookReaderRef.current = null
    }
  }, [identifier, fileName, title])

  return (
    <div 
      ref={containerRef} 
      className="w-full h-full min-h-[500px] bg-gray-100"
      style={{ minHeight: '500px' }}
    >
      <div className="flex items-center justify-center h-full">
        <div className="text-lg text-gray-600">Initializing viewer...</div>
      </div>
    </div>
  )
}