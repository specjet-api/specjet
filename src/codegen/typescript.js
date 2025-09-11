import TypeScriptInterfaceGenerator from './interface-generator.js';
import ApiClientGenerator from './api-client-generator.js';

// Constants for large schema optimization
const LARGE_SCHEMA_THRESHOLD = 100;
const BATCH_SIZE = 50; // Process schemas in batches for memory efficiency

/**
 * TypeScript code generator with optimization support
 * Generates TypeScript interfaces and API clients from OpenAPI contracts
 * @class TypeScriptGenerator
 */
class TypeScriptGenerator {
  /**
   * Creates a new TypeScript generator instance
   * Initializes interface and API client generators
   */
  constructor() {
    this.interfaceGenerator = new TypeScriptInterfaceGenerator();
    this.apiClientGenerator = new ApiClientGenerator();
  }
  
  /**
   * Generates TypeScript interfaces from OpenAPI schemas
   * Uses batch processing for large schemas to optimize memory usage
   * @param {Object} schemas - OpenAPI schema definitions
   * @returns {string} Generated TypeScript interface code
   * @example
   * const generator = new TypeScriptGenerator();
   * const interfaces = generator.generateInterfaces(parsedContract.schemas);
   * console.log(interfaces); // TypeScript interface definitions
   */
  generateInterfaces(schemas) {
    const schemaCount = Object.keys(schemas).length;
    
    // Use batch processing for large schemas
    if (schemaCount >= LARGE_SCHEMA_THRESHOLD) {
      return this.generateInterfacesBatched(schemas);
    }
    
    return this.interfaceGenerator.generateInterfaces(schemas);
  }
  
  generateInterfacesBatched(schemas) {
    const schemaEntries = Object.entries(schemas);
    const batches = [];
    
    // Split into batches for memory efficiency
    for (let i = 0; i < schemaEntries.length; i += BATCH_SIZE) {
      const batch = schemaEntries.slice(i, i + BATCH_SIZE);
      batches.push(Object.fromEntries(batch));
    }
    
    // Process each batch and combine results
    const results = batches.map(batch => {
      return this.interfaceGenerator.generateInterfaces(batch);
    });
    
    return results.join('\n\n');
  }
  
  /**
   * Generates TypeScript API client from endpoints and schemas
   * Uses optimization for large APIs with endpoint sorting
   * @param {Array} endpoints - Array of API endpoints
   * @param {Object} schemas - OpenAPI schema definitions  
   * @param {Object} config - Generation configuration options
   * @returns {string} Generated TypeScript API client code
   * @example
   * const client = generator.generateApiClient(
   *   contract.endpoints,
   *   contract.schemas,
   *   { clientName: 'MyApiClient' }
   * );
   */
  generateApiClient(endpoints, schemas, config = {}) {
    const endpointCount = endpoints.length;
    
    // Use optimized processing for large APIs
    if (endpointCount >= LARGE_SCHEMA_THRESHOLD) {
      return this.generateApiClientOptimized(endpoints, schemas, config);
    }
    
    return this.apiClientGenerator.generateApiClient(endpoints, schemas, config);
  }
  
  generateApiClientOptimized(endpoints, schemas, config = {}) {
    // Sort endpoints by path for better organization in large APIs
    const sortedEndpoints = [...endpoints].sort((a, b) => a.path.localeCompare(b.path));
    
    return this.apiClientGenerator.generateApiClient(sortedEndpoints, schemas, config);
  }
}

export default TypeScriptGenerator;