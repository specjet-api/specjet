import express from 'express';
import cors from 'cors';
import { faker } from '@faker-js/faker';

// Constants for better maintainability
const DEFAULT_MAX_ITEMS = 1000;
const MAX_ITEMS_VERY_COMPLEX_OBJECTS = 50;
const MAX_ITEMS_MODERATELY_COMPLEX_OBJECTS = 100;
const MAX_ITEMS_SIMPLE_OBJECTS = 200;

/**
 * Mock server with realistic data generation based on OpenAPI contracts
 * Provides persistent data across requests and supports multiple scenarios
 * @class MockServer
 */
class MockServer {
  /**
   * Create a new mock server instance
   * @param {Object} contract - Parsed OpenAPI contract
   * @param {string} [scenario='demo'] - Data scenario (demo, realistic, large, errors)
   * @param {Object} [options={}] - Server configuration options
   * @param {Object} [options.entityPatterns] - Custom patterns for entity detection
   * @param {Object} [options.domainMappings] - Custom domain mappings for data generation
   */
  constructor(contract, scenario = 'demo', options = {}) {
    this.app = express();
    this.contract = contract;
    this.scenario = scenario;
    
    // Store resolved schemas for $ref resolution
    this.schemas = contract.components?.schemas || {};
    
    // In-memory data store for persistent mock data
    this.dataStore = new Map();
    this.nextId = 1;
    
    // Track explicitly deleted records to return 404 instead of regenerating
    this.deletedRecords = new Map();
    
    // Configure entity detection patterns (can be overridden via options)
    this.entityPatterns = {
      user: /^(user|author|customer|owner|creator)s?$/i,
      category: /^categor(y|ies)$/i,
      product: /^products?$/i,
      review: /^reviews?$/i,
      order: /^orders?$/i,
      cart: /^carts?$/i,
      ...options.entityPatterns
    };
    
    // Configure domain mappings (can be overridden via options)
    this.domainMappings = {
      user: 'users',
      category: 'commerce',
      product: 'commerce', 
      review: 'commerce',
      order: 'commerce',
      cart: 'commerce',
      ...options.domainMappings
    };
    
    this.setupMiddleware();
    this.setupRoutes();
  }
  
  /**
   * Setup Express middleware for CORS and JSON parsing
   * @private
   */
  setupMiddleware() {
    this.app.use(cors());
    this.app.use(express.json());
  }
  
