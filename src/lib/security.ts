import path from 'path'
import crypto from 'crypto'
import { NextRequest } from 'next/server'

/**
 * Sanitizes file paths to prevent directory traversal attacks
 * @param filePath - The file path to sanitize
 * @param basePath - The base directory that files should be contained within
 * @returns Sanitized path or null if invalid
 */
export function sanitizeFilePath(filePath: string, basePath: string): string | null {
  if (!filePath || !basePath) {
    return null
  }

  // Remove any null bytes
  const cleanPath = filePath.replace(/\0/g, '')
  
  // Normalize the path to resolve any .. or . components
  const normalizedPath = path.normalize(cleanPath)
  
  // Join with base path and resolve
  const fullPath = path.resolve(basePath, normalizedPath)
  
  // Ensure the resolved path is still within the base directory
  if (!fullPath.startsWith(path.resolve(basePath))) {
    return null
  }
  
  return fullPath
}

/**
 * Validates that a string contains only safe characters for identifiers
 * @param identifier - The identifier to validate
 * @returns true if valid, false otherwise
 */
export function validateIdentifier(identifier: string): boolean {
  if (!identifier || typeof identifier !== 'string') {
    return false
  }
  
  // Allow alphanumeric, hyphens, underscores, and dots
  const validPattern = /^[a-zA-Z0-9._-]+$/
  return validPattern.test(identifier) && identifier.length <= 255
}

/**
 * Validates file names to ensure they don't contain dangerous characters
 * @param fileName - The file name to validate
 * @returns true if valid, false otherwise
 */
export function validateFileName(fileName: string): boolean {
  if (!fileName || typeof fileName !== 'string') {
    return false
  }
  
  // Reject files with dangerous characters or patterns
  const dangerousPatterns = [
    /\.\./, // Directory traversal
    /[\x00-\x1f]/, // Control characters
    /[<>:"|?*]/, // Windows reserved characters
    /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i, // Windows reserved names
    /^\.|\.$/, // Files starting or ending with dots
  ]
  
  return !dangerousPatterns.some(pattern => pattern.test(fileName)) && 
         fileName.length <= 255
}

/**
 * Validates numeric parameters with optional min/max constraints
 * @param value - The value to validate
 * @param min - Minimum allowed value (optional)
 * @param max - Maximum allowed value (optional)
 * @returns Validated number or null if invalid
 */
export function validateNumericParam(value: string | null, min?: number, max?: number): number | null {
  if (!value) {
    return null
  }
  
  const num = parseInt(value, 10)
  if (isNaN(num)) {
    return null
  }
  
  if (min !== undefined && num < min) {
    return null
  }
  
  if (max !== undefined && num > max) {
    return null
  }
  
  return num
}

/**
 * Validates string parameters with length constraints
 * @param value - The value to validate
 * @param maxLength - Maximum allowed length
 * @param allowEmpty - Whether empty strings are allowed
 * @returns Validated string or null if invalid
 */
export function validateStringParam(value: string | null, maxLength: number = 1000, allowEmpty: boolean = true): string | null {
  if (!value) {
    return allowEmpty ? '' : null
  }
  
  if (typeof value !== 'string' || value.length > maxLength) {
    return null
  }
  
  return value
}

/**
 * Generates a CSRF token
 * @returns A secure random token
 */
export function generateCSRFToken(): string {
  return crypto.randomBytes(32).toString('hex')
}

/**
 * Validates a CSRF token against the expected token
 * @param token - The token to validate
 * @param expectedToken - The expected token value
 * @returns true if valid, false otherwise
 */
export function validateCSRFToken(token: string | null, expectedToken: string): boolean {
  if (!token || !expectedToken) {
    return false
  }
  
  // Simple string comparison for edge runtime compatibility
  // In production, consider using a more secure comparison method
  return token === expectedToken
}

/**
 * Extracts and validates CSRF token from request headers
 * @param request - The Next.js request object
 * @returns The CSRF token or null if not found/invalid
 */
export function getCSRFTokenFromRequest(request: NextRequest): string | null {
  // Check X-CSRF-Token header first
  let token = request.headers.get('X-CSRF-Token')
  
  if (!token) {
    // Fallback to form data for POST requests
    const contentType = request.headers.get('content-type')
    if (contentType?.includes('application/x-www-form-urlencoded')) {
      // Note: This would need to be implemented based on your form handling
      // For now, we'll just check headers
    }
  }
  
  return token
}

/**
 * Rate limiting helper - simple in-memory store
 * In production, you should use Redis or similar
 */
const rateLimitStore = new Map<string, { count: number; resetTime: number }>()

/**
 * Simple rate limiting function
 * @param key - Unique key for the rate limit (e.g., IP address)
 * @param maxRequests - Maximum requests allowed
 * @param windowMs - Time window in milliseconds
 * @returns true if request is allowed, false if rate limited
 */
export function checkRateLimit(key: string, maxRequests: number = 100, windowMs: number = 60000): boolean {
  const now = Date.now()
  const record = rateLimitStore.get(key)
  
  if (!record || now > record.resetTime) {
    // First request or window expired
    rateLimitStore.set(key, { count: 1, resetTime: now + windowMs })
    return true
  }
  
  if (record.count >= maxRequests) {
    return false
  }
  
  record.count++
  return true
}

/**
 * Sanitizes user input to prevent XSS attacks
 * @param input - The input to sanitize
 * @returns Sanitized string
 */
export function sanitizeInput(input: string): string {
  if (!input || typeof input !== 'string') {
    return ''
  }
  
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;')
}

/**
 * Validates media type parameter
 * @param mediaType - The media type to validate
 * @returns Valid media type or null
 */
export function validateMediaType(mediaType: string | null): string | null {
  if (!mediaType) {
    return null
  }
  
  const validMediaTypes = [
    'texts', 'movies', 'audio', 'software', 'image', 
    'etree', 'data', 'web', 'collection', 'account'
  ]
  
  return validMediaTypes.includes(mediaType) ? mediaType : null
}

/**
 * Validates sort parameter
 * @param sort - The sort parameter to validate
 * @returns Valid sort parameter or default
 */
export function validateSortParam(sort: string | null): string {
  if (!sort) {
    return '-downloads'
  }
  
  const validSorts = [
    'downloads', '-downloads', 'title', '-title', 
    'date', '-date', 'creator', '-creator'
  ]
  
  return validSorts.includes(sort) ? sort : '-downloads'
}