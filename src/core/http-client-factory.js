import HttpClient from './http-client.js';

/**
 * Factory for creating and managing HTTP client instances
 * Implements connection reuse and proper resource management
 */
class HttpClientFactory {
  constructor() {
    this.clients = new Map();
  }

  /**
   * Get or create an HTTP client for the given configuration
   * @param {string} baseURL - Base URL for the API
   * @param {object} headers - Default headers
   * @param {object} options - HTTP client options
   * @returns {HttpClient} HTTP client instance
   */
  getClient(baseURL, headers = {}, options = {}) {
    const key = this.createClientKey(baseURL, headers, options);

    if (!this.clients.has(key)) {
      const client = new HttpClient(baseURL, headers, options);
      this.clients.set(key, client);
      console.log(`🔗 Created new HTTP client for ${baseURL}`);
    }

    return this.clients.get(key);
  }

  createClientKey(baseURL, headers, options) {
    const normalizedBaseURL = baseURL?.replace(/\/$/, '') || '';
    const sortedHeaders = this.sortObject(headers);
    const sortedOptions = this.sortObject(options);

    return JSON.stringify({
      baseURL: normalizedBaseURL,
      headers: sortedHeaders,
      options: sortedOptions
    });
  }

  sortObject(obj) {
    if (!obj || typeof obj !== 'object') return obj;

    const sorted = {};
    Object.keys(obj).sort().forEach(key => {
      sorted[key] = obj[key];
    });
    return sorted;
  }

  /**
   * Test connectivity for a given base URL
   * @param {string} baseURL
   * @param {object} headers
   * @param {object} options
   * @returns {Promise<boolean>}
   */
  async testConnection(baseURL, headers = {}, options = {}) {
    const client = this.getClient(baseURL, headers, options);
    return await client.testConnection();
  }

  removeClient(baseURL, headers = {}, options = {}) {
    const key = this.createClientKey(baseURL, headers, options);

    if (this.clients.has(key)) {
      const client = this.clients.get(key);

      // If the client has cleanup method, call it
      if (typeof client.cleanup === 'function') {
        client.cleanup();
      }

      this.clients.delete(key);
      console.log(`🗑️  Removed HTTP client for ${baseURL}`);
    }
  }

  cleanup() {
    for (const [_key, client] of this.clients) {
      if (typeof client.cleanup === 'function') {
        client.cleanup();
      }
    }
    this.clients.clear();
    console.log('🧹 Cleaned up all HTTP clients');
  }

  getStats() {
    return {
      totalClients: this.clients.size,
      clientKeys: Array.from(this.clients.keys())
    };
  }

  /**
   * Create a client with default production settings
   * @param {string} baseURL
   * @param {object} headers
   * @returns {HttpClient}
   */
  createDefaultClient(baseURL, headers = {}) {
    return this.getClient(baseURL, headers, {
      timeout: 30000,
      maxRetries: 2
    });
  }

  /**
   * Create a client optimized for CI/CD environments
   * @param {string} baseURL
   * @param {object} headers
   * @returns {HttpClient}
   */
  createCIClient(baseURL, headers = {}) {
    return this.getClient(baseURL, headers, {
      timeout: 60000, // Longer timeout for CI
      maxRetries: 3   // More retries for CI
    });
  }
}

// Export singleton instance
const httpClientFactory = new HttpClientFactory();

export default httpClientFactory;
export { HttpClientFactory };