  /**
   * Setup routes from OpenAPI contract endpoints
   * @private
   */
  setupRoutes() {
    if (!this.contract?.endpoints) return;
    
    for (const endpoint of this.contract.endpoints) {
      this.addRoute(endpoint);
    }
  }
  
  
  /**
   * Add a single route to Express app with mock data handling
   * @private
   * @param {Object} endpoint - OpenAPI endpoint definition
   */
  addRoute(endpoint) {
    const method = endpoint.method.toLowerCase();
    const path = this.convertOpenApiPath(endpoint.path);
    
    this.app[method](path, (req, res) => {
      try {
        // Handle error scenarios
        if (this.scenario === 'errors' && Math.random() < 0.3) {
          return this.generateErrorResponse(res, endpoint);
        }
        
        // Extract entity type for data persistence
        const entityType = this.extractEntityType(endpoint);
        
        // Handle different HTTP methods with data persistence
        const httpMethod = method.toUpperCase();
        let mockData;
        let statusCode;
        
        if (httpMethod === 'GET' && req.params.id) {
          // GET by ID - check if explicitly deleted first
          if (this.isRecordDeleted(entityType, req.params.id)) {
            return res.status(404).json({
              message: `${entityType} not found`,
              code: 'not_found'
            });
          }
          
          // Return stored record or generate consistent one
          const storedRecord = this.getRecord(entityType, req.params.id);
          if (storedRecord) {
            mockData = storedRecord;
          } else {
            // Generate consistent record with the requested ID
            const { params, context } = this.extractRequestParams(req, endpoint);
            mockData = this.generateMockResponse(endpoint, params, context);
            // Store it for future requests
            this.storeRecord(entityType, mockData);
          }
          statusCode = 200;
          
        } else if (httpMethod === 'GET') {
          // GET all - check if response should be array or single object based on schema
          const { params, context } = this.extractRequestParams(req, endpoint);
          mockData = this.generateMockResponse(endpoint, params, context);

          // Store generated data for persistence
          if (Array.isArray(mockData)) {
            mockData.forEach(item => this.storeRecord(entityType, item));
          } else if (mockData && typeof mockData === 'object') {
            this.storeRecord(entityType, mockData);
          }
          statusCode = 200;
          
        } else if (httpMethod === 'POST') {
          // Validate request body first
          const validation = this.validateRequestBody(req, endpoint);
          if (!validation.isValid) {
            const errorResponse = this.generateValidationErrorResponse(validation.errors);
            return res.status(400).json(errorResponse);
          }

          // POST - generate response according to endpoint schema
          const { params, context } = this.extractRequestParams(req, endpoint);
          const correlationContext = { ...context, correlationId: this.nextId++ };

          // Check if this endpoint should return ApiResponse (like file uploads)
          const shouldReturnApiResponse = this.shouldReturnApiResponse(endpoint);

          if (shouldReturnApiResponse) {
            // Generate ApiResponse for endpoints like file upload
            mockData = {
              code: 200,
              type: 'success',
              message: 'Operation completed successfully'
            };
          } else {
            // Generate response matching the endpoint's response schema
            mockData = this.generateMockResponse(endpoint, params, correlationContext);

            // If it's an object, merge with request data and add server-generated ID
            if (mockData && typeof mockData === 'object' && !Array.isArray(mockData)) {
              mockData = { ...req.body, ...mockData };
              if (!mockData.id) {
                mockData.id = this.nextId++;
              }
            }
          }

          this.storeRecord(entityType, mockData);
          statusCode = 201;
          
        } else if (httpMethod === 'PUT' || httpMethod === 'PATCH') {
          // Validate request body first
          const validation = this.validateRequestBody(req, endpoint);
          if (!validation.isValid) {
            const errorResponse = this.generateValidationErrorResponse(validation.errors);
            return res.status(400).json(errorResponse);
          }
          
          // PUT/PATCH - update existing record
          const id = req.params.id;
          const updates = { ...req.body, updatedAt: new Date().toISOString() };
          mockData = this.updateRecord(entityType, id, updates);
          
          if (!mockData) {
            // Record doesn't exist, return 404
            return res.status(404).json({
              message: `${entityType} not found`,
              code: 'not_found'
            });
          }
          statusCode = 200;
          
        } else if (httpMethod === 'DELETE') {
          // DELETE - remove record
          const id = req.params.id;
          const deleted = this.deleteRecord(entityType, id);
          
          if (!deleted) {
            return res.status(404).json({
              message: `${entityType} not found`,
              code: 'not_found'
            });
          }
          
          return res.status(204).send(); // No content for successful delete
          
        } else {
          // Fallback to original mock generation for other methods
          const validation = this.validateRequestBody(req, endpoint);
          if (!validation.isValid) {
            const errorResponse = this.generateValidationErrorResponse(validation.errors);
            return res.status(400).json(errorResponse);
          }
          
          const { params, context } = this.extractRequestParams(req, endpoint);
          mockData = this.generateMockResponse(endpoint, params, context);
          statusCode = this.getSuccessStatusCode(endpoint);
        }
        
        res.status(statusCode).json(mockData);
      } catch (error) {
        res.status(500).json({ 
          error: 'Mock generation failed', 
          message: error.message 
        });
      }
    });
  }
  
