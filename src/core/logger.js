import { URL } from 'url';

/**
 * Structured logger for SpecJet with different log levels and contexts
 */
class Logger {
  constructor(options = {}) {
    this.level = options.level || 'info';
    this.silent = options.silent || false;
    this.context = options.context || 'SpecJet';
    this.enableColors = options.enableColors !== false && !process.env.NO_COLOR;
    this.enableTimestamps = options.enableTimestamps !== false;
    this.sensitivePatterns = [
      /password/i,
      /secret/i,
      /token/i,
      /key/i,
      /auth/i
    ];
  }

  /**
   * Log levels in order of priority
   */
  static LEVELS = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3
  };

  /**
   * Color codes for different log levels
   */
  static COLORS = {
    debug: '\x1b[36m',   // Cyan
    info: '\x1b[32m',    // Green
    warn: '\x1b[33m',    // Yellow
    error: '\x1b[31m',   // Red
    reset: '\x1b[0m'     // Reset
  };

  shouldLog(level) {
    if (this.silent) return false;
    return Logger.LEVELS[level] >= Logger.LEVELS[this.level];
  }

  /**
   * Format log message with metadata
   * @param {string} level - Log level
   * @param {string} message - Log message
   * @param {object} context - Additional context
   * @returns {string} Formatted message
   */
  formatMessage(level, message, context = {}) {
    let formatted = '';

    // Add timestamp if enabled
    if (this.enableTimestamps) {
      const timestamp = new Date().toISOString();
      formatted += `[${timestamp}] `;
    }

    // Add level with colors if enabled
    const levelUpper = level.toUpperCase();
    if (this.enableColors) {
      const color = Logger.COLORS[level] || '';
      formatted += `${color}[${levelUpper}]${Logger.COLORS.reset} `;
    } else {
      formatted += `[${levelUpper}] `;
    }

    // Add context
    formatted += `${this.context}: `;

    // Add main message
    formatted += message;

    // Add context data if present
    if (Object.keys(context).length > 0) {
      const sanitizedContext = this.sanitizeContext(context);
      formatted += ` ${JSON.stringify(sanitizedContext)}`;
    }

    return formatted;
  }

  /**
   * Sanitize context to remove sensitive information
   * @param {object} context - Context object
   * @returns {object} Sanitized context
   */
  sanitizeContext(context) {
    const sanitized = {};

    for (const [key, value] of Object.entries(context)) {
      const keyLower = key.toLowerCase();
      const isSensitive = this.sensitivePatterns.some(pattern => pattern.test(keyLower));

      if (isSensitive) {
        sanitized[key] = '[REDACTED]';
      } else if (typeof value === 'string' && value.length > 1000) {
        sanitized[key] = value.substring(0, 1000) + '...[TRUNCATED]';
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = this.sanitizeContext(value);
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  debug(message, context = {}) {
    if (this.shouldLog('debug')) {
      const formatted = this.formatMessage('debug', message, context);
      console.log(formatted);
    }
  }

  info(message, context = {}) {
    if (this.shouldLog('info')) {
      const formatted = this.formatMessage('info', message, context);
      console.log(formatted);
    }
  }

  warn(message, context = {}) {
    if (this.shouldLog('warn')) {
      const formatted = this.formatMessage('warn', message, context);
      console.warn(formatted);
    }
  }

  /**
   * Error level logging
   * @param {string} message - Log message
   * @param {Error|object} error - Error object or additional context
   * @param {object} context - Additional context
   */
  error(message, error = null, context = {}) {
    if (this.shouldLog('error')) {
      const errorContext = { ...context };

      if (error instanceof Error) {
        errorContext.error = {
          name: error.name,
          message: error.message,
          code: error.code,
          stack: error.stack
        };
      } else if (error) {
        errorContext.error = error;
      }

      const formatted = this.formatMessage('error', message, errorContext);
      console.error(formatted);
    }
  }

  /**
   * Log performance metrics
   * @param {string} operation - Operation name
   * @param {number} duration - Duration in milliseconds
   * @param {object} context - Additional context
   */
  performance(operation, duration, context = {}) {
    const perfContext = {
      operation,
      duration: `${duration}ms`,
      ...context
    };

    this.info(`Performance: ${operation}`, perfContext);
  }

  /**
   * Log HTTP request/response
   * @param {string} method - HTTP method
   * @param {string} url - Request URL
   * @param {number} statusCode - Response status code
   * @param {number} duration - Request duration
   * @param {object} context - Additional context
   */
  http(method, url, statusCode, duration, context = {}) {
    const httpContext = {
      method,
      url: this.sanitizeUrl(url),
      statusCode,
      duration: `${duration}ms`,
      ...context
    };

    const level = statusCode >= 400 ? 'warn' : 'info';
    const message = `HTTP ${method} ${statusCode}`;

    this[level](message, httpContext);
  }

  /**
   * Sanitize URL to remove sensitive query parameters
   * @param {string} url - URL to sanitize
   * @returns {string} Sanitized URL
   */
  sanitizeUrl(url) {
    try {
      const urlObj = new URL(url);
      const sensitiveParams = ['token', 'key', 'secret', 'password', 'auth'];

      for (const param of sensitiveParams) {
        if (urlObj.searchParams.has(param)) {
          urlObj.searchParams.set(param, '[REDACTED]');
        }
      }

      return urlObj.toString();
    } catch {
      return url; // Return original if URL parsing fails
    }
  }

  /**
   * Log validation results
   * @param {object} result - Validation result
   */
  validation(result) {
    const context = {
      endpoint: result.endpoint,
      method: result.method,
      success: result.success,
      statusCode: result.statusCode,
      issueCount: result.issues?.length || 0
    };

    if (result.metadata?.responseTime) {
      context.responseTime = `${result.metadata.responseTime}ms`;
    }

    const level = result.success ? 'info' : 'warn';
    const message = `Validation ${result.success ? 'passed' : 'failed'}`;

    this[level](message, context);
  }

  /**
   * Log circuit breaker events
   * @param {string} state - Circuit breaker state
   * @param {object} context - Additional context
   */
  circuitBreaker(state, context = {}) {
    const cbContext = {
      state,
      ...context
    };

    const level = state === 'OPEN' ? 'warn' : 'info';
    this[level](`Circuit breaker ${state}`, cbContext);
  }

  /**
   * Log rate limiting events
   * @param {string} action - Rate limiting action
   * @param {object} context - Additional context
   */
  rateLimiting(action, context = {}) {
    this.debug(`Rate limiting: ${action}`, context);
  }

  /**
   * Create a child logger with additional context
   * @param {object} additionalContext - Additional context to merge
   * @returns {Logger} Child logger
   */
  child(additionalContext) {
    const childContext = `${this.context}:${additionalContext.component || 'child'}`;
    return new Logger({
      level: this.level,
      silent: this.silent,
      context: childContext,
      enableColors: this.enableColors,
      enableTimestamps: this.enableTimestamps
    });
  }

  setLevel(level) {
    if (Object.prototype.hasOwnProperty.call(Logger.LEVELS, level)) {
      this.level = level;
    } else {
      throw new Error(`Invalid log level: ${level}. Valid levels: ${Object.keys(Logger.LEVELS).join(', ')}`);
    }
  }

  setSilent(silent) {
    this.silent = silent;
  }

  getConfig() {
    return {
      level: this.level,
      silent: this.silent,
      context: this.context,
      enableColors: this.enableColors,
      enableTimestamps: this.enableTimestamps
    };
  }

  /**
   * Create a console-compatible interface
   * For compatibility with existing code that expects console methods
   */
  get console() {
    return {
      log: (message, ...args) => this.info(message, { args }),
      info: (message, ...args) => this.info(message, { args }),
      warn: (message, ...args) => this.warn(message, { args }),
      error: (message, ...args) => this.error(message, null, { args }),
      debug: (message, ...args) => this.debug(message, { args })
    };
  }
}

export default Logger;