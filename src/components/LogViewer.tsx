'use client'

import { useState, useEffect, useRef } from 'react'
import { LogLevel, LogEntry } from '@/lib/logger'

interface LogViewerProps {
  className?: string
  enableFileLogging?: boolean
}

const LogViewer: React.FC<LogViewerProps> = ({ className = '', enableFileLogging = false }) => {
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedLevel, setSelectedLevel] = useState<LogLevel | 'all'>('all')
  const [autoRefresh, setAutoRefresh] = useState(false)
  const [showFileContent, setShowFileContent] = useState(false)
  const [fileContent, setFileContent] = useState<string | null>(null)
  const logContainerRef = useRef<HTMLDivElement>(null)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  const fetchLogs = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const params = new URLSearchParams()
      if (selectedLevel !== 'all') {
        params.append('level', selectedLevel.toString())
      }
      params.append('limit', '200')
      
      const response = await fetch(`/api/logs?${params}`)
      const data = await response.json()
      
      if (data.success) {
        setLogs(data.logs)
      } else {
        setError(data.error || 'Failed to fetch logs')
      }
    } catch (err) {
      setError('Network error while fetching logs')
    } finally {
      setLoading(false)
    }
  }

  const fetchFileContent = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/logs?file=true')
      const data = await response.json()
      
      if (data.success && data.available) {
        setFileContent(data.fileContent)
      } else {
        setFileContent('No log file available')
      }
    } catch (err) {
      setFileContent('Error loading log file')
    } finally {
      setLoading(false)
    }
  }

  const clearLogs = async () => {
    try {
      const response = await fetch('/api/logs', { method: 'DELETE' })
      const data = await response.json()
      
      if (data.success) {
        setLogs([])
        setFileContent(null)
      } else {
        setError(data.error || 'Failed to clear logs')
      }
    } catch (err) {
      setError('Network error while clearing logs')
    }
  }

  const scrollToBottom = () => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight
    }
  }

  useEffect(() => {
    fetchLogs()
  }, [selectedLevel])

  useEffect(() => {
    if (autoRefresh) {
      intervalRef.current = setInterval(fetchLogs, 2000)
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [autoRefresh, selectedLevel])

  useEffect(() => {
    if (autoRefresh) {
      scrollToBottom()
    }
  }, [logs, autoRefresh])

  const getLevelColor = (level: LogLevel) => {
    switch (level) {
      case LogLevel.DEBUG:
        return 'text-gray-500'
      case LogLevel.INFO:
        return 'text-blue-600'
      case LogLevel.WARN:
        return 'text-yellow-600'
      case LogLevel.ERROR:
        return 'text-red-600'
      default:
        return 'text-gray-700'
    }
  }

  const getLevelBadgeColor = (level: LogLevel) => {
    switch (level) {
      case LogLevel.DEBUG:
        return 'bg-gray-100 text-gray-700'
      case LogLevel.INFO:
        return 'bg-blue-100 text-blue-700'
      case LogLevel.WARN:
        return 'bg-yellow-100 text-yellow-700'
      case LogLevel.ERROR:
        return 'bg-red-100 text-red-700'
      default:
        return 'bg-gray-100 text-gray-700'
    }
  }

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString()
  }

  return (
    <div className={`bg-white rounded-lg border border-gray-200 ${className}`}>
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Application Logs</h3>
          <div className="flex items-center space-x-2">
            {enableFileLogging && (
              <button
                onClick={() => setShowFileContent(!showFileContent)}
                className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded transition-colors"
              >
                {showFileContent ? 'Show Live Logs' : 'Show Log File'}
              </button>
            )}
            <button
              onClick={clearLogs}
              className="px-3 py-1 text-sm bg-red-100 hover:bg-red-200 text-red-700 rounded transition-colors"
            >
              Clear Logs
            </button>
          </div>
        </div>
        
        {!showFileContent && (
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <label htmlFor="log-level-select" className="text-sm font-medium text-gray-700">Level:</label>
              <select
                id="log-level-select"
                value={selectedLevel}
                onChange={(e) => setSelectedLevel(e.target.value === 'all' ? 'all' : parseInt(e.target.value) as LogLevel)}
                className="px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                aria-label="Filter logs by level"
              >
                <option value="all">All Levels</option>
                <option value={LogLevel.DEBUG}>Debug</option>
                <option value={LogLevel.INFO}>Info</option>
                <option value={LogLevel.WARN}>Warning</option>
                <option value={LogLevel.ERROR}>Error</option>
              </select>
            </div>
            
            <div className="flex items-center space-x-2">
              <label className="flex items-center space-x-1 text-sm">
                <input
                  type="checkbox"
                  checked={autoRefresh}
                  onChange={(e) => setAutoRefresh(e.target.checked)}
                  className="rounded"
                />
                <span>Auto-refresh</span>
              </label>
            </div>
            
            <button
              onClick={fetchLogs}
              disabled={loading}
              className="px-3 py-1 text-sm bg-blue-100 hover:bg-blue-200 text-blue-700 rounded transition-colors disabled:opacity-50"
            >
              {loading ? 'Loading...' : 'Refresh'}
            </button>
            
            <button
              onClick={scrollToBottom}
              className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded transition-colors"
            >
              Scroll to Bottom
            </button>
          </div>
        )}
        
        {showFileContent && (
          <button
            onClick={fetchFileContent}
            disabled={loading}
            className="px-3 py-1 text-sm bg-blue-100 hover:bg-blue-200 text-blue-700 rounded transition-colors disabled:opacity-50"
          >
            {loading ? 'Loading...' : 'Load Log File'}
          </button>
        )}
      </div>
      
      <div className="h-96 overflow-auto" ref={logContainerRef}>
        {error && (
          <div 
            className="p-4 bg-red-50 border-l-4 border-red-400"
            role="alert"
            aria-live="assertive"
            aria-atomic="true"
          >
            <p className="text-red-700">{error}</p>
          </div>
        )}
        
        {showFileContent ? (
          <div className="p-4">
            {fileContent ? (
              <pre className="text-xs font-mono whitespace-pre-wrap text-gray-700 bg-gray-50 p-3 rounded">
                {fileContent}
              </pre>
            ) : (
              <p className="text-gray-500 text-center py-8">Click "Load Log File" to view file contents</p>
            )}
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {logs.length === 0 && !loading ? (
              <div 
                className="p-8 text-center text-gray-500"
                role="status"
                aria-live="polite"
                aria-atomic="true"
              >
                No logs available
              </div>
            ) : (
              logs.map((log, index) => (
                <div key={index} className="p-3 hover:bg-gray-50">
                  <div className="flex items-start space-x-3">
                    <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getLevelBadgeColor(log.level)}`}>
                      {LogLevel[log.level]}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2 text-xs text-gray-500 mb-1">
                        <span>{formatTimestamp(log.timestamp)}</span>
                        {log.context && (
                          <span className="px-1 py-0.5 bg-gray-100 rounded text-gray-600">
                            {log.context}
                          </span>
                        )}
                      </div>
                      <p className={`text-sm ${getLevelColor(log.level)} break-words`}>
                        {log.message}
                      </p>
                      {log.data && (
                        <pre className="mt-1 text-xs text-gray-600 bg-gray-50 p-2 rounded overflow-x-auto">
                          {JSON.stringify(log.data, null, 2)}
                        </pre>
                      )}
                      {log.stack && (
                        <pre className="mt-1 text-xs text-red-600 bg-red-50 p-2 rounded overflow-x-auto">
                          {log.stack}
                        </pre>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default LogViewer