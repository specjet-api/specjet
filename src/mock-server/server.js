import express from 'express';
import cors from 'cors';
import { faker } from '@faker-js/faker';

class MockServer {
  constructor(contract, scenario = 'demo') {
    this.app = express();
    this.contract = contract;
    this.scenario = scenario;
    
    this.setupMiddleware();
    this.setupRoutes();
  }
  
  setupMiddleware() {
    this.app.use(cors());
    this.app.use(express.json());
  }
  
  setupRoutes() {
    if (!this.contract?.endpoints) return;
    
    for (const endpoint of this.contract.endpoints) {
      this.addRoute(endpoint);
    }
  }
  
  
  addRoute(endpoint) {
    const method = endpoint.method.toLowerCase();
    const path = this.convertOpenApiPath(endpoint.path);
    
    this.app[method](path, (req, res) => {
      try {
        // Handle error scenarios
        if (this.scenario === 'errors' && Math.random() < 0.3) {
          return this.generateErrorResponse(res, endpoint);
        }
        
        // Validate and extract parameters
        const params = this.extractRequestParams(req, endpoint);
        const mockData = this.generateMockResponse(endpoint, params);
        
        // Determine response status
        const statusCode = this.getSuccessStatusCode(endpoint);
        res.status(statusCode).json(mockData);
      } catch (error) {
        res.status(500).json({ 
          error: 'Mock generation failed', 
          message: error.message 
        });
      }
    });
  }
  
  convertOpenApiPath(openApiPath) {
    // Convert /users/{id} to /users/:id
    return openApiPath.replace(/{([^}]+)}/g, ':$1');
  }
  
  generateMockResponse(endpoint, params = {}) {
    const responses = endpoint.responses || endpoint.spec?.responses || {};
    const successResponse = responses['200'] || responses['201'] || responses['202'] || Object.values(responses)[0];
    
    if (!successResponse?.schema && !successResponse?.content?.['application/json']?.schema) {
      return { message: 'Mock response', method: endpoint.method, path: endpoint.path };
    }
    
    // Get schema from either direct schema or content schema
    const schema = successResponse.schema || successResponse.content?.['application/json']?.schema;
    return this.generateMockData(schema, this.scenario, params);
  }

  generateErrorResponse(res, _endpoint) {
    const errorResponses = Object.keys(_endpoint.responses || _endpoint.spec?.responses || {})
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
    const errorSpec = (_endpoint.responses || _endpoint.spec.responses)[errorCode];
    
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
    
    // Add correlation between path params and generated IDs
    if (params.path.id) {
      params._correlationId = params.path.id;
    }
    
    return params;
  }
  
  generateMockData(schema, scenario, params = {}) {
    // Handle schema references (simplified)
    if (schema.$ref) {
      // For now, generate basic object for refs
      return { id: faker.string.uuid(), name: faker.lorem.words(2) };
    }
    
    // Handle oneOf - pick first option
    if (schema.oneOf) {
      return this.generateMockData(schema.oneOf[0], scenario, params);
    }
    
    // Handle allOf - merge all schemas (simplified)
    if (schema.allOf) {
      const merged = {};
      for (const subSchema of schema.allOf) {
        const subData = this.generateMockData(subSchema, scenario, params);
        Object.assign(merged, subData);
      }
      return merged;
    }
    
    // Handle enums
    if (schema.enum) {
      return schema.enum[Math.floor(Math.random() * schema.enum.length)];
    }
    
    if (schema.type === 'array') {
      const itemCount = this.getItemCount(scenario);
      const items = [];
      for (let i = 0; i < itemCount; i++) {
        items.push(this.generateMockData(schema.items, scenario, params));
      }
      return items;
    }
    
    if (schema.type === 'object' || schema.properties) {
      const obj = {};
      const properties = schema.properties || {};
      const required = schema.required || [];
      
      for (const [propName, propSchema] of Object.entries(properties)) {
        // Use correlation ID for id fields if available
        if (propName === 'id' && params._correlationId) {
          obj[propName] = params._correlationId;
        } else {
          obj[propName] = this.generatePropertyValue(propName, propSchema, scenario);
        }
      }
      
      // Add required properties that might be missing
      for (const reqProp of required) {
        if (!Object.prototype.hasOwnProperty.call(obj, reqProp)) {
          obj[reqProp] = this.generatePropertyValue(reqProp, { type: 'string' }, scenario);
        }
      }
      
      return obj;
    }
    
    return this.generatePrimitiveValue(schema, scenario);
  }
  
  getItemCount(scenario) {
    switch (scenario) {
      case 'demo':
        return 3;
      case 'realistic':
        return faker.number.int({ min: 5, max: 15 });
      case 'large':
        return faker.number.int({ min: 50, max: 100 });
      case 'errors':
        return faker.number.int({ min: 2, max: 8 });
      default:
        return 3;
    }
  }
  
  generatePropertyValue(propName, schema, scenario = 'demo') {
    // Handle schema references in properties
    if (schema.$ref) {
      return this.generateMockData(schema, scenario);
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
    
    // ID patterns
    if (schema.format === 'uuid' || propName === 'id' || propLower.endsWith('id')) {
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
        
      default:
        return null;
    }
  }
  
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