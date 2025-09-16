import { SpecJetError } from './errors.js';
import { URL } from 'url';
import fetch, { AbortError } from 'node-fetch';

/**
 * HTTP Client wrapper for making API requests during validation
 * Handles timeouts, retries, and proper error handling
 */
class HttpClient {
  constructor(baseURL, defaultHeaders = {}, options = {}) {
    this.baseURL = baseURL?.replace(/\/$/, ''); // Remove trailing slash
    this.defaultHeaders = {
      'Content-Type': 'application/json',
      'User-Agent': 'SpecJet-Validator/1.0',
      ...defaultHeaders
    };
    this.defaultTimeout = options.timeout || 10000; // 10 seconds default
    this.maxRetries = options.maxRetries || 2;
  }

  /**
   * Make an HTTP request
   * @param {string} path - Request path (relative to baseURL)
   * @param {string} method - HTTP method
   * @param {Object} options - Request options
   * @param {Object} options.query - Query parameters
   * @param {*} options.body - Request body
   * @param {Object} options.headers - Additional headers
   * @param {number} options.timeout - Request timeout in milliseconds
   * @returns {Promise<Object>} Response object with status, headers, data, and metadata
   */
  async makeRequest(path, method = 'GET', options = {}) {
    const {
      query = {},
      body = null,
      headers = {},
      timeout = this.defaultTimeout
    } = options;

    // Construct full URL
    const url = this.buildURL(path, query);

    // Merge headers
    const requestHeaders = {
      ...this.defaultHeaders,
      ...headers
    };

    // Remove Content-Type for GET requests or if no body
    if (method.toUpperCase() === 'GET' || !body) {
      delete requestHeaders['Content-Type'];
    }

    const requestOptions = {
      method: method.toUpperCase(),
      headers: requestHeaders
    };

    // Add body for non-GET requests
    if (body && ['POST', 'PUT', 'PATCH'].includes(method.toUpperCase())) {
      if (typeof body === 'object') {
        requestOptions.body = JSON.stringify(body);
      } else {
        requestOptions.body = body;
      }
    }

    const startTime = Date.now();

    try {
      console.log(`🌐 ${method.toUpperCase()} ${url}`);

      // Use Promise.race to implement timeout
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Request timeout')), timeout)
      );

      const response = await Promise.race([
        fetch(url, requestOptions),
        timeoutPromise
      ]);

      const responseTime = Date.now() - startTime;

      const result = await this.processResponse(response, responseTime);

      console.log(`✅ ${response.status} ${response.statusText} (${responseTime}ms)`);

      return result;
    } catch (error) {
      const responseTime = Date.now() - startTime;

      if (error.message === 'Request timeout') {
        console.error(`⏰ Request timeout after ${timeout}ms`);
        throw new SpecJetError(
          `Request timeout after ${timeout}ms`,
          'REQUEST_TIMEOUT',
          error,
          [
            'Increase the timeout value',
            'Check if the API server is responding',
            'Verify network connectivity'
          ]
        );
      }

      if (error instanceof AbortError) {
        console.error(`🚫 Request aborted after ${responseTime}ms`);
        throw new SpecJetError(
          'Request was aborted',
          'REQUEST_ABORTED',
          error,
          [
            'Check if the API endpoint exists',
            'Verify the request parameters',
            'Try increasing the timeout'
          ]
        );
      }

      if (error.code === 'ENOTFOUND') {
        console.error(`🔍 DNS lookup failed for ${url}`);
        throw new SpecJetError(
          `Cannot resolve hostname: ${new URL(url).hostname}`,
          'DNS_LOOKUP_FAILED',
          error,
          [
            'Check the base URL in your configuration',
            'Verify internet connectivity',
            'Ensure the hostname is correct'
          ]
        );
      }

      if (error.code === 'ECONNREFUSED') {
        console.error(`🚫 Connection refused to ${url}`);
        throw new SpecJetError(
          `Connection refused to ${url}`,
          'CONNECTION_REFUSED',
          error,
          [
            'Check if the API server is running',
            'Verify the port number is correct',
            'Check firewall settings'
          ]
        );
      }

      console.error(`❌ Request failed: ${error.message} (${responseTime}ms)`);
      throw new SpecJetError(
        `HTTP request failed: ${error.message}`,
        'HTTP_REQUEST_FAILED',
        error,
        [
          'Check your internet connection',
          'Verify the API endpoint is accessible',
          'Check authentication credentials'
        ]
      );
    }
  }

  /**
   * Process the response and extract data
   * @private
   */
  async processResponse(response, responseTime) {
    const headers = {};
    response.headers.forEach((value, key) => {
      headers[key.toLowerCase()] = value;
    });

    let data = null;
    let parseError = null;

    // Try to parse response body
    try {
      const contentType = headers['content-type'] || '';
      const text = await response.text();

      if (text) {
        if (contentType.includes('application/json')) {
          data = JSON.parse(text);
        } else {
          data = text;
        }
      }
    } catch (error) {
      parseError = error;
      // If JSON parsing fails, keep the raw text
      data = await response.text().catch(() => null);
    }

    const result = {
      status: response.status,
      statusText: response.statusText,
      headers,
      data,
      responseTime,
      url: response.url
    };

    // Add parse error info if present
    if (parseError) {
      result.parseError = parseError.message;
    }

    return result;
  }

  /**
   * Build full URL with query parameters
   * @private
   */
  buildURL(path, query = {}) {
    // Handle absolute URLs
    if (path.startsWith('http://') || path.startsWith('https://')) {
      const url = new URL(path);
      this.addQueryParams(url, query);
      return url.toString();
    }

    // Handle relative paths
    if (!this.baseURL) {
      throw new SpecJetError(
        'Base URL is required for relative paths',
        'MISSING_BASE_URL',
        null,
        [
          'Provide a baseURL when creating the HttpClient',
          'Use absolute URLs in your requests',
          'Check your environment configuration'
        ]
      );
    }

    const url = new URL(path.startsWith('/') ? path : `/${path}`, this.baseURL);
    this.addQueryParams(url, query);
    return url.toString();
  }

  /**
   * Add query parameters to URL
   * @private
   */
  addQueryParams(url, query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null) {
        if (Array.isArray(value)) {
          value.forEach(v => url.searchParams.append(key, v));
        } else {
          url.searchParams.append(key, value);
        }
      }
    }
  }

  /**
   * Make a GET request
   * @param {string} path - Request path
   * @param {Object} options - Request options
   * @returns {Promise<Object>} Response object
   */
  async get(path, options = {}) {
    return this.makeRequest(path, 'GET', options);
  }

  /**
   * Make a POST request
   * @param {string} path - Request path
   * @param {*} body - Request body
   * @param {Object} options - Request options
   * @returns {Promise<Object>} Response object
   */
  async post(path, body, options = {}) {
    return this.makeRequest(path, 'POST', { ...options, body });
  }

  /**
   * Make a PUT request
   * @param {string} path - Request path
   * @param {*} body - Request body
   * @param {Object} options - Request options
   * @returns {Promise<Object>} Response object
   */
  async put(path, body, options = {}) {
    return this.makeRequest(path, 'PUT', { ...options, body });
  }

  /**
   * Make a PATCH request
   * @param {string} path - Request path
   * @param {*} body - Request body
   * @param {Object} options - Request options
   * @returns {Promise<Object>} Response object
   */
  async patch(path, body, options = {}) {
    return this.makeRequest(path, 'PATCH', { ...options, body });
  }

  /**
   * Make a DELETE request
   * @param {string} path - Request path
   * @param {Object} options - Request options
   * @returns {Promise<Object>} Response object
   */
  async delete(path, options = {}) {
    return this.makeRequest(path, 'DELETE', options);
  }

  /**
   * Make a HEAD request
   * @param {string} path - Request path
   * @param {Object} options - Request options
   * @returns {Promise<Object>} Response object
   */
  async head(path, options = {}) {
    return this.makeRequest(path, 'HEAD', options);
  }

  /**
   * Make an OPTIONS request
   * @param {string} path - Request path
   * @param {Object} options - Request options
   * @returns {Promise<Object>} Response object
   */
  async options(path, options = {}) {
    return this.makeRequest(path, 'OPTIONS', options);
  }

  /**
   * Test connectivity to the base URL
   * @returns {Promise<boolean>} True if connection is successful
   */
  async testConnection() {
    if (!this.baseURL) {
      throw new SpecJetError(
        'No base URL configured for connectivity test',
        'MISSING_BASE_URL'
      );
    }

    try {
      // Try OPTIONS first (least intrusive)
      await this.options('/', { timeout: 5000 });
      return true;
    } catch {
      // If OPTIONS fails, try HEAD
      try {
        await this.head('/', { timeout: 5000 });
        return true;
      } catch {
        // If both fail, return false
        return false;
      }
    }
  }

  /**
   * Set default headers for all requests
   * @param {Object} headers - Headers to set
   */
  setDefaultHeaders(headers) {
    this.defaultHeaders = { ...this.defaultHeaders, ...headers };
  }

  /**
   * Remove a default header
   * @param {string} headerName - Name of header to remove
   */
  removeDefaultHeader(headerName) {
    delete this.defaultHeaders[headerName];
  }

  /**
   * Update the base URL
   * @param {string} baseURL - New base URL
   */
  setBaseURL(baseURL) {
    this.baseURL = baseURL?.replace(/\/$/, '');
  }

  /**
   * Get current configuration
   * @returns {Object} Current client configuration
   */
  getConfig() {
    return {
      baseURL: this.baseURL,
      defaultHeaders: { ...this.defaultHeaders },
      defaultTimeout: this.defaultTimeout,
      maxRetries: this.maxRetries
    };
  }
}

export default HttpClient;