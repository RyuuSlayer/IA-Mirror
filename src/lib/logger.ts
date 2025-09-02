export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3
}

export interface LogEntry {
  timestamp: string
  level: LogLevel
  message: string
  context?: string
  data?: any
  stack?: string
}

class Logger {
  private logs: LogEntry[] = []
  private maxLogs = 1000
  private logFile: string | null = null
  private isClient = typeof window !== 'undefined'

  constructor() {
    if (!this.isClient) {
      // Server-side: conditionally set up file logging based on settings
      this.conditionallySetupFileLogging()
    }
  }

  private async conditionallySetupFileLogging() {
    try {
      // Only import Node.js modules on server side
      if (typeof window === 'undefined') {
        // Check if file logging is enabled in settings
        // Use a safer approach to avoid circular dependencies
        const path = require('path')
        const fs = require('fs')
        const configFile = path.join(process.cwd(), 'config.json')
        
        let enableFileLogging = false
        try {
          if (fs.existsSync(configFile)) {
            const configData = fs.readFileSync(configFile, 'utf8')
            const config = JSON.parse(configData)
            enableFileLogging = config.enableFileLogging || false
          }
        } catch (configError) {
          // If config reading fails, default to false (no file logging)
          enableFileLogging = false
        }
        
        if (enableFileLogging) {
          await this.setupFileLogging()
        }
      }
    } catch (error) {
      console.error('Failed to check file logging settings:', error)
    }
  }

  private async setupFileLogging() {
    try {
      // Only import Node.js modules on server side
      if (typeof window === 'undefined') {
        const path = require('path')
        const fs = require('fs')
        const fsPromises = require('fs/promises')
        
        const logsDir = path.join(process.cwd(), 'logs')
        if (!fs.existsSync(logsDir)) {
          await fsPromises.mkdir(logsDir, { recursive: true })
        }
        this.logFile = path.join(logsDir, `app-${new Date().toISOString().split('T')[0]}.log`)
      }
    } catch (error) {
      console.error('Failed to setup file logging:', error)
    }
  }

  private formatMessage(level: LogLevel, message: string, context?: string, data?: any): string {
    const timestamp = new Date().toISOString()
    const levelStr = LogLevel[level]
    const contextStr = context ? `[${context}]` : ''
    const dataStr = data ? ` ${JSON.stringify(data)}` : ''
    return `${timestamp} ${levelStr} ${contextStr} ${message}${dataStr}`
  }

  private async writeToFile(entry: LogEntry) {
    if (!this.logFile || this.isClient) return
    
    try {
      if (typeof window === 'undefined') {
        const fsPromises = require('fs/promises')
        const logLine = this.formatMessage(entry.level, entry.message, entry.context, entry.data)
        await fsPromises.writeFile(this.logFile, logLine + '\n', { flag: 'a' })
      }
    } catch (error) {
      console.error('Failed to write to log file:', error)
    }
  }

  // Method to enable file logging dynamically
  async enableFileLogging() {
    if (!this.isClient && !this.logFile) {
      await this.setupFileLogging()
    }
  }

  // Method to disable file logging
  disableFileLogging() {
    this.logFile = null
  }

  private addLog(level: LogLevel, message: string, context?: string, data?: any, error?: Error) {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context,
      data,
      stack: error?.stack
    }

    // Add to in-memory logs
    this.logs.push(entry)
    if (this.logs.length > this.maxLogs) {
      this.logs.shift()
    }

    // Write to file (server-side only)
    this.writeToFile(entry)

    // Also log to console for development
    if (process.env.NODE_ENV === 'development') {
      const formattedMessage = this.formatMessage(level, message, context, data)
      switch (level) {
        case LogLevel.DEBUG:
          console.debug(formattedMessage)
          break
        case LogLevel.INFO:
          console.info(formattedMessage)
          break
        case LogLevel.WARN:
          console.warn(formattedMessage)
          break
        case LogLevel.ERROR:
          console.error(formattedMessage, error?.stack || '')
          break
      }
    }
  }

  debug(message: string, context?: string, data?: any) {
    this.addLog(LogLevel.DEBUG, message, context, data)
  }

  info(message: string, context?: string, data?: any) {
    this.addLog(LogLevel.INFO, message, context, data)
  }

  warn(message: string, context?: string, data?: any) {
    this.addLog(LogLevel.WARN, message, context, data)
  }

  error(message: string, context?: string, data?: any, error?: Error) {
    this.addLog(LogLevel.ERROR, message, context, data, error)
  }

  getLogs(level?: LogLevel, limit?: number): LogEntry[] {
    let filteredLogs = this.logs
    
    if (level !== undefined) {
      filteredLogs = this.logs.filter(log => log.level >= level)
    }
    
    if (limit) {
      filteredLogs = filteredLogs.slice(-limit)
    }
    
    return filteredLogs
  }

  clearLogs() {
    this.logs = []
  }

  async getLogFile(): Promise<string | null> {
    if (!this.logFile || this.isClient) return null
    
    try {
      if (typeof window === 'undefined') {
        const fsPromises = require('fs/promises')
        return await fsPromises.readFile(this.logFile, 'utf-8')
      }
      return null
    } catch (error) {
      this.error('Failed to read log file', 'Logger', { error: error instanceof Error ? error.message : String(error) })
      return null
    }
  }
}

// Create singleton instance
const logger = new Logger()

export default logger

// Convenience functions for easier migration from console.log
export const log = {
  debug: (message: string, context?: string, data?: any) => logger.debug(message, context, data),
  info: (message: string, context?: string, data?: any) => logger.info(message, context, data),
  warn: (message: string, context?: string, data?: any) => logger.warn(message, context, data),
  error: (message: string, context?: string, data?: any, error?: Error) => logger.error(message, context, data, error)
}