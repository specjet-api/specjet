import { SpecJetError } from './errors.js';
import { URL } from 'url';
import fetch, { AbortError } from 'node-fetch';

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

  async get(path, options = {}) {
    return this.makeRequest(path, 'GET', options);
  }

  async post(path, body, options = {}) {
    return this.makeRequest(path, 'POST', { ...options, body });
  }

  async put(path, body, options = {}) {
    return this.makeRequest(path, 'PUT', { ...options, body });
  }

  async patch(path, body, options = {}) {
    return this.makeRequest(path, 'PATCH', { ...options, body });
  }

  async delete(path, options = {}) {
    return this.makeRequest(path, 'DELETE', options);
  }

  async head(path, options = {}) {
    return this.makeRequest(path, 'HEAD', options);
  }

  async options(path, options = {}) {
    return this.makeRequest(path, 'OPTIONS', options);
  }

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

  setDefaultHeaders(headers) {
    this.defaultHeaders = { ...this.defaultHeaders, ...headers };
  }

  removeDefaultHeader(headerName) {
    delete this.defaultHeaders[headerName];
  }

  setBaseURL(baseURL) {
    this.baseURL = baseURL?.replace(/\/$/, '');
  }

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