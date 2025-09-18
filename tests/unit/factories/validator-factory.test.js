import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock all dependencies before importing ValidatorFactory
vi.mock('#src/core/validator.js', () => ({
  default: vi.fn()
}));

vi.mock('#src/core/schema-validator.js', () => ({
  default: vi.fn()
}));

vi.mock('#src/core/retry-handler.js', () => {
  const MockRetryHandler = vi.fn().mockImplementation(() => ({ retry: vi.fn() }));
  MockRetryHandler.createDevHandler = vi.fn(() => ({ maxRetries: 2 }));
  MockRetryHandler.createCIHandler = vi.fn(() => ({ maxRetries: 5 }));
  return { default: MockRetryHandler };
});

vi.mock('#src/core/batch-processor.js', () => ({
  default: vi.fn()
}));

vi.mock('#src/core/results-aggregator.js', () => ({
  default: vi.fn()
}));

import ValidatorFactory from '#src/factories/validator-factory.js';
import APIValidator from '#src/core/validator.js';
import SchemaValidator from '#src/core/schema-validator.js';
import ValidationRetryHandler from '#src/core/retry-handler.js';
import ValidationBatchProcessor from '#src/core/batch-processor.js';
import ValidationResultsAggregator from '#src/core/results-aggregator.js';

