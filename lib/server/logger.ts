/**
 * Structured Logger Module
 * Provides structured logging with context support for production environments.
 */

type LogLevel = "debug" | "info" | "warn" | "error";

interface LogContext {
  requestId?: string;
  ip?: string;
  path?: string;
  method?: string;
  durationMs?: number;
  [key: string]: unknown;
}

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  service: string;
  version: string;
  environment: string;
  context?: LogContext;
}

const SERVICE_NAME = "gesture-tetris-api";
const VERSION = process.env.npm_package_version ?? "1.0.0";
const ENVIRONMENT = process.env.NODE_ENV ?? "development";
const LOG_LEVEL = (process.env.LOG_LEVEL ?? "info") as LogLevel;

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3
};

function shouldLog(level: LogLevel): boolean {
  return LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[LOG_LEVEL];
}

function formatEntry(entry: LogEntry): string {
  if (ENVIRONMENT === "production") {
    return JSON.stringify(entry);
  }

  const contextStr = entry.context ? ` ${JSON.stringify(entry.context)}` : "";
  return `[${entry.timestamp}] [${entry.level.toUpperCase()}] ${entry.message}${contextStr}`;
}

function log(level: LogLevel, message: string, context?: LogContext): void {
  if (!shouldLog(level)) {
    return;
  }

  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    service: SERVICE_NAME,
    version: VERSION,
    environment: ENVIRONMENT,
    ...(context && { context })
  };

  const formatted = formatEntry(entry);

  switch (level) {
    case "debug":
    case "info":
      console.log(formatted);
      break;
    case "warn":
      console.warn(formatted);
      break;
    case "error":
      console.error(formatted);
      break;
  }
}

/**
 * Creates a child logger with pre-bound context (e.g., requestId).
 */
export function createLogger(baseContext: LogContext) {
  return {
    debug: (message: string, context?: LogContext) =>
      log("debug", message, { ...baseContext, ...context }),
    info: (message: string, context?: LogContext) =>
      log("info", message, { ...baseContext, ...context }),
    warn: (message: string, context?: LogContext) =>
      log("warn", message, { ...baseContext, ...context }),
    error: (message: string, context?: LogContext) =>
      log("error", message, { ...baseContext, ...context })
  };
}

/**
 * Default global logger instance.
 */
export const logger = {
  debug: (message: string, context?: LogContext) => log("debug", message, context),
  info: (message: string, context?: LogContext) => log("info", message, context),
  warn: (message: string, context?: LogContext) => log("warn", message, context),
  error: (message: string, context?: LogContext) => log("error", message, context)
};

/**
 * Logs request completion with timing information.
 */
export function logRequestComplete(
  method: string,
  path: string,
  status: number,
  durationMs: number,
  context?: LogContext
): void {
  const level: LogLevel = status >= 500 ? "error" : status >= 400 ? "warn" : "info";
  log(level, `${method} ${path} ${status} ${durationMs}ms`, {
    ...context,
    status,
    durationMs
  });
}
