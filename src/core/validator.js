import ContractParser from './parser.js';
import SchemaValidator from './schema-validator.js';
import HttpClient from './http-client.js';
import ValidationResults from './validation-results.js';
import { SpecJetError } from './errors.js';

/**
 * Core API Validation Engine
 * Compares live API responses against OpenAPI contract specifications
 */
class APIValidator {
  constructor(contractPath, baseURL, headers = {}) {
    this.contractPath = contractPath;
    this.baseURL = baseURL;
    this.headers = headers;
    this.contract = null;
    this.endpoints = null;
    this.httpClient = new HttpClient(baseURL, headers);
    this.schemaValidator = new SchemaValidator();
  }

  /**
   * Initialize the validator by parsing the OpenAPI contract
   * @returns {Promise<void>}
   * @throws {SpecJetError} When contract cannot be loaded or parsed
   */
  async initialize() {
    try {
      const parser = new ContractParser();
      this.contract = await parser.parseContract(this.contractPath);
      this.endpoints = this.contract.endpoints;

      console.log(`✅ Loaded contract: ${this.contract.info.title} v${this.contract.info.version}`);
      console.log(`📊 Found ${this.endpoints.length} endpoints to validate`);
    } catch (error) {
      throw new SpecJetError(
        `Failed to initialize validator with contract: ${this.contractPath}`,
        'VALIDATOR_INIT_ERROR',
        error,
        [
          'Check that the contract file exists and is valid OpenAPI',
          'Verify the contract path is correct',
          'Run with --verbose for detailed error information'
        ]
      );
    }
  }

  /**
   * Validate a specific endpoint against the contract
   * @param {string} path - The endpoint path (e.g., '/users/{id}')
   * @param {string} method - HTTP method (GET, POST, PUT, DELETE, etc.)
   * @param {Object} options - Additional validation options
   * @param {Object} options.pathParams - Path parameters for the request
   * @param {Object} options.queryParams - Query parameters for the request
   * @param {Object} options.requestBody - Request body for POST/PUT requests
   * @param {number} options.timeout - Request timeout in milliseconds
   * @returns {Promise<Object>} Validation result object
   */
  async validateEndpoint(path, method, options = {}) {
    if (!this.contract) {
      throw new SpecJetError(
        'Validator not initialized. Call initialize() first.',
        'VALIDATOR_NOT_INITIALIZED'
      );
    }

    const endpoint = this.findEndpoint(path, method);
    if (!endpoint) {
      return ValidationResults.createResult(path, method, false, null, [
        ValidationResults.createIssue(
          'endpoint_not_found',
          null,
          `Endpoint ${method} ${path} not found in OpenAPI contract`
        )
      ]);
    }

    try {
      // Resolve path parameters in the URL
      const resolvedPath = this.resolvePath(path, options.pathParams || {});

      // Generate request body for POST/PUT operations
      const requestBody = await this.generateRequestBody(endpoint, options.requestBody);

      // Make HTTP request to the live API
      const response = await this.httpClient.makeRequest(
        resolvedPath,
        method,
        {
          query: options.queryParams,
          body: requestBody,
          timeout: options.timeout
        }
      );

      // Validate the response against the contract
      const issues = await this.validateResponse(endpoint, response);

      return ValidationResults.createResult(
        path,
        method,
        issues.length === 0,
        response.status,
        issues,
        {
          responseTime: response.responseTime,
          responseSize: response.data ? JSON.stringify(response.data).length : 0
        }
      );
    } catch (error) {
      // Handle network errors, timeouts, etc.
      return ValidationResults.createResult(path, method, false, null, [
        ValidationResults.createIssue(
          'network_error',
          null,
          `Network error: ${error.message}`,
          { originalError: error.code || error.name }
        )
      ]);
    }
  }

