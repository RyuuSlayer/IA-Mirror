'use client'

import { useState, useEffect } from 'react'
import ErrorBoundary from '@/components/ErrorBoundary'

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

  useEffect(() => {
    // Initial fetch
    fetchDownloads()

    // Poll for updates every second
    const interval = setInterval(fetchDownloads, 1000)
    return () => clearInterval(interval)
  }, [])

  const fetchDownloads = async () => {
    try {
      const response = await fetch('/api/download')
      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Failed to fetch downloads: ${response.status} ${response.statusText}${errorText ? ` - ${errorText}` : ''}`)
      }
      const data = await response.json()
      setDownloads(data)
      setError(null)
      setLoading(false)
    } catch (error) {
      console.error('Error fetching downloads:', error)
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch downloads'
      setError(`Unable to load downloads: ${errorMessage}`)
      setLoading(false)
    }
  }

  const handleCancel = async (identifier: string) => {
    try {
      await fetch('/api/download', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          identifier,
          action: 'cancel'
        }),
      })
    } catch (error) {
      console.error('Error cancelling download:', error)
    }
  }

  const handleClear = async () => {
    try {
      const response = await fetch('/api/download', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'clear'
        }),
      })
      
      if (!response.ok) {
        throw new Error('Failed to clear downloads')
      }
      
      // Wait for API completion before refreshing
      await fetchDownloads()
    } catch (error) {
      console.error('Error clearing downloads:', error)
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
          {hasFinishedDownloads && (
            <button
              onClick={handleClear}
              className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
            >
              Clear Completed
            </button>
          )}
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
