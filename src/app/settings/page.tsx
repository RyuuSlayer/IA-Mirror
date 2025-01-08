'use client'

import { useState, useEffect } from 'react'

interface Settings {
  storagePath: string
  maxConcurrentDownloads: number
  skipDerivativeFiles: boolean
  skipHashCheck: boolean
}

interface MaintenanceIssue {
  item: string
  file?: string
  error: string
  expected?: number
  actual?: number
}

interface MaintenanceResult {
  success: boolean
  message: string
  issues?: MaintenanceIssue[]
  type?: string
}

const DEFAULT_SETTINGS: Settings = {
  storagePath: '',
  maxConcurrentDownloads: 3,
  skipDerivativeFiles: false,
  skipHashCheck: false
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [maintenanceResult, setMaintenanceResult] = useState<MaintenanceResult | null>(null)
  const [isMaintenanceRunning, setIsMaintenanceRunning] = useState(false)
  const [remainingIssues, setRemainingIssues] = useState<MaintenanceIssue[]>([])

  useEffect(() => {
    fetchSettings()
  }, [])

  useEffect(() => {
    if (maintenanceResult?.issues) {
      setRemainingIssues(maintenanceResult.issues)
    }
  }, [maintenanceResult])

  const fetchSettings = async () => {
    try {
      const response = await fetch('/api/settings')
      if (response.ok) {
        const data = await response.json()
        setSettings({
          storagePath: data.storagePath || '',
          maxConcurrentDownloads: data.maxConcurrentDownloads || 3,
          skipDerivativeFiles: data.skipDerivativeFiles || false,
          skipHashCheck: data.skipHashCheck || false
        })
      }
    } catch (error) {
      console.error('Error fetching settings:', error)
      setError('Failed to load settings')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setMessage('')
    setError('')

    try {
      const response = await fetch('/api/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(settings),
      })

      if (response.ok) {
        setMessage('Settings saved successfully')
      } else {
        const data = await response.json()
        setError(data.error || 'Failed to save settings')
      }
    } catch (error) {
      console.error('Error saving settings:', error)
      setError('Failed to save settings')
    }
  }

  const runMaintenance = async (action: 'refresh-metadata' | 'verify-files' | 'redownload-mismatched' | 'redownload-single' | 'find-derivatives' | 'remove-derivatives' | 'remove-single-derivative', data?: { identifier: string, filename: string }) => {
    if (action !== 'redownload-single' && action !== 'remove-single-derivative') {
      setMaintenanceResult(null)
      setRemainingIssues([])
    }
    setIsMaintenanceRunning(true)
    setMessage('')
    setError('')

    try {
      const response = await fetch('/api/maintenance', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action, ...data }),
      })

      if (response.ok) {
        const result = await response.json()
        if (action === 'redownload-single' && data?.identifier && data?.filename) {
          // Remove the queued item from the remaining issues
          setRemainingIssues(prev => 
            prev.filter(issue => !(issue.item === data.identifier && issue.file === data.filename))
          )
          setMessage(`Queued ${data.filename} for redownload`)
        } else if (action === 'remove-single-derivative' && data?.identifier && data?.filename) {
          if (result.success) {
            // Remove the deleted item from the remaining issues
            setRemainingIssues(prev => 
              prev.filter(issue => !(issue.item === data.identifier && issue.file === data.filename))
            )
            setMessage(result.message)
          } else {
            setError(result.message || 'Failed to remove file')
          }
        } else if (action === 'redownload-mismatched') {
          setMaintenanceResult(null)
          setRemainingIssues([])
          setMessage(result.message)
        } else if (action === 'remove-derivatives') {
          setMaintenanceResult(null)
          setRemainingIssues([])
          setMessage(result.message)
          if (result.error) {
            setError(result.error)
          }
        } else {
          setMaintenanceResult(result)
          if (result.issues) {
            setRemainingIssues(result.issues)
          }
        }
      } else {
        const data = await response.json()
        setError(data.error || 'Maintenance operation failed')
      }
    } catch (error) {
      console.error('Error during maintenance:', error)
      setError('Maintenance operation failed')
    } finally {
      setIsMaintenanceRunning(false)
    }
  }

  if (isLoading) {
    return <div>Loading settings...</div>
  }

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold mb-6">Settings</h1>
      
      <form onSubmit={handleSubmit} className="settings-form">
        <div className="form-group">
          <label htmlFor="storagePath">Storage Directory</label>
          <input
            type="text"
            id="storagePath"
            value={settings.storagePath}
            onChange={(e) => setSettings({ ...settings, storagePath: e.target.value })}
            className="form-input"
            placeholder="Enter storage directory path"
          />
          <p className="input-help">
            Directory where downloaded items will be stored
          </p>
        </div>

        <div className="form-group">
          <label htmlFor="maxConcurrentDownloads">Max Concurrent Downloads</label>
          <input
            type="number"
            id="maxConcurrentDownloads"
            value={settings.maxConcurrentDownloads}
            onChange={(e) => setSettings({ 
              ...settings, 
              maxConcurrentDownloads: Math.max(1, parseInt(e.target.value) || 1)
            })}
            min="1"
            className="form-input"
          />
          <p className="input-help">
            Maximum number of downloads that can run at the same time
          </p>
        </div>

        <div className="mb-4">
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={settings.skipDerivativeFiles}
              onChange={(e) => setSettings({ ...settings, skipDerivativeFiles: e.target.checked })}
              className="mr-2"
            />
            Skip Derivative Files
          </label>
          <div className="text-sm text-gray-600">Only download original files</div>
        </div>

        <div className="mb-4">
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={settings.skipHashCheck}
              onChange={(e) => setSettings({ ...settings, skipHashCheck: e.target.checked })}
              className="mr-2"
            />
            Skip Hash Verification
          </label>
          <div className="text-sm text-gray-600">Only check if files exist, skip MD5/SHA1 verification</div>
        </div>

        <button
          type="submit"
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          Save Settings
        </button>

        <div className="maintenance-section mt-8">
          <h2 className="text-2xl font-bold mb-4">Maintenance</h2>
          
          <div className="maintenance-actions">
            <button
              type="button"
              onClick={() => runMaintenance('refresh-metadata')}
              disabled={isMaintenanceRunning}
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
            >
              {isMaintenanceRunning ? 'Running...' : 'Refresh All Metadata'}
            </button>

            <button
              type="button"
              onClick={() => runMaintenance('verify-files')}
              disabled={isMaintenanceRunning}
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
            >
              {isMaintenanceRunning ? 'Running...' : 'Verify Files'}
            </button>

            <button
              type="button"
              onClick={() => runMaintenance('find-derivatives')}
              disabled={isMaintenanceRunning}
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
            >
              {isMaintenanceRunning ? 'Running...' : 'Find Derivative Files'}
            </button>
          </div>

          {remainingIssues.length > 0 && (
            <div className="maintenance-results mt-4">
              <h3 className="text-xl font-bold mb-2">
                {maintenanceResult?.type === 'derivatives' ? 'Derivative Files Found:' : 'Issues Found:'}
              </h3>
              <div className="flex justify-between items-center mb-4">
                <span>{remainingIssues.length} {maintenanceResult?.type === 'derivatives' ? 'derivative file(s)' : 'issue(s)'} found</span>
                <button
                  type="button"
                  onClick={() => runMaintenance(maintenanceResult?.type === 'derivatives' ? 'remove-derivatives' : 'redownload-mismatched')}
                  disabled={isMaintenanceRunning}
                  className={maintenanceResult?.type === 'derivatives' ? 'bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700' : 'bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700'}
                >
                  {isMaintenanceRunning ? 'Processing...' : maintenanceResult?.type === 'derivatives' ? 'Remove All Derivatives' : 'Queue All for Redownload'}
                </button>
              </div>
              <ul className="issues-list">
                {remainingIssues.map((issue, index) => (
                  <li key={index} className="issue-item">
                    <div className="flex justify-between items-center">
                      <div>
                        <strong>{issue.item}</strong>
                        {issue.file && <span> - File: {issue.file}</span>}
                        {issue.error && <span className="error-text"> - {issue.error}</span>}
                        {issue.expected !== undefined && (
                          <span className="size-mismatch">
                            (Expected: {issue.expected}, Actual: {issue.actual})
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => runMaintenance(
                          maintenanceResult?.type === 'derivatives' ? 'remove-single-derivative' : 'redownload-single',
                          {
                            identifier: issue.item,
                            filename: issue.file
                          }
                        )}
                        disabled={isMaintenanceRunning}
                        className={maintenanceResult?.type === 'derivatives' ? 'bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700' : 'bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700'}
                      >
                        {maintenanceResult?.type === 'derivatives' ? 'Remove' : 'Queue'}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {message && (
          <div className="success-message">
            {message}
          </div>
        )}
        
        {error && (
          <div className="error-message">
            {error}
          </div>
        )}
      </form>
    </div>
  )
}
