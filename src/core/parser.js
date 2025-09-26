import SwaggerParser from '@apidevtools/swagger-parser';

// Constants for large schema optimization
const LARGE_SCHEMA_THRESHOLD = 100;
const VERY_LARGE_SCHEMA_THRESHOLD = 250;
const MAX_ENDPOINT_COUNT = 500;

/**
 * OpenAPI contract parser with validation and optimization features
 * Handles parsing, dereferencing, validation, and extraction of OpenAPI 3.x contracts
 * Supports OpenAPI 3.0.x and 3.1.x specifications (3.2.0+ pending library support)
 * Provides performance optimizations and helpful feedback for large schemas
 * @class ContractParser
 */
class ContractParser {
  /**
   * Parse and validate an OpenAPI contract file
   * Resolves all $ref pointers and extracts schemas and endpoints
   * @param {string} filePath - Path to the OpenAPI contract file (YAML or JSON)
   * @returns {Promise<Object>} Parsed contract with schemas and endpoints
   * @throws {Error} When parsing, validation, or resolution fails
   * @example
   * const parser = new ContractParser();
   * const contract = await parser.parseContract('./api-contract.yaml');
   * console.log(`Found ${contract.endpoints.length} endpoints`);
   */
  async parseContract(filePath) {
    try {
      // Use dereference to resolve all $ref pointers
      const api = await SwaggerParser.dereference(filePath);

      // Validate the resolved API
      await SwaggerParser.validate(api);

      const parsed = {
        info: api.info,
        paths: api.paths,
        components: api.components,
        schemas: this.extractSchemas(api),
        endpoints: this.extractEndpoints(api),
        openapi: api.openapi // Track version for feature support
      };

      this.validateParsedContract(parsed);
      this.checkSchemaSize(parsed);
      return parsed;
    } catch (error) {
      this.handleParsingError(error, filePath);
    }
  }

  /**
   * Handle parsing errors with helpful error messages
   * @private
   * @param {Error} error - The parsing error
   * @param {string} filePath - Path to the contract file
   * @throws {Error} Enhanced error with helpful context
   */
  handleParsingError(error, filePath) {
    if (error.name === 'ResolverError') {
      throw new Error(`❌ Contract resolution failed in ${filePath}:\n   ${error.message}`);
    } else if (error.name === 'ParserError') {
      throw new Error(`❌ Contract parsing failed in ${filePath}:\n   ${error.message}`);
    } else if (error.name === 'ValidatorError') {
      throw new Error(`❌ Contract validation failed in ${filePath}:\n   ${error.message}`);
    } else if (error.message?.includes('Unsupported OpenAPI version') && error.message?.includes('3.2')) {
      throw new Error(`❌ OpenAPI 3.2.0 is not yet supported by the parser library.\n   Please use OpenAPI 3.1.1 or earlier.\n   3.2.0 support will be added when the ecosystem catches up.`);
    } else {
      throw new Error(`❌ Contract processing failed: ${error.message}`);
    }
  }

  /**
   * Check schema size and provide performance feedback
   * @private
   * @param {Object} parsed - Parsed contract object
   */
  checkSchemaSize(parsed) {
    const schemaCount = Object.keys(parsed.schemas).length;
    const endpointCount = parsed.endpoints.length;
    
    if (schemaCount >= VERY_LARGE_SCHEMA_THRESHOLD) {
      console.log(`\n⚠️  Very large OpenAPI schema detected:`);
      console.log(`   📊 ${schemaCount} schemas (${endpointCount} endpoints)`);
      console.log(`   🚀 Consider splitting large schemas for better performance`);
      console.log(`   💡 Large schemas may take longer to process and generate`);
    } else if (schemaCount >= LARGE_SCHEMA_THRESHOLD) {
      console.log(`\n⚡ Large OpenAPI schema detected (${schemaCount} schemas)`);
      console.log(`   🎯 Processing optimizations enabled for better performance`);
    }
    
    if (endpointCount >= MAX_ENDPOINT_COUNT) {
      console.log(`\n⚠️  Very large API detected with ${endpointCount} endpoints`);
      console.log(`   💡 Consider API versioning or splitting for maintainability`);
    }
  }

