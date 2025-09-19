
/**
 * Smart path parameter discovery service
 * Automatically resolves path parameters by querying list endpoints
 * and falling back to sensible defaults for common REST patterns
 */
class ParameterDiscovery {
  constructor(dependencies = {}) {
    this.httpClient = dependencies.httpClient;
    this.logger = dependencies.logger || console;
    this.cache = new Map(); // Cache discovered parameters
  }

  /**
   * Discover parameter values for an endpoint
   * @param {string} pathTemplate - Path template like "/pet/{petId}"
   * @param {Array} allEndpoints - All contract endpoints for discovery
   * @param {object} providedParams - Already provided parameters
   * @returns {Promise<object>} Resolved parameters
   */
  async discoverParameters(pathTemplate, allEndpoints, providedParams = {}) {
    if (!pathTemplate) {
      return {};
    }

    // Extract parameter names from path template
    const paramMatches = pathTemplate.match(/\{([^}]+)\}/g);
    if (!paramMatches) {
      return {};
    }

    const paramNames = paramMatches.map(match => match.slice(1, -1));
    const resolvedParams = { ...providedParams };

    // Discover each missing parameter
    for (const paramName of paramNames) {
      if (!resolvedParams[paramName]) {
        const value = await this.discoverParameter(
          pathTemplate,
          paramName,
          allEndpoints,
          resolvedParams
        );
        if (value !== null) {
          resolvedParams[paramName] = value;
        }
      }
    }

