// Node.js built-ins
import { URL } from 'url';
import https from 'https';
import http from 'http';

// Internal modules
import { SpecJetError } from './errors.js';
import { validateTimeout, validateMaxRetries } from './parameter-validator.js';

class HttpClient {
  constructor(baseURL, defaultHeaders = {}, options = {}) {
    this.baseURL = baseURL?.replace(/\/$/, ''); // Remove trailing slash
    this.defaultHeaders = {
      'Content-Type': 'application/json',
      'User-Agent': 'SpecJet-Validator/1.0',
      ...defaultHeaders
    };

    // Use parameter validator functions for type safety
    this.validateTimeout = options.validateTimeout || validateTimeout;
    this.validateMaxRetries = options.validateMaxRetries || validateMaxRetries;
    this.defaultTimeout = this.validateTimeout(options.timeout, 10000);
    this.maxRetries = this.validateMaxRetries(options.maxRetries, 2);
    this.agent = this.createAgent(options);
  }

  createAgent(options) {
    const agentOptions = {
      keepAlive: true,
      keepAliveMsecs: 1000,
      maxSockets: 10,
      maxFreeSockets: 5,
      timeout: this.validateTimeout(options.timeout, 10000),
      freeSocketTimeout: 30000, // Free socket timeout
      ...options.agentOptions
    };

    // Create both HTTP and HTTPS agents to handle different URLs
    this.httpAgent = new http.Agent(agentOptions);
    this.httpsAgent = new https.Agent(agentOptions);

    return this.baseURL && this.baseURL.startsWith('https:')
      ? this.httpsAgent
      : this.httpAgent;
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
    const parsedUrl = new URL(url);

    // Merge headers
    const requestHeaders = {
      ...this.defaultHeaders,
      ...headers
    };

    // Remove Content-Type for GET requests or if no body
    if (method.toUpperCase() === 'GET' || !body) {
      delete requestHeaders['Content-Type'];
    }

    // Prepare request body
    let requestBody = null;
    if (body && ['POST', 'PUT', 'PATCH'].includes(method.toUpperCase())) {
      if (typeof body === 'object') {
        requestBody = JSON.stringify(body);
        requestHeaders['Content-Length'] = Buffer.byteLength(requestBody);
      } else {
        requestBody = body;
        requestHeaders['Content-Length'] = Buffer.byteLength(requestBody);
      }
    }

    const validatedTimeout = this.validateTimeout(timeout, 30000);

    const requestOptions = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port,
      path: parsedUrl.pathname + parsedUrl.search,
      method: method.toUpperCase(),
      headers: requestHeaders,
      agent: parsedUrl.protocol === 'https:' ? this.httpsAgent : this.httpAgent,
      timeout: validatedTimeout
    };

    const startTime = Date.now();

    return new Promise((resolve, reject) => {
      console.log(`🌐 ${method.toUpperCase()} ${url}`);

      const client = parsedUrl.protocol === 'https:' ? https : http;

      const req = client.request(requestOptions, (res) => {
        const responseTime = Date.now() - startTime;
        console.log(`✅ ${res.statusCode} ${res.statusMessage} (${responseTime}ms)`);

        this.processNativeResponse(res, responseTime, url)
          .then(resolve)
          .catch(reject);
      });

      // Handle request timeout
      req.setTimeout(validatedTimeout, () => {
        req.destroy();
        console.error(`⏰ Request timeout after ${validatedTimeout}ms`);
        reject(new SpecJetError(
          `Request timeout after ${validatedTimeout}ms`,
          'REQUEST_TIMEOUT',
          null,
          [
            'Increase the timeout value',
            'Check if the API server is responding',
            'Verify network connectivity'
          ]
        ));
      });

      // Handle request errors
      req.on('error', (error) => {
        const responseTime = Date.now() - startTime;

        if (error.code === 'ENOTFOUND') {
          console.error(`🔍 DNS lookup failed for ${url}`);
          reject(new SpecJetError(
            `Cannot resolve hostname: ${parsedUrl.hostname}`,
            'DNS_LOOKUP_FAILED',
            error,
            [
              'Check the base URL in your configuration',
              'Verify internet connectivity',
              'Ensure the hostname is correct'
            ]
          ));
        } else if (error.code === 'ECONNREFUSED') {
          console.error(`🚫 Connection refused to ${url}`);
          reject(new SpecJetError(
            `Connection refused to ${url}`,
            'CONNECTION_REFUSED',
            error,
            [
              'Check if the API server is running',
              'Verify the port number is correct',
              'Check firewall settings'
            ]
          ));
        } else {
          console.error(`❌ Request failed: ${error.message} (${responseTime}ms)`);
          reject(new SpecJetError(
            `HTTP request failed: ${error.message}`,
            'HTTP_REQUEST_FAILED',
            error,
            [
              'Check your internet connection',
              'Verify the API endpoint is accessible',
              'Check authentication credentials'
            ]
          ));
        }
      });

      // Write request body if present
      if (requestBody) {
        req.write(requestBody);
      }

      req.end();
    });
  }

  async processNativeResponse(response, responseTime, url) {
    return new Promise((resolve, reject) => {
      const headers = {};
      Object.keys(response.headers).forEach(key => {
        headers[key.toLowerCase()] = response.headers[key];
      });

      const chunks = [];

      response.on('data', (chunk) => {
        chunks.push(chunk);
      });

      response.on('end', () => {
        const rawData = Buffer.concat(chunks);
        const text = rawData.toString();

        let data = null;
        let parseError = null;

        // Try to parse response body
        try {
          const contentType = headers['content-type'] || '';

          if (text) {
            if (contentType.includes('application/json')) {
              data = JSON.parse(text);
            } else {
              data = text;
            }
          }
        } catch (error) {
          parseError = error;
          data = text;
        }

        const result = {
          status: response.statusCode,
          statusText: response.statusMessage,
          headers,
          data,
          responseTime,
          url
        };

        // Add parse error info if present
        if (parseError) {
          result.parseError = parseError.message;
        }

        resolve(result);
      });

      response.on('error', (error) => {
        reject(new SpecJetError(
          `Response processing failed: ${error.message}`,
          'RESPONSE_PROCESSING_FAILED',
          error
        ));
      });
    });
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

  cleanup() {
    if (this.httpAgent && this.httpAgent.destroy) {
      this.httpAgent.destroy();
    }
    if (this.httpsAgent && this.httpsAgent.destroy) {
      this.httpsAgent.destroy();
    }
  }
}

export default HttpClient;