'use client'

import { useState, useEffect } from 'react'
import { retryFetch, RETRY_CONFIGS } from '@/lib/retry'
import ErrorBoundary from '@/components/ErrorBoundary'
import { log } from '@/lib/logger'

// CSRF token utility
const fetchCSRFToken = async (): Promise<string> => {
  const response = await fetch('/api/csrf-token')
  if (!response.ok) {
    throw new Error('Failed to fetch CSRF token')
  }
  const data = await response.json()
  return data.token
}

interface DownloadItem {
  identifier: string
  title: string
  status: 'queued' | 'downloading' | 'completed' | 'failed'
  progress?: number
  error?: string
  startedAt?: string
  completedAt?: string
  pid?: number
  file?: string
  destinationPath?: string
}

export default function DownloadsPage() {
  const [downloads, setDownloads] = useState<DownloadItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notification, setNotification] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null)

  // Show notification with auto-dismiss
  const showNotification = (type: 'success' | 'error' | 'info', message: string) => {
    setNotification({ type, message })
    setTimeout(() => setNotification(null), 5000) // Auto-dismiss after 5 seconds
  }

  // Get user-friendly error message
  const getUserFriendlyError = (error: any): string => {
    if (error instanceof Error) {
      if (error.message.includes('fetch')) {
        return 'Network connection failed. Please check your internet connection.'
      }
      if (error.message.includes('CSRF')) {
        return 'Security token expired. Please refresh the page and try again.'
      }
      if (error.message.includes('timeout')) {
        return 'Request timed out. The server may be busy, please try again.'
      }
      if (error.message.includes('permission')) {
        return 'Permission denied. You may not have access to perform this action.'
      }
      return error.message
    }
    return 'An unexpected error occurred. Please try again.'
  }

  useEffect(() => {
    // Initial fetch
    fetchDownloads()

    // Poll for updates every second
    const interval = setInterval(fetchDownloads, 1000)
    return () => clearInterval(interval)
  }, [])

  const fetchDownloads = async () => {
    try {
      const response = await retryFetch('/api/download', {}, RETRY_CONFIGS.METADATA)
      const data = await response.json()
      setDownloads(data)
      setError(null)
      setLoading(false)
    } catch (error) {
      log.error('Error fetching downloads', 'downloads', { error: error.message }, error)
      const userFriendlyMessage = getUserFriendlyError(error)
      setError(`Unable to load downloads: ${userFriendlyMessage}`)
      setLoading(false)
      
      // Only show notification for non-network errors to avoid spam during connectivity issues
      if (!error || !error.toString().includes('fetch')) {
        showNotification('error', `Failed to load downloads: ${userFriendlyMessage}`)
      }
    }
  }

  const handleCancel = async (identifier: string) => {
    try {
      // Fetch CSRF token
      const csrfToken = await fetchCSRFToken()
      
      await retryFetch('/api/download', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken,
        },
        body: JSON.stringify({
          identifier,
          action: 'cancel'
        }),
      }, RETRY_CONFIGS.CRITICAL)
      
      showNotification('success', 'Download cancelled successfully')
    } catch (error) {
      log.error('Error cancelling download', 'downloads', { identifier, error: error.message }, error)
      const userFriendlyMessage = getUserFriendlyError(error)
      showNotification('error', `Failed to cancel download: ${userFriendlyMessage}`)
    }
  }

  const handleClear = async () => {
    try {
      // Fetch CSRF token
      const csrfToken = await fetchCSRFToken()
      
      await retryFetch('/api/download', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken,
        },
        body: JSON.stringify({
          action: 'clear'
        }),
      }, RETRY_CONFIGS.CRITICAL)
      
      showNotification('success', 'Completed downloads cleared successfully')
      
      // Wait for API completion before refreshing
      await fetchDownloads()
    } catch (error) {
      log.error('Error clearing downloads', 'downloads', { error: error.message }, error)
      const userFriendlyMessage = getUserFriendlyError(error)
      showNotification('error', `Failed to clear downloads: ${userFriendlyMessage}`)
    }
  }

  const handleStartAll = async () => {
    try {
      // Fetch CSRF token
      const csrfToken = await fetchCSRFToken()
      
      await retryFetch('/api/download', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken,
        },
        body: JSON.stringify({
          action: 'start-all'
        }),
      }, RETRY_CONFIGS.CRITICAL)
      
      showNotification('success', 'All queued downloads started successfully')
      
      // Wait for API completion before refreshing
      await fetchDownloads()
    } catch (error) {
      log.error('Error starting all downloads', 'downloads', { error: error.message }, error)
      const userFriendlyMessage = getUserFriendlyError(error)
      showNotification('error', `Failed to start downloads: ${userFriendlyMessage}`)
    }
  }

  const handlePauseAll = async () => {
    try {
      // Fetch CSRF token
      const csrfToken = await fetchCSRFToken()
      
      await retryFetch('/api/download', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken,
        },
        body: JSON.stringify({
          action: 'pause-all'
        }),
      }, RETRY_CONFIGS.CRITICAL)
      
      showNotification('success', 'All downloads paused successfully')
      
      // Wait for API completion before refreshing
      await fetchDownloads()
    } catch (error) {
      log.error('Error pausing all downloads', 'downloads', { error: error.message }, error)
      const userFriendlyMessage = getUserFriendlyError(error)
      showNotification('error', `Failed to pause downloads: ${userFriendlyMessage}`)
    }
  }

  const handleCancelAll = async () => {
    try {
      // Fetch CSRF token
      const csrfToken = await fetchCSRFToken()
      
      await retryFetch('/api/download', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken,
        },
        body: JSON.stringify({
          action: 'cancel-all'
        }),
      }, RETRY_CONFIGS.CRITICAL)
      
      showNotification('success', 'All downloads cancelled successfully')
      
      // Wait for API completion before refreshing
      await fetchDownloads()
    } catch (error) {
      log.error('Error cancelling all downloads', 'downloads', { error: error.message }, error)
      const userFriendlyMessage = getUserFriendlyError(error)
      showNotification('error', `Failed to cancel downloads: ${userFriendlyMessage}`)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAFAFA] flex justify-center items-center">
        <div className="animate-spin rounded-full h-8 w-8 border-4 border-[#428BCA] border-t-transparent"></div>
      </div>
    )
  }

  if (downloads.length === 0) {
    return (
      <div className="min-h-screen bg-[#FAFAFA]">
        <main className="max-w-7xl mx-auto px-4 py-8">
          <div className="bg-white rounded-lg shadow-sm p-12 text-center">
            <p className="text-gray-500">No downloads in progress</p>
          </div>
        </main>
      </div>
    )
  }

  // Only show clear button if there are any completed or failed downloads
  const hasFinishedDownloads = downloads.some(d => 
    d.status === 'completed' || d.status === 'failed'
  )

  // Show start all button if there are queued downloads
  const hasQueuedDownloads = downloads.some(d => d.status === 'queued')

  // Show pause all button if there are downloading items
  const hasDownloadingItems = downloads.some(d => d.status === 'downloading')

  // Show cancel all button if there are active downloads (queued or downloading)
  const hasActiveDownloads = downloads.some(d => 
    d.status === 'queued' || d.status === 'downloading'
  )

  // Sort downloads to show active ones first
  const sortedDownloads = [...downloads].sort((a, b) => {
    // Active downloads first
    if ((a.status === 'downloading' || a.status === 'queued') && 
        (b.status !== 'downloading' && b.status !== 'queued')) {
      return -1
    }
    if ((b.status === 'downloading' || b.status === 'queued') && 
        (a.status !== 'downloading' && a.status !== 'queued')) {
      return 1
    }
    // Then by start time
    return (b.startedAt || '').localeCompare(a.startedAt || '')
  })

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-[#FAFAFA]">
        {/* Notification Toast */}
        {notification && (
          <div className={`fixed top-4 right-4 z-50 max-w-sm w-full shadow-lg rounded-lg p-4 ${
            notification.type === 'success' ? 'bg-green-50 border border-green-200' :
            notification.type === 'error' ? 'bg-red-50 border border-red-200' :
            'bg-blue-50 border border-blue-200'
          }`}>
            <div className="flex items-start">
              <div className="flex-shrink-0">
                {notification.type === 'success' && (
                  <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                )}
                {notification.type === 'error' && (
                  <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                )}
                {notification.type === 'info' && (
                  <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                )}
              </div>
              <div className="ml-3 w-0 flex-1">
                <p className={`text-sm font-medium ${
                  notification.type === 'success' ? 'text-green-800' :
                  notification.type === 'error' ? 'text-red-800' :
                  'text-blue-800'
                }`}>
                  {notification.message}
                </p>
              </div>
              <div className="ml-4 flex-shrink-0 flex">
                <button
                  className={`rounded-md inline-flex ${
                    notification.type === 'success' ? 'text-green-400 hover:text-green-500' :
                    notification.type === 'error' ? 'text-red-400 hover:text-red-500' :
                    'text-blue-400 hover:text-blue-500'
                  } focus:outline-none`}
                  onClick={() => setNotification(null)}
                >
                  <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        )}
        
        <main className="max-w-7xl mx-auto px-4 py-8">
          {error && (
            <div className="mb-6 bg-red-50 border border-red-200 rounded-md p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm text-red-800">{error}</p>
                </div>
                <div className="ml-auto pl-3">
                  <button
                    onClick={() => setError(null)}
                    className="inline-flex text-red-400 hover:text-red-600"
                  >
                    <span className="sr-only">Dismiss</span>
                    <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          )}
          <div className="flex justify-between items-center mb-8">
            <h1 className="text-3xl font-bold text-[#2C2C2C]">Downloads</h1>
            <div className="flex gap-2">
               {hasQueuedDownloads && (
                 <button
                   onClick={handleStartAll}
                   className="px-4 py-2 text-sm bg-green-100 text-green-700 rounded-md hover:bg-green-200 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
                 >
                   Start All
                 </button>
               )}
               {hasDownloadingItems && (
                 <button
                   onClick={handlePauseAll}
                   className="px-4 py-2 text-sm bg-yellow-100 text-yellow-700 rounded-md hover:bg-yellow-200 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-offset-2"
                 >
                   Pause All
                 </button>
               )}
               {hasActiveDownloads && (
                 <button
                   onClick={handleCancelAll}
                   className="px-4 py-2 text-sm bg-red-100 text-red-700 rounded-md hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
                 >
                   Cancel All
                 </button>
               )}
               {hasFinishedDownloads && (
                 <button
                   onClick={handleClear}
                   className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
                 >
                   Clear Completed
                 </button>
               )}
             </div>
        </div>

        <div className="space-y-4">
          {sortedDownloads.map((download) => (
            <div
              key={`${download.identifier}_${download.file || ''}`}
              className="bg-white rounded-lg shadow-sm p-6"
            >
              <div className="flex items-start justify-between">
                <div className="flex-grow min-w-0">
                  <h3 className="text-lg font-medium text-gray-900 truncate mb-1">
                    {download.title || download.identifier}
                  </h3>
                  
                  <div className="text-sm text-gray-500 space-y-1">
                    {download.file && (
                      <p className="truncate">File: {download.file}</p>
                    )}
                    {download.destinationPath && (
                      <p className="truncate">Path: {download.destinationPath}</p>
                    )}
                    {download.startedAt && (
                      <p>Started: {new Date(download.startedAt).toLocaleString()}</p>
                    )}
                    {download.completedAt && (
                      <p>Completed: {new Date(download.completedAt).toLocaleString()}</p>
                    )}
                    {download.error && (
                      <p className="text-red-600">{download.error}</p>
                    )}
                  </div>
                </div>

                <div className="ml-4 flex flex-col items-end gap-2">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    download.status === 'completed' ? 'bg-green-100 text-green-800' :
                    download.status === 'failed' ? 'bg-red-100 text-red-800' :
                    download.status === 'downloading' ? 'bg-blue-100 text-blue-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {download.status.charAt(0).toUpperCase() + download.status.slice(1)}
                  </span>

                  {(download.status === 'downloading' || download.status === 'queued') && (
                    <button
                      onClick={() => handleCancel(download.identifier)}
                      className="text-sm text-red-600 hover:text-red-800"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </div>

              {download.status === 'downloading' && download.progress !== undefined && (
                <div className="mt-4">
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${download.progress}%` }}
                    />
                  </div>
                  <div className="mt-1 text-right text-sm text-gray-500">
                    {download.progress.toFixed(1)}%
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
        </main>
      </div>
    </ErrorBoundary>
  )
}
