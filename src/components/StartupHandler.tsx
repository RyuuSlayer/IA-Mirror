'use client'

import { useEffect } from 'react'
import { log } from '@/lib/logger'

export default function StartupHandler() {
  useEffect(() => {
    // Clear cache on startup
    const clearCache = async () => {
      try {
        const response = await fetch('/api/cache/stats', {
          method: 'DELETE'
        })
        
        if (response.ok) {
          log.info('Cache cleared on startup', 'startup-handler')
        } else {
          log.warn('Failed to clear cache on startup', 'startup-handler')
        }
      } catch (error) {
        log.error('Error clearing cache on startup', 'startup-handler', { error: error.message }, error)
      }
    }
    
    clearCache()
  }, [])

  return null // This component doesn't render anything
}