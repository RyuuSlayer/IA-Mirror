import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { getConfig } from '@/lib/config'
import { readDownloads } from '@/lib/downloads'
import { retryFetch, RETRY_CONFIGS } from '@/lib/retry'
import { healthCache } from '@/lib/cache'
import { log } from '@/lib/logger'
import type { HealthCheckResponse, HealthCheckService } from '@/types/api'

const startTime = Date.now()

// Get package.json version
function getVersion(): string {
  try {
    const packagePath = path.join(process.cwd(), 'package.json')
    const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'))
    return packageJson.version || 'unknown'
  } catch {
    return 'unknown'
  }
}

// Check storage directory accessibility
async function checkStorageHealth(): Promise<HealthCheckService> {
  const startTime = Date.now()
  try {
    const config = await getConfig()
    const storagePath = config.cacheDir
    
    // Check if storage directory exists
    if (!fs.existsSync(storagePath)) {
      return {
        name: 'storage',
        status: 'unhealthy',
        message: 'Storage directory does not exist',
        responseTime: Date.now() - startTime,
        lastChecked: new Date().toISOString(),
        details: { path: storagePath }
      }
    }
    
    // Check if storage directory is writable
    const testFile = path.join(storagePath, '.health-check-test')
    try {
      fs.writeFileSync(testFile, 'test')
      fs.unlinkSync(testFile)
    } catch {
      return {
        name: 'storage',
        status: 'unhealthy',
        message: 'Storage directory is not writable',
        responseTime: Date.now() - startTime,
        lastChecked: new Date().toISOString(),
        details: { path: storagePath }
      }
    }
    
    // Get storage stats
    const stats = fs.statSync(storagePath)
    
    return {
      name: 'storage',
      status: 'healthy',
      message: 'Storage directory is accessible and writable',
      responseTime: Date.now() - startTime,
      lastChecked: new Date().toISOString(),
      details: {
        path: storagePath,
        created: stats.birthtime,
        modified: stats.mtime
      }
    }
  } catch (error) {
    return {
      name: 'storage',
      status: 'unhealthy',
      message: `Storage check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      responseTime: Date.now() - startTime,
      lastChecked: new Date().toISOString()
    }
  }
}

// Check configuration health
async function checkConfigHealth(): Promise<HealthCheckService> {
  const startTime = Date.now()
  try {
    const config = await getConfig()
    
    // Validate required config fields
    const requiredFields = ['cacheDir', 'maxConcurrentDownloads']
    const missingFields = requiredFields.filter(field => !config[field as keyof typeof config])
    
    if (missingFields.length > 0) {
      return {
        name: 'configuration',
        status: 'degraded',
        message: `Missing configuration fields: ${missingFields.join(', ')}`,
        responseTime: Date.now() - startTime,
        lastChecked: new Date().toISOString(),
        details: { missingFields }
      }
    }
    
    return {
      name: 'configuration',
      status: 'healthy',
      message: 'Configuration is valid',
      responseTime: Date.now() - startTime,
      lastChecked: new Date().toISOString(),
      details: {
        cacheDir: config.cacheDir,
        maxConcurrentDownloads: config.maxConcurrentDownloads,
        skipHashCheck: config.skipHashCheck
      }
    }
  } catch (error) {
    return {
      name: 'configuration',
      status: 'unhealthy',
      message: `Configuration check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      responseTime: Date.now() - startTime,
      lastChecked: new Date().toISOString()
    }
  }
}

// Check downloads system health
function checkDownloadsHealth(): HealthCheckService {
  const startTime = Date.now()
  try {
    const downloads = readDownloads()
    const activeDownloads = downloads.filter(d => d.status === 'downloading' || d.status === 'queued')
    const failedDownloads = downloads.filter(d => d.status === 'failed')
    
    let status: 'healthy' | 'unhealthy' | 'degraded' = 'healthy'
    let message = 'Downloads system is operational'
    
    if (failedDownloads.length > downloads.length * 0.5) {
      status = 'degraded'
      message = 'High number of failed downloads detected'
    }
    
    return {
      name: 'downloads',
      status,
      message,
      responseTime: Date.now() - startTime,
      lastChecked: new Date().toISOString(),
      details: {
        total: downloads.length,
        active: activeDownloads.length,
        failed: failedDownloads.length,
        completed: downloads.filter(d => d.status === 'completed').length
      }
    }
  } catch (error) {
    return {
      name: 'downloads',
      status: 'unhealthy',
      message: `Downloads check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      responseTime: Date.now() - startTime,
      lastChecked: new Date().toISOString()
    }
  }
}

// Check Internet Archive connectivity
async function checkInternetArchiveHealth(): Promise<HealthCheckService> {
  const startTime = Date.now()
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000) // 10 second timeout for retries
    
    // Test with Internet Archive's advancedsearch API to verify connectivity with retry logic
    const response = await retryFetch(
      'https://archive.org/advancedsearch.php?q=identifier:stats&output=json&rows=1',
      {
        method: 'GET',
        signal: controller.signal
      },
      RETRY_CONFIGS.HEALTH_CHECK
    )
    
    clearTimeout(timeoutId)
    
    if (response.ok) {
      return {
        name: 'internet_archive',
        status: 'healthy',
        message: 'Internet Archive is accessible',
        responseTime: Date.now() - startTime,
        lastChecked: new Date().toISOString(),
        details: { statusCode: response.status }
      }
    } else {
      return {
        name: 'internet_archive',
        status: 'degraded',
        message: `Internet Archive returned status ${response.status}`,
        responseTime: Date.now() - startTime,
        lastChecked: new Date().toISOString(),
        details: { statusCode: response.status }
      }
    }
  } catch (error) {
    return {
      name: 'internet_archive',
      status: 'unhealthy',
      message: `Internet Archive connectivity failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      responseTime: Date.now() - startTime,
      lastChecked: new Date().toISOString()
    }
  }
}

export async function GET(request: NextRequest): Promise<NextResponse<HealthCheckResponse>> {
  // Check cache first (short TTL for health checks)
  const cacheKey = 'health-status'
  const cachedHealth = healthCache.get(cacheKey)
  
  if (cachedHealth) {
    log.debug('Using cached health status', 'health-api')
    return NextResponse.json(cachedHealth)
  }
  
  log.debug('Generating fresh health status', 'health-api')
  const timestamp = new Date().toISOString()
  const uptime = Date.now() - startTime
  
  // Run all health checks
  const services = await Promise.all([
    checkStorageHealth(),
    checkConfigHealth(),
    checkDownloadsHealth(),
    checkInternetArchiveHealth()
  ])
  
  // Calculate summary
  const summary = {
    total: services.length,
    healthy: services.filter(s => s.status === 'healthy').length,
    unhealthy: services.filter(s => s.status === 'unhealthy').length,
    degraded: services.filter(s => s.status === 'degraded').length
  }
  
  // Determine overall status
  let overallStatus: 'healthy' | 'unhealthy' | 'degraded' = 'healthy'
  if (summary.unhealthy > 0) {
    overallStatus = 'unhealthy'
  } else if (summary.degraded > 0) {
    overallStatus = 'degraded'
  }
  
  const healthResponse: HealthCheckResponse = {
    status: overallStatus,
    timestamp,
    uptime,
    version: getVersion(),
    services,
    summary
  }
  
  // Cache the result
  healthCache.set(cacheKey, healthResponse)
  
  // Set appropriate HTTP status code
  const httpStatus = overallStatus === 'healthy' ? 200 : overallStatus === 'degraded' ? 200 : 503
  
  return NextResponse.json(healthResponse, { status: httpStatus })
}