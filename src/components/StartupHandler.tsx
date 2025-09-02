'use client'

import { useEffect } from 'react'

export default function StartupHandler() {
  useEffect(() => {
    // Clear cache on startup
    const clearCache = async () => {
      try {
        const response = await fetch('/api/cache/stats', {
          method: 'DELETE'
        })
        
        if (response.ok) {
          console.log('Cache cleared on startup')
        } else {
          console.warn('Failed to clear cache on startup')
        }
      } catch (error) {
        console.error('Error clearing cache on startup:', error)
      }
    }
    
    clearCache()
  }, [])

  return null // This component doesn't render anything
}