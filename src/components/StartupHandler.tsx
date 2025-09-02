'use client'

import { useEffect, useRef } from 'react'
import { log } from '@/lib/logger'

export default function StartupHandler() {
  const abortControllerRef = useRef<AbortController | null>(null)

  useEffect(() => {
    // Clear cache on startup
    const clearCache = async () => {
      // Create abort controller for this request
      const abortController = new AbortController()
      abortControllerRef.current = abortController

      try {
        const response = await fetch('/api/cache/stats', {
          method: 'DELETE',
          signal: abortController.signal
        })
        
        // Only process response if not aborted
        if (!abortController.signal.aborted) {
          if (response.ok) {
            log.info('Cache cleared on startup', 'startup-handler')
          } else {
            log.warn('Failed to clear cache on startup', 'startup-handler')
          }
        }
      } catch (error) {
        // Don't log abort errors
        if (error instanceof Error && error.name === 'AbortError') {
          return
        }
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        log.error('Error clearing cache on startup', 'startup-handler', { error: errorMessage }, error instanceof Error ? error : undefined)
      }
    }
    
    clearCache()

    // Cleanup function to abort request if component unmounts
    return () => {
      if (abortControllerRef.current && !abortControllerRef.current.signal.aborted) {
        abortControllerRef.current.abort()
      }
    }
  }, [])

  return null // This component doesn't render anything
}