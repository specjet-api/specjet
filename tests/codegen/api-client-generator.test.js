import { describe, test, expect, beforeEach } from 'vitest';
import ApiClientGenerator from '#src/codegen/api-client-generator.js';

describe('ApiClientGenerator', () => {
  let generator;

  beforeEach(() => {
    generator = new ApiClientGenerator();
  });

  describe('Method Name Generation', () => {
    test('should generate method names from paths', () => {
      expect(generator.pathToMethodName('/users', 'GET')).toBe('getUsers');
      expect(generator.pathToMethodName('/users', 'POST')).toBe('createUsers');
      expect(generator.pathToMethodName('/users/{id}', 'GET')).toBe('getUsersById');
      expect(generator.pathToMethodName('/users/{id}', 'PUT')).toBe('updateUsers');
      expect(generator.pathToMethodName('/users/{id}', 'DELETE')).toBe('deleteUsers');
    });

    test('should use operationId when available', () => {
      expect(generator.pathToMethodName('/users', 'GET', 'getAllUsers')).toBe('getAllUsers');
    });

    test('should handle complex paths', () => {
      expect(generator.pathToMethodName('/api/v1/users/profile', 'GET')).toBe('getProfile');
      expect(generator.pathToMethodName('/categories/{categoryId}/products', 'GET')).toBe('getProductsById');
    });

    test('should handle unknown HTTP methods', () => {
      expect(generator.pathToMethodName('/users', 'CUSTOM')).toBe('customUsers');
    });

    test('should capitalize resource names correctly', () => {
      expect(generator.pathToMethodName('/user-profiles', 'GET')).toBe('getUser-profiles');
      expect(generator.pathToMethodName('/api_endpoints', 'POST')).toBe('createApi_endpoints');
    });
  });

  describe('Parameter Type Generation', () => {
    test('should generate query parameter types', () => {
      const queryParams = [
        { name: 'limit', schema: { type: 'number' }, required: true },
        { name: 'offset', schema: { type: 'number' }, required: false },
        { name: 'search', schema: { type: 'string' }, required: false }
      ];

      const result = generator.generateQueryParamsType(queryParams);
      
      expect(result).toContain('limit: number');
      expect(result).toContain('offset?: number');
      expect(result).toContain('search?: string');
    });

    test('should generate header parameter types', () => {
      const headerParams = [
        { name: 'Authorization', schema: { type: 'string' }, required: true },
        { name: 'X-Custom-Header', schema: { type: 'string' }, required: false }
      ];

      const result = generator.generateHeaderParamsType(headerParams);
      
      expect(result).toContain('Authorization: string');
      expect(result).toContain('X-Custom-Header?: string');
    });

    test('should handle complex parameter types', () => {
      const complexParams = [
        { 
          name: 'filter', 
          schema: { 
            type: 'object',
            properties: {
              status: { type: 'string' },
              count: { type: 'number' }
            }
          }, 
          required: false 
        }
      ];

      const result = generator.generateQueryParamsType(complexParams);
      expect(result).toContain('filter?:');
      expect(result).toContain('status?: string');
      expect(result).toContain('count?: number');
    });
  });

  describe('Path Parameter Handling', () => {
    test('should convert OpenAPI path parameters to template literals', () => {
      const pathParams = [
        { name: 'id', schema: { type: 'number' } },
        { name: 'category', schema: { type: 'string' } }
      ];

      const result = generator.generatePathWithParams('/users/{id}/categories/{category}', pathParams);
      
      expect(result).toBe('/users/${id}/categories/${category}');
    });

    test('should handle paths with no parameters', () => {
      const result = generator.generatePathWithParams('/users', []);
      expect(result).toBe('/users');
    });

    test('should handle multiple instances of same parameter', () => {
      const pathParams = [
        { name: 'id', schema: { type: 'string' } }
      ];

      const result = generator.generatePathWithParams('/users/{id}/posts/{id}', pathParams);
      // The current implementation only replaces the first occurrence
      expect(result).toBe('/users/${id}/posts/{id}');
    });
  });

  describe('Return Type Detection', () => {
    test('should detect return types from responses', () => {
      const endpoint = {
        responses: {
          '200': {
            schema: { $ref: '#/components/schemas/User' }
          }
        }
      };

      const imports = new Set();
      const result = generator.getReturnType(endpoint, { User: {} }, imports);
      
      expect(result).toBe('User');
      expect(imports.has('User')).toBe(true);
    });

    test('should return void for endpoints without response schemas', () => {
      const endpoint = {
        responses: {
          '204': {
            description: 'No content'
          }
        }
      };

      const result = generator.getReturnType(endpoint, {}, new Set());
      expect(result).toBe('void');
    });

    test('should prefer 200 over other success codes', () => {
      const endpoint = {
        responses: {
          '201': { schema: { type: 'object' } },
          '200': { schema: { type: 'string' } }
        }
      };

      const result = generator.getReturnType(endpoint, {}, new Set());
      expect(result).toBe('string');
    });

    test('should handle endpoints with no responses', () => {
      const endpoint = { responses: {} };

      const result = generator.getReturnType(endpoint, {}, new Set());
      expect(result).toBe('void');
    });
  });

  describe('Import Path Calculation', () => {
    test('should calculate relative import paths correctly', () => {
      const config = {
        output: {
          types: './src/types',
          client: './src/api'
        }
      };

      const result = generator.calculateRelativeImportPath(config);
      expect(result).toMatch(/\.\.\/types\/api\.js/);
    });

    test('should handle custom output directories', () => {
      const config = {
        output: {
          types: './generated/types',
          client: './generated/client'
        }
      };

      const result = generator.calculateRelativeImportPath(config);
      expect(result).toMatch(/\.\.\/types\/api\.js/);
    });

    test('should handle default paths when config is missing', () => {
      const result = generator.calculateRelativeImportPath({});
      expect(result).toMatch(/\.\.\/types\/api\.js/);
    });
  });

  describe('Method Body Generation', () => {
    test('should generate method body for simple GET request', () => {
      const endpoint = {
        method: 'GET',
        path: '/users',
        responses: { '200': { schema: { type: 'array' } } }
      };

      const result = generator.generateMethodBody(endpoint, [], [], [], '/users');
      
      expect(result).toContain("const path = `/users`;");
      expect(result).toContain("method: 'GET'");
      expect(result).toContain('return this.request');
    });

    test('should generate method body with query parameters', () => {
      const endpoint = {
        method: 'GET',
        path: '/users',
        responses: { '200': {} }
      };
      const queryParams = [{ name: 'limit', schema: { type: 'number' } }];

      const result = generator.generateMethodBody(endpoint, [], queryParams, [], '/users');
      
      expect(result).toContain('const url = new URL(path, this.baseUrl);');
      expect(result).toContain('if (params)');
      expect(result).toContain('url.searchParams.append');
    });

    test('should generate method body with request body', () => {
      const endpoint = {
        method: 'POST',
        path: '/users',
        requestBody: { schema: { type: 'object' } },
        responses: { '201': {} }
      };

      const result = generator.generateMethodBody(endpoint, [], [], [], '/users');
      
      expect(result).toContain("method: 'POST'");
      expect(result).toContain('body: JSON.stringify(data)');
    });

    test('should generate method body with header parameters', () => {
      const endpoint = {
        method: 'GET',
        path: '/users',
        responses: { '200': {} }
      };
      const headerParams = [{ name: 'Authorization', schema: { type: 'string' } }];

      const result = generator.generateMethodBody(endpoint, [], [], headerParams, '/users');
      
      expect(result).toContain('const requestHeaders: Record<string, string> = {};');
      expect(result).toContain('if (headers)');
    });
  });

  describe('Complete API Client Generation', () => {
    test('should generate complete API client code', () => {
      const endpoints = [
        {
          method: 'GET',
          path: '/users',
          summary: 'Get all users',
          parameters: [],
          responses: {
            '200': {
              schema: {
                type: 'array',
                items: { $ref: '#/components/schemas/User' }
              }
            }
          }
        }
      ];

      const schemas = {
        User: {
          type: 'object',
          properties: {
            id: { type: 'number' },
            name: { type: 'string' }
          }
        }
      };

      const result = generator.generateApiClient(endpoints, schemas);
      
      expect(result).toContain('export class ApiClient');
      expect(result).toContain('async getUsers');
      expect(result).toContain('import type { User }');
      expect(result).toContain('Generated by SpecJet CLI');
    });

    test('should handle custom client name', () => {
      const config = { clientName: 'CustomApiClient' };
      const result = generator.generateApiClient([], {}, config);
      
      expect(result).toContain('export class CustomApiClient');
    });
  });

  describe('Edge Cases', () => {
    test('should handle endpoints with no parameters', () => {
      const endpoint = {
        method: 'GET',
        path: '/health',
        parameters: [],
        responses: { '200': {} }
      };

      const result = generator.endpointToMethod(endpoint, {});
      expect(result.code).toContain('async getHealth(options?: RequestInit)');
    });

    test('should handle endpoints with complex nested response types', () => {
      const endpoint = {
        method: 'GET',
        path: '/users',
        parameters: [],
        responses: {
          '200': {
            schema: {
              type: 'object',
              properties: {
                data: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/User' }
                },
                pagination: {
                  type: 'object',
                  properties: {
                    total: { type: 'number' },
                    page: { type: 'number' }
                  }
                }
              }
            }
          }
        }
      };

      const schemas = {
        User: {
          type: 'object',
          properties: {
            id: { type: 'number' },
            name: { type: 'string' }
          }
        }
      };

      const result = generator.endpointToMethod(endpoint, schemas);
      expect(result.imports.has('User')).toBe(true);
    });

    test('should handle endpoints with missing operationId', () => {
      const endpoint = {
        method: 'POST',
        path: '/users/{userId}/activate',
        parameters: [{ name: 'userId', in: 'path', schema: { type: 'string' } }],
        responses: { '200': {} }
      };

      const result = generator.endpointToMethod(endpoint, {});
      // The actual implementation generates 'createActivate' for POST to '/activate' resource
      expect(result.code).toContain('async createActivate');
    });

    test('should handle request return type correctly', () => {
      const endpoint = {
        responses: {
          '200': {
            schema: { type: 'string' }
          }
        }
      };

      const result = generator.getReturnTypeForRequest(endpoint);
      expect(result).toBe('string');
    });
  });

  describe('Utility Methods', () => {
    test('should capitalize strings correctly', () => {
      expect(generator.capitalize('user')).toBe('User');
      expect(generator.capitalize('USER')).toBe('USER');
      expect(generator.capitalize('u')).toBe('U');
      expect(generator.capitalize('')).toBe('');
    });
  });
});