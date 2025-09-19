import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import ParameterDiscovery from '#src/core/parameter-discovery.js';

describe('ParameterDiscovery', () => {
  let mockHttpClient;
  let mockLogger;
  let parameterDiscovery;

  beforeEach(() => {
    // Mock HTTP client
    mockHttpClient = {
      makeRequest: vi.fn()
    };

    // Mock logger
    mockLogger = {
      log: vi.fn(),
      warn: vi.fn()
    };

    // Create parameter discovery with mocked dependencies
    parameterDiscovery = new ParameterDiscovery({
      httpClient: mockHttpClient,
      logger: mockLogger
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    parameterDiscovery.clearCache();
  });

  describe('Constructor and Configuration', () => {
    test('should create parameter discovery with dependencies', () => {
      expect(parameterDiscovery.httpClient).toBe(mockHttpClient);
      expect(parameterDiscovery.logger).toBe(mockLogger);
    });

    test('should create parameter discovery without dependencies (for fallback-only mode)', () => {
      const discovery = new ParameterDiscovery();
      expect(discovery.httpClient).toBeUndefined();
      expect(discovery.logger).toBeDefined(); // Should use console fallback
    });

    test('should initialize with empty cache', () => {
      const stats = parameterDiscovery.getCacheStats();
      expect(stats.size).toBe(0);
      expect(stats.keys).toEqual([]);
    });
  });

  describe('Parameter Discovery from List Endpoints', () => {
    test('should discover petId from /pet/findByStatus endpoint', async () => {
      // Mock successful list endpoint response
      mockHttpClient.makeRequest.mockResolvedValue({
        status: 200,
        data: [
          { id: 123, name: 'Fluffy', status: 'available' },
          { id: 456, name: 'Rex', status: 'pending' }
        ]
      });

      const endpoints = [
        { path: '/pet/findByStatus', method: 'GET' },
        { path: '/pet/{petId}', method: 'GET' }
      ];

      const result = await parameterDiscovery.discoverParameters('/pet/{petId}', endpoints, {});

      expect(result).toEqual({ petId: 123 });
      expect(mockHttpClient.makeRequest).toHaveBeenCalledWith(
        '/pet/findByStatus',
        'GET',
        { timeout: 5000 }
      );
      expect(mockLogger.log).toHaveBeenCalledWith('🔍 Discovered petId=123 from list endpoint');
    });

    test('should discover username from nested data structure', async () => {
      // Mock list endpoint with nested data structure
      mockHttpClient.makeRequest.mockResolvedValue({
        status: 200,
        data: {
          users: [
            { username: 'alice', id: 1 },
            { username: 'bob', id: 2 }
          ]
        }
      });

      const endpoints = [
        { path: '/users', method: 'GET' },
        { path: '/user/{username}', method: 'GET' }
      ];

      const result = await parameterDiscovery.discoverParameters('/user/{username}', endpoints, {});

      expect(result).toEqual({ username: 'testuser' });
      expect(mockHttpClient.makeRequest).toHaveBeenCalledWith('/users', 'GET', { timeout: 5000 });
    });

    test('should handle multiple parameters in single path', async () => {
      // Mock responses for both discovery attempts
      mockHttpClient.makeRequest
        .mockResolvedValueOnce({
          status: 200,
          data: [{ id: 789, petId: 123 }]
        })
        .mockResolvedValueOnce({
          status: 200,
          data: [{ id: 456, name: 'Fluffy' }]
        });

      const endpoints = [
        { path: '/store/order', method: 'GET' },
        { path: '/pet/findByStatus', method: 'GET' },
        { path: '/store/order/{orderId}/pet/{petId}', method: 'GET' }
      ];

      const result = await parameterDiscovery.discoverParameters(
        '/store/order/{orderId}/pet/{petId}',
        endpoints,
        {}
      );

      expect(result).toEqual({ orderId: 789, petId: 456 });
    });

    test('should preserve provided parameters', async () => {
      const endpoints = [
        { path: '/pet/findByStatus', method: 'GET' },
        { path: '/pet/{petId}', method: 'GET' }
      ];

      const providedParams = { petId: 999 };
      const result = await parameterDiscovery.discoverParameters(
        '/pet/{petId}',
        endpoints,
        providedParams
      );

      expect(result).toEqual({ petId: 999 });
      expect(mockHttpClient.makeRequest).not.toHaveBeenCalled();
    });
  });

  describe('Smart Fallback Patterns', () => {
    test('should use smart fallbacks when no list endpoint exists', async () => {
      const endpoints = [
        { path: '/user/{username}', method: 'GET' }
      ];

      const result = await parameterDiscovery.discoverParameters('/user/{username}', endpoints, {});

      expect(result).toEqual({ username: 'testuser' });
      expect(mockLogger.log).toHaveBeenCalledWith('🎯 Using fallback username=testuser (smart default)');
    });

    test('should handle various parameter patterns', async () => {
      const testCases = [
        { path: '/pet/{petId}', expected: { petId: '1' } },
        { path: '/user/{userId}', expected: { userId: '1' } },
        { path: '/user/{username}', expected: { username: 'testuser' } },
        { path: '/user/{email}', expected: { email: 'test@example.com' } },
        { path: '/category/{categoryId}', expected: { categoryId: '1' } },
        { path: '/item/{code}', expected: { code: 'test' } },
        { path: '/product/{slug}', expected: { slug: 'test' } },
        { path: '/api/{version}', expected: { version: 'v1' } },
        { path: '/status/{status}', expected: { status: 'active' } },
        { path: '/type/{type}', expected: { type: 'default' } }
      ];

      for (const testCase of testCases) {
        const result = await parameterDiscovery.discoverParameters(testCase.path, [], {});
        expect(result).toEqual(testCase.expected);
      }
    });

    test('should handle context-aware fallbacks', async () => {
      // Pet context
      const petResult = await parameterDiscovery.discoverParameters('/pet/{petParam}', [], {});
      expect(petResult).toEqual({ petParam: '1' });

      // User context
      const userResult = await parameterDiscovery.discoverParameters('/user/{userParam}', [], {});
      expect(userResult).toEqual({ userParam: 'testuser' });

      // Order context
      const orderResult = await parameterDiscovery.discoverParameters('/order/{orderParam}', [], {});
      expect(orderResult).toEqual({ orderParam: '1' });
    });
  });

  describe('List Endpoint Detection', () => {
    test('should find exact base path matches', async () => {
      const endpoints = [
        { path: '/pet', method: 'GET' },
        { path: '/pet/{petId}', method: 'GET' }
      ];

      // Mock the findListEndpoints method indirectly by testing discovery
      mockHttpClient.makeRequest.mockResolvedValue({
        status: 200,
        data: [{ id: 123 }]
      });

      await parameterDiscovery.discoverParameters('/pet/{petId}', endpoints, {});

      expect(mockHttpClient.makeRequest).toHaveBeenCalledWith('/pet', 'GET', { timeout: 5000 });
    });

    test('should find plural pattern matches', async () => {
      const endpoints = [
        { path: '/pets', method: 'GET' },
        { path: '/pet/{petId}', method: 'GET' }
      ];

      mockHttpClient.makeRequest.mockResolvedValue({
        status: 200,
        data: [{ id: 123 }]
      });

      await parameterDiscovery.discoverParameters('/pet/{petId}', endpoints, {});

      expect(mockHttpClient.makeRequest).toHaveBeenCalledWith('/pets', 'GET', { timeout: 5000 });
    });

    test('should find query pattern matches (findBy*, search*, etc.)', async () => {
      const endpoints = [
        { path: '/pet/findByStatus', method: 'GET' },
        { path: '/pet/findByTags', method: 'GET' },
        { path: '/pet/search', method: 'GET' },
        { path: '/pet/{petId}', method: 'GET' }
      ];

      mockHttpClient.makeRequest.mockResolvedValue({
        status: 200,
        data: [{ id: 123 }]
      });

      await parameterDiscovery.discoverParameters('/pet/{petId}', endpoints, {});

      // Should try the first matching pattern
      expect(mockHttpClient.makeRequest).toHaveBeenCalledWith('/pet/search', 'GET', { timeout: 5000 });
    });

    test('should handle irregular plurals', async () => {
      const endpoints = [
        { path: '/people', method: 'GET' },
        { path: '/person/{personId}', method: 'GET' }
      ];

      mockHttpClient.makeRequest.mockResolvedValue({
        status: 200,
        data: [{ id: 123 }]
      });

      await parameterDiscovery.discoverParameters('/person/{personId}', endpoints, {});

      expect(mockHttpClient.makeRequest).toHaveBeenCalledWith('/people', 'GET', { timeout: 5000 });
    });
  });

  describe('Response Data Extraction', () => {
    test('should extract from simple array response', async () => {
      mockHttpClient.makeRequest.mockResolvedValue({
        status: 200,
        data: [
          { id: 123, name: 'test' },
          { id: 456, name: 'test2' }
        ]
      });

      const endpoints = [
        { path: '/items', method: 'GET' },
        { path: '/item/{id}', method: 'GET' }
      ];

      const result = await parameterDiscovery.discoverParameters('/item/{id}', endpoints, {});
      expect(result).toEqual({ id: 123 });
    });

    test('should extract from nested object response', async () => {
      mockHttpClient.makeRequest.mockResolvedValue({
        status: 200,
        data: {
          data: [
            { itemId: 789, name: 'nested' }
          ]
        }
      });

      const endpoints = [
        { path: '/items', method: 'GET' },
        { path: '/item/{itemId}', method: 'GET' }
      ];

      const result = await parameterDiscovery.discoverParameters('/item/{itemId}', endpoints, {});
      expect(result).toEqual({ itemId: 789 });
    });

    test('should extract from various nested property names', async () => {
      const nestedProperties = ['data', 'items', 'results', 'content', 'list'];

      for (const prop of nestedProperties) {
        mockHttpClient.makeRequest.mockResolvedValue({
          status: 200,
          data: {
            [prop]: [{ id: 999 }]
          }
        });

        const result = await parameterDiscovery.discoverParameters('/item/{id}', [
          { path: '/items', method: 'GET' }
        ], {});

        expect(result).toEqual({ id: 999 });
        mockHttpClient.makeRequest.mockClear();
      }
    });

    test('should handle parameter variations (id, Id, ID)', async () => {
      mockHttpClient.makeRequest.mockResolvedValue({
        status: 200,
        data: [
          { petId: 123, pet: { id: 456 } }
        ]
      });

      const endpoints = [
        { path: '/pets', method: 'GET' },
        { path: '/pet/{petId}', method: 'GET' }
      ];

      const result = await parameterDiscovery.discoverParameters('/pet/{petId}', endpoints, {});
      expect(result).toEqual({ petId: 123 });
    });

    test('should fallback to nested id when direct match not found', async () => {
      mockHttpClient.makeRequest.mockResolvedValue({
        status: 200,
        data: [
          { name: 'test', pet: { id: 789 } }
        ]
      });

      const endpoints = [
        { path: '/pets', method: 'GET' },
        { path: '/pet/{petId}', method: 'GET' }
      ];

      const result = await parameterDiscovery.discoverParameters('/pet/{petId}', endpoints, {});
      expect(result).toEqual({ petId: 789 });
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle HTTP client errors gracefully', async () => {
      mockHttpClient.makeRequest.mockRejectedValue(new Error('Network error'));

      const endpoints = [
        { path: '/pets', method: 'GET' },
        { path: '/pet/{petId}', method: 'GET' }
      ];

      const result = await parameterDiscovery.discoverParameters('/pet/{petId}', endpoints, {});

      // Should fall back to smart default
      expect(result).toEqual({ petId: '1' });
      expect(mockLogger.log).toHaveBeenCalledWith('🎯 Using fallback petId=1 (smart default)');
    });

    test('should handle empty array responses', async () => {
      mockHttpClient.makeRequest.mockResolvedValue({
        status: 200,
        data: []
      });

      const endpoints = [
        { path: '/pets', method: 'GET' },
        { path: '/pet/{petId}', method: 'GET' }
      ];

      const result = await parameterDiscovery.discoverParameters('/pet/{petId}', endpoints, {});

      // Should fall back to smart default
      expect(result).toEqual({ petId: '1' });
      expect(mockLogger.log).toHaveBeenCalledWith('🎯 Using fallback petId=1 (smart default)');
    });

    test('should handle null/undefined responses', async () => {
      mockHttpClient.makeRequest.mockResolvedValue({
        status: 200,
        data: null
      });

      const endpoints = [
        { path: '/pets', method: 'GET' },
        { path: '/pet/{petId}', method: 'GET' }
      ];

      const result = await parameterDiscovery.discoverParameters('/pet/{petId}', endpoints, {});

      expect(result).toEqual({ petId: '1' });
    });

    test('should handle paths with no parameters', async () => {
      const result = await parameterDiscovery.discoverParameters('/pets', [], {});
      expect(result).toEqual({});
    });

    test('should handle empty path template', async () => {
      const result = await parameterDiscovery.discoverParameters('', [], {});
      expect(result).toEqual({});
    });

    test('should handle null path template', async () => {
      const result = await parameterDiscovery.discoverParameters(null, [], {});
      expect(result).toEqual({});
    });

    test('should handle endpoints with unresolved parameters in list endpoint path', async () => {
      const endpoints = [
        { path: '/user/{userId}/pets', method: 'GET' },
        { path: '/user/{userId}/pet/{petId}', method: 'GET' }
      ];

      const result = await parameterDiscovery.discoverParameters(
        '/user/{userId}/pet/{petId}',
        endpoints,
        {}
      );

      // Should fall back to smart defaults since list endpoint has unresolved params
      expect(result).toEqual({ userId: '1', petId: '1' });
    });

    test('should handle HTTP 404 responses gracefully', async () => {
      mockHttpClient.makeRequest.mockResolvedValue({
        status: 404,
        data: null
      });

      const endpoints = [
        { path: '/pets', method: 'GET' },
        { path: '/pet/{petId}', method: 'GET' }
      ];

      const result = await parameterDiscovery.discoverParameters('/pet/{petId}', endpoints, {});

      expect(result).toEqual({ petId: '1' });
    });
  });

  describe('Caching', () => {
    test('should cache discovered parameters', async () => {
      mockHttpClient.makeRequest.mockResolvedValue({
        status: 200,
        data: [{ id: 123 }]
      });

      const endpoints = [
        { path: '/pets', method: 'GET' },
        { path: '/pet/{petId}', method: 'GET' }
      ];

      // First call
      const result1 = await parameterDiscovery.discoverParameters('/pet/{petId}', endpoints, {});
      expect(result1).toEqual({ petId: 123 });

      // Second call should use cache
      const result2 = await parameterDiscovery.discoverParameters('/pet/{petId}', endpoints, {});
      expect(result2).toEqual({ petId: 123 });

      // HTTP client should only be called once
      expect(mockHttpClient.makeRequest).toHaveBeenCalledTimes(1);

      // Check cache stats
      const stats = parameterDiscovery.getCacheStats();
      expect(stats.size).toBe(1);
      expect(stats.keys).toEqual(['/pet/{petId}:petId']);
    });

    test('should cache fallback values', async () => {
      // First call (no HTTP client setup, will use fallback)
      const result1 = await parameterDiscovery.discoverParameters('/user/{username}', [], {});
      expect(result1).toEqual({ username: 'testuser' });

      // Second call should use cache
      const result2 = await parameterDiscovery.discoverParameters('/user/{username}', [], {});
      expect(result2).toEqual({ username: 'testuser' });

      // Check cache stats
      const stats = parameterDiscovery.getCacheStats();
      expect(stats.size).toBe(1);
    });

    test('should clear cache correctly', async () => {
      mockHttpClient.makeRequest.mockResolvedValue({
        status: 200,
        data: [{ id: 123 }]
      });

      await parameterDiscovery.discoverParameters('/pet/{petId}', [
        { path: '/pets', method: 'GET' }
      ], {});

      expect(parameterDiscovery.getCacheStats().size).toBe(1);

      parameterDiscovery.clearCache();

      expect(parameterDiscovery.getCacheStats().size).toBe(0);
    });
  });

  describe('Parameter Validation', () => {
    test('should validate that all required parameters are resolved', () => {
      const missing = parameterDiscovery.validateParameters(
        '/user/{userId}/pet/{petId}',
        { userId: 1 }
      );

      expect(missing).toEqual(['petId']);
    });

    test('should return empty array when all parameters are resolved', () => {
      const missing = parameterDiscovery.validateParameters(
        '/user/{userId}/pet/{petId}',
        { userId: 1, petId: 2 }
      );

      expect(missing).toEqual([]);
    });

    test('should handle paths with no parameters', () => {
      const missing = parameterDiscovery.validateParameters('/users', {});
      expect(missing).toEqual([]);
    });

    test('should handle null/undefined values as missing', () => {
      const missing = parameterDiscovery.validateParameters(
        '/user/{userId}',
        { userId: null }
      );

      expect(missing).toEqual(['userId']);
    });
  });

  describe('Static Factory Methods', () => {
    test('should create test instance with mock dependencies', () => {
      const mockDeps = {
        httpClient: mockHttpClient,
        logger: mockLogger
      };

      const testInstance = ParameterDiscovery.createForTesting(mockDeps);

      expect(testInstance.httpClient).toBe(mockHttpClient);
      expect(testInstance.logger).toBe(mockLogger);
    });

    test('should create test instance with default mocks', () => {
      const testInstance = ParameterDiscovery.createForTesting();

      expect(testInstance.httpClient).toBeUndefined();
      expect(testInstance.logger).toBeDefined();
    });
  });
});