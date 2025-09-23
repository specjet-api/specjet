import ValidationResults from './validation-results.js';
import Logger from './logger.js';

/**
 * Circuit breaker pattern implementation for fault tolerance
 */
class CircuitBreaker {
  constructor(options = {}) {
    this.failureThreshold = options.failureThreshold || 5;
    this.resetTimeout = options.resetTimeout || 30000;
    this.monitoringPeriod = options.monitoringPeriod || 10000;

    this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
    this.failures = 0;
    this.lastFailureTime = null;
    this.successCount = 0;
  }

  async execute(operation) {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime > this.resetTimeout) {
        this.state = 'HALF_OPEN';
        this.successCount = 0;
      } else {
        throw new Error('Circuit breaker is OPEN');
      }
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  onSuccess() {
    this.failures = 0;
    if (this.state === 'HALF_OPEN') {
      this.successCount++;
      if (this.successCount >= 3) {
        this.state = 'CLOSED';
      }
    }
  }

  onFailure() {
    this.failures++;
    this.lastFailureTime = Date.now();

    if (this.state === 'HALF_OPEN') {
      // In HALF_OPEN state, any failure immediately opens the circuit
      this.state = 'OPEN';
    } else if (this.failures >= this.failureThreshold) {
      this.state = 'OPEN';
    }
  }

  getState() {
    return this.state;
  }

  reset() {
    this.state = 'CLOSED';
    this.failures = 0;
    this.lastFailureTime = null;
    this.successCount = 0;
  }
}

/**
 * Token bucket rate limiter implementation
 */
class RateLimiter {
  constructor(requestsPerSecond = 10) {
    this.requestsPerSecond = requestsPerSecond;
    this.tokens = requestsPerSecond;
    this.lastRefill = Date.now();
  }

  async waitForToken() {
    this.refillTokens();

    if (this.tokens >= 1) {
      this.tokens--;
      return;
    }

    // Wait for next token
    const waitTime = (1 / this.requestsPerSecond) * 1000;
    await new Promise(resolve => setTimeout(resolve, waitTime));
    return this.waitForToken();
  }

  refillTokens() {
    const now = Date.now();
    const timePassed = now - this.lastRefill;
    const tokensToAdd = (timePassed / 1000) * this.requestsPerSecond;

    this.tokens = Math.min(this.requestsPerSecond, this.tokens + tokensToAdd);
    this.lastRefill = now;
  }

  setRate(requestsPerSecond) {
    this.requestsPerSecond = requestsPerSecond;
    this.tokens = Math.min(requestsPerSecond, this.tokens);
  }
}

/**
 * Handles batch processing of validation operations
 * Manages concurrency, batching, and coordination
 */
class ValidationBatchProcessor {
  constructor(validator, options = {}) {
    this.validator = validator;
    this.concurrency = options.concurrency || 3;
    this.delay = options.delay || 100;
    this.retryHandler = options.retryHandler;
    this.progressCallback = options.progressCallback;
    this.logger = options.logger || new Logger({ context: 'BatchProcessor' });

    // Initialize rate limiter and circuit breaker
    this.rateLimiter = new RateLimiter(options.requestsPerSecond || 10);
    this.circuitBreaker = new CircuitBreaker({
      failureThreshold: options.circuitBreakerFailureThreshold || 5,
      resetTimeout: options.circuitBreakerResetTimeout || 30000,
      ...options.circuitBreakerOptions
    });

    // Performance monitoring
    this.stats = {
      requestsSent: 0,
      requestsFailed: 0,
      circuitBreakerTripped: 0,
      averageResponseTime: 0
    };
  }

  /**
   * Process multiple endpoints with batching and concurrency control
   * @param {Array} endpoints - Endpoints to validate
   * @param {object} options - Validation options
   * @returns {Promise<Array>} Validation results
   */
  async processEndpoints(endpoints, options = {}) {
    if (!endpoints || endpoints.length === 0) {
      return [];
    }

    this.logger.info('Starting batch processing', { endpointCount: endpoints.length });
    this.logger.info('Batch processing configuration', { concurrency: this.concurrency, delay: this.delay });

    const results = [];
    const batches = this.createBatches(endpoints, this.concurrency);

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      this.logger.info('Processing batch', { batchNumber: i + 1, totalBatches: batches.length, batchSize: batch.length });

      const batchResults = await this.processBatch(batch, options);
      results.push(...batchResults);

      // Add delay between batches to avoid overwhelming the API
      if (i < batches.length - 1 && this.delay > 0) {
        await this.sleep(this.delay);
      }
    }