  /**
   * Convert OpenAPI path parameters to Express route format
   * @private
   * @param {string} openApiPath - OpenAPI path with {param} syntax
   * @returns {string} Express path with :param syntax
   * @example
   * convertOpenApiPath('/users/{id}') // returns '/users/:id'
   */
  convertOpenApiPath(openApiPath) {
    // Convert /users/{id} to /users/:id
    return openApiPath.replace(/{([^}]+)}/g, ':$1');
  }
  
  /**
   * Generate mock response data for an endpoint
   * @param {Object} endpoint - OpenAPI endpoint definition
   * @param {Object} [params={}] - URL parameters for response generation
   * @param {Object} [requestContext={}] - Additional request context
   * @returns {any} Generated mock data matching endpoint schema
   * @example
   * const mockData = server.generateMockResponse(endpoint, { id: '123' });
   */
  generateMockResponse(endpoint, params = {}, requestContext = {}) {
    const responses = endpoint.responses || endpoint.spec?.responses || {};
    const successResponse = responses['200'] || responses['201'] || responses['202'] || Object.values(responses)[0];
    
    if (!successResponse?.schema && !successResponse?.content?.['application/json']?.schema) {
      return { message: 'Mock response', method: endpoint.method, path: endpoint.path };
    }
    
    // Get schema from either direct schema or content schema
    const schema = successResponse.schema || successResponse.content?.['application/json']?.schema;
    
    // Extract endpoint context for smarter data generation
    const endpointContext = this.extractEndpointContext(endpoint);
    
    // Combine endpoint context with request context
    const combinedContext = { ...endpointContext, ...requestContext };
    
    return this.generateMockData(schema, this.scenario, params, combinedContext);
  }
  
  extractEndpointContext(endpoint) {
    const context = {
      domain: 'generic',
      entity: 'item',
      tags: endpoint.tags || endpoint.spec?.tags || [],
      path: endpoint.path,
      method: endpoint.method,
      operationId: endpoint.operationId || endpoint.spec?.operationId
    };
    
    // Determine domain from tags
    if (context.tags.length > 0) {
      const primaryTag = context.tags[0].toLowerCase();
      switch (primaryTag) {
        case 'categories':
          context.domain = 'commerce';
          context.entity = 'category';
          break;
        case 'products':
          context.domain = 'commerce';
          context.entity = 'product';
          break;
        case 'users':
          context.domain = 'users';
          context.entity = 'user';
          break;
        case 'orders':
          context.domain = 'commerce';
          context.entity = 'order';
          break;
        case 'reviews':
          context.domain = 'commerce';
          context.entity = 'review';
          break;
        case 'cart':
          context.domain = 'commerce';
          context.entity = 'cart';
          break;
        case 'authentication':
          context.domain = 'auth';
          context.entity = 'auth';
          break;
        default:
          // Try to infer from path
          context.domain = this.inferDomainFromPath(context.path);
          context.entity = this.inferEntityFromPath(context.path);
      }
    } else {
      // Fallback to path analysis
      context.domain = this.inferDomainFromPath(context.path);
      context.entity = this.inferEntityFromPath(context.path);
    }
    
    return context;
  }
  
  inferDomainFromPath(path) {
    const pathLower = path.toLowerCase();
    if (pathLower.includes('/products') || pathLower.includes('/categories') || 
        pathLower.includes('/orders') || pathLower.includes('/cart')) {
      return 'commerce';
    }
    if (pathLower.includes('/users') || pathLower.includes('/profile')) {
      return 'users';
    }
    if (pathLower.includes('/auth')) {
      return 'auth';
    }
    return 'generic';
  }
  
  inferEntityFromPath(path) {
    const pathSegments = path.split('/').filter(segment => segment && !segment.startsWith('{'));
    if (pathSegments.length > 0) {
      const lastSegment = pathSegments[pathSegments.length - 1];
      // Convert plural to singular
      if (lastSegment.endsWith('ies')) {
        return lastSegment.slice(0, -3) + 'y'; // categories -> category
      } else if (lastSegment.endsWith('s')) {
        return lastSegment.slice(0, -1); // products -> product
      }
      return lastSegment;
    }
    return 'item';
  }
  
  inferNestedContext(propName, parentContext) {
    if (!parentContext) {
      return { domain: 'generic', entity: 'item', tags: [], path: '', method: '' };
    }
    
    // Check against configured entity patterns
    for (const [entityType, pattern] of Object.entries(this.entityPatterns)) {
      if (pattern.test(propName)) {
        return {
          ...parentContext,
          entity: entityType,
          domain: this.domainMappings[entityType] || 'generic'
        };
      }
    }
    
    // For unmatched properties, keep parent context
    return parentContext;
  }

  generateErrorResponse(res, endpoint) {
    const errorResponses = Object.keys(endpoint.responses || endpoint.spec?.responses || {})
      .filter(code => code.startsWith('4') || code.startsWith('5'));
    
    if (errorResponses.length === 0) {
      // Default error responses
      const errorCode = Math.random() < 0.7 ? 404 : 400;
      const errorMessages = {
        400: 'Bad Request - Invalid parameters',
        404: 'Not Found - Resource does not exist',
        500: 'Internal Server Error'
      };
      return res.status(errorCode).json({ 
        error: errorMessages[errorCode],
        code: errorCode
      });
    }
    
    // Use defined error response
    const errorCode = errorResponses[Math.floor(Math.random() * errorResponses.length)];
    const errorSpec = (endpoint.responses || endpoint.spec.responses)[errorCode];
    
    res.status(parseInt(errorCode)).json({
      error: errorSpec.description || 'An error occurred',
      code: parseInt(errorCode)
    });
  }

  getSuccessStatusCode(endpoint) {
    const responses = endpoint.responses || endpoint.spec?.responses || {};
    const statusCodes = Object.keys(responses).filter(code => code.startsWith('2'));
    return parseInt(statusCodes[0] || '200');
  }

  extractRequestParams(req, endpoint) {
    const params = {
      path: req.params || {},
      query: req.query || {},
      body: req.body || {}
    };
    
    const context = {};
    
    // Add correlation between path params and generated IDs
    if (params.path.id) {
      context.correlationId = params.path.id;
      
      // Try to determine the expected type from the endpoint schema
      if (endpoint?.spec?.parameters) {
        const idParam = endpoint.spec.parameters.find(p => p.name === 'id' && p.in === 'path');
        if (idParam?.schema?.type) {
          context.correlationIdType = idParam.schema.type;
        }
      }
    }
    
    return { params, context };
  }
  
  resolveSchemaRef(ref) {
    // Extract schema name from $ref path like "#/components/schemas/Product"
    const parts = ref.split('/');
    const schemaName = parts[parts.length - 1];
    
    // Look up in our resolved schemas
    const resolvedSchema = this.schemas[schemaName];
    if (resolvedSchema) {
      return resolvedSchema;
    }
    
    // Fallback: return a basic schema structure
    console.warn(`⚠️  Schema reference not found: ${ref}`);
    return {
      type: 'object',
      properties: {
        id: { type: 'string', format: 'uuid' },
        name: { type: 'string' }
      },
      required: ['id', 'name']
    };
  }

  validateRequestBody(req, endpoint) {
    const method = endpoint.method.toUpperCase();
    
    // Only validate methods that typically have request bodies
    if (!['POST', 'PUT', 'PATCH'].includes(method)) {
      return { isValid: true };
    }
    
    // Check if endpoint expects a request body
    const requestBody = endpoint.spec?.requestBody || endpoint.requestBody;
    if (!requestBody || !requestBody.required) {
      return { isValid: true };
    }
    
    // Get the schema for the request body
    const content = requestBody.content?.['application/json'];
    if (!content?.schema) {
      return { isValid: true };
    }
    
    const schema = content.schema.$ref ? this.resolveSchemaRef(content.schema.$ref) : content.schema;
    const body = req.body || {};
    
    // Validate required fields
    const errors = [];
    const required = schema.required || [];
    
    for (const field of required) {
      if (!(field in body) || body[field] === null || body[field] === undefined || body[field] === '') {
        errors.push({
          field,
          message: `'${field}' is required`,
          code: 'required_field_missing'
        });
      }
    }
    
    // Validate data types for provided fields
    if (schema.properties) {
      for (const [field, fieldSchema] of Object.entries(schema.properties)) {
        if (field in body && body[field] !== null && body[field] !== undefined) {
          const value = body[field];
          const expectedType = fieldSchema.type;
          
          if (expectedType && !this.validateFieldType(value, expectedType, fieldSchema)) {
            errors.push({
              field,
              message: `'${field}' must be of type ${expectedType}`,
              code: 'invalid_type'
            });
          }
        }
      }
    }
    
    return {
      isValid: errors.length === 0,
      errors: errors
    };
  }
  
  validateFieldType(value, expectedType, schema = {}) {
    switch (expectedType) {
      case 'string':
        if (schema.format === 'email') {
          return typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
        }
        if (schema.format === 'uuid') {
          return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
        }
        if (schema.format === 'date') {
          return typeof value === 'string' && !isNaN(Date.parse(value));
        }
        if (schema.format === 'date-time') {
          return typeof value === 'string' && !isNaN(Date.parse(value));
        }
        return typeof value === 'string';
      case 'number':
      case 'integer':
        return typeof value === 'number' && !isNaN(value) && 
               (expectedType === 'number' || Number.isInteger(value));
      case 'boolean':
        return typeof value === 'boolean';
      case 'array':
        return Array.isArray(value);
      case 'object':
        return typeof value === 'object' && value !== null && !Array.isArray(value);
      default:
        return true; // Unknown type, assume valid
    }
  }
  
  generateValidationErrorResponse(errors) {
    return {
      message: 'Validation failed',
      code: 'validation_error',
      details: {
        errors: errors
      }
    };
  }

  generateMockData(schema, scenario, params = {}, context = {}) {
    // Null safety: never return null/undefined from this method
    if (!schema) {
      console.warn('⚠️  generateMockData called with null/undefined schema');
      return { _mock: true };
    }
    
    // Handle $ref resolution
    if (schema.$ref) {
      const resolvedSchema = this.resolveSchemaRef(schema.$ref);
      return this.generateMockData(resolvedSchema, scenario, params, context);
    }
    
    // Handle oneOf - pick first option
    if (schema.oneOf) {
      return this.generateMockData(schema.oneOf[0], scenario, params, context);
    }
    
    // Handle allOf - merge all schemas (simplified)
    if (schema.allOf) {
      const merged = {};
      for (const subSchema of schema.allOf) {
        const subData = this.generateMockData(subSchema, scenario, params, context);
        Object.assign(merged, subData);
      }
      return merged;
    }
    
    // Handle enums
    if (schema.enum) {
      return schema.enum[Math.floor(Math.random() * schema.enum.length)];
    }
    
    if (schema.type === 'array') {
      // Calculate appropriate memory limits based on item complexity
      let maxItems = DEFAULT_MAX_ITEMS; // Default limit
      if (schema.items?.type === 'object' || schema.items?.properties) {
        // Complex objects get lower limits
        const propertyCount = Object.keys(schema.items?.properties || {}).length;
        if (propertyCount > 10) {
          maxItems = MAX_ITEMS_VERY_COMPLEX_OBJECTS; // Very complex objects
        } else if (propertyCount > 5) {
          maxItems = MAX_ITEMS_MODERATELY_COMPLEX_OBJECTS; // Moderately complex objects
        } else {
          maxItems = MAX_ITEMS_SIMPLE_OBJECTS; // Simple objects
        }
      }
      
      const itemCount = this.getItemCount(scenario, maxItems);
      const items = [];
      for (let i = 0; i < itemCount; i++) {
        const item = this.generateMockData(schema.items, scenario, params, context);
        // Never push null/undefined items - use fallback instead
        if (item === null || item === undefined) {
          // Generate a fallback item based on the schema type
          const fallbackItem = this.generateFallbackItem(schema.items);
          items.push(fallbackItem);
        } else {
          items.push(item);
        }
      }
      return items;
    }
    
    if (schema.type === 'object' || schema.properties) {
      const obj = {};
      const properties = schema.properties || {};
      const required = schema.required || [];
      
      for (const [propName, propSchema] of Object.entries(properties)) {
        // Use correlation ID for id fields if available
        if (propName === 'id' && context.correlationId) {
          // Convert correlation ID to the correct type if type info is available
          if (context.correlationIdType === 'integer' || context.correlationIdType === 'number') {
            obj[propName] = parseInt(context.correlationId);
          } else {
            obj[propName] = context.correlationId;
          }
        } else {
          obj[propName] = this.generatePropertyValue(propName, propSchema, scenario, context);
        }
      }
      
      // Add required properties that might be missing
      for (const reqProp of required) {
        if (!Object.prototype.hasOwnProperty.call(obj, reqProp)) {
          obj[reqProp] = this.generatePropertyValue(reqProp, { type: 'string' }, scenario, context);
        }
      }
      
      return obj;
    }
    
    return this.generatePrimitiveValue(schema, scenario);
  }
  
  getItemCount(scenario, maxItems = DEFAULT_MAX_ITEMS) {
    let count;
    switch (scenario) {
      case 'demo':
        count = 3;
        break;
      case 'realistic':
        count = faker.number.int({ min: 5, max: 15 });
        break;
      case 'large':
        count = faker.number.int({ min: 50, max: 100 });
        break;
      case 'errors':
        count = faker.number.int({ min: 2, max: 8 });
        break;
      default:
        count = 3;
    }
    
    // Apply memory safety limit
    return Math.min(count, maxItems);
  }
  
  generateFallbackItem(schema) {
    // Generate a basic fallback item when primary generation fails
    if (schema?.type === 'object' || schema?.properties) {
      return {
        id: faker.string.uuid(),
        name: faker.lorem.words(2),
        _fallback: true
      };
    }
    
    if (schema?.$ref) {
      // For $ref schemas, return a basic object
      return {
        id: faker.string.uuid(),
        name: faker.lorem.words(2),
        _fallback: true
      };
    }
    
    // For primitive types, use the primitive generator
    return this.generatePrimitiveValue(schema || { type: 'string' });
  }
  
  generateDomainSpecificValue(propName, schema, context, scenario) {
    const propLower = propName.toLowerCase();
    const { entity } = context;
    
    // Generate context-aware names
    if (propLower.includes('name') && !propLower.includes('firstname') && !propLower.includes('lastname')) {
      switch (entity) {
        case 'category':
          return this.generateCategoryName();
        case 'product':
          return this.generateProductName();
        case 'user':
          return faker.person.fullName();
        case 'review':
          return this.generateReviewTitle(scenario);
        default:
          return faker.lorem.words(2);
      }
    }
    
    // Generate context-aware descriptions
    if (propLower.includes('description') || propLower.includes('bio')) {
      switch (entity) {
        case 'category':
          return this.generateCategoryDescription(scenario);
        case 'product':
          return this.generateProductDescription();
        case 'user':
          return scenario === 'demo' ? faker.lorem.sentence() : faker.lorem.paragraphs();
        case 'review':
          return this.generateReviewComment(scenario);
        default:
          return scenario === 'demo' ? faker.lorem.sentence() : faker.lorem.paragraphs();
      }
    }
    
    // Generate context-aware titles
    if (propLower.includes('title')) {
      switch (entity) {
        case 'review':
          return this.generateReviewTitle(scenario);
        case 'product':
          return this.generateProductName();
        default:
          return faker.lorem.words(faker.number.int({ min: 3, max: 8 }));
      }
    }
    
    return null; // Let the generic handler take over
  }
  
  generateCategoryName() {
    return faker.commerce.department();
  }
  
  generateCategoryDescription(scenario) {
    if (scenario === 'demo') {
      return faker.lorem.sentence();
    }
    return faker.lorem.paragraph();
  }
  
  generateProductName() {
    return faker.commerce.productName();
  }
  
  generateProductDescription() {
    return faker.commerce.productDescription();
  }
  
  generateReviewTitle(scenario) {
    if (scenario === 'demo') {
      return faker.lorem.words(faker.number.int({ min: 3, max: 6 }));
    }
    return faker.lorem.words(faker.number.int({ min: 3, max: 8 }));
  }
  
  generateReviewComment(scenario) {
    if (scenario === 'demo') {
      return faker.lorem.sentence();
    }
    return faker.lorem.paragraphs(faker.number.int({ min: 1, max: 3 }));
  }

  generatePropertyValue(propName, schema, scenario = 'demo', context = null) {
    // Handle schema references in properties
    if (schema.$ref) {
      const resolvedSchema = this.resolveSchemaRef(schema.$ref);
      return this.generateMockData(resolvedSchema, scenario, {}, context);
    }
    
    // Handle arrays - must use generateMockData to handle array type properly
    if (schema.type === 'array') {
      return this.generateMockData(schema, scenario, {}, context);
    }
    
    // Handle nested object relationships
    if (schema.type === 'object' || schema.properties) {
      const nestedContext = this.inferNestedContext(propName, context);
      return this.generateMockData(schema, scenario, {}, nestedContext);
    }
    
    // Try domain-specific generation first if context is available
    if (context) {
      const domainValue = this.generateDomainSpecificValue(propName, schema, context, scenario);
      if (domainValue !== null) {
        return domainValue;
      }
    }
    
    // Smart generation based on property name patterns
    const propLower = propName.toLowerCase();
    
    // Email patterns
    if (schema.format === 'email' || propLower.includes('email')) {
      return faker.internet.email();
    }
    
    // Token/Auth patterns - Enhanced with better faker methods
    if (propLower.includes('token') || propLower.includes('jwt') || propLower.includes('accesstoken') || propLower.includes('refreshtoken')) {
      return faker.internet.jwt();
    }
    if (propLower.includes('apikey') || propLower.includes('api_key')) {
      return faker.string.alphanumeric(32);
    }
    if (propLower.includes('secret') || propLower.includes('key')) {
      return faker.string.alphanumeric(64);
    }
    if (propLower.includes('bearer') || propLower.includes('authorization')) {
      return `Bearer ${faker.internet.jwt()}`;
    }
    
    // Date/time patterns
    if (schema.format === 'date-time' || propLower.includes('createdat') || propLower.includes('updatedat')) {
      return faker.date.recent().toISOString();
    }
    if (schema.format === 'date' || propLower.includes('date')) {
      return faker.date.recent().toISOString().split('T')[0];
    }
    
    // ID patterns - always respect schema type first
    if (propName === 'id' || propLower.endsWith('id')) {
      // If schema has explicit type, always use it
      if (schema.type === 'integer' || schema.type === 'number') {
        return scenario === 'demo' ? faker.number.int({ min: 1, max: 100 }) : faker.number.int({ min: 1, max: 100000 });
      }
      if (schema.type === 'string') {
        return schema.format === 'uuid' ? faker.string.uuid() : faker.string.alphanumeric({ length: 8 });
      }
      
      // Only if no schema type is provided, use format or fallback logic
      if (schema.format === 'uuid') {
        return faker.string.uuid();
      }
      
      // Final fallback for ID fields without explicit type - warn and use integer for demo
      console.warn(`⚠️  ID field '${propName}' has no explicit type in schema, defaulting to integer for scenario '${scenario}'`);
      return scenario === 'demo' ? faker.number.int({ min: 1, max: 100 }) : faker.string.uuid();
    }
    
    // Name patterns
    if (propLower.includes('firstname') || propLower === 'first_name') {
      return faker.person.firstName();
    }
    if (propLower.includes('lastname') || propLower === 'last_name') {
      return faker.person.lastName();
    }
    if (propLower.includes('fullname') || propLower.includes('name')) {
      return faker.person.fullName();
    }
    
    // Address patterns
    if (propLower.includes('address')) {
      return faker.location.streetAddress();
    }
    if (propLower.includes('city')) {
      return faker.location.city();
    }
    if (propLower.includes('country')) {
      return faker.location.country();
    }
    
    // Phone patterns
    if (propLower.includes('phone')) {
      return faker.phone.number();
    }
    
    // URL patterns
    if (schema.format === 'uri' || propLower.includes('url') || propLower.includes('link')) {
      return faker.internet.url();
    }
    
    // Status/boolean patterns
    if (propLower.includes('active') || propLower.includes('enabled') || propLower.includes('verified')) {
      return scenario === 'demo' ? true : faker.datatype.boolean();
    }
    
    // Price/money patterns
    if (propLower.includes('price') || propLower.includes('amount') || propLower.includes('cost')) {
      return parseFloat(faker.commerce.price());
    }
    
    // Description patterns
    if (propLower.includes('description') || propLower.includes('bio')) {
      return scenario === 'demo' ? faker.lorem.sentence() : faker.lorem.paragraphs();
    }
    
    return this.generatePrimitiveValue(schema, scenario);
  }
  
  generatePrimitiveValue(schema, scenario = 'demo') {
    const type = schema.type || 'string';
    
    switch (type) {
      case 'string': {
        if (schema.enum) {
          return schema.enum[Math.floor(Math.random() * schema.enum.length)];
        }
        if (schema.minLength || schema.maxLength) {
          const min = schema.minLength || 5;
          const max = schema.maxLength || 50;
          return faker.lorem.words({ min: Math.ceil(min/5), max: Math.ceil(max/5) });
        }
        return scenario === 'demo' ? faker.lorem.words(2) : faker.lorem.sentence();
      }
        
      case 'integer': {
        const intMin = schema.minimum || 1;
        const intMax = schema.maximum || (scenario === 'large' ? 10000 : 1000);
        return faker.number.int({ min: intMin, max: intMax });
      }
        
      case 'number': {
        const numMin = schema.minimum || 0;
        const numMax = schema.maximum || (scenario === 'large' ? 10000 : 1000);
        return faker.number.float({ min: numMin, max: numMax, precision: 0.01 });
      }
        
      case 'boolean':
        return scenario === 'demo' ? true : faker.datatype.boolean();
        
      case 'array':
        // Arrays should not reach here - they should be handled in generateMockData
        console.error('⚠️  Array type reached generatePrimitiveValue - this should not happen');
        return [];
        
      default:
        console.warn(`⚠️  Unknown primitive type: ${type}, defaulting to string`);
        return faker.lorem.words(2);
    }
  }
  
  // Data store helper methods for persistence
  storeRecord(entityType, record) {
    if (!this.dataStore.has(entityType)) {
      this.dataStore.set(entityType, new Map());
    }
    
    const entityStore = this.dataStore.get(entityType);
    const id = record.id || this.nextId++;
    const recordWithId = { ...record, id };
    entityStore.set(id, recordWithId);
    
    return recordWithId;
  }
  
  getRecord(entityType, id) {
    const entityStore = this.dataStore.get(entityType);
    if (!entityStore) return null;
    return entityStore.get(parseInt(id)) || entityStore.get(id) || null;
  }
  
  updateRecord(entityType, id, updates) {
    const entityStore = this.dataStore.get(entityType);
    if (!entityStore) return null;
    
    const existingRecord = entityStore.get(parseInt(id)) || entityStore.get(id);
    if (!existingRecord) return null;
    
    const updatedRecord = { ...existingRecord, ...updates, id: existingRecord.id };
    entityStore.set(existingRecord.id, updatedRecord);
    
    return updatedRecord;
  }
  
  deleteRecord(entityType, id) {
    const entityStore = this.dataStore.get(entityType);
    if (!entityStore) return false;
    
    const key = entityStore.has(parseInt(id)) ? parseInt(id) : id;
    const deleted = entityStore.delete(key);
    
    // If deletion was successful, mark as deleted for tombstone tracking
    if (deleted) {
      this.markAsDeleted(entityType, id);
    }
    
    return deleted;
  }
  
  getAllRecords(entityType) {
    const entityStore = this.dataStore.get(entityType);
    if (!entityStore) return [];
    return Array.from(entityStore.values());
  }
  
  shouldReturnApiResponse(endpoint) {
    // Check if the endpoint response schema is ApiResponse
    const responses = endpoint.responses || endpoint.spec?.responses || {};
    const successResponse = responses['200'] || responses['201'] || responses['202'];

    if (!successResponse) return false;

    // Get schema from either direct schema or content schema
    const schema = successResponse.schema || successResponse.content?.['application/json']?.schema;

    if (!schema) return false;

    // Check if it's a reference to ApiResponse schema
    if (schema.$ref && schema.$ref.includes('ApiResponse')) {
      return true;
    }

    return false;
  }

  extractEntityType(endpoint) {
    // Extract entity type from endpoint path for dataStore management
    const path = endpoint.path || endpoint.url || '';

    // Remove path parameters like {id}, {userId} etc
    const cleanPath = path.replace(/\{[^}]+\}/g, '');

    // Split path into segments and get the base resource name
    const segments = cleanPath.split('/').filter(segment => segment.length > 0);

    if (segments.length === 0) return 'item';

    // Take the first segment as the entity type (e.g., /users/123 -> users)
    const baseEntity = segments[0];

    // Check against configured entity patterns
    for (const [entityType, pattern] of Object.entries(this.entityPatterns)) {
      if (pattern.test(baseEntity)) {
        return entityType;
      }
    }

    // Return the base entity in singular form as fallback
    return baseEntity.endsWith('s') ? baseEntity.slice(0, -1) : baseEntity;
  }
  
  // Tombstone tracking methods for handling deleted records
  isRecordDeleted(entityType, id) {
    const deletedIds = this.deletedRecords.get(entityType);
    if (!deletedIds) return false;
    
    // Check both string and numeric versions of the ID
    return deletedIds.has(String(id)) || deletedIds.has(parseInt(id));
  }
  
  markAsDeleted(entityType, id) {
    if (!this.deletedRecords.has(entityType)) {
      this.deletedRecords.set(entityType, new Set());
    }
    
    const deletedIds = this.deletedRecords.get(entityType);
    // Store both string and numeric versions for consistent lookups
    deletedIds.add(String(id));
    if (!isNaN(parseInt(id))) {
      deletedIds.add(parseInt(id));
    }
  }
  
  /**
   * Starts the mock server on specified port
   * @param {number} port - Port number to start server on (default: 3001)
   * @returns {Promise<string>} Server URL when successfully started
   * @throws {Error} When server cannot start (e.g., port in use)
   * @example
   * const serverUrl = await mockServer.start(3001);
   * console.log(`Server running at ${serverUrl}`);
   */
  /**
   * Start the mock server on specified port
   * @param {number} [port=3001] - Port number to listen on
   * @returns {Promise<string>} Server URL when successfully started
   * @throws {Error} When server fails to start (e.g., port in use)
   * @example
   * const server = new MockServer(contract);
   * const url = await server.start(3001);
   * console.log(`Server running at ${url}`);
   */
  start(port = 3001) {
    return new Promise((resolve, reject) => {
      this.app.listen(port, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve(`http://localhost:${port}`);
        }
      });
    });
  }
}

export default MockServer;