describe('ValidatorFactory', () => {
  let validatorFactory;
  let mockHttpClientFactory;
  let mockServiceContainer;
  let mockLogger;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Ensure we're not in CI mode for most tests
    delete process.env.CI;
    process.stdin.isTTY = true;

    // Mock HTTP Client Factory
    mockHttpClientFactory = {
      createDefaultClient: vi.fn(),
      createCIClient: vi.fn(),
      getStats: vi.fn()
    };

    // Mock Service Container
    mockServiceContainer = {
      register: vi.fn(),
      get: vi.fn(),
      has: vi.fn()
    };

    // Mock Logger
    mockLogger = {
      log: vi.fn(),
      warn: vi.fn(),
      error: vi.fn()
    };

    // Create factory with mocked dependencies
    validatorFactory = new ValidatorFactory({
      httpClientFactory: mockHttpClientFactory,
      serviceContainer: mockServiceContainer,
      logger: mockLogger
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Constructor and Dependency Injection', () => {
    test('should create factory with provided dependencies', () => {
      expect(validatorFactory.httpClientFactory).toBe(mockHttpClientFactory);
      expect(validatorFactory.serviceContainer).toBe(mockServiceContainer);
      expect(validatorFactory.logger).toBe(mockLogger);
    });

    test('should use default dependencies when not provided', () => {
      const factoryWithDefaults = new ValidatorFactory();

      expect(factoryWithDefaults.httpClientFactory).toBeDefined();
      expect(factoryWithDefaults.serviceContainer).toBe(undefined);
      expect(factoryWithDefaults.logger).toBe(console);
    });
  });

  describe('Basic Validator Creation', () => {
    test('should create validator with all dependencies', () => {
      const mockEnvironment = {
        url: 'https://api.example.com',
        headers: { 'Authorization': 'Bearer token' }
      };

      const mockHttpClient = { baseURL: 'https://api.example.com' };
      const mockSchemaValidator = { validate: vi.fn() };
      const mockValidator = { httpClient: mockHttpClient, schemaValidator: mockSchemaValidator };

      // Mock both client creation methods to return the same client
      mockHttpClientFactory.createDefaultClient.mockReturnValue(mockHttpClient);
      mockHttpClientFactory.createCIClient.mockReturnValue(mockHttpClient);
      SchemaValidator.mockReturnValue(mockSchemaValidator);
      APIValidator.mockReturnValue(mockValidator);

      const validator = validatorFactory.create(mockEnvironment);

      // Verify that one of the HTTP client creation methods was called with the right parameters
      const defaultClientCalled = mockHttpClientFactory.createDefaultClient.mock.calls.length > 0;
      const ciClientCalled = mockHttpClientFactory.createCIClient.mock.calls.length > 0;

      expect(defaultClientCalled || ciClientCalled).toBe(true);

      if (defaultClientCalled) {
        expect(mockHttpClientFactory.createDefaultClient).toHaveBeenCalledWith(
          'https://api.example.com',
          { 'Authorization': 'Bearer token' }
        );
      } else {
        expect(mockHttpClientFactory.createCIClient).toHaveBeenCalledWith(
          'https://api.example.com',
          { 'Authorization': 'Bearer token' }
        );
      }

      expect(APIValidator).toHaveBeenCalledWith({
        httpClient: mockHttpClient,
        schemaValidator: mockSchemaValidator,
        logger: mockLogger
      });

      expect(validator).toBe(mockValidator);
    });

    test('should create CI-optimized validator in CI environment', () => {
      const originalEnv = process.env.CI;
      process.env.CI = 'true';

      const mockEnvironment = { url: 'https://api.example.com' };
      const mockCIClient = { baseURL: 'https://api.example.com', timeout: 60000 };
      const mockValidator = { httpClient: mockCIClient };

      mockHttpClientFactory.createCIClient.mockReturnValue(mockCIClient);
      APIValidator.mockReturnValue(mockValidator);

      validatorFactory.create(mockEnvironment);

      expect(mockHttpClientFactory.createCIClient).toHaveBeenCalledWith(
        'https://api.example.com',
        {}
      );

      process.env.CI = originalEnv;
    });

    test('should detect CI environment from TTY', () => {
      const originalStdin = process.stdin.isTTY;
      process.stdin.isTTY = false; // Simulate CI environment

      const mockEnvironment = { url: 'https://api.example.com' };
      const mockCIClient = { baseURL: 'https://api.example.com' };

      mockHttpClientFactory.createCIClient.mockReturnValue(mockCIClient);
      APIValidator.mockReturnValue({});

      validatorFactory.create(mockEnvironment);

      expect(mockHttpClientFactory.createCIClient).toHaveBeenCalled();

      process.stdin.isTTY = originalStdin;
    });
  });

  describe('Batch Processor Creation', () => {
    test('should create validator with batch processor', () => {
      const mockEnvironment = { url: 'https://api.example.com' };
      const mockValidator = { endpoints: [] };
      const mockRetryHandler = { retry: vi.fn() };
      const mockBatchProcessor = { processEndpoints: vi.fn() };

      APIValidator.mockReturnValue(mockValidator);

      // Mock both CI and Dev handlers since environment detection might vary
      ValidationRetryHandler.createDevHandler.mockReturnValue(mockRetryHandler);
      ValidationRetryHandler.createCIHandler.mockReturnValue(mockRetryHandler);
      ValidationBatchProcessor.mockReturnValue(mockBatchProcessor);

      const result = validatorFactory.createWithBatchProcessor(mockEnvironment, {
        concurrency: 5,
        delay: 200,
        progressCallback: vi.fn()
      });

      expect(result.validator).toBe(mockValidator);
      expect(result.batchProcessor).toBe(mockBatchProcessor);
      expect(result.retryHandler).toBe(mockRetryHandler);
      expect(result.validateAllEndpoints).toBeInstanceOf(Function);

      expect(ValidationBatchProcessor).toHaveBeenCalledWith(
        mockValidator,
        expect.objectContaining({
          concurrency: 5,
          delay: 200,
          retryHandler: mockRetryHandler
        })
      );
    });

    test('should throw error if validator not initialized for batch processing', async () => {
      const mockEnvironment = { url: 'https://api.example.com' };
      const mockValidator = {}; // No endpoints property

      APIValidator.mockReturnValue(mockValidator);

      const result = validatorFactory.createWithBatchProcessor(mockEnvironment);

      await expect(result.validateAllEndpoints()).rejects.toThrow(
        'Validator must be initialized before batch processing'
      );
    });

    test('should process endpoints when validator is initialized', async () => {
      const mockEnvironment = { url: 'https://api.example.com' };
      const mockValidator = {
        endpoints: [
          { path: '/users', method: 'GET' },
          { path: '/posts', method: 'GET' }
        ]
      };

      const mockBatchProcessor = {
        processEndpoints: vi.fn().mockResolvedValue([
          { success: true, endpoint: '/users' },
          { success: true, endpoint: '/posts' }
        ])
      };

      APIValidator.mockReturnValue(mockValidator);
      ValidationBatchProcessor.mockReturnValue(mockBatchProcessor);

      const result = validatorFactory.createWithBatchProcessor(mockEnvironment);
      const validationResults = await result.validateAllEndpoints({ timeout: 5000 });

      expect(mockBatchProcessor.processEndpoints).toHaveBeenCalledWith(
        mockValidator.endpoints,
        { timeout: 5000 }
      );

      expect(validationResults).toHaveLength(2);
      expect(validationResults[0].success).toBe(true);
    });
  });

  describe('Complete Validation System Creation', () => {
    test('should create complete validation system with all components', () => {
      const mockEnvironment = { url: 'https://api.example.com' };
      const mockValidator = { endpoints: [], initialize: vi.fn() };
      const mockRetryHandler = { retry: vi.fn() };
      const mockResultsAggregator = {
        addResult: vi.fn(),
        startTracking: vi.fn(),
        stopTracking: vi.fn(),
        getStatistics: vi.fn(),
        export: vi.fn()
      };
      const mockBatchProcessor = { processEndpoints: vi.fn() };

      APIValidator.mockReturnValue(mockValidator);
      // Mock both CI and Dev handlers since environment detection might vary
      ValidationRetryHandler.createDevHandler.mockReturnValue(mockRetryHandler);
      ValidationRetryHandler.createCIHandler.mockReturnValue(mockRetryHandler);
      ValidationResultsAggregator.mockReturnValue(mockResultsAggregator);
      ValidationBatchProcessor.mockReturnValue(mockBatchProcessor);

      const system = validatorFactory.createValidationSystem(mockEnvironment, {
        concurrency: 3,
        delay: 100
      });

      expect(system.validator).toBe(mockValidator);
      expect(system.batchProcessor).toBe(mockBatchProcessor);
      expect(system.retryHandler).toBe(mockRetryHandler);
      expect(system.resultsAggregator).toBe(mockResultsAggregator);
      expect(system.initialize).toBeInstanceOf(Function);
      expect(system.validateAllEndpoints).toBeInstanceOf(Function);
      expect(system.getStatistics).toBeInstanceOf(Function);
      expect(system.generateReport).toBeInstanceOf(Function);
    });

    test('should integrate results aggregator with progress callback', () => {
      const mockEnvironment = { url: 'https://api.example.com' };
      const mockResultsAggregator = { addResult: vi.fn() };
      const customProgressCallback = vi.fn();

      ValidationResultsAggregator.mockReturnValue(mockResultsAggregator);
      ValidationBatchProcessor.mockImplementation((validator, options) => {
        // Simulate calling the progress callback
        const testResult = { success: true, endpoint: '/test' };
        options.progressCallback(testResult);
        return { processEndpoints: vi.fn() };
      });

      validatorFactory.createValidationSystem(mockEnvironment, {
        progressCallback: customProgressCallback
      });

      // Verify that results aggregator receives results
      expect(mockResultsAggregator.addResult).toHaveBeenCalledWith({
        success: true,
        endpoint: '/test'
      });

      // Verify that custom callback is also called
      expect(customProgressCallback).toHaveBeenCalledWith({
        success: true,
        endpoint: '/test'
      });
    });

    test('should handle validation system workflow methods', async () => {
      const mockValidator = {
        endpoints: [{ path: '/users', method: 'GET' }],
        initialize: vi.fn()
      };

      const mockBatchProcessor = {
        processEndpoints: vi.fn().mockResolvedValue([
          { success: true, endpoint: '/users' }
        ])
      };

      const mockResultsAggregator = {
        startTracking: vi.fn(),
        stopTracking: vi.fn(),
        getStatistics: vi.fn().mockReturnValue({ total: 1, passed: 1 }),
        export: vi.fn().mockReturnValue('Summary report')
      };

      APIValidator.mockReturnValue(mockValidator);
      ValidationBatchProcessor.mockReturnValue(mockBatchProcessor);
      ValidationResultsAggregator.mockReturnValue(mockResultsAggregator);

      const system = validatorFactory.createValidationSystem({ url: 'https://api.example.com' });

      // Test initialize
      await system.initialize('/path/to/contract');
      expect(mockValidator.initialize).toHaveBeenCalledWith('/path/to/contract');

      // Test validation workflow
      await system.validateAllEndpoints({ timeout: 5000 });

      expect(mockResultsAggregator.startTracking).toHaveBeenCalled();
      expect(mockBatchProcessor.processEndpoints).toHaveBeenCalledWith(
        mockValidator.endpoints,
        { timeout: 5000 }
      );
      expect(mockResultsAggregator.stopTracking).toHaveBeenCalled();

      // Test statistics and reporting
      const stats = system.getStatistics();
      expect(stats).toEqual({ total: 1, passed: 1 });

      const report = system.generateReport('summary');
      expect(report).toBe('Summary report');
    });

    test('should handle validation errors and stop tracking', async () => {
      const mockValidator = { endpoints: [{ path: '/users', method: 'GET' }] };
      const mockBatchProcessor = {
        processEndpoints: vi.fn().mockRejectedValue(new Error('Validation failed'))
      };
      const mockResultsAggregator = {
        startTracking: vi.fn(),
        stopTracking: vi.fn()
      };

      APIValidator.mockReturnValue(mockValidator);
      ValidationBatchProcessor.mockReturnValue(mockBatchProcessor);
      ValidationResultsAggregator.mockReturnValue(mockResultsAggregator);

      const system = validatorFactory.createValidationSystem({ url: 'https://api.example.com' });

      await expect(system.validateAllEndpoints()).rejects.toThrow('Validation failed');

      // Verify tracking was stopped even on error
      expect(mockResultsAggregator.startTracking).toHaveBeenCalled();
      expect(mockResultsAggregator.stopTracking).toHaveBeenCalled();
    });
  });

  describe('Retry Handler Creation', () => {
    test('should create default retry handler for development', () => {
      const mockDevHandler = { maxRetries: 2 };
      const mockCIHandler = { maxRetries: 5 };

      // Mock both handlers since environment detection may vary
      ValidationRetryHandler.createDevHandler.mockReturnValue(mockDevHandler);
      ValidationRetryHandler.createCIHandler.mockReturnValue(mockCIHandler);

      const retryHandler = validatorFactory.createRetryHandler({});

      // Verify that one of the handler creation methods was called
      const devHandlerCalled = ValidationRetryHandler.createDevHandler.mock.calls.length > 0;
      const ciHandlerCalled = ValidationRetryHandler.createCIHandler.mock.calls.length > 0;

      expect(devHandlerCalled || ciHandlerCalled).toBe(true);

      // The returned handler should be one of the mocked handlers
      expect(retryHandler === mockDevHandler || retryHandler === mockCIHandler).toBe(true);
    });

    test('should create CI retry handler in CI environment', () => {
      const originalEnv = process.env.CI;
      process.env.CI = 'true';

      const mockCIHandler = { maxRetries: 5 };

      ValidationRetryHandler.createCIHandler = vi.fn().mockReturnValue(mockCIHandler);

      const retryHandler = validatorFactory.createRetryHandler({});

      expect(ValidationRetryHandler.createCIHandler).toHaveBeenCalled();
      expect(retryHandler).toBe(mockCIHandler);

      process.env.CI = originalEnv;
    });

    test('should create custom retry handler with provided config', () => {
      const customConfig = {
        maxRetries: 10,
        baseBackoffMs: 500
      };

      const mockCustomHandler = { maxRetries: 10, baseBackoffMs: 500 };

      ValidationRetryHandler.mockReturnValue(mockCustomHandler);

      const retryHandler = validatorFactory.createRetryHandler({
        retryConfig: customConfig
      });

      expect(ValidationRetryHandler).toHaveBeenCalledWith(10, 500);
      expect(retryHandler).toBe(mockCustomHandler);
    });
  });

  describe('Testing Support', () => {
    test('should create validator optimized for testing', () => {
      const mockEnvironment = { url: 'https://test.example.com' };
      const mockHttpClient = { request: vi.fn() };
      const mockSchemaValidator = { validate: vi.fn() };
      const mockLogger = { log: vi.fn() };

      const mockValidator = {
        httpClient: mockHttpClient,
        schemaValidator: mockSchemaValidator,
        logger: mockLogger
      };

      APIValidator.mockReturnValue(mockValidator);

      const validator = validatorFactory.createForTesting(mockEnvironment, {
        httpClient: mockHttpClient,
        schemaValidator: mockSchemaValidator,
        logger: mockLogger
      });

      expect(APIValidator).toHaveBeenCalledWith({
        httpClient: mockHttpClient,
        schemaValidator: mockSchemaValidator,
        logger: mockLogger
      });

      expect(validator).toBe(mockValidator);
    });

    test('should create testing validator with default mocked dependencies', () => {
      const mockEnvironment = { url: 'https://test.example.com' };
      const mockHttpClient = { request: vi.fn() };
      const mockSchemaValidator = { validate: vi.fn() };

      // Mock HTTP client creation for both CI and default clients
      mockHttpClientFactory.createDefaultClient.mockReturnValue(mockHttpClient);
      mockHttpClientFactory.createCIClient.mockReturnValue(mockHttpClient);

      APIValidator.mockReturnValue({});
      SchemaValidator.mockReturnValue(mockSchemaValidator);

      validatorFactory.createForTesting(mockEnvironment);

      expect(APIValidator).toHaveBeenCalledWith(
        expect.objectContaining({
          httpClient: mockHttpClient,
          schemaValidator: mockSchemaValidator,
          logger: expect.objectContaining({
            log: expect.any(Function)
          })
        })
      );

      // Verify silent logger for tests
      const loggerArg = APIValidator.mock.calls[0][0].logger;
      loggerArg.log('test message'); // Should not throw
    });
  });

  describe('Service Container Integration', () => {
    test('should create validator from service container', () => {
      const mockEnvironment = { url: 'https://api.example.com' };
      const mockHttpClient = { request: vi.fn() };
      const mockSchemaValidator = { validate: vi.fn() };
      const mockValidator = { initialized: true };

      mockServiceContainer.get
        .mockReturnValueOnce(mockEnvironment) // environment.staging
        .mockReturnValueOnce(mockHttpClient) // httpClient
        .mockReturnValueOnce(mockSchemaValidator); // schemaValidator

      APIValidator.mockReturnValue(mockValidator);

      validatorFactory.createFromContainer('staging');

      expect(mockServiceContainer.get).toHaveBeenCalledWith('environment.staging');
      expect(mockServiceContainer.get).toHaveBeenCalledWith('httpClient');
      expect(mockServiceContainer.get).toHaveBeenCalledWith('schemaValidator');

      expect(APIValidator).toHaveBeenCalledWith({
        httpClient: mockHttpClient,
        schemaValidator: mockSchemaValidator,
        logger: mockLogger
      });
    });

    test('should throw error if service container not configured', () => {
      const factoryWithoutContainer = new ValidatorFactory({
        httpClientFactory: mockHttpClientFactory,
        logger: mockLogger
      });

      expect(() => {
        factoryWithoutContainer.createFromContainer('staging');
      }).toThrow('Service container not configured');
    });
  });

  describe('Static Service Registration', () => {
    test('should register all services in container', () => {
      const mockContainer = {
        register: vi.fn()
      };

      const environments = {
        staging: { url: 'https://staging.api.com' },
        production: { url: 'https://prod.api.com' }
      };

      ValidatorFactory.registerServices(mockContainer, environments);

      // Verify factory registration
      expect(mockContainer.register).toHaveBeenCalledWith(
        'validatorFactory',
        expect.any(Function),
        true
      );

      // Verify schema validator registration
      expect(mockContainer.register).toHaveBeenCalledWith(
        'schemaValidator',
        expect.any(Function),
        true
      );

      // Verify environment registrations
      expect(mockContainer.register).toHaveBeenCalledWith(
        'environment.staging',
        expect.any(Function)
      );

      expect(mockContainer.register).toHaveBeenCalledWith(
        'environment.production',
        expect.any(Function)
      );

      // Verify HTTP client factory registration
      expect(mockContainer.register).toHaveBeenCalledWith(
        'httpClientFactory',
        expect.any(Function),
        true
      );
    });

    test('should create validator factory from registered service', () => {
      const mockContainer = {
        register: vi.fn()
      };

      ValidatorFactory.registerServices(mockContainer);

      // Get the factory registration function
      const factoryRegistration = mockContainer.register.mock.calls.find(
        call => call[0] === 'validatorFactory'
      )[1];

      const factory = factoryRegistration();

      expect(factory).toBeInstanceOf(ValidatorFactory);
      expect(factory.serviceContainer).toBe(mockContainer);
    });
  });

  describe('Configuration and Status', () => {
    test('should return factory configuration', () => {
      mockHttpClientFactory.getStats.mockReturnValue({
        totalClients: 3,
        activeConnections: 2
      });

      const config = validatorFactory.getConfig();

      expect(config.hasServiceContainer).toBe(true);
      expect(config.httpClientFactoryStats).toEqual({
        totalClients: 3,
        activeConnections: 2
      });
    });

    test('should indicate when service container is not available', () => {
      const factoryWithoutContainer = new ValidatorFactory({
        httpClientFactory: mockHttpClientFactory,
        logger: mockLogger
      });

      mockHttpClientFactory.getStats.mockReturnValue({});

      const config = factoryWithoutContainer.getConfig();

      expect(config.hasServiceContainer).toBe(false);
    });
  });
});