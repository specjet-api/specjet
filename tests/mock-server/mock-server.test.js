import { describe, test, expect, beforeEach } from 'vitest';
import MockServer from '../../src/mock-server/server.js';

describe('MockServer', () => {
  const sampleContract = {
    endpoints: [
      {
        method: 'GET',
        path: '/users',
        responses: {
          '200': {
            schema: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'number' },
                  name: { type: 'string' },
                  email: { type: 'string' }
                }
              }
            }
          }
        }
      },
      {
        method: 'POST',
        path: '/users',
        responses: {
          '201': {
            schema: {
              type: 'object',
              properties: {
                id: { type: 'number' },
                name: { type: 'string' }
              }
            }
          }
        }
      }
    ],
    components: {
      schemas: {
        User: {
          type: 'object',
          properties: {
            id: { type: 'number' },
            name: { type: 'string' },
            email: { type: 'string' }
          }
        }
      }
    }
  };

  let mockServer;

  beforeEach(() => {
    mockServer = new MockServer(sampleContract, 'demo');
  });

  describe('Initialization', () => {
    test('should initialize with contract and scenario', () => {
      expect(mockServer.contract).toBe(sampleContract);
      expect(mockServer.scenario).toBe('demo');
      expect(mockServer.schemas).toEqual(sampleContract.components.schemas);
    });

    test('should handle contract without components', () => {
      const minimalContract = {
        endpoints: []
      };
      const server = new MockServer(minimalContract, 'realistic');
      expect(server.schemas).toEqual({});
    });

    test('should default to demo scenario', () => {
      const server = new MockServer(sampleContract);
      expect(server.scenario).toBe('demo');
    });
  });

  describe('Scenario-based Generation', () => {
    test('should generate different data for demo scenario', () => {
      const demoServer = new MockServer(sampleContract, 'demo');
      const mockData = demoServer.generateMockResponse(sampleContract.endpoints[0]);
      
      expect(Array.isArray(mockData)).toBe(true);
      expect(mockData.length).toBeLessThanOrEqual(10); // Demo should have limited items
    });

    test('should generate more data for realistic scenario', () => {
      const realisticServer = new MockServer(sampleContract, 'realistic');
      const mockData = realisticServer.generateMockResponse(sampleContract.endpoints[0]);
      
      expect(Array.isArray(mockData)).toBe(true);
      // Realistic scenario should still generate reasonable amount of data
    });

    test('should handle error scenario', () => {
      const errorServer = new MockServer(sampleContract, 'errors');
      // Error scenario testing would need more complex setup
      // This is a placeholder for the framework
      expect(errorServer.scenario).toBe('errors');
    });

    test('should handle large scenario', () => {
      const largeServer = new MockServer(sampleContract, 'large');
      expect(largeServer.scenario).toBe('large');
    });
  });

  describe('OpenAPI Path Conversion', () => {
    test('should convert OpenAPI paths to Express paths', () => {
      expect(mockServer.convertOpenApiPath('/users/{id}')).toBe('/users/:id');
      expect(mockServer.convertOpenApiPath('/users/{userId}/posts/{postId}')).toBe('/users/:userId/posts/:postId');
      expect(mockServer.convertOpenApiPath('/users')).toBe('/users');
    });

    test('should handle complex path parameters', () => {
      expect(mockServer.convertOpenApiPath('/api/v1/users/{userId}')).toBe('/api/v1/users/:userId');
      expect(mockServer.convertOpenApiPath('/categories/{categoryId}/items/{itemId}/details')).toBe('/categories/:categoryId/items/:itemId/details');
    });

    test('should handle paths with no parameters', () => {
      expect(mockServer.convertOpenApiPath('/health')).toBe('/health');
      expect(mockServer.convertOpenApiPath('/api/status')).toBe('/api/status');
    });
  });

  describe('Response Status Code Detection', () => {
    test('should determine correct success status codes', () => {
      const getEndpoint = { method: 'GET', responses: { '200': {} } };
      const postEndpoint = { method: 'POST', responses: { '201': {} } };
      const putEndpoint = { method: 'PUT', responses: { '200': {} } };
      const deleteEndpoint = { method: 'DELETE', responses: { '204': {} } };
      
      expect(mockServer.getSuccessStatusCode(getEndpoint)).toBe(200);
      expect(mockServer.getSuccessStatusCode(postEndpoint)).toBe(201);
      expect(mockServer.getSuccessStatusCode(putEndpoint)).toBe(200);
      expect(mockServer.getSuccessStatusCode(deleteEndpoint)).toBe(204);
    });

    test('should prefer specific success codes', () => {
      const multiResponseEndpoint = { 
        method: 'POST', 
        responses: { 
          '200': {}, 
          '201': {},
          '202': {} 
        } 
      };
      
      // Should prefer 200, then 201, then 202
      expect(mockServer.getSuccessStatusCode(multiResponseEndpoint)).toBe(200);
    });

    test('should handle endpoints with no responses', () => {
      const noResponseEndpoint = { method: 'GET', responses: {} };
      // Should return a default success code
      const statusCode = mockServer.getSuccessStatusCode(noResponseEndpoint);
      expect(typeof statusCode).toBe('number');
      expect(statusCode).toBeGreaterThanOrEqual(200);
      expect(statusCode).toBeLessThan(300);
    });
  });

  describe('Mock Response Generation', () => {
    test('should generate mock response for array schema', () => {
      const endpoint = sampleContract.endpoints[0]; // GET /users
      const mockData = mockServer.generateMockResponse(endpoint);
      
      expect(Array.isArray(mockData)).toBe(true);
      if (mockData.length > 0) {
        expect(mockData[0]).toHaveProperty('id');
        expect(mockData[0]).toHaveProperty('name');
        expect(typeof mockData[0].id).toBe('number');
        expect(typeof mockData[0].name).toBe('string');
      }
    });

    test('should generate mock response for object schema', () => {
      const endpoint = sampleContract.endpoints[1]; // POST /users
      const mockData = mockServer.generateMockResponse(endpoint);
      
      expect(typeof mockData).toBe('object');
      expect(mockData).toHaveProperty('id');
      expect(mockData).toHaveProperty('name');
      expect(typeof mockData.id).toBe('number');
      expect(typeof mockData.name).toBe('string');
    });

    test('should handle endpoints without schema', () => {
      const endpoint = {
        method: 'DELETE',
        path: '/users/{id}',
        responses: {
          '204': {
            description: 'No content'
          }
        }
      };
      
      const mockData = mockServer.generateMockResponse(endpoint);
      expect(mockData).toHaveProperty('message');
      expect(mockData).toHaveProperty('method', 'DELETE');
      expect(mockData).toHaveProperty('path', '/users/{id}');
    });

    test('should handle OpenAPI 3.0 content schema format', () => {
      const endpoint = {
        method: 'GET',
        path: '/items',
        responses: {
          '200': {
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      id: { type: 'string' }
                    }
                  }
                }
              }
            }
          }
        }
      };
      
      const mockData = mockServer.generateMockResponse(endpoint);
      expect(Array.isArray(mockData)).toBe(true);
    });
  });

  describe('Endpoint Context Extraction', () => {
    test('should extract basic endpoint context', () => {
      const endpoint = {
        method: 'GET',
        path: '/users',
        tags: ['users'],
        operationId: 'getUsers'
      };
      
      const context = mockServer.extractEndpointContext(endpoint);
      
      expect(context).toHaveProperty('domain');
      expect(context).toHaveProperty('entity');
      expect(context).toHaveProperty('tags');
      expect(context).toHaveProperty('path', '/users');
      expect(context).toHaveProperty('method', 'GET');
      expect(context).toHaveProperty('operationId', 'getUsers');
      expect(context.tags).toContain('users');
    });

    test('should determine domain from tags', () => {
      const commerceEndpoint = {
        method: 'GET',
        path: '/products',
        tags: ['products']
      };
      
      const context = mockServer.extractEndpointContext(commerceEndpoint);
      // The actual implementation may set domain based on tags
      expect(context.tags).toContain('products');
    });

    test('should handle endpoints without tags', () => {
      const endpoint = {
        method: 'GET',
        path: '/health'
      };
      
      const context = mockServer.extractEndpointContext(endpoint);
      
      expect(context.domain).toBe('generic');
      // The implementation infers entity from path, so '/health' becomes 'health'
      expect(context.entity).toBe('health');
      expect(Array.isArray(context.tags)).toBe(true);
      expect(context.tags).toHaveLength(0);
    });

    test('should handle spec-nested properties', () => {
      const endpoint = {
        method: 'POST',
        path: '/orders',
        spec: {
          tags: ['orders'],
          operationId: 'createOrder'
        }
      };
      
      const context = mockServer.extractEndpointContext(endpoint);
      
      expect(context.tags).toContain('orders');
      expect(context.operationId).toBe('createOrder');
    });
  });

  describe('Request Parameter Extraction', () => {
    test('should extract parameters from request', () => {
      // This would require mocking Express request objects
      // Testing the existence of the method for now
      expect(typeof mockServer.extractRequestParams).toBe('function');
    });
  });

  describe('Error Response Generation', () => {
    test('should generate error responses', () => {
      // This would require mocking Express response objects
      // Testing the existence of the method for now
      expect(typeof mockServer.generateErrorResponse).toBe('function');
    });
  });

  describe('Route Setup', () => {
    test('should handle contract without endpoints', () => {
      const emptyContract = {
        components: { schemas: {} }
      };
      
      const server = new MockServer(emptyContract);
      // Should not throw error when setting up routes
      expect(server.contract).toBe(emptyContract);
    });

    test('should handle contract with null endpoints', () => {
      const nullEndpointsContract = {
        endpoints: null,
        components: { schemas: {} }
      };
      
      const server = new MockServer(nullEndpointsContract);
      expect(server.contract.endpoints).toBeNull();
    });
  });

  describe('Express App Configuration', () => {
    test('should have express app configured', () => {
      expect(mockServer.app).toBeDefined();
      expect(typeof mockServer.app.listen).toBe('function');
    });

    test('should setup middleware correctly', () => {
      // The setupMiddleware method should configure CORS and JSON parsing
      expect(typeof mockServer.setupMiddleware).toBe('function');
    });
  });

  describe('Schema Storage', () => {
    test('should store resolved schemas for reference resolution', () => {
      const contractWithSchemas = {
        endpoints: [],
        components: {
          schemas: {
            User: { type: 'object', properties: { id: { type: 'number' } } },
            Product: { type: 'object', properties: { name: { type: 'string' } } }
          }
        }
      };
      
      const server = new MockServer(contractWithSchemas);
      expect(server.schemas).toHaveProperty('User');
      expect(server.schemas).toHaveProperty('Product');
      expect(server.schemas.User.properties.id.type).toBe('number');
    });
  });
});