  /**
   * Validate all endpoints defined in the OpenAPI contract
   * @param {Object} options - Validation options
   * @param {Object} options.pathParams - Global path parameters
   * @param {Object} options.queryParams - Global query parameters
   * @param {number} options.timeout - Request timeout in milliseconds
   * @param {number} options.concurrency - Number of concurrent requests (default: 3)
   * @param {number} options.delay - Delay between requests in ms (default: 100)
   * @returns {Promise<Array>} Array of validation results
   */
  async validateAllEndpoints(options = {}) {
    if (!this.contract) {
      throw new SpecJetError(
        'Validator not initialized. Call initialize() first.',
        'VALIDATOR_NOT_INITIALIZED'
      );
    }

    const {
      concurrency = 3,
      delay = 100,
      ...validateOptions
    } = options;

    console.log(`🚀 Starting validation of ${this.endpoints.length} endpoints`);
    console.log(`⚙️  Concurrency: ${concurrency}, Delay: ${delay}ms`);

    const results = [];
    const batches = this.createBatches(this.endpoints, concurrency);

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      console.log(`📦 Processing batch ${i + 1}/${batches.length} (${batch.length} endpoints)`);

      // Process endpoints in this batch concurrently
      const batchPromises = batch.map(endpoint =>
        this.validateEndpointWithRetry(endpoint, validateOptions)
      );

      const batchResults = await Promise.allSettled(batchPromises);

      // Add results and handle any rejections
      batchResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          const endpoint = batch[index];
          results.push(ValidationResults.createResult(
            endpoint.path,
            endpoint.method,
            false,
            null,
            [ValidationResults.createIssue(
              'validation_error',
              null,
              `Validation failed: ${result.reason.message}`
            )]
          ));
        }
      });

      // Add delay between batches to avoid overwhelming the API
      if (i < batches.length - 1 && delay > 0) {
        await this.sleep(delay);
      }
    }

    console.log(`✅ Validation complete. ${results.length} endpoints processed`);
    return results;
  }

  /**
   * Find an endpoint definition in the contract
   * @private
   */
  findEndpoint(path, method) {
    return this.endpoints.find(ep =>
      ep.path === path && ep.method.toUpperCase() === method.toUpperCase()
    );
  }

  /**
   * Resolve path parameters in URL template
   * @private
   */
  resolvePath(pathTemplate, pathParams) {
    let resolvedPath = pathTemplate;

    // Replace {param} with actual values
    for (const [key, value] of Object.entries(pathParams)) {
      resolvedPath = resolvedPath.replace(`{${key}}`, encodeURIComponent(value));
    }

    // Check for unresolved parameters
    const unresolvedParams = resolvedPath.match(/\{([^}]+)\}/g);
    if (unresolvedParams) {
      throw new Error(`Unresolved path parameters: ${unresolvedParams.join(', ')}`);
    }

    return resolvedPath;
  }

  /**
   * Generate appropriate request body for POST/PUT operations
   * @private
   */
  async generateRequestBody(endpoint, providedBody) {
    if (!endpoint.requestBody || !endpoint.requestBody.schema) {
      return null;
    }

    if (providedBody) {
      return providedBody;
    }

    // Generate minimal valid request body from schema
    return this.schemaValidator.generateSampleData(endpoint.requestBody.schema);
  }

  /**
   * Validate API response against contract schema
   * @private
   */
  async validateResponse(endpoint, response) {
    const issues = [];
    const statusCode = response.status.toString();

    // Check if status code is defined in contract
    const responseSpec = endpoint.responses[statusCode] || endpoint.responses['default'];
    if (!responseSpec) {
      issues.push(ValidationResults.createIssue(
        'unexpected_status_code',
        null,
        `Status code ${statusCode} not defined in contract`,
        {
          actualStatus: statusCode,
          expectedStatuses: Object.keys(endpoint.responses)
        }
      ));
      return issues;
    }

    // Validate response schema if present
    if (responseSpec.schema && response.data) {
      const schemaIssues = await this.schemaValidator.validateResponse(
        response.data,
        responseSpec.schema
      );
      issues.push(...schemaIssues);
    }

    // Validate required headers if defined in contract
    if (responseSpec.headers) {
      const headerIssues = this.validateHeaders(response.headers, responseSpec.headers);
      issues.push(...headerIssues);
    }

    return issues;
  }

  /**
   * Validate response headers against contract
   * @private
   */
  validateHeaders(actualHeaders, expectedHeaders) {
    const issues = [];

    for (const [headerName, headerSpec] of Object.entries(expectedHeaders)) {
      const actualValue = actualHeaders[headerName.toLowerCase()];

      if (headerSpec.required && !actualValue) {
        issues.push(ValidationResults.createIssue(
          'missing_header',
          headerName,
          `Required header '${headerName}' is missing`
        ));
      }
    }

    return issues;
  }

  /**
   * Validate endpoint with retry logic for transient failures
   * @private
   */
  async validateEndpointWithRetry(endpoint, options, maxRetries = 2) {
    let lastError;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await this.validateEndpoint(endpoint.path, endpoint.method, options);
      } catch (error) {
        lastError = error;

        // Only retry on network errors, not validation errors
        if (attempt < maxRetries && this.isRetryableError(error)) {
          console.warn(`⚠️  Retry ${attempt + 1}/${maxRetries} for ${endpoint.method} ${endpoint.path}`);
          await this.sleep(1000 * (attempt + 1)); // Exponential backoff
          continue;
        }

        break;
      }
    }

    // All retries failed
    return ValidationResults.createResult(
      endpoint.path,
      endpoint.method,
      false,
      null,
      [ValidationResults.createIssue(
        'validation_failed',
        null,
        `Validation failed after ${maxRetries + 1} attempts: ${lastError.message}`
      )]
    );
  }

  /**
   * Check if an error is retryable
   * @private
   */
  isRetryableError(error) {
    const retryableCodes = ['ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'ECONNREFUSED'];
    return retryableCodes.includes(error.code) ||
           error.message.includes('timeout') ||
           error.message.includes('ECONNRESET');
  }

  /**
   * Create batches from endpoints array
   * @private
   */
  createBatches(endpoints, batchSize) {
    const batches = [];
    for (let i = 0; i < endpoints.length; i += batchSize) {
      batches.push(endpoints.slice(i, i + batchSize));
    }
    return batches;
  }

  /**
   * Sleep utility for rate limiting
   * @private
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get validation statistics
   * @param {Array} results - Array of validation results
   * @returns {Object} Statistics object
   */
  static getValidationStats(results) {
    const stats = {
      total: results.length,
      passed: 0,
      failed: 0,
      errors: 0,
      totalIssues: 0,
      issuesByType: {},
      avgResponseTime: 0
    };

    let totalResponseTime = 0;
    let responseTimeCount = 0;

    results.forEach(result => {
      if (result.success) {
        stats.passed++;
      } else {
        stats.failed++;
      }

      stats.totalIssues += result.issues.length;

      // Count issues by type
      result.issues.forEach(issue => {
        stats.issuesByType[issue.type] = (stats.issuesByType[issue.type] || 0) + 1;
        if (issue.type === 'network_error' || issue.type === 'validation_failed') {
          stats.errors++;
        }
      });

      // Calculate average response time
      if (result.metadata && result.metadata.responseTime) {
        totalResponseTime += result.metadata.responseTime;
        responseTimeCount++;
      }
    });

    if (responseTimeCount > 0) {
      stats.avgResponseTime = Math.round(totalResponseTime / responseTimeCount);
    }

    // Calculate success rate
    stats.successRate = stats.total > 0 ? Math.round((stats.passed / stats.total) * 100) : 0;

    return stats;
  }
}

export default APIValidator;