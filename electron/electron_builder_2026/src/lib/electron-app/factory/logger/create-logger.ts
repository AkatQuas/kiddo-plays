import { app } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import winston, { type Logger, format } from 'winston'
import 'winston-daily-rotate-file'
import DailyRotateFile from 'winston-daily-rotate-file'

// Singleton cache map: ensures only ONE logger instance per label
const LOG_INSTANCES = new Map<string, Logger>()

export type LoggerLabel = 'main' | 'error' | 'window' | 'ipc' | 'updater'

/**
 * Factory function to create a LAZY, SINGLETON logger for Electron main process
 * Persists logs to files with auto-rotation, outputs to console with colors
 * @param label - Category/module name for the logger
 * @returns Winston logger instance (singleton)
 */
export function createLogger(label: LoggerLabel): Logger {
  if (LOG_INSTANCES.has(label)) {
    return LOG_INSTANCES.get(label) as Logger
  }

  const LOG_DIRECTORY = path.join(app.getPath('userData'), 'logs')

  if (!fs.existsSync(LOG_DIRECTORY)) {
    fs.mkdirSync(LOG_DIRECTORY, { recursive: true })
  }

  // ------------------------------
  // Log format for FILE storage (JSON, structured, machine-readable)
  // ------------------------------
  const fileLogFormat = format.combine(
    format.timestamp({ format: 'yyyy-MM-dd HH:mm:ss' }),
    format.errors({ stack: true }),
    format.json()
  )

  // ------------------------------
  // Log format for CONSOLE (colored, human-readable)
  // ------------------------------
  const consoleLogFormat = format.combine(
    format.colorize(),
    format.timestamp({ format: 'HH:mm:ss' }),
    format.printf(log => {
      const { timestamp, level, message, label, stack } = log
      return `[${timestamp}] [${level}] [${label}] ${stack || message}`
    })
  )

  // ------------------------------
  // Auto-rotate log file transport (daily + size limit)
  // ------------------------------
  const fileTransport: DailyRotateFile = new DailyRotateFile({
    dirname: LOG_DIRECTORY,
    filename: `${label}-%DATE%.log`,
    datePattern: 'yyyy-MM-dd',
    maxFiles: '15d',
    maxSize: '20m',
    format: fileLogFormat,
  })

  const logger = winston.createLogger({
    defaultMeta: { label },
    transports: [
      // Console transport for development
      new winston.transports.Console({ format: consoleLogFormat }),
      // File transport for persistent logging
      fileTransport,
    ],
  })

  LOG_INSTANCES.set(label, logger)

  return logger
}

// Auto cleanup on Electron quit
app.on('quit', () => {
  for (const logger of LOG_INSTANCES.values()) {
    // Flush and close all transports
    logger.close()
  }
  LOG_INSTANCES.clear()
})