    this.logger.info('Batch processing complete', { endpointsProcessed: results.length });
    return results;
  }

  /**
   * Process a single batch of endpoints concurrently
   * @param {Array} batch - Batch of endpoints
   * @param {object} options - Validation options
   * @returns {Promise<Array>} Batch results
   */
  async processBatch(batch, options) {
    const batchPromises = batch.map(endpoint =>
      this.processEndpoint(endpoint, options)
    );

    const batchResults = await Promise.allSettled(batchPromises);
    const results = [];

    // Handle results and any rejections
    batchResults.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        results.push(result.value);
      } else {
        const endpoint = batch[index];
        results.push(this.createErrorResult(endpoint, result.reason));
      }
    });

    return results;
  }

  /**
   * Process a single endpoint with retry logic if configured
   * @param {object} endpoint - Endpoint to validate
   * @param {object} options - Validation options
   * @returns {Promise<object>} Validation result
   */
  async processEndpoint(endpoint, options) {
    const startTime = Date.now();

    try {
      // Wait for rate limiter token
      await this.rateLimiter.waitForToken();

      // Execute with circuit breaker protection
      const result = await this.circuitBreaker.execute(async () => {
        if (this.retryHandler) {
          return await this.retryHandler.withRetry(
            () => this.validator.validateEndpoint(endpoint.path, endpoint.method, options),
            {
              path: endpoint.path,
              method: endpoint.method,
              onRetry: (attempt, maxRetries, error, backoffTime) => {
                this.logger.warn('Retrying endpoint validation', { method: endpoint.method, path: endpoint.path, attempt, maxRetries, backoffTime });
              }
            }
          );
        } else {
          return await this.validator.validateEndpoint(endpoint.path, endpoint.method, options);
        }
      });

      // Update stats
      this.stats.requestsSent++;
      const responseTime = Date.now() - startTime;
      this.updateAverageResponseTime(responseTime);

      // Call progress callback if provided
      if (this.progressCallback) {
        this.progressCallback(result);
      }

      return result;

    } catch (error) {
      this.stats.requestsFailed++;

      if (error.message === 'Circuit breaker is OPEN') {
        this.stats.circuitBreakerTripped++;
        this.logger.warn('Circuit breaker OPEN for endpoint', { method: endpoint.method, path: endpoint.path });

        // Return circuit breaker error result
        return ValidationResults.createResult(
          endpoint.path,
          endpoint.method,
          false,
          null,
          [ValidationResults.createIssue(
            'circuit_breaker_open',
            null,
            'Circuit breaker is open due to repeated failures',
            {
              circuitBreakerState: this.circuitBreaker.getState(),
              failureThreshold: this.circuitBreaker.failureThreshold
            }
          )]
        );
      }

      throw error;
    }
  }

  createBatches(endpoints, batchSize) {
    const batches = [];
    for (let i = 0; i < endpoints.length; i += batchSize) {
      batches.push(endpoints.slice(i, i + batchSize));
    }
    return batches;
  }

  /**
   * Create an error result for failed endpoint processing
   * @param {object} endpoint - The endpoint that failed
   * @param {Error} error - The error that occurred
   * @returns {object} Error result
   */
  createErrorResult(endpoint, error) {
    return ValidationResults.createResult(
      endpoint.path,
      endpoint.method,
      false,
      null,
      [ValidationResults.createIssue(
        'batch_processing_error',
        null,
        `Batch processing failed: ${error.message}`,
        {
          originalError: error.code || error.name,
          errorStack: error.stack
        }
      )]
    );
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  updateAverageResponseTime(responseTime) {
    if (this.stats.requestsSent === 1) {
      this.stats.averageResponseTime = responseTime;
    } else {
      // Calculate running average
      this.stats.averageResponseTime = (
        (this.stats.averageResponseTime * (this.stats.requestsSent - 1)) + responseTime
      ) / this.stats.requestsSent;
    }
  }

  getConfig() {
    return {
      concurrency: this.concurrency,
      delay: this.delay,
      hasRetryHandler: !!this.retryHandler,
      hasProgressCallback: !!this.progressCallback,
      rateLimiter: {
        requestsPerSecond: this.rateLimiter.requestsPerSecond,
        currentTokens: this.rateLimiter.tokens
      },
      circuitBreaker: {
        state: this.circuitBreaker.getState(),
        failureThreshold: this.circuitBreaker.failureThreshold,
        resetTimeout: this.circuitBreaker.resetTimeout,
        failures: this.circuitBreaker.failures
      },
      stats: { ...this.stats }
    };
  }

  updateConfig(newOptions) {
    if (newOptions.concurrency !== undefined) {
      this.concurrency = newOptions.concurrency;
    }
    if (newOptions.delay !== undefined) {
      this.delay = newOptions.delay;
    }
    if (newOptions.retryHandler !== undefined) {
      this.retryHandler = newOptions.retryHandler;
    }
    if (newOptions.progressCallback !== undefined) {
      this.progressCallback = newOptions.progressCallback;
    }
    if (newOptions.requestsPerSecond !== undefined) {
      this.rateLimiter.setRate(newOptions.requestsPerSecond);
    }
    if (newOptions.resetCircuitBreaker) {
      this.circuitBreaker.reset();
    }
  }

  /**
   * Process endpoints with custom batching strategy
   * @param {Array} endpoints - Endpoints to validate
   * @param {function} batchStrategy - Custom batching function
   * @param {object} options - Validation options
   * @returns {Promise<Array>} Validation results
   */
  async processWithCustomBatching(endpoints, batchStrategy, options = {}) {
    if (!endpoints || endpoints.length === 0) {
      return [];
    }

    const batches = batchStrategy(endpoints);
    const results = [];

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      const batchResults = await this.processBatch(batch, options);
      results.push(...batchResults);

      if (i < batches.length - 1 && this.delay > 0) {
        await this.sleep(this.delay);
      }
    }

    return results;
  }

  /**
   * Create a batch processor optimized for CI environments
   * @param {object} validator - Validator instance
   * @returns {ValidationBatchProcessor}
   */
  static createCIProcessor(validator) {
    return new ValidationBatchProcessor(validator, {
      concurrency: 1,    // Sequential processing in CI
      delay: 500         // Longer delays in CI
    });
  }

  /**
   * Create a batch processor optimized for development
   * @param {object} validator - Validator instance
   * @returns {ValidationBatchProcessor}
   */
  static createDevProcessor(validator) {
    return new ValidationBatchProcessor(validator, {
      concurrency: 5,    // Higher concurrency for dev
      delay: 50          // Shorter delays for dev
    });
  }
}

export default ValidationBatchProcessor;
export { CircuitBreaker, RateLimiter };