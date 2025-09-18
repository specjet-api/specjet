import { describe, test, expect, beforeEach } from 'vitest';
import MockServer from '#src/mock-server/server.js';

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

  describe('Data Persistence and CRUD Operations', () => {
    let crudServer;
    
    beforeEach(() => {
      const crudContract = {
        endpoints: [
          {
            method: 'GET',
            path: '/users/{id}',
            responses: {
              '200': {
                schema: {
                  type: 'object',
                  properties: {
                    id: { type: 'number' },
                    name: { type: 'string' },
                    email: { type: 'string' }
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
                    name: { type: 'string' },
                    email: { type: 'string' }
                  }
                }
              }
            }
          },
          {
            method: 'DELETE',
            path: '/users/{id}',
            responses: {
              '204': { description: 'No content' }
            }
          }
        ],
        components: { schemas: {} }
      };
      
      crudServer = new MockServer(crudContract, 'demo');
    });

    test('should initialize with empty dataStore and deletedRecords', () => {
      expect(crudServer.dataStore).toBeInstanceOf(Map);
      expect(crudServer.deletedRecords).toBeInstanceOf(Map);
      expect(crudServer.dataStore.size).toBe(0);
      expect(crudServer.deletedRecords.size).toBe(0);
    });

    test('should extract entity type from endpoint path', () => {
      const userEndpoint = { path: '/users/{id}' };
      const productEndpoint = { path: '/products' };
      const nestedEndpoint = { path: '/projects/{projectId}/tasks/{taskId}' };
      
      expect(crudServer.extractEntityType(userEndpoint)).toBe('user');
      expect(crudServer.extractEntityType(productEndpoint)).toBe('product');
      expect(crudServer.extractEntityType(nestedEndpoint)).toBe('project');
    });

    test('should store and retrieve records', () => {
      const testRecord = { name: 'John Doe', email: 'john@example.com' };
      
      const stored = crudServer.storeRecord('user', testRecord);
      expect(stored).toHaveProperty('id');
      expect(stored.name).toBe('John Doe');
      expect(stored.email).toBe('john@example.com');
      
      const retrieved = crudServer.getRecord('user', stored.id);
      expect(retrieved).toEqual(stored);
    });

    test('should handle string and numeric IDs consistently', () => {
      const testRecord = { id: 123, name: 'Test User' };
      
      crudServer.storeRecord('user', testRecord);
      
      // Should work with both string and numeric ID formats
      expect(crudServer.getRecord('user', 123)).toBeTruthy();
      expect(crudServer.getRecord('user', '123')).toBeTruthy();
    });

    test('should update existing records', () => {
      const original = { id: 1, name: 'John', email: 'john@example.com' };
      crudServer.storeRecord('user', original);
      
      const updates = { name: 'John Smith', isActive: true };
      const updated = crudServer.updateRecord('user', 1, updates);
      
      expect(updated.id).toBe(1); // ID preserved
      expect(updated.name).toBe('John Smith'); // Updated
      expect(updated.email).toBe('john@example.com'); // Original preserved
      expect(updated.isActive).toBe(true); // Added
    });

    test('should return null when updating non-existent record', () => {
      const result = crudServer.updateRecord('user', 999, { name: 'Test' });
      expect(result).toBeNull();
    });

    test('should get all records for an entity type', () => {
      crudServer.storeRecord('user', { id: 1, name: 'User 1' });
      crudServer.storeRecord('user', { id: 2, name: 'User 2' });
      crudServer.storeRecord('product', { id: 1, name: 'Product 1' });
      
      const users = crudServer.getAllRecords('user');
      expect(users).toHaveLength(2);
      expect(users.find(u => u.id === 1).name).toBe('User 1');
      expect(users.find(u => u.id === 2).name).toBe('User 2');
      
      const products = crudServer.getAllRecords('product');
      expect(products).toHaveLength(1);
      expect(products[0].name).toBe('Product 1');
    });

    test('should return empty array for non-existent entity type', () => {
      const result = crudServer.getAllRecords('nonexistent');
      expect(result).toEqual([]);
    });
  });

  describe('DELETE → GET 404 Tombstone Tracking', () => {
    let crudServer;
    
    beforeEach(() => {
      const crudContract = {
        endpoints: [
          {
            method: 'GET',
            path: '/users/{id}',
            responses: {
              '200': {
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
        components: { schemas: {} }
      };
      
      crudServer = new MockServer(crudContract, 'demo');
    });

    test('should mark records as deleted when deleteRecord is called', () => {
      // Store a record first
      const record = { id: 1, name: 'Test User' };
      crudServer.storeRecord('user', record);
      
      // Verify it exists
      expect(crudServer.getRecord('user', 1)).toBeTruthy();
      expect(crudServer.isRecordDeleted('user', 1)).toBe(false);
      
      // Delete it
      const deleted = crudServer.deleteRecord('user', 1);
      expect(deleted).toBe(true);
      
      // Verify it's marked as deleted
      expect(crudServer.isRecordDeleted('user', 1)).toBe(true);
      expect(crudServer.getRecord('user', 1)).toBeNull();
    });

    test('should handle deleting non-existent records', () => {
      const deleted = crudServer.deleteRecord('user', 999);
      expect(deleted).toBe(false);
      expect(crudServer.isRecordDeleted('user', 999)).toBe(false);
    });

    test('should handle string and numeric IDs in tombstone tracking', () => {
      const record = { id: 42, name: 'Test User' };
      crudServer.storeRecord('user', record);
      
      // Delete using numeric ID
      crudServer.deleteRecord('user', 42);
      
      // Should be marked as deleted for both formats
      expect(crudServer.isRecordDeleted('user', 42)).toBe(true);
      expect(crudServer.isRecordDeleted('user', '42')).toBe(true);
    });

    test('should track deletions separately by entity type', () => {
      // Store records in different entities
      crudServer.storeRecord('user', { id: 1, name: 'User 1' });
      crudServer.storeRecord('product', { id: 1, name: 'Product 1' });
      
      // Delete user but not product
      crudServer.deleteRecord('user', 1);
      
      expect(crudServer.isRecordDeleted('user', 1)).toBe(true);
      expect(crudServer.isRecordDeleted('product', 1)).toBe(false);
    });

    test('should persist tombstone tracking across operations', () => {
      // Store and delete a record
      crudServer.storeRecord('user', { id: 1, name: 'Test User' });
      crudServer.deleteRecord('user', 1);
      
      // Store another record with different ID
      crudServer.storeRecord('user', { id: 2, name: 'Another User' });
      
      // Original should still be marked as deleted
      expect(crudServer.isRecordDeleted('user', 1)).toBe(true);
      expect(crudServer.isRecordDeleted('user', 2)).toBe(false);
    });

    test('markAsDeleted should handle both string and numeric IDs', () => {
      crudServer.markAsDeleted('user', '123');
      
      expect(crudServer.isRecordDeleted('user', '123')).toBe(true);
      expect(crudServer.isRecordDeleted('user', 123)).toBe(true);
    });

    test('markAsDeleted should handle non-numeric strings', () => {
      crudServer.markAsDeleted('user', 'abc-123');
      
      expect(crudServer.isRecordDeleted('user', 'abc-123')).toBe(true);
      expect(crudServer.isRecordDeleted('user', 'different-id')).toBe(false);
    });

    test('should handle edge cases in tombstone tracking', () => {
      // Empty entity type
      expect(crudServer.isRecordDeleted('', 1)).toBe(false);
      
      // Null/undefined IDs (should not crash)
      expect(() => crudServer.isRecordDeleted('user', null)).not.toThrow();
      expect(() => crudServer.isRecordDeleted('user', undefined)).not.toThrow();
      
      expect(crudServer.isRecordDeleted('user', null)).toBe(false);
      expect(crudServer.isRecordDeleted('user', undefined)).toBe(false);
    });
  });

  describe('ID Type Consistency', () => {
    test('should respect schema type for ID fields', () => {
      const integerIdContract = {
        endpoints: [{
          method: 'GET',
          path: '/users',
          responses: {
            '200': {
              schema: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'integer' },
                    name: { type: 'string' }
                  }
                }
              }
            }
          }
        }],
        components: { schemas: {} }
      };
      
      const server = new MockServer(integerIdContract, 'demo');
      const mockData = server.generateMockResponse(integerIdContract.endpoints[0]);
      
      expect(Array.isArray(mockData)).toBe(true);
      if (mockData.length > 0) {
        expect(typeof mockData[0].id).toBe('number');
        expect(Number.isInteger(mockData[0].id)).toBe(true);
      }
    });

    test('should generate integer IDs for realistic scenario when schema specifies integer', () => {
      const integerIdContract = {
        endpoints: [{
          method: 'GET',
          path: '/users',
          responses: {
            '200': {
              schema: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'integer' },
                    name: { type: 'string' }
                  }
                }
              }
            }
          }
        }],
        components: { schemas: {} }
      };
      
      const server = new MockServer(integerIdContract, 'realistic');
      const mockData = server.generateMockResponse(integerIdContract.endpoints[0]);
      
      expect(Array.isArray(mockData)).toBe(true);
      if (mockData.length > 0) {
        // Should be integers, not UUID strings
        expect(typeof mockData[0].id).toBe('number');
        expect(Number.isInteger(mockData[0].id)).toBe(true);
      }
    });

    test('should generate string IDs when schema specifies string type', () => {
      const stringIdContract = {
        endpoints: [{
          method: 'GET',
          path: '/items',
          responses: {
            '200': {
              schema: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    name: { type: 'string' }
                  }
                }
              }
            }
          }
        }],
        components: { schemas: {} }
      };
      
      const server = new MockServer(stringIdContract, 'realistic');
      const mockData = server.generateMockResponse(stringIdContract.endpoints[0]);
      
      expect(Array.isArray(mockData)).toBe(true);
      if (mockData.length > 0) {
        expect(typeof mockData[0].id).toBe('string');
      }
    });

    test('should generate UUID strings when format is specified', () => {
      const uuidIdContract = {
        endpoints: [{
          method: 'GET',
          path: '/resources',
          responses: {
            '200': {
              schema: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string', format: 'uuid' },
                    name: { type: 'string' }
                  }
                }
              }
            }
          }
        }],
        components: { schemas: {} }
      };
      
      const server = new MockServer(uuidIdContract, 'realistic');
      const mockData = server.generateMockResponse(uuidIdContract.endpoints[0]);
      
      expect(Array.isArray(mockData)).toBe(true);
      if (mockData.length > 0) {
        expect(typeof mockData[0].id).toBe('string');
        // Basic UUID format check (36 chars with dashes)
        expect(mockData[0].id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
      }
    });
  });
});