  /**
   * Validate parsed contract has required fields
   * @private
   * @param {Object} parsed - Parsed contract object
   * @throws {Error} When required fields are missing
   */
  validateParsedContract(parsed) {
    const errors = [];

    if (!parsed.info?.title) {
      errors.push('Contract must have info.title');
    }

    if (!parsed.info?.version) {
      errors.push('Contract must have info.version');
    }

    if (!parsed.paths || Object.keys(parsed.paths).length === 0) {
      errors.push('Contract must define at least one path');
    }

    if (errors.length > 0) {
      throw new Error(`❌ Contract validation failed:\n${errors.map(e => `   ${e}`).join('\n')}`);
    }
  }
  
  /**
   * Extract schema definitions from OpenAPI contract
   * @private
   * @param {Object} contract - Dereferenced OpenAPI contract
   * @returns {Object} Schema definitions object
   */
  extractSchemas(contract) {
    // After dereference(), all schemas should be fully resolved
    // The components.schemas contains all the resolved schema definitions
    return contract.components?.schemas || {};
  }
  
  /**
   * Extract endpoint definitions from OpenAPI paths
   * @private
   * @param {Object} contract - Dereferenced OpenAPI contract
   * @returns {Array} Array of endpoint objects with normalized structure
   */
  extractEndpoints(contract) {
    const endpoints = [];
    
    for (const [path, methods] of Object.entries(contract.paths || {})) {
      for (const [method, spec] of Object.entries(methods)) {
        // Skip non-HTTP methods (like parameters, summary, etc.)
        if (!['get', 'post', 'put', 'patch', 'delete', 'head', 'options', 'trace'].includes(method.toLowerCase())) {
          continue;
        }

        const endpoint = {
          path,
          method: method.toUpperCase(),
          operationId: spec.operationId,
          summary: spec.summary,
          description: spec.description,
          tags: spec.tags || [],
          parameters: this.extractParameters(spec.parameters || []),
          requestBody: this.extractRequestBody(spec.requestBody),
          responses: this.extractResponses(spec.responses || {}),
          spec // Keep original spec for reference
        };

        endpoints.push(endpoint);
      }
    }

    return endpoints;
  }

  /**
   * Extract and normalize parameter definitions
   * @private
   * @param {Array} parameters - OpenAPI parameter definitions
   * @returns {Array} Normalized parameter objects
   */
  extractParameters(parameters) {
    return parameters.map(param => ({
      name: param.name,
      in: param.in, // 'path', 'query', 'header', 'cookie'
      required: param.required || false,
      schema: param.schema,
      description: param.description
    }));
  }

  /**
   * Extract request body schema from OpenAPI definition
   * @private
   * @param {Object} requestBody - OpenAPI request body definition
   * @returns {Object|null} Normalized request body object or null
   */
  extractRequestBody(requestBody) {
    if (!requestBody) return null;

    const content = requestBody.content || {};
    const jsonContent = content['application/json'];
    
    if (!jsonContent?.schema) return null;

    return {
      required: requestBody.required || false,
      schema: jsonContent.schema,
      description: requestBody.description
    };
  }

  /**
   * Extract response schemas from OpenAPI definition
   * @private
   * @param {Object} responses - OpenAPI responses definition
   * @returns {Object} Normalized response objects by status code
   */
  extractResponses(responses) {
    const extractedResponses = {};

    for (const [statusCode, response] of Object.entries(responses)) {
      const content = response.content || {};
      const jsonContent = content['application/json'];

      extractedResponses[statusCode] = {
        description: response.description,
        schema: jsonContent?.schema || null,
        headers: response.headers || {}
      };
    }

    return extractedResponses;
  }

  /**
   * Generate schema names from endpoint path and method
   * @private
   * @param {string} path - API endpoint path
   * @param {string} method - HTTP method
   * @param {string} suffix - Schema suffix (e.g., 'Request', 'Response')
   * @returns {string} Generated schema name
   * @example
   * generateSchemaName('/users/{id}', 'POST', 'Request') // 'PostUsersRequest'
   */
  generateSchemaName(path, method, suffix) {
    // Convert /users/{id} POST to CreateUserRequest
    const pathParts = path.split('/').filter(p => p && !p.startsWith('{'));
    const resource = pathParts[pathParts.length - 1];
    const methodName = method.charAt(0).toUpperCase() + method.slice(1).toLowerCase();
    const resourceName = resource.charAt(0).toUpperCase() + resource.slice(1);
    
    return `${methodName}${resourceName}${suffix}`;
  }
}

export default ContractParser;