/**
 * Structured Logger
 * 
 * Provides consistent, structured logging with Vercel Log Drain compatibility.
 * Follows OpenTelemetry semantic conventions where applicable.
 * 
 * @see https://vercel.com/docs/observability/log-drains
 * @see https://opentelemetry.io/docs/specs/semconv/
 */

import { SERVICE_NAME } from './site-config'

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal'

export interface LogContext {
  // Request context
  requestId?: string
  traceId?: string
  spanId?: string
  
  // User/session context
  tenantId?: string
  sessionId?: string
  fingerprint?: string
  
  // Request metadata
  method?: string
  path?: string
  statusCode?: number
  duration?: number
  userAgent?: string
  ip?: string
  
  // Geo context
  country?: string
  region?: string
  city?: string
  
  // Error context
  error?: Error | string
  stack?: string
  
  // Custom fields
  [key: string]: unknown
}

interface LogEntry {
  timestamp: string
  level: LogLevel
  message: string
  service: string
  version: string
  environment: string
  context: LogContext
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  fatal: 4,
}

class Logger {
  private service: string
  private version: string
  private environment: string
  private minLevel: LogLevel
  
  constructor() {
    this.service = SERVICE_NAME
    this.version = process.env.npm_package_version || '1.0.0'
    this.environment = process.env.NODE_ENV || 'development'
    this.minLevel = (process.env.LOG_LEVEL as LogLevel) || 'info'
  }
  
  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] >= LOG_LEVELS[this.minLevel]
  }
  
  private formatEntry(level: LogLevel, message: string, context: LogContext = {}): LogEntry {
    // Handle error objects
    if (context.error instanceof Error) {
      context.stack = context.error.stack
      context.error = context.error.message
    }
    
    return {
      timestamp: new Date().toISOString(),
      level,
      message,
      service: this.service,
      version: this.version,
      environment: this.environment,
      context,
    }
  }
  
  private output(entry: LogEntry): void {
    const json = JSON.stringify(entry)
    
    switch (entry.level) {
      case 'debug':
        console.debug(json)
        break
      case 'info':
        console.info(json)
        break
      case 'warn':
        console.warn(json)
        break
      case 'error':
      case 'fatal':
        console.error(json)
        break
    }
  }
  
  debug(message: string, context?: LogContext): void {
    if (this.shouldLog('debug')) {
      this.output(this.formatEntry('debug', message, context))
    }
  }
  
  info(message: string, context?: LogContext): void {
    if (this.shouldLog('info')) {
      this.output(this.formatEntry('info', message, context))
    }
  }
  
  warn(message: string, context?: LogContext): void {
    if (this.shouldLog('warn')) {
      this.output(this.formatEntry('warn', message, context))
    }
  }
  
  error(message: string, context?: LogContext): void {
    if (this.shouldLog('error')) {
      this.output(this.formatEntry('error', message, context))
    }
  }
  
  fatal(message: string, context?: LogContext): void {
    if (this.shouldLog('fatal')) {
      this.output(this.formatEntry('fatal', message, context))
    }
  }
  
  // Create a child logger with preset context
  child(baseContext: LogContext): ChildLogger {
    return new ChildLogger(this, baseContext)
  }
  
  // Log HTTP request/response
  request(
    method: string,
    path: string,
    statusCode: number,
    duration: number,
    context?: LogContext
  ): void {
    const level: LogLevel = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info'
    this.output(this.formatEntry(level, `${method} ${path} ${statusCode} ${duration}ms`, {
      method,
      path,
      statusCode,
      duration,
      ...context,
    }))
  }
  
  // Log MCP tool calls
  mcp(toolName: string, success: boolean, duration: number, context?: LogContext): void {
    const level: LogLevel = success ? 'info' : 'warn'
    this.output(this.formatEntry(level, `MCP tool: ${toolName} ${success ? 'success' : 'failed'} ${duration}ms`, {
      toolName,
      success,
      duration,
      ...context,
    }))
  }
  
  // Log database queries
  db(operation: string, table: string, duration: number, context?: LogContext): void {
    this.output(this.formatEntry('debug', `DB: ${operation} ${table} ${duration}ms`, {
      operation,
      table,
      duration,
      ...context,
    }))
  }
}

class ChildLogger {
  private parent: Logger
  private baseContext: LogContext
  
  constructor(parent: Logger, baseContext: LogContext) {
    this.parent = parent
    this.baseContext = baseContext
  }
  
  debug(message: string, context?: LogContext): void {
    this.parent.debug(message, { ...this.baseContext, ...context })
  }
  
  info(message: string, context?: LogContext): void {
    this.parent.info(message, { ...this.baseContext, ...context })
  }
  
  warn(message: string, context?: LogContext): void {
    this.parent.warn(message, { ...this.baseContext, ...context })
  }
  
  error(message: string, context?: LogContext): void {
    this.parent.error(message, { ...this.baseContext, ...context })
  }
  
  fatal(message: string, context?: LogContext): void {
    this.parent.fatal(message, { ...this.baseContext, ...context })
  }
}

// Singleton instance
export const logger = new Logger()

// Request ID generator
export function generateRequestId(): string {
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`
}

// Middleware helper to extract request context
export function getRequestContext(request: Request, requestId?: string): LogContext {
  const url = new URL(request.url)
  const headers = request.headers
  
  return {
    requestId: requestId || generateRequestId(),
    method: request.method,
    path: url.pathname,
    userAgent: headers.get('user-agent') || undefined,
    ip: headers.get('x-forwarded-for')?.split(',')[0] || 
        headers.get('x-real-ip') || 
        undefined,
    country: headers.get('x-vercel-ip-country') || undefined,
    region: headers.get('x-vercel-ip-country-region') || undefined,
    city: headers.get('x-vercel-ip-city') || undefined,
  }
}

export default logger
