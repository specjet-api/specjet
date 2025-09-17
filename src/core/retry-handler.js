import ValidationResults from './validation-results.js';

/**
 * Handles retry logic for validation operations
 * Implements exponential backoff and error classification
 */
class ValidationRetryHandler {
  constructor(maxRetries = 2, baseBackoffMs = 1000) {
    this.maxRetries = maxRetries;
    this.baseBackoffMs = baseBackoffMs;
  }

  /**
   * Execute operation with retry logic
   * @param {function} operation - Async operation to retry
   * @param {object} context - Context information for error handling
   * @returns {Promise<*>} Operation result
   */
  async withRetry(operation, context = {}) {
    let lastError;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;

        // Only retry on retryable errors and if we haven't exhausted attempts
        if (attempt < this.maxRetries && this.isRetryableError(error)) {
          const backoffTime = this.calculateBackoff(attempt);

          if (context.onRetry) {
            context.onRetry(attempt + 1, this.maxRetries, error, backoffTime);
          }

          await this.sleep(backoffTime);
          continue;
        }

        break;
      }
    }

    // All retries failed - return error result
    return this.createFailureResult(lastError, context);
  }

  /**
   * Determine if an error is retryable
   * @param {Error} error - The error to check
   * @returns {boolean}
   */
  isRetryableError(error) {
    // Network and connection errors are retryable
    const retryableCodes = [
      'ECONNRESET',
      'ETIMEDOUT',
      'ENOTFOUND',
      'ECONNREFUSED',
      'EPIPE',
      'EHOSTUNREACH'
    ];

    if (retryableCodes.includes(error.code)) {
      return true;
    }

    // Timeout errors are retryable
    if (error.message && (
      error.message.includes('timeout') ||
      error.message.includes('ECONNRESET') ||
      error.message.includes('Request timeout')
    )) {
      return true;
    }

    // HTTP status codes that are retryable (5xx errors, rate limiting)
    if (error.response && error.response.status) {
      const status = error.response.status;
      return status >= 500 || status === 429; // Server errors or rate limiting
    }

    return false;
  }

  /**
   * Calculate exponential backoff time with jitter
   * Uses exponential backoff with 10% jitter to prevent thundering herd
   * @param {number} attempt - Current attempt number (0-based)
   * @returns {number} Backoff time in milliseconds
   */
  calculateBackoff(attempt) {
    // Exponential backoff with jitter
    const exponentialBackoff = this.baseBackoffMs * Math.pow(2, attempt);
    const jitter = Math.random() * 0.1 * exponentialBackoff; // 10% jitter

    return Math.min(exponentialBackoff + jitter, 30000); // Cap at 30 seconds
  }

  createFailureResult(error, context) {
    const { path = 'unknown', method = 'unknown' } = context;

    return ValidationResults.createResult(
      path,
      method,
      false,
      null,
      [ValidationResults.createIssue(
        'validation_failed',
        null,
        `Validation failed after ${this.maxRetries + 1} attempts: ${error.message}`,
        {
          originalError: error.code || error.name,
          attempts: this.maxRetries + 1,
          finalErrorMessage: error.message
        }
      )]
    );
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Execute operation with custom retry configuration
   * @param {function} operation - Async operation to retry
   * @param {object} retryConfig - Custom retry configuration
   * @param {object} context - Context information
   * @returns {Promise<*>}
   */
  async withCustomRetry(operation, retryConfig, context = {}) {
    const originalMaxRetries = this.maxRetries;
    const originalBackoff = this.baseBackoffMs;

    try {
      if (retryConfig.maxRetries !== undefined) {
        this.maxRetries = retryConfig.maxRetries;
      }
      if (retryConfig.baseBackoffMs !== undefined) {
        this.baseBackoffMs = retryConfig.baseBackoffMs;
      }

      return await this.withRetry(operation, context);
    } finally {
      // Restore original configuration
      this.maxRetries = originalMaxRetries;
      this.baseBackoffMs = originalBackoff;
    }
  }

  getConfig() {
    return {
      maxRetries: this.maxRetries,
      baseBackoffMs: this.baseBackoffMs
    };
  }

  /**
   * Create a retry handler optimized for CI environments
   * @returns {ValidationRetryHandler}
   */
  static createCIHandler() {
    return new ValidationRetryHandler(3, 2000); // More retries, longer delays for CI
  }

  /**
   * Create a retry handler optimized for development
   * @returns {ValidationRetryHandler}
   */
  static createDevHandler() {
    return new ValidationRetryHandler(1, 500); // Fewer retries, shorter delays for dev
  }
}

export default ValidationRetryHandler;