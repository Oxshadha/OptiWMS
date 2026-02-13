/**
 * Production-Safe Logging Utility
 * 
 * Usage:
 *   logger.log('Debug info'); // Only logs in development
 *   logger.error('Error occurred'); // Logs in dev, reports in production
 *   logger.warn('Warning message');
 * 
 * In production, errors should be sent to monitoring service (Sentry, Datadog, etc.)
 */

const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const IS_DEVELOPMENT = process.env.NODE_ENV === 'development';

// Sensitive data patterns to filter out
const SENSITIVE_PATTERNS = [
  /token/i,
  /password/i,
  /secret/i,
  /api[_-]?key/i,
  /authorization/i,
  /bearer/i,
  /jwt/i,
];

/**
 * Check if message contains sensitive data
 */
function containsSensitiveData(message: string): boolean {
  return SENSITIVE_PATTERNS.some(pattern => pattern.test(message));
}

/**
 * Sanitize message to remove sensitive data
 */
function sanitizeMessage(message: any): any {
  if (message instanceof Error) {
    return {
      name: message.name,
      message: message.message,
      stack: message.stack,
    };
  }

  if (typeof message === 'string') {
    if (containsSensitiveData(message)) {
      return '[REDACTED - Sensitive Data]';
    }
    return message;
  }
  
  if (typeof message === 'object' && message !== null) {
    const sanitized: any = Array.isArray(message) ? [] : {};
    for (const key in message) {
      if (containsSensitiveData(key)) {
        sanitized[key] = '[REDACTED]';
      } else {
        sanitized[key] = sanitizeMessage(message[key]);
      }
    }
    return sanitized;
  }
  
  return message;
}

/**
 * Send error to monitoring service (implement based on your service)
 */
function sendToMonitoring(level: string, message: string, ...args: any[]) {
  // TODO: Implement error reporting service integration
  // Examples:
  // - Sentry: Sentry.captureException(new Error(message));
  // - Datadog: DD_LOGS.logger.error(message, ...args);
  // - Custom API: fetch('/api/logs', { method: 'POST', body: JSON.stringify({ level, message, args }) });
  
  // For now, just store critical errors in localStorage for later analysis
  if (IS_PRODUCTION && (level === 'error' || level === 'warn')) {
    try {
      const logs = JSON.parse(localStorage.getItem('error_logs') || '[]');
      logs.push({
        level,
        message: sanitizeMessage(message),
        timestamp: new Date().toISOString(),
        url: window.location.href,
      });
      // Keep only last 50 errors
      if (logs.length > 50) {
        logs.shift();
      }
      localStorage.setItem('error_logs', JSON.stringify(logs));
    } catch (e) {
      // Silently fail if localStorage is full or unavailable
    }
  }
}

export const logger = {
  /**
   * Log debug information (development only)
   */
  log: (...args: any[]) => {
    if (IS_DEVELOPMENT) {
      console.log(...args);
    }
  },

  /**
   * Log errors (always report, only show in development)
   */
  error: (...args: any[]) => {
    const sanitizedArgs = args.map(sanitizeMessage);
    
    if (IS_DEVELOPMENT) {
      console.error(...sanitizedArgs);
    }
    
    // In production, send to monitoring service
    if (IS_PRODUCTION) {
      sendToMonitoring('error', String(sanitizedArgs[0]), ...sanitizedArgs.slice(1));
    }
  },

  /**
   * Log warnings (development only by default, can be enabled in production)
   */
  warn: (...args: any[]) => {
    const sanitizedArgs = args.map(sanitizeMessage);
    
    if (IS_DEVELOPMENT) {
      console.warn(...sanitizedArgs);
    }
    
    // Optionally send warnings to monitoring in production
    if (IS_PRODUCTION && process.env.NEXT_PUBLIC_LOG_WARNINGS === 'true') {
      sendToMonitoring('warn', String(sanitizedArgs[0]), ...sanitizedArgs.slice(1));
    }
  },

  /**
   * Log info messages (development only)
   */
  info: (...args: any[]) => {
    if (IS_DEVELOPMENT) {
      console.info(...args);
    }
  },

  /**
   * Log debug messages (development only)
   */
  debug: (...args: any[]) => {
    if (IS_DEVELOPMENT) {
      console.debug(...args);
    }
  },

  /**
   * Group logs (development only)
   */
  group: (label: string) => {
    if (IS_DEVELOPMENT) {
      console.group(label);
    }
  },

  /**
   * End group (development only)
   */
  groupEnd: () => {
    if (IS_DEVELOPMENT) {
      console.groupEnd();
    }
  },

  /**
   * Log table (development only)
   */
  table: (data: any) => {
    if (IS_DEVELOPMENT) {
      console.table(data);
    }
  },

  /**
   * Performance timing (development only)
   */
  time: (label: string) => {
    if (IS_DEVELOPMENT) {
      console.time(label);
    }
  },

  /**
   * End performance timing (development only)
   */
  timeEnd: (label: string) => {
    if (IS_DEVELOPMENT) {
      console.timeEnd(label);
    }
  },
};

// Export a function to retrieve stored error logs (for debugging or support)
export function getErrorLogs(): any[] {
  try {
    return JSON.parse(localStorage.getItem('error_logs') || '[]');
  } catch {
    return [];
  }
}

// Export a function to clear error logs
export function clearErrorLogs(): void {
  try {
    localStorage.removeItem('error_logs');
  } catch {
    // Silently fail
  }
}
