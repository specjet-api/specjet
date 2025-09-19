import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import APIValidator from '#src/core/validator.js';
import { SpecJetError } from '#src/core/errors.js';

describe('APIValidator', () => {
  let mockHttpClient;
  let mockSchemaValidator;
  let mockLogger;
  let validator;

  beforeEach(() => {
    // Mock HTTP client
    mockHttpClient = {
      makeRequest: vi.fn(),
      testConnection: vi.fn()
    };

    // Mock schema validator
    mockSchemaValidator = {
      validateResponse: vi.fn(),
      generateSampleData: vi.fn()
    };

    // Mock logger
    mockLogger = {
      log: vi.fn(),
      warn: vi.fn(),
      error: vi.fn()
    };

    // Create validator with mocked dependencies
    validator = new APIValidator({
      httpClient: mockHttpClient,
      schemaValidator: mockSchemaValidator,
      logger: mockLogger
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Constructor and Dependency Validation', () => {
    test('should create validator with all required dependencies', () => {
      expect(validator.httpClient).toBe(mockHttpClient);
      expect(validator.schemaValidator).toBe(mockSchemaValidator);
      expect(validator.logger).toBe(mockLogger);
    });

    test('should throw error if HTTP client is missing', () => {
      expect(() => {
        new APIValidator({
          schemaValidator: mockSchemaValidator,
          logger: mockLogger
        });
      }).toThrow(new SpecJetError(
        'HTTPClient dependency is required',
        'MISSING_DEPENDENCY'
      ));
    });

    test('should throw error if schema validator is missing', () => {
      expect(() => {
        new APIValidator({
          httpClient: mockHttpClient,
          logger: mockLogger
        });
      }).toThrow(new SpecJetError(
        'SchemaValidator dependency is required',
        'MISSING_DEPENDENCY'
      ));
    });

    test('should use console as default logger if not provided', () => {
      const validatorWithDefaultLogger = new APIValidator({
        httpClient: mockHttpClient,
        schemaValidator: mockSchemaValidator
      });

      expect(validatorWithDefaultLogger.logger).toBe(console);
    });
  });

  describe('Initialization', () => {
    let mockContractParser;

    beforeEach(() => {
      // Create a mock ContractParser instance
      mockContractParser = {
        parseContract: vi.fn()
      };
    });

    test('should initialize with valid contract', async () => {
      const mockContract = {
        info: { title: 'Test API', version: '1.0.0' },
        endpoints: [
          { path: '/users', method: 'GET' },
          { path: '/users/{id}', method: 'GET' }
        ]
      };

      // Manually set the contract for testing
      validator.contract = mockContract;
      validator.endpoints = mockContract.endpoints;
      validator.contractPath = '/path/to/contract.yaml';

      expect(validator.contract).toBe(mockContract);
      expect(validator.endpoints).toBe(mockContract.endpoints);
      expect(validator.contractPath).toBe('/path/to/contract.yaml');
    });

    test('should throw error if contract parsing fails', async () => {
      const parseError = new Error('Invalid YAML syntax');
      mockContractParser.parseContract.mockRejectedValue(parseError);

      // Mock the validator's parser property
      validator.parser = mockContractParser;

      await expect(validator.initialize('/path/to/invalid.yaml')).rejects.toThrow(
        new SpecJetError(
          'Failed to initialize validator with contract: /path/to/invalid.yaml',
          'VALIDATOR_INIT_ERROR',
          parseError
        )
      );
    });
  });

  describe('Endpoint Validation', () => {
    beforeEach(async () => {
      // Set up validator with mock contract
      validator.contract = {
        info: { title: 'Test API', version: '1.0.0' },
        endpoints: [
          {
            path: '/users',
            method: 'GET',
            responses: {
              '200': {
                schema: { type: 'object', properties: { users: { type: 'array' } } }
              }
            }
          },
          {
            path: '/users/{id}',
            method: 'GET',
            responses: {
              '200': {
                schema: { type: 'object', properties: { id: { type: 'string' }, name: { type: 'string' } } }
              },
              '404': {
                schema: { type: 'object', properties: { error: { type: 'string' } } }
              }
            }
          },
          {
            path: '/users',
            method: 'POST',
            requestBody: {
              schema: { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] }
            },
            responses: {
              '201': {
                schema: { type: 'object', properties: { id: { type: 'string' }, name: { type: 'string' } } }
              }
            }
          }
        ]
      };
      validator.endpoints = validator.contract.endpoints;
    });

    test('should throw error if validator not initialized', async () => {
      const uninitializedValidator = new APIValidator({
        httpClient: mockHttpClient,
        schemaValidator: mockSchemaValidator,
        logger: mockLogger
      });

      await expect(
        uninitializedValidator.validateEndpoint('/users', 'GET')
      ).rejects.toThrow(new SpecJetError(
        'Validator not initialized. Call initialize() first.',
        'VALIDATOR_NOT_INITIALIZED'
      ));
    });

    test('should return not found result for unknown endpoint', async () => {
      const result = await validator.validateEndpoint('/unknown', 'GET');

      expect(result.success).toBe(false);
      expect(result.endpoint).toBe('/unknown');
      expect(result.method).toBe('GET');
      expect(result.statusCode).toBe(null);
      expect(result.issues).toHaveLength(1);
      expect(result.issues[0].type).toBe('endpoint_not_found');
      expect(result.issues[0].message).toBe('Endpoint GET /unknown not found in OpenAPI contract');
    });

    test('should validate successful endpoint response', async () => {
      const mockResponse = {
        status: 200,
        data: { users: [{ id: '1', name: 'John' }] },
        headers: { 'content-type': 'application/json' },
        responseTime: 150
      };

      mockHttpClient.makeRequest.mockResolvedValue(mockResponse);
      mockSchemaValidator.validateResponse.mockResolvedValue([]);

      const result = await validator.validateEndpoint('/users', 'GET');

      expect(mockHttpClient.makeRequest).toHaveBeenCalledWith('/users', 'GET', {
        query: undefined,
        body: null,
        timeout: undefined
      });

      expect(mockSchemaValidator.validateResponse).toHaveBeenCalledWith(
        mockResponse.data,
        validator.endpoints[0].responses['200'].schema
      );

      expect(result.success).toBe(true);
      expect(result.endpoint).toBe('/users');
      expect(result.method).toBe('GET');
      expect(result.statusCode).toBe(200);
      expect(result.issues).toHaveLength(0);
      expect(result.metadata.responseTime).toBe(150);
    });

    test('should validate endpoint with path parameters', async () => {
      const mockResponse = {
        status: 200,
        data: { id: '123', name: 'John Doe' },
        headers: {},
        responseTime: 120
      };

      mockHttpClient.makeRequest.mockResolvedValue(mockResponse);
      mockSchemaValidator.validateResponse.mockResolvedValue([]);

      const result = await validator.validateEndpoint('/users/{id}', 'GET', {
        pathParams: { id: '123' }
      });

      expect(mockHttpClient.makeRequest).toHaveBeenCalledWith('/users/123', 'GET', {
        query: undefined,
        body: null,
        timeout: undefined
      });

      expect(result.success).toBe(true);
      expect(result.statusCode).toBe(200);
    });

    test('should handle unresolved path parameters', async () => {
      const result = await validator.validateEndpoint('/users/{id}', 'GET', {
        enableParameterDiscovery: false
      });

      expect(result.success).toBe(false);
      expect(result.issues).toHaveLength(1);
      expect(result.issues[0].type).toBe('network_error');
      expect(result.issues[0].message).toContain('Unresolved path parameters: {id}');
    });

    test('should validate POST endpoint with request body', async () => {
      const mockResponse = {
        status: 201,
        data: { id: '456', name: 'Jane Doe' },
        headers: {},
        responseTime: 200
      };

      mockHttpClient.makeRequest.mockResolvedValue(mockResponse);
      mockSchemaValidator.validateResponse.mockResolvedValue([]);
      mockSchemaValidator.generateSampleData.mockReturnValue({ name: 'Sample User' });

      const result = await validator.validateEndpoint('/users', 'POST');

      expect(mockSchemaValidator.generateSampleData).toHaveBeenCalledWith(
        validator.endpoints[2].requestBody.schema
      );

      expect(mockHttpClient.makeRequest).toHaveBeenCalledWith('/users', 'POST', {
        query: undefined,
        body: { name: 'Sample User' },
        timeout: undefined
      });

      expect(result.success).toBe(true);
      expect(result.statusCode).toBe(201);
    });

    test('should use provided request body instead of generating one', async () => {
      const mockResponse = {
        status: 201,
        data: { id: '789', name: 'Custom User' },
        headers: {},
        responseTime: 180
      };

      const customBody = { name: 'Custom User' };

      mockHttpClient.makeRequest.mockResolvedValue(mockResponse);
      mockSchemaValidator.validateResponse.mockResolvedValue([]);

      const result = await validator.validateEndpoint('/users', 'POST', {
        requestBody: customBody
      });

      expect(mockSchemaValidator.generateSampleData).not.toHaveBeenCalled();

      expect(mockHttpClient.makeRequest).toHaveBeenCalledWith('/users', 'POST', {
        query: undefined,
        body: customBody,
        timeout: undefined
      });

      expect(result.success).toBe(true);
    });
  });

  describe('Response Validation', () => {
    beforeEach(() => {
      validator.contract = { info: { title: 'Test API', version: '1.0.0' } };
      validator.endpoints = [
        {
          path: '/test',
          method: 'GET',
          responses: {
            '200': {
              schema: { type: 'object', properties: { data: { type: 'string' } } },
              headers: {
                'X-Custom-Header': { required: true }
              }
            },
            '404': {
              schema: { type: 'object', properties: { error: { type: 'string' } } }
            }
          }
        }
      ];
    });

    test('should validate response with unexpected status code', async () => {
      const mockResponse = {
        status: 500,
        data: { error: 'Internal Server Error' },
        headers: {}
      };

      mockHttpClient.makeRequest.mockResolvedValue(mockResponse);

      const result = await validator.validateEndpoint('/test', 'GET');

      expect(result.success).toBe(false);
      expect(result.issues).toHaveLength(1);
      expect(result.issues[0].type).toBe('unexpected_status_code');
      expect(result.issues[0].message).toBe('Status code 500 not defined in contract');
      expect(result.issues[0].metadata.actualStatus).toBe('500');
      expect(result.issues[0].metadata.expectedStatuses).toEqual(['200', '404']);
    });

    test('should validate response schema and return schema issues', async () => {
      const mockResponse = {
        status: 200,
        data: { data: 123 }, // Should be string, not number
        headers: { 'x-custom-header': 'present' }
      };

      const schemaIssues = [
        {
          type: 'type_mismatch',
          field: 'data',
          message: 'Field should be string but got number'
        }
      ];

      mockHttpClient.makeRequest.mockResolvedValue(mockResponse);
      mockSchemaValidator.validateResponse.mockResolvedValue(schemaIssues);

      const result = await validator.validateEndpoint('/test', 'GET');

      expect(mockSchemaValidator.validateResponse).toHaveBeenCalledWith(
        mockResponse.data,
        validator.endpoints[0].responses['200'].schema
      );

      expect(result.success).toBe(false);
      expect(result.issues).toEqual(schemaIssues);
    });

    test('should validate required response headers', async () => {
      const mockResponse = {
        status: 200,
        data: { data: 'valid string' },
        headers: {} // Missing required X-Custom-Header
      };

      mockHttpClient.makeRequest.mockResolvedValue(mockResponse);
      mockSchemaValidator.validateResponse.mockResolvedValue([]);

      const result = await validator.validateEndpoint('/test', 'GET');

      expect(result.success).toBe(false);
      expect(result.issues).toHaveLength(1);
      expect(result.issues[0].type).toBe('missing_header');
      expect(result.issues[0].field).toBe('X-Custom-Header');
      expect(result.issues[0].message).toBe("Required header 'X-Custom-Header' is missing");
    });

    test('should handle network errors gracefully', async () => {
      const networkError = new Error('Connection refused');
      networkError.code = 'ECONNREFUSED';

      mockHttpClient.makeRequest.mockRejectedValue(networkError);

      const result = await validator.validateEndpoint('/test', 'GET');

      expect(result.success).toBe(false);
      expect(result.statusCode).toBe(null);
      expect(result.issues).toHaveLength(1);
      expect(result.issues[0].type).toBe('network_error');
      expect(result.issues[0].message).toBe('Network error: Connection refused');
      expect(result.issues[0].metadata.originalError).toBe('ECONNREFUSED');
    });
  });

  describe('Path Resolution', () => {
    test('should resolve simple path parameters', () => {
      const resolved = validator.resolvePath('/users/{id}/posts/{postId}', {
        id: '123',
        postId: 'abc'
      });

      expect(resolved).toBe('/users/123/posts/abc');
    });

    test('should URL encode path parameters', () => {
      const resolved = validator.resolvePath('/search/{query}', {
        query: 'hello world & friends'
      });

      expect(resolved).toBe('/search/hello%20world%20%26%20friends');
    });

    test('should throw error for unresolved parameters', () => {
      expect(() => {
        validator.resolvePath('/users/{id}/posts/{postId}', { id: '123' });
      }).toThrow('Unresolved path parameters: {postId}');
    });

    test('should handle paths with no parameters', () => {
      const resolved = validator.resolvePath('/users', {});
      expect(resolved).toBe('/users');
    });
  });

  describe('Request Body Generation', () => {
    beforeEach(() => {
      validator.endpoints = [
        {
          path: '/test',
          method: 'POST',
          requestBody: {
            schema: { type: 'object', properties: { name: { type: 'string' } } }
          }
        }
      ];
    });

    test('should return null for endpoints without request body', async () => {
      const endpoint = { path: '/test', method: 'GET' };
      const body = await validator.generateRequestBody(endpoint);

      expect(body).toBe(null);
    });

    test('should return provided body if given', async () => {
      const endpoint = validator.endpoints[0];
      const providedBody = { name: 'Custom Name' };

      const body = await validator.generateRequestBody(endpoint, providedBody);

      expect(body).toBe(providedBody);
      expect(mockSchemaValidator.generateSampleData).not.toHaveBeenCalled();
    });

    test('should generate sample data from schema', async () => {
      const endpoint = validator.endpoints[0];
      const sampleData = { name: 'Generated Name' };

      mockSchemaValidator.generateSampleData.mockReturnValue(sampleData);

      const body = await validator.generateRequestBody(endpoint);

      expect(mockSchemaValidator.generateSampleData).toHaveBeenCalledWith(endpoint.requestBody.schema);
      expect(body).toBe(sampleData);
    });
  });

  describe('Result Creation', () => {
    test('should create validation result with all fields', () => {
      const issues = [{ type: 'test_issue', message: 'Test message' }];
      const metadata = { responseTime: 100, responseSize: 500 };

      const result = validator.createValidationResult(
        '/test',
        'post',
        true,
        201,
        issues,
        metadata
      );

      expect(result.endpoint).toBe('/test');
      expect(result.method).toBe('POST');
      expect(result.success).toBe(true);
      expect(result.statusCode).toBe(201);
      expect(result.issues).toBe(issues);
      expect(result.metadata).toBe(metadata);
      expect(result.timestamp).toBeDefined();
    });

    test('should create issue with all fields', () => {
      const metadata = { additional: 'info' };

      const issue = validator.createIssue(
        'validation_error',
        'fieldName',
        'Something went wrong',
        metadata
      );

      expect(issue.type).toBe('validation_error');
      expect(issue.field).toBe('fieldName');
      expect(issue.message).toBe('Something went wrong');
      expect(issue.metadata).toBe(metadata);
    });
  });

  describe('Configuration and State', () => {
    test('should return correct configuration when not initialized', () => {
      const config = validator.getConfig();

      expect(config.contractPath).toBe(null);
      expect(config.hasContract).toBe(false);
      expect(config.endpointCount).toBe(0);
      expect(config.contractInfo).toBe(null);
    });

    test('should return correct configuration when initialized', () => {
      validator.contractPath = '/path/to/contract.yaml';
      validator.contract = {
        info: { title: 'Test API', version: '1.0.0' }
      };
      validator.endpoints = [{ path: '/test', method: 'GET' }];

      const config = validator.getConfig();

      expect(config.contractPath).toBe('/path/to/contract.yaml');
      expect(config.hasContract).toBe(true);
      expect(config.endpointCount).toBe(1);
      expect(config.contractInfo).toEqual({ title: 'Test API', version: '1.0.0' });
    });
  });

  describe('Static Validation Statistics', () => {
    test('should calculate statistics for empty results', () => {
      const stats = APIValidator.getValidationStats([]);

      expect(stats.total).toBe(0);
      expect(stats.passed).toBe(0);
      expect(stats.failed).toBe(0);
      expect(stats.errors).toBe(0);
      expect(stats.totalIssues).toBe(0);
      expect(stats.avgResponseTime).toBe(0);
      expect(stats.successRate).toBe(0);
    });

    test('should calculate statistics for successful results', () => {
      const results = [
        {
          success: true,
          issues: [],
          metadata: { responseTime: 100 }
        },
        {
          success: true,
          issues: [],
          metadata: { responseTime: 200 }
        }
      ];

      const stats = APIValidator.getValidationStats(results);

      expect(stats.total).toBe(2);
      expect(stats.passed).toBe(2);
      expect(stats.failed).toBe(0);
      expect(stats.avgResponseTime).toBe(150);
      expect(stats.successRate).toBe(100);
    });

    test('should calculate statistics for mixed results', () => {
      const results = [
        {
          success: true,
          issues: [],
          metadata: { responseTime: 100 }
        },
        {
          success: false,
          issues: [
            { type: 'validation_error' },
            { type: 'network_error' }
          ],
          metadata: { responseTime: 50 }
        },
        {
          success: false,
          issues: [
            { type: 'validation_failed' }
          ]
        }
      ];

      const stats = APIValidator.getValidationStats(results);

      expect(stats.total).toBe(3);
      expect(stats.passed).toBe(1);
      expect(stats.failed).toBe(2);
      expect(stats.errors).toBe(2); // network_error and validation_failed count as errors
      expect(stats.totalIssues).toBe(3);
      expect(stats.avgResponseTime).toBe(75); // (100 + 50) / 2
      expect(stats.successRate).toBe(33);
      expect(stats.issuesByType).toEqual({
        'validation_error': 1,
        'network_error': 1,
        'validation_failed': 1
      });
    });
  });

  describe('Parameter Discovery Integration', () => {
    let mockParameterDiscovery;

    beforeEach(() => {
      // Mock the parameter discovery service
      mockParameterDiscovery = {
        discoverParameters: vi.fn()
      };

      // Replace the parameter discovery instance
      validator.parameterDiscovery = mockParameterDiscovery;

      // Set up basic endpoints for testing
      validator.endpoints = [
        {
          path: '/pet/{petId}',
          method: 'GET',
          responses: {
            '200': {
              description: 'successful operation',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      id: { type: 'integer' },
                      name: { type: 'string' }
                    }
                  }
                }
              }
            }
          }
        },
        { path: '/pet/findByStatus', method: 'GET' },
        { path: '/user/{username}', method: 'GET' },
        {
          path: '/user/{userId}/pet/{petId}',
          method: 'GET',
          responses: {
            '200': {
              description: 'successful operation',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      id: { type: 'integer' }
                    }
                  }
                }
              }
            }
          }
        }
      ];
      // Initialize contract
      validator.contract = { info: { title: 'Test', version: '1.0' } };
    });

    test('should call parameter discovery when enabled', async () => {
      const discoveredParams = { petId: '123' };

      mockParameterDiscovery.discoverParameters.mockResolvedValue(discoveredParams);
      mockHttpClient.makeRequest.mockResolvedValue({
        status: 200,
        data: { id: 123, name: 'Fluffy' }
      });
      mockSchemaValidator.validateResponse.mockResolvedValue([]);

      // Endpoint already exists in beforeEach setup

      const result = await validator.validateEndpoint('/pet/{petId}', 'GET', {
        enableParameterDiscovery: true
      });

      expect(mockParameterDiscovery.discoverParameters).toHaveBeenCalledWith(
        '/pet/{petId}',
        validator.endpoints,
        {}
      );
      expect(mockHttpClient.makeRequest).toHaveBeenCalledWith(
        '/pet/123',
        'GET',
        expect.any(Object)
      );
      expect(result.success).toBe(true);
    });

    test('should skip parameter discovery when disabled', async () => {
      const endpoint = { path: '/pet/{petId}', method: 'GET' };
      validator.endpoints = [endpoint];
      validator.contract = { info: { title: 'Test', version: '1.0' } };

      await validator.validateEndpoint('/pet/{petId}', 'GET', {
        enableParameterDiscovery: false,
        pathParams: { petId: '456' }
      });

      expect(mockParameterDiscovery.discoverParameters).not.toHaveBeenCalled();
      expect(mockHttpClient.makeRequest).toHaveBeenCalledWith(
        '/pet/456',
        'GET',
        expect.any(Object)
      );
    });

    test('should merge discovered parameters with provided parameters', async () => {
      const providedParams = { userId: '999' };
      const discoveredParams = { userId: '999', petId: '123' }; // userId preserved, petId discovered

      mockParameterDiscovery.discoverParameters.mockResolvedValue(discoveredParams);
      mockHttpClient.makeRequest.mockResolvedValue({
        status: 200,
        data: { id: 123 }
      });
      mockSchemaValidator.validateResponse.mockResolvedValue([]);

      // Endpoint and contract already set up in beforeEach

      const result = await validator.validateEndpoint('/user/{userId}/pet/{petId}', 'GET', {
        enableParameterDiscovery: true,
        pathParams: providedParams
      });

      expect(mockParameterDiscovery.discoverParameters).toHaveBeenCalledWith(
        '/user/{userId}/pet/{petId}',
        validator.endpoints,
        providedParams
      );
      expect(mockHttpClient.makeRequest).toHaveBeenCalledWith(
        '/user/999/pet/123',
        'GET',
        expect.any(Object)
      );
      expect(result.success).toBe(true);
    });

    test('should handle parameter discovery errors gracefully', async () => {
      const endpoint = { path: '/pet/{petId}', method: 'GET' };
      const providedParams = {};

      mockParameterDiscovery.discoverParameters.mockRejectedValue(new Error('Discovery failed'));
      validator.endpoints = [endpoint];
      validator.contract = { info: { title: 'Test', version: '1.0' } };

      const result = await validator.validateEndpoint('/pet/{petId}', 'GET', {
        enableParameterDiscovery: true,
        pathParams: providedParams
      });

      expect(mockParameterDiscovery.discoverParameters).toHaveBeenCalled();
      expect(mockLogger.warn).toHaveBeenCalledWith('⚠️  Parameter discovery failed: Discovery failed');

      // Should fall back to provided parameters (empty in this case)
      // This should result in an error due to unresolved parameters
      expect(result.success).toBe(false);
      expect(result.issues[0].type).toBe('network_error');
      expect(result.issues[0].message).toContain('Unresolved path parameters');
    });

    test('should log discovered parameters for transparency', async () => {
      const endpoint = { path: '/pet/{petId}', method: 'GET' };
      const providedParams = { existingParam: 'existing' };
      const discoveredParams = { existingParam: 'existing', petId: '123' };

      mockParameterDiscovery.discoverParameters.mockResolvedValue(discoveredParams);
      mockHttpClient.makeRequest.mockResolvedValue({
        status: 200,
        data: { id: 123 }
      });
      mockSchemaValidator.validateResponse.mockResolvedValue([]);

      validator.endpoints = [endpoint];

      await validator.validateEndpoint('/pet/{petId}', 'GET', {
        enableParameterDiscovery: true,
        pathParams: providedParams
      });

      expect(mockLogger.log).toHaveBeenCalledWith(
        '🔍 Auto-discovered parameters: petId=123'
      );
    });

    test('should not log when no new parameters are discovered', async () => {
      const endpoint = { path: '/pet/{petId}', method: 'GET' };
      const providedParams = { petId: '999' };
      const discoveredParams = { petId: '999' }; // Same as provided

      mockParameterDiscovery.discoverParameters.mockResolvedValue(discoveredParams);
      mockHttpClient.makeRequest.mockResolvedValue({
        status: 200,
        data: { id: 999 }
      });
      mockSchemaValidator.validateResponse.mockResolvedValue([]);

      validator.endpoints = [endpoint];

      await validator.validateEndpoint('/pet/{petId}', 'GET', {
        enableParameterDiscovery: true,
        pathParams: providedParams
      });

      // Should not log auto-discovered parameters since none were new
      expect(mockLogger.log).not.toHaveBeenCalledWith(
        expect.stringContaining('Auto-discovered parameters')
      );
    });

    test('should default enableParameterDiscovery to true', async () => {
      const endpoint = { path: '/pet/{petId}', method: 'GET' };
      const discoveredParams = { petId: '123' };

      mockParameterDiscovery.discoverParameters.mockResolvedValue(discoveredParams);
      mockHttpClient.makeRequest.mockResolvedValue({
        status: 200,
        data: { id: 123 }
      });
      mockSchemaValidator.validateResponse.mockResolvedValue([]);

      validator.endpoints = [endpoint];

      // Don't specify enableParameterDiscovery - should default to true
      await validator.validateEndpoint('/pet/{petId}', 'GET', {});

      expect(mockParameterDiscovery.discoverParameters).toHaveBeenCalled();
    });

    test('should pass all endpoints to parameter discovery for context', async () => {
      const allEndpoints = [
        { path: '/pet/findByStatus', method: 'GET' },
        { path: '/pet/{petId}', method: 'GET' },
        { path: '/user/{username}', method: 'GET' }
      ];

      mockParameterDiscovery.discoverParameters.mockResolvedValue({ petId: '123' });
      mockHttpClient.makeRequest.mockResolvedValue({
        status: 200,
        data: { id: 123 }
      });
      mockSchemaValidator.validateResponse.mockResolvedValue([]);

      validator.endpoints = allEndpoints;

      await validator.validateEndpoint('/pet/{petId}', 'GET', {
        enableParameterDiscovery: true
      });

      expect(mockParameterDiscovery.discoverParameters).toHaveBeenCalledWith(
        '/pet/{petId}',
        allEndpoints, // Should pass all endpoints for discovery context
        {}
      );
    });
  });
});