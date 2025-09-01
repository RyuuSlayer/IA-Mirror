// Custom error types for better error handling

export class ValidationError extends Error {
  constructor(message: string, public field?: string) {
    super(message)
    this.name = 'ValidationError'
  }
}

export class NetworkError extends Error {
  constructor(message: string, public statusCode?: number, public url?: string) {
    super(message)
    this.name = 'NetworkError'
  }
}

export class FileSystemError extends Error {
  constructor(message: string, public path?: string, public operation?: string) {
    super(message)
    this.name = 'FileSystemError'
  }
}

export class ProcessError extends Error {
  constructor(message: string, public pid?: number, public exitCode?: number) {
    super(message)
    this.name = 'ProcessError'
  }
}

export class MetadataError extends Error {
  constructor(message: string, public identifier?: string) {
    super(message)
    this.name = 'MetadataError'
  }
}

export class DownloadError extends Error {
  constructor(message: string, public identifier?: string, public file?: string) {
    super(message)
    this.name = 'DownloadError'
  }
}

export class ConfigurationError extends Error {
  constructor(message: string, public setting?: string) {
    super(message)
    this.name = 'ConfigurationError'
  }
}

export class AuthenticationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AuthenticationError'
  }
}

// Error handler utility functions
export function handleApiError(error: unknown): { message: string; statusCode: number } {
  if (error instanceof ValidationError) {
    return { message: error.message, statusCode: 400 }
  }
  
  if (error instanceof NetworkError) {
    return { message: error.message, statusCode: error.statusCode || 502 }
  }
  
  if (error instanceof FileSystemError) {
    return { message: `File operation failed: ${error.message}`, statusCode: 500 }
  }
  
  if (error instanceof ProcessError) {
    return { message: `Process error: ${error.message}`, statusCode: 500 }
  }
  
  if (error instanceof MetadataError) {
    return { message: `Metadata error: ${error.message}`, statusCode: 404 }
  }
  
  if (error instanceof DownloadError) {
    return { message: `Download error: ${error.message}`, statusCode: 500 }
  }
  
  if (error instanceof ConfigurationError) {
    return { message: `Configuration error: ${error.message}`, statusCode: 500 }
  }
  
  if (error instanceof AuthenticationError) {
    return { message: error.message, statusCode: 401 }
  }
  
  // Generic error fallback
  const message = error instanceof Error ? error.message : 'Unknown error occurred'
  return { message, statusCode: 500 }
}

// User-friendly error messages for UI
export function getUserFriendlyMessage(error: unknown): string {
  if (error instanceof ValidationError) {
    return `Please check your input: ${error.message}`
  }
  
  if (error instanceof NetworkError) {
    if (error.statusCode === 404) {
      return 'The requested resource was not found'
    }
    if (error.statusCode && error.statusCode >= 500) {
      return 'Server is temporarily unavailable. Please try again later.'
    }
    return 'Network connection failed. Please check your internet connection.'
  }
  
  if (error instanceof FileSystemError) {
    return 'File operation failed. Please check file permissions and disk space.'
  }
  
  if (error instanceof ProcessError) {
    return 'Download process failed. Please try again.'
  }
  
  if (error instanceof MetadataError) {
    return 'Unable to load item information. The item may not exist.'
  }
  
  if (error instanceof DownloadError) {
    return 'Download failed. Please try again or check your settings.'
  }
  
  if (error instanceof ConfigurationError) {
    return 'Configuration error. Please check your settings.'
  }
  
  if (error instanceof AuthenticationError) {
    return 'Authentication failed. Please refresh the page and try again.'
  }
  
  return 'An unexpected error occurred. Please try again.'
}

// Retry logic for specific error types
export function shouldRetry(error: unknown, attempt: number, maxAttempts: number): boolean {
  if (attempt >= maxAttempts) return false
  
  if (error instanceof NetworkError) {
    // Retry on temporary network errors
    return !error.statusCode || error.statusCode >= 500 || error.statusCode === 429
  }
  
  if (error instanceof ProcessError) {
    // Retry process errors once
    return attempt < 2
  }
  
  // Don't retry validation, authentication, or file system errors
  if (error instanceof ValidationError || 
      error instanceof AuthenticationError || 
      error instanceof FileSystemError) {
    return false
  }
  
  return true
}