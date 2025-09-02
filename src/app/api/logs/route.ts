import { NextRequest, NextResponse } from 'next/server'
import logger, { LogLevel } from '@/lib/logger'
import { readSettings } from '@/lib/config'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const levelParam = searchParams.get('level')
    const limitParam = searchParams.get('limit')
    const fileParam = searchParams.get('file')

    // If requesting log file content
    if (fileParam === 'true') {
      const settings = readSettings()
      if (!settings.enableFileLogging) {
        return NextResponse.json({ 
          success: true, 
          fileContent: null,
          available: false,
          message: 'File logging is disabled'
        })
      }
      
      const fileContent = await logger.getLogFile()
      return NextResponse.json({ 
        success: true, 
        fileContent,
        available: fileContent !== null
      })
    }

    // Parse parameters
    const level = levelParam ? parseInt(levelParam) as LogLevel : undefined
    const limit = limitParam ? parseInt(limitParam) : 100

    // Get logs
    const logs = logger.getLogs(level, limit)

    return NextResponse.json({
      success: true,
      logs,
      total: logs.length
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    logger.error('Error fetching logs', 'LogsAPI', { error: errorMessage }, error instanceof Error ? error : undefined)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch logs' },
      { status: 500 }
    )
  }
}

export async function DELETE() {
  try {
    logger.clearLogs()
    logger.info('Logs cleared via API', 'LogsAPI')
    
    return NextResponse.json({
      success: true,
      message: 'Logs cleared successfully'
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    logger.error('Error clearing logs', 'LogsAPI', { error: errorMessage }, error instanceof Error ? error : undefined)
    return NextResponse.json(
      { success: false, error: 'Failed to clear logs' },
      { status: 500 }
    )
  }
}