    return resolvedParams;
  }

  /**
   * Discover a single parameter value
   * @param {string} pathTemplate - Original path template
   * @param {string} paramName - Parameter name to discover
   * @param {Array} allEndpoints - All contract endpoints
   * @param {object} currentParams - Currently resolved parameters
   * @returns {Promise<string|number|null>} Discovered parameter value
   */
  async discoverParameter(pathTemplate, paramName, allEndpoints, currentParams) {
    const cacheKey = `${pathTemplate}:${paramName}`;

    // Check cache first
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    try {
      // Step 1: Try to discover from list endpoints
      const discoveredValue = await this.discoverFromListEndpoint(
        pathTemplate,
        paramName,
        allEndpoints,
        currentParams
      );

      if (discoveredValue !== null) {
        this.cache.set(cacheKey, discoveredValue);
        this.logger.log(`🔍 Discovered ${paramName}=${discoveredValue} from list endpoint`);
        return discoveredValue;
      }

      // Step 2: Use smart fallback patterns
      const fallbackValue = this.getSmartFallback(paramName, pathTemplate);
      if (fallbackValue !== null) {
        this.cache.set(cacheKey, fallbackValue);
        this.logger.log(`🎯 Using fallback ${paramName}=${fallbackValue} (smart default)`);
        return fallbackValue;
      }

      this.logger.warn(`⚠️  Could not discover parameter: ${paramName}`);
      return null;

    } catch (error) {
      this.logger.warn(`⚠️  Error discovering ${paramName}: ${error.message}`);

      // Fall back to smart default even on error
      const fallbackValue = this.getSmartFallback(paramName, pathTemplate);
      if (fallbackValue !== null) {
        this.cache.set(cacheKey, fallbackValue);
        this.logger.log(`🎯 Using fallback ${paramName}=${fallbackValue} (after error)`);
        return fallbackValue;
      }

      return null;
    }
  }

  /**
   * Try to discover parameter from list endpoints
   * @param {string} pathTemplate - Original path template
   * @param {string} paramName - Parameter to discover
   * @param {Array} allEndpoints - All endpoints
   * @param {object} currentParams - Current parameters
   * @returns {Promise<string|number|null>} Discovered value
   */
  async discoverFromListEndpoint(pathTemplate, paramName, allEndpoints, currentParams) {
    // Find potential list endpoints that could provide this parameter
    const listEndpoints = this.findListEndpoints(pathTemplate, paramName, allEndpoints);

    for (const listEndpoint of listEndpoints) {
      try {
        const value = await this.queryListEndpoint(listEndpoint, paramName, currentParams);
        if (value !== null) {
          return value;
        }
      } catch (error) {
        this.logger.warn(`Failed to query list endpoint ${listEndpoint.path}: ${error.message}`);
        continue; // Try next list endpoint
      }
    }

    return null;
  }

  /**
   * Find list endpoints that might contain the parameter
   * @param {string} pathTemplate - Original path template
   * @param {string} paramName - Parameter to find
   * @param {Array} allEndpoints - All endpoints
   * @returns {Array} Potential list endpoints
   */
  findListEndpoints(pathTemplate, paramName, allEndpoints) {
    const listEndpoints = [];

    // Extract base path from template (e.g., "/pet/{petId}" -> "/pet")
    const basePath = pathTemplate.replace(/\/\{[^}]+\}.*$/, '');

    // Look for GET endpoints that match the base path
    const exactMatch = allEndpoints.find(ep =>
      ep.method.toUpperCase() === 'GET' &&
      ep.path === basePath
    );

    if (exactMatch) {
      listEndpoints.push(exactMatch);
    }

    // Look for common list patterns
    const pluralPatterns = this.getPluralPatterns(basePath);
    for (const pattern of pluralPatterns) {
      const match = allEndpoints.find(ep =>
        ep.method.toUpperCase() === 'GET' &&
        ep.path === pattern
      );
      if (match && !listEndpoints.some(ep => ep.path === match.path)) {
        listEndpoints.push(match);
      }
    }

    // Look for common query patterns that might return lists
    const queryPatterns = this.getQueryPatterns(basePath);
    for (const pattern of queryPatterns) {
      const matches = allEndpoints.filter(ep =>
        ep.method.toUpperCase() === 'GET' &&
        pattern.test(ep.path)
      );
      for (const match of matches) {
        if (!listEndpoints.some(ep => ep.path === match.path)) {
          listEndpoints.push(match);
        }
      }
    }

    // Sort by preference (exact matches first, then shorter paths)
    listEndpoints.sort((a, b) => {
      if (a.path === basePath) return -1;
      if (b.path === basePath) return 1;
      return a.path.length - b.path.length;
    });

    return listEndpoints;
  }

  /**
   * Get common plural patterns for a base path
   * @param {string} basePath - Base path like "/pet"
   * @returns {Array} Possible plural patterns
   */
  getPluralPatterns(basePath) {
    const patterns = [];

    if (basePath.endsWith('s')) {
      // Already plural, try removing 's'
      patterns.push(basePath);
    } else {
      // Try adding 's'
      patterns.push(basePath + 's');
    }

    // Common REST patterns
    const lastSegment = basePath.split('/').pop();
    const pathPrefix = basePath.substring(0, basePath.lastIndexOf('/'));

    if (lastSegment) {
      // /user -> /users
      patterns.push(`${pathPrefix}/${lastSegment}s`);

      // /person -> /people (handle common irregular plurals)
      const irregularPlurals = {
        'person': 'people',
        'child': 'children',
        'foot': 'feet',
        'tooth': 'teeth',
        'mouse': 'mice',
        'man': 'men',
        'woman': 'women'
      };

      if (irregularPlurals[lastSegment]) {
        patterns.push(`${pathPrefix}/${irregularPlurals[lastSegment]}`);
      }
    }

    return [...new Set(patterns)]; // Remove duplicates
  }

  /**
   * Get query patterns that might return lists for a base path
   * @param {string} basePath - Base path like "/pet"
   * @returns {Array} Array of regex patterns to match query endpoints
   */
  getQueryPatterns(basePath) {
    const patterns = [];

    // Common query patterns for list endpoints
    // /pet/findByStatus, /pet/findByTags, etc.
    patterns.push(new RegExp(`^${basePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/find`));
    patterns.push(new RegExp(`^${basePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/search`));
    patterns.push(new RegExp(`^${basePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/query`));
    patterns.push(new RegExp(`^${basePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/list`));

    return patterns;
  }

  /**
   * Query a list endpoint to extract parameter values
   * @param {object} endpoint - List endpoint to query
   * @param {string} paramName - Parameter name to extract
   * @param {object} currentParams - Current parameters for path resolution
   * @returns {Promise<string|number|null>} Extracted value
   */
  async queryListEndpoint(endpoint, paramName, currentParams) {
    if (!this.httpClient) {
      return null;
    }

    // Resolve any path parameters in the list endpoint path
    let resolvedPath = endpoint.path;
    for (const [key, value] of Object.entries(currentParams)) {
      resolvedPath = resolvedPath.replace(`{${key}}`, encodeURIComponent(value));
    }

    // Skip if there are still unresolved parameters
    if (resolvedPath.includes('{')) {
      return null;
    }

    try {
      const response = await this.httpClient.makeRequest(resolvedPath, 'GET', {
        timeout: 5000 // Quick timeout for discovery
      });

      if (response.status >= 200 && response.status < 300 && response.data) {
        return this.extractParameterFromResponse(response.data, paramName);
      }

      return null;
    } catch {
      // Don't log every failure as it's expected during discovery
      return null;
    }
  }

  /**
   * Extract parameter value from API response data
   * @param {*} data - Response data (object or array)
   * @param {string} paramName - Parameter to extract
   * @returns {string|number|null} Extracted value
   */
  extractParameterFromResponse(data, paramName) {
    if (!data) {
      return null;
    }

    // Handle array responses (most common for list endpoints)
    if (Array.isArray(data)) {
      if (data.length === 0) {
        return null;
      }

      // Try first item
      const firstItem = data[0];
      return this.extractParameterFromObject(firstItem, paramName);
    }

    // Handle object responses
    if (typeof data === 'object') {
      // Check if it has a data/items/results property with array
      const arrayProps = ['data', 'items', 'results', 'content', 'list'];
      for (const prop of arrayProps) {
        if (Array.isArray(data[prop]) && data[prop].length > 0) {
          return this.extractParameterFromObject(data[prop][0], paramName);
        }
      }

      // Try to extract directly from object
      return this.extractParameterFromObject(data, paramName);
    }

    return null;
  }

  /**
   * Extract parameter from a single object
   * @param {object} obj - Object to search
   * @param {string} paramName - Parameter name
   * @returns {string|number|null} Extracted value
   */
  extractParameterFromObject(obj, paramName) {
    if (!obj || typeof obj !== 'object') {
      return null;
    }

    // Direct match
    if (obj[paramName] !== undefined) {
      return obj[paramName];
    }

    // Common variations
    const variations = [
      paramName,
      paramName.toLowerCase(),
      paramName.replace(/Id$/, ''), // petId -> pet
      paramName.replace(/id$/i, ''), // petid -> pet
      'id' // fallback to id
    ];

    for (const variation of variations) {
      if (obj[variation] !== undefined) {
        const value = obj[variation];

        // Return primitive values or extract id from nested objects
        if (typeof value === 'string' || typeof value === 'number') {
          return value;
        } else if (typeof value === 'object' && value.id !== undefined) {
          return value.id;
        }
      }
    }

    // If no direct match, try 'id' as ultimate fallback
    if (obj.id !== undefined) {
      return obj.id;
    }

    return null;
  }

  /**
   * Get smart fallback value for common parameter patterns
   * @param {string} paramName - Parameter name
   * @param {string} pathTemplate - Full path template for context
   * @returns {string|number|null} Fallback value
   */
  getSmartFallback(paramName, pathTemplate) {
    const lowerParam = paramName.toLowerCase();

    // ID patterns
    if (lowerParam.includes('id')) {
      return '1'; // Most APIs use 1 as first/test ID
    }

    // Username patterns
    if (lowerParam.includes('user') || lowerParam.includes('username')) {
      return 'testuser';
    }

    // Email patterns
    if (lowerParam.includes('email')) {
      return 'test@example.com';
    }

    // Code/slug patterns
    if (lowerParam.includes('code') || lowerParam.includes('slug')) {
      return 'test';
    }

    // Name patterns
    if (lowerParam.includes('name') && !lowerParam.includes('username')) {
      return 'test';
    }

    // Category patterns
    if (lowerParam.includes('category')) {
      return 'general';
    }

    // Status patterns
    if (lowerParam.includes('status')) {
      return 'active';
    }

    // Type patterns
    if (lowerParam.includes('type')) {
      return 'default';
    }

    // Version patterns
    if (lowerParam.includes('version')) {
      return 'v1';
    }

    // Generic fallbacks based on path context
    if (pathTemplate.includes('/pet')) {
      if (lowerParam.includes('pet')) return '1';
    }

    if (pathTemplate.includes('/user')) {
      if (lowerParam.includes('user')) return '1';
    }

    if (pathTemplate.includes('/order')) {
      if (lowerParam.includes('order')) return '1';
    }

    // Ultimate fallback for any unrecognized pattern
    return '1';
  }

  /**
   * Clear discovery cache
   */
  clearCache() {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   * @returns {object} Cache statistics
   */
  getCacheStats() {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    };
  }

  /**
   * Validate that all required parameters are resolved
   * @param {string} pathTemplate - Path template
   * @param {object} resolvedParams - Resolved parameters
   * @returns {Array} Array of missing parameter names
   */
  validateParameters(pathTemplate, resolvedParams) {
    const paramMatches = pathTemplate.match(/\{([^}]+)\}/g);
    if (!paramMatches) {
      return [];
    }

    const requiredParams = paramMatches.map(match => match.slice(1, -1));
    const missing = [];

    for (const param of requiredParams) {
      if (resolvedParams[param] === undefined || resolvedParams[param] === null) {
        missing.push(param);
      }
    }

    return missing;
  }

  /**
   * Create parameter discovery for testing with mock dependencies
   * @param {object} mockDependencies - Mock dependencies
   * @returns {ParameterDiscovery} Test instance
   */
  static createForTesting(mockDependencies = {}) {
    return new ParameterDiscovery({
      httpClient: mockDependencies.httpClient,
      logger: mockDependencies.logger || { log: () => {}, warn: () => {} }
    });
  }
}

export default ParameterDiscovery;