import ValidationResults from './validation-results.js';

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

    console.log(`📦 Starting batch processing of ${endpoints.length} endpoints`);
    console.log(`⚙️  Concurrency: ${this.concurrency}, Delay: ${this.delay}ms`);

    const results = [];
    const batches = this.createBatches(endpoints, this.concurrency);

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      console.log(`📦 Processing batch ${i + 1}/${batches.length} (${batch.length} endpoints)`);

      const batchResults = await this.processBatch(batch, options);
      results.push(...batchResults);

      // Add delay between batches to avoid overwhelming the API
      if (i < batches.length - 1 && this.delay > 0) {
        await this.sleep(this.delay);
      }
    }

    console.log(`✅ Batch processing complete. ${results.length} endpoints processed`);
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
    if (this.retryHandler) {
      return await this.retryHandler.withRetry(
        () => this.validator.validateEndpoint(endpoint.path, endpoint.method, options),
        {
          path: endpoint.path,
          method: endpoint.method,
          onRetry: (attempt, maxRetries, error, backoffTime) => {
            console.warn(`⚠️  Retry ${attempt}/${maxRetries} for ${endpoint.method} ${endpoint.path} (${backoffTime}ms delay)`);
          }
        }
      );
    } else {
      const result = await this.validator.validateEndpoint(endpoint.path, endpoint.method, options);

      // Call progress callback if provided
      if (this.progressCallback) {
        this.progressCallback(result);
      }

      return result;
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

  getConfig() {
    return {
      concurrency: this.concurrency,
      delay: this.delay,
      hasRetryHandler: !!this.retryHandler,
      hasProgressCallback: !!this.progressCallback
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