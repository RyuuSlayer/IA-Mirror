'use client'

import { useState, useEffect } from 'react'
import ErrorBoundary from '@/components/ErrorBoundary'

// CSRF token utility
const fetchCSRFToken = async (): Promise<string> => {
  const response = await fetch('/api/csrf-token')
  if (!response.ok) {
    throw new Error('Failed to fetch CSRF token')
  }
  const data = await response.json()
  return data.token
}

interface Settings {
  storagePath: string
  maxConcurrentDownloads: number
  skipHashCheck: boolean
  baseUrl: string
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

interface HealthCheckService {
  name: string
  status: 'healthy' | 'unhealthy' | 'degraded'
  message?: string
  responseTime?: number
  lastChecked: string
  details?: Record<string, any>
}

interface HealthCheckResponse {
  status: 'healthy' | 'unhealthy' | 'degraded'
  timestamp: string
  uptime: number
  version?: string
  services: HealthCheckService[]
  summary: {
    total: number
    healthy: number
    unhealthy: number
    degraded: number
  }
}

const DEFAULT_SETTINGS: Settings = {
  storagePath: '',
  maxConcurrentDownloads: 3,
  skipHashCheck: false,
  baseUrl: 'http://localhost:3000'
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [maintenanceResult, setMaintenanceResult] = useState<MaintenanceResult | null>(null)
  const [isMaintenanceRunning, setIsMaintenanceRunning] = useState(false)
  const [remainingIssues, setRemainingIssues] = useState<MaintenanceIssue[]>([])
  const [healthData, setHealthData] = useState<HealthCheckResponse | null>(null)
  const [isHealthLoading, setIsHealthLoading] = useState(false)
  const [healthError, setHealthError] = useState('')

  useEffect(() => {
    fetchSettings()
  }, [])

  useEffect(() => {
    if (maintenanceResult?.issues) {
      setRemainingIssues(maintenanceResult.issues)
    }
  }, [maintenanceResult])

  const fetchHealthStatus = async () => {
    setIsHealthLoading(true)
    setHealthError('')
    
    try {
      const response = await fetch('/api/health')
      if (response.ok) {
        const data = await response.json()
        setHealthData(data)
      } else {
        setHealthError('Failed to fetch health status')
      }
    } catch (error) {
      console.error('Error fetching health status:', error)
      setHealthError('Failed to fetch health status')
    } finally {
      setIsHealthLoading(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'text-green-600 bg-green-50'
      case 'degraded': return 'text-yellow-600 bg-yellow-50'
      case 'unhealthy': return 'text-red-600 bg-red-50'
      default: return 'text-gray-600 bg-gray-50'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy': return '✓'
      case 'degraded': return '⚠'
      case 'unhealthy': return '✗'
      default: return '?'
    }
  }

  const fetchSettings = async () => {
    try {
      const response = await fetch('/api/settings')
      if (response.ok) {
        const data = await response.json()
        setSettings({
          storagePath: data.storagePath || '',
          maxConcurrentDownloads: data.maxConcurrentDownloads || 3,
          skipHashCheck: data.skipHashCheck || false,
          baseUrl: data.baseUrl || 'http://localhost:3000'
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
      // Fetch CSRF token
      const csrfToken = await fetchCSRFToken()
      
      const response = await fetch('/api/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken,
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
    // Only reset maintenance result for new scans, not for actions on existing issues
    if (action === 'refresh-metadata' || action === 'verify-files' || action === 'find-derivatives') {
      setMaintenanceResult(null)
      setRemainingIssues([])
    }
    
    setIsMaintenanceRunning(true)
    setMessage('')
    setError('')

    try {
      const csrfToken = await fetchCSRFToken()
      const response = await fetch('/api/maintenance', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken,
        },
        body: JSON.stringify({ action, ...data }),
      })

      if (response.ok) {
        const result = await response.json()
        
        switch (action) {
          case 'verify-files':
            setMaintenanceResult({
              ...result,
              type: 'verify-files'
            })
            if (result.issues) {
              setRemainingIssues(result.issues)
            }
            break;

          case 'redownload-single':
            if (data?.identifier && data?.filename) {
              // Remove the queued item from the remaining issues
              setRemainingIssues(prev => 
                prev.filter(issue => !(issue.item === data.identifier && issue.file === data.filename))
              )
              setMessage(`Queued ${data.filename} for redownload`)
            }
            break;
            
          case 'redownload-mismatched':
            // Clear all issues since they're all queued
            setMaintenanceResult(null)
            setRemainingIssues([])
            setMessage('All mismatched files have been queued for redownload')
            break;
            
          case 'remove-single-derivative':
            if (result.success && data?.identifier && data?.filename) {
              setRemainingIssues(prev => 
                prev.filter(issue => !(issue.item === data.identifier && issue.file === data.filename))
              )
              setMessage(result.message)
            } else {
              setError(result.message || 'Failed to remove file')
            }
            break;
            
          case 'remove-derivatives':
            setMaintenanceResult(null)
            setRemainingIssues([])
            setMessage(result.message)
            if (result.error) {
              setError(result.error)
            }
            break;
            
          default:
            // For refresh-metadata and find-derivatives
            setMaintenanceResult({
              ...result,
              type: action
            })
            if (result.issues) {
              setRemainingIssues(result.issues)
            }
        }
      } else {
        const errorData = await response.json()
        setError(errorData.error || 'Maintenance operation failed')
      }
    } catch (error) {
      console.error('Error during maintenance:', error)
      setError('Maintenance operation failed')
    } finally {
      setIsMaintenanceRunning(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-4 border-[#428BCA] border-t-transparent"></div>
      </div>
    )
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-[#FAFAFA]">
      <main className="max-w-7xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-[#2C2C2C] mb-8">Settings</h1>

        <div className="space-y-6">
          {/* Settings Form */}
          <section className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-xl font-semibold mb-6">General Settings</h2>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid gap-6">
                <div>
                  <label htmlFor="storagePath" className="block text-sm font-medium text-gray-700 mb-1">
                    Storage Path
                  </label>
                  <input
                    type="text"
                    id="storagePath"
                    value={settings.storagePath}
                    onChange={(e) => setSettings({ ...settings, storagePath: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                    placeholder="/path/to/storage"
                  />
                </div>

                <div>
                  <label htmlFor="maxConcurrentDownloads" className="block text-sm font-medium text-gray-700 mb-1">
                    Max Concurrent Downloads
                  </label>
                  <input
                    type="number"
                    id="maxConcurrentDownloads"
                    value={settings.maxConcurrentDownloads}
                    onChange={(e) => {
                  const value = parseInt(e.target.value, 10)
                  const validValue = isNaN(value) ? 1 : Math.max(1, Math.min(10, value))
                  setSettings({ ...settings, maxConcurrentDownloads: validValue })
                }}
                    min="1"
                    max="10"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label htmlFor="baseUrl" className="block text-sm font-medium text-gray-700 mb-1">
                    Base URL
                  </label>
                  <input
                    type="url"
                    id="baseUrl"
                    value={settings.baseUrl}
                    onChange={(e) => setSettings({ ...settings, baseUrl: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                    placeholder="http://localhost:3000"
                  />
                  <p className="mt-1 text-sm text-gray-500">
                    The base URL for the application (including protocol and port)
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="skipHashCheck"
                      checked={settings.skipHashCheck}
                      onChange={(e) => setSettings({ ...settings, skipHashCheck: e.target.checked })}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <label htmlFor="skipHashCheck" className="ml-2 block text-sm text-gray-700">
                      Skip Hash Check
                    </label>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-4">
                {message && <span className="text-green-600 text-sm">{message}</span>}
                {error && <span className="text-red-600 text-sm">{error}</span>}
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                >
                  Save Settings
                </button>
              </div>
            </form>
          </section>

          {/* Maintenance Section */}
          <section className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-xl font-semibold mb-6">Maintenance</h2>
            
            <div className="space-y-4">
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() => runMaintenance('refresh-metadata')}
                  disabled={isMaintenanceRunning}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 disabled:opacity-50"
                >
                  Refresh Metadata
                </button>
                <button
                  onClick={() => runMaintenance('verify-files')}
                  disabled={isMaintenanceRunning}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 disabled:opacity-50"
                >
                  Verify Files
                </button>
                <button
                  onClick={() => runMaintenance('find-derivatives')}
                  disabled={isMaintenanceRunning}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 disabled:opacity-50"
                >
                  Find Derivatives
                </button>
              </div>

              {isMaintenanceRunning && (
                <div className="flex items-center gap-2 text-gray-600">
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-600 border-t-transparent"></div>
                  Maintenance in progress...
                </div>
              )}

              {maintenanceResult && (
                <div className={`mt-4 p-4 rounded-md ${
                  maintenanceResult.success ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
                }`}>
                  <p className="font-medium">{maintenanceResult.message}</p>
                  
                  {maintenanceResult.issues && maintenanceResult.issues.length > 0 && (
                    <div className="mt-4">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="font-medium">Issues Found: {remainingIssues.length}</h3>
                        {maintenanceResult.type === 'verify-files' && (
                          <button
                            onClick={() => runMaintenance('redownload-mismatched')}
                            disabled={isMaintenanceRunning}
                            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
                          >
                            Queue All for Redownload
                          </button>
                        )}
                        {maintenanceResult.type === 'find-derivatives' && (
                          <button
                            onClick={() => runMaintenance('remove-derivatives')}
                            disabled={isMaintenanceRunning}
                            className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50"
                          >
                            Delete All Derivatives
                          </button>
                        )}
                      </div>
                      <div className="space-y-2">
                        {remainingIssues.map((issue, index) => (
                          <div key={`${issue.item}_${issue.file}_${index}`} className="flex items-start gap-4 p-3 bg-white rounded border">
                            <div className="flex-grow">
                              <p className="font-medium">{issue.item}</p>
                              {issue.file && <p className="text-sm text-gray-600">File: {issue.file}</p>}
                              <p className="text-sm text-red-600">{issue.error}</p>
                              {issue.expected !== undefined && (
                                <p className="text-sm text-gray-600">
                                  Expected: {issue.expected}, Actual: {issue.actual}
                                </p>
                              )}
                            </div>
                            {maintenanceResult.type === 'verify-files' && (
                              <button
                                onClick={() => runMaintenance('redownload-single', { 
                                  identifier: issue.item,
                                  filename: issue.file || ''
                                })}
                                disabled={isMaintenanceRunning}
                                className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
                              >
                                Queue for Redownload
                              </button>
                            )}
                            {maintenanceResult.type === 'find-derivatives' && (
                              <button
                                onClick={() => runMaintenance('remove-single-derivative', { 
                                  identifier: issue.item,
                                  filename: issue.file || ''
                                })}
                                disabled={isMaintenanceRunning}
                                className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50"
                              >
                                Delete Derivative
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </section>

          {/* Health Section */}
          <section className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold">System Health</h2>
              <button
                onClick={fetchHealthStatus}
                disabled={isHealthLoading}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
              >
                {isHealthLoading ? 'Checking...' : 'Check Health'}
              </button>
            </div>

            {healthError && (
              <div className="mb-4 p-4 bg-red-50 text-red-800 rounded-md">
                {healthError}
              </div>
            )}

            {healthData && (
              <div className="space-y-4">
                {/* Overall Status */}
                <div className={`p-4 rounded-md ${getStatusColor(healthData.status)}`}>
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-bold">{getStatusIcon(healthData.status)}</span>
                    <span className="font-medium capitalize">System Status: {healthData.status}</span>
                  </div>
                  <div className="mt-2 text-sm">
                    <p>Last checked: {new Date(healthData.timestamp).toLocaleString()}</p>
                    <p>Uptime: {Math.floor(healthData.uptime / 1000 / 60)} minutes</p>
                    {healthData.version && <p>Version: {healthData.version}</p>}
                  </div>
                </div>

                {/* Services Summary */}
                <div className="grid grid-cols-4 gap-4">
                  <div className="text-center p-3 bg-gray-50 rounded">
                    <div className="text-2xl font-bold text-gray-700">{healthData.summary.total}</div>
                    <div className="text-sm text-gray-600">Total Services</div>
                  </div>
                  <div className="text-center p-3 bg-green-50 rounded">
                    <div className="text-2xl font-bold text-green-600">{healthData.summary.healthy}</div>
                    <div className="text-sm text-green-600">Healthy</div>
                  </div>
                  <div className="text-center p-3 bg-yellow-50 rounded">
                    <div className="text-2xl font-bold text-yellow-600">{healthData.summary.degraded}</div>
                    <div className="text-sm text-yellow-600">Degraded</div>
                  </div>
                  <div className="text-center p-3 bg-red-50 rounded">
                    <div className="text-2xl font-bold text-red-600">{healthData.summary.unhealthy}</div>
                    <div className="text-sm text-red-600">Unhealthy</div>
                  </div>
                </div>

                {/* Individual Services */}
                <div className="space-y-3">
                  <h3 className="font-medium text-gray-900">Service Details</h3>
                  {healthData.services.map((service, index) => (
                    <div key={index} className={`p-4 rounded-md border ${getStatusColor(service.status)}`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-bold">{getStatusIcon(service.status)}</span>
                          <span className="font-medium capitalize">{service.name}</span>
                          <span className={`px-2 py-1 text-xs rounded-full ${
                            service.status === 'healthy' ? 'bg-green-100 text-green-800' :
                            service.status === 'degraded' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {service.status}
                          </span>
                        </div>
                        {service.responseTime && (
                          <span className="text-sm text-gray-600">{service.responseTime}ms</span>
                        )}
                      </div>
                      {service.message && (
                        <p className="mt-2 text-sm">{service.message}</p>
                      )}
                      {service.details && Object.keys(service.details).length > 0 && (
                        <div className="mt-2 text-xs text-gray-600">
                          <details>
                            <summary className="cursor-pointer hover:text-gray-800">View Details</summary>
                            <pre className="mt-1 p-2 bg-gray-100 rounded text-xs overflow-x-auto">
                              {JSON.stringify(service.details, null, 2)}
                            </pre>
                          </details>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {!healthData && !isHealthLoading && (
              <div className="text-center py-8 text-gray-500">
                <p>Click "Check Health" to view system status</p>
              </div>
            )}
          </section>
        </div>
        </main>
      </div>
    </ErrorBoundary>
  )
}
