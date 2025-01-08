'use client'

import { useState, useEffect } from 'react'

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
        throw new Error('Failed to fetch downloads')
      }
      const data = await response.json()
      setDownloads(data)
      setLoading(false)
    } catch (error) {
      console.error('Error fetching downloads:', error)
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
      await fetch('/api/download', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'clear'
        }),
      })
      fetchDownloads() // Refresh the list
    } catch (error) {
      console.error('Error clearing downloads:', error)
    }
  }

  if (loading) {
    return <div className="p-4">Loading downloads...</div>
  }

  if (downloads.length === 0) {
    return <div className="p-4">No downloads in progress</div>
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
    return new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
  })

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">Downloads</h1>
        {hasFinishedDownloads && (
          <button
            onClick={handleClear}
            className="bg-gray-500 hover:bg-gray-600 text-white px-3 py-1 rounded"
          >
            Clear Finished
          </button>
        )}
      </div>
      {sortedDownloads.map((download) => (
        <div key={`${download.identifier}-${download.file}`} className="mb-6">
          <h2 className="text-xl font-semibold">
            {download.identifier} - {download.file?.split('/').pop()}
          </h2>
          <div className="mt-2">
            <div>File: {download.file}</div>
            <div>Status: {download.status} {download.progress !== undefined && `(${download.progress}%)`}</div>
            {download.error && <div className="text-red-500">Error: {download.error}</div>}
            <div>Destination: {download.destinationPath}</div>
          </div>
          {download.status === 'downloading' && (
            <div className="mt-2">
              <button 
                onClick={() => handleCancel(download.identifier)}
                className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded"
              >
                Cancel
              </button>
              {download.progress !== undefined && (
                <div className="mt-2 w-full bg-gray-200 rounded-full h-2.5">
                  <div 
                    className="bg-blue-600 h-2.5 rounded-full" 
                    style={{ width: `${download.progress}%` }}
                  ></div>
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
