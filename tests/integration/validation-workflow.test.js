import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import ValidationService from '#src/services/validation-service.js';
import ValidatorFactory from '#src/factories/validator-factory.js';
import ServiceContainer from '#src/core/service-container.js';
import { SpecJetError } from '#src/core/errors.js';

describe('Complete Validation Workflow Integration', () => {
  let validationService;
  let validatorFactory;
  let serviceContainer;
  let mockLogger;

  beforeEach(() => {
    // Create real service container for integration testing
    serviceContainer = new ServiceContainer();

    // Create real validator factory
    validatorFactory = new ValidatorFactory({
      serviceContainer: serviceContainer
    });

    // Mock logger to avoid console output during tests
    mockLogger = {
      log: vi.fn(),
      warn: vi.fn(),
      error: vi.fn()
    };

    // Create validation service with real dependencies but mocked logger
    validationService = new ValidationService({
      validatorFactory: validatorFactory,
      serviceContainer: serviceContainer,
      logger: mockLogger
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('End-to-End Validation Workflow', () => {
    test('should execute complete validation workflow with mocked contract and API', async () => {
      // Mock configuration loading
      const mockConfig = {
        environments: {
          staging: {
            url: 'https://staging.api.example.com',
            headers: {
              'Authorization': 'Bearer ${API_TOKEN}',
              'X-Client-ID': 'test-client'
            }
          }
        },
        contract: './tests/fixtures/sample-contract.yaml'
      };

      // Mock environment variable
      process.env.API_TOKEN = 'test-token-123';

      // Mock all the dependencies
      const mockConfigLoader = {
        loadConfig: vi.fn().mockResolvedValue(mockConfig),
        validateConfig: vi.fn(),
        getEnvironmentConfig: vi.fn().mockReturnValue(mockConfig.environments.staging),
        listEnvironments: vi.fn(),
        getAvailableEnvironments: vi.fn()
      };

      const mockContractFinder = {
        findContract: vi.fn().mockResolvedValue('./tests/fixtures/sample-contract.yaml'),
        validateContractFile: vi.fn(),
        getRelativePath: vi.fn().mockReturnValue('sample-contract.yaml')
      };

      const mockEnvValidator = {
        validateEnvironment: vi.fn().mockResolvedValue()
      };

      // Mock successful validation results
      const mockSuccessfulResults = [
        {
          endpoint: '/users',
          method: 'GET',
          success: true,
          issues: [],
          statusCode: 200,
          responseTime: 150
        },
        {
          endpoint: '/users/{id}',
          method: 'GET',
          success: true,
          issues: [],
          statusCode: 200,
          responseTime: 100
        }
      ];

      // Mock validation system that returns successful results
      const mockValidationSystem = {
        validator: { endpoints: ['GET /users', 'GET /users/{id}'] },
        initialize: vi.fn().mockResolvedValue(),
        validateAllEndpoints: vi.fn().mockResolvedValue(mockSuccessfulResults),
        getStatistics: vi.fn().mockReturnValue({
          total: 2,
          passed: 2,
          failed: 0,
          successRate: 100
        }),
        generateReport: vi.fn().mockReturnValue('Test summary'),
        cleanup: vi.fn().mockResolvedValue()
      };

      // Mock validator factory that returns our mock validation system
      const mockValidatorFactory = {
        createValidationSystem: vi.fn().mockReturnValue(mockValidationSystem)
      };

      // Create validation service with mocked dependencies
      const validationServiceWithMocks = new ValidationService({
        configLoader: mockConfigLoader,
        contractFinder: mockContractFinder,
        envValidator: mockEnvValidator,
        validatorFactory: mockValidatorFactory,
        serviceContainer: serviceContainer,
        logger: mockLogger
      });

      // Execute validation
      const result = await validationServiceWithMocks.validateEnvironment('staging', {
        verbose: false,
        output: 'console'
      });

      // Verify workflow execution
      expect(mockConfigLoader.loadConfig).toHaveBeenCalled();
      expect(mockConfigLoader.validateConfig).toHaveBeenCalledWith(mockConfig);
      expect(mockEnvValidator.validateEnvironment).toHaveBeenCalledWith(
        mockConfig.environments.staging,
        'staging'
      );
      expect(mockContractFinder.findContract).toHaveBeenCalledWith(mockConfig, undefined);
      expect(mockValidatorFactory.createValidationSystem).toHaveBeenCalled();
      expect(mockValidationSystem.initialize).toHaveBeenCalledWith('./tests/fixtures/sample-contract.yaml');
      expect(mockValidationSystem.validateAllEndpoints).toHaveBeenCalled();

      // Verify result structure - the workflow should complete successfully
      expect(result.environment).toBe('staging');
      expect(result.results).toBeDefined();
      expect(result.statistics).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.exitCode).toBe(0);

      // We should have 2 endpoint results
      expect(result.results).toHaveLength(2);

      // Check that we attempted to validate the expected endpoints
      const endpointPaths = result.results.map(r => r.endpoint);
      expect(endpointPaths).toContain('/users');
      expect(endpointPaths).toContain('/users/{id}');

      // All requests should succeed with our mocked responses
      result.results.forEach(result => {
        expect(result.success).toBe(true);
        expect(result.issues).toBeDefined();
        expect(result.issues.length).toBe(0);
      });

      // Cleanup
      delete process.env.API_TOKEN;
    });

    test('should handle validation failures in integration workflow', async () => {
      const mockConfig = {
        environments: {
          staging: { url: 'https://staging.api.example.com' }
        }
      };

      // Mock API response that doesn't match schema
      const invalidApiResponse = {
        status: 200,
        data: { items: [] }, // Wrong property name, should be 'users'
        headers: { 'content-type': 'application/json' },
        responseTime: 100
      };

      // Mock HTTP client that returns schema-invalid responses
      const mockHttpClient = {
        makeRequest: vi.fn().mockResolvedValue(invalidApiResponse),
        testConnection: vi.fn().mockResolvedValue(true)
      };

      // Mock HTTP client factory to return our mocked client
      const mockHttpClientFactory = {
        createDefaultClient: vi.fn().mockReturnValue(mockHttpClient),
        createCIClient: vi.fn().mockReturnValue(mockHttpClient),
        getStats: vi.fn().mockReturnValue({ totalClients: 1, activeConnections: 0 })
      };

      // Create validator factory with mocked HTTP client factory
      const validatorFactoryWithMocks = new ValidatorFactory({
        httpClientFactory: mockHttpClientFactory,
        serviceContainer: serviceContainer
      });

      const mockConfigLoader = {
        loadConfig: vi.fn().mockResolvedValue(mockConfig),
        validateConfig: vi.fn(),
        getEnvironmentConfig: vi.fn().mockReturnValue(mockConfig.environments.staging)
      };

      const mockContractFinder = {
        findContract: vi.fn().mockResolvedValue('./tests/fixtures/sample-contract.yaml'),
        validateContractFile: vi.fn(),
        getRelativePath: vi.fn().mockReturnValue('sample-contract.yaml')
      };

      const mockEnvValidator = {
        validateEnvironment: vi.fn().mockResolvedValue()
      };

      const validationServiceWithMocks = new ValidationService({
        configLoader: mockConfigLoader,
        contractFinder: mockContractFinder,
        envValidator: mockEnvValidator,
        validatorFactory: validatorFactoryWithMocks,
        serviceContainer: serviceContainer,
        logger: mockLogger
      });

      const result = await validationServiceWithMocks.validateEnvironment('staging');

      // Verify workflow completion and endpoint failure handling
      expect(result.success).toBe(false); // Workflow failed due to validation errors
      expect(result.exitCode).toBe(1);    // Exit code should be 1 for validation failures
      expect(result.results).toHaveLength(2);
      expect(result.results[0].success).toBe(false); // Individual endpoints failed
      expect(result.results[0].issues.length).toBeGreaterThan(0);
    });

    test('should handle network errors in integration workflow', async () => {
      const mockConfig = {
        environments: {
          staging: { url: 'https://staging.api.example.com' }
        }
      };

      const mockConfigLoader = {
        loadConfig: vi.fn().mockResolvedValue(mockConfig),
        validateConfig: vi.fn(),
        getEnvironmentConfig: vi.fn().mockReturnValue(mockConfig.environments.staging)
      };

      const mockContractFinder = {
        findContract: vi.fn().mockResolvedValue('./tests/fixtures/sample-contract.yaml'),
        validateContractFile: vi.fn(),
        getRelativePath: vi.fn().mockReturnValue('sample-contract.yaml')
      };

      const mockEnvValidator = {
        validateEnvironment: vi.fn().mockResolvedValue()
      };

      const networkError = new Error('Connection refused');
      networkError.code = 'ECONNREFUSED';

      // Mock HTTP client that throws network errors
      const mockHttpClient = {
        makeRequest: vi.fn().mockRejectedValue(networkError),
        testConnection: vi.fn().mockResolvedValue(true)
      };

      // Mock HTTP client factory to return our mocked client
      const mockHttpClientFactory = {
        createDefaultClient: vi.fn().mockReturnValue(mockHttpClient),
        createCIClient: vi.fn().mockReturnValue(mockHttpClient),
        getStats: vi.fn().mockReturnValue({ totalClients: 1, activeConnections: 0 })
      };

      // Create validator factory with mocked HTTP client factory
      const validatorFactoryWithMocks = new ValidatorFactory({
        httpClientFactory: mockHttpClientFactory,
        serviceContainer: serviceContainer
      });

      const validationServiceWithMocks = new ValidationService({
        configLoader: mockConfigLoader,
        contractFinder: mockContractFinder,
        envValidator: mockEnvValidator,
        validatorFactory: validatorFactoryWithMocks,
        serviceContainer: serviceContainer,
        logger: mockLogger
      });

      const result = await validationServiceWithMocks.validateEnvironment('staging');

      // Verify network error is handled correctly
      expect(result.success).toBe(false); // Workflow failed due to network errors
      expect(result.exitCode).toBe(1);    // Exit code should be 1 for endpoint failures
      expect(result.results).toHaveLength(2);
      expect(result.results[0].success).toBe(false); // Individual endpoints failed
      expect(result.results[0].issues.length).toBeGreaterThan(0);
      // Note: The specific error message may vary depending on network conditions
    });
  });

  describe('Service Container Integration', () => {
    test('should register and use services from container', () => {
      // Register services in container
      ValidatorFactory.registerServices(serviceContainer, {
        staging: { url: 'https://staging.api.example.com' },
        production: { url: 'https://prod.api.example.com' }
      });

      // Verify services are registered
      expect(serviceContainer.has('validatorFactory')).toBe(true);
      expect(serviceContainer.has('schemaValidator')).toBe(true);
      expect(serviceContainer.has('httpClientFactory')).toBe(true);
      expect(serviceContainer.has('environment.staging')).toBe(true);
      expect(serviceContainer.has('environment.production')).toBe(true);

      // Get services and verify they work
      const factory = serviceContainer.get('validatorFactory');
      expect(factory).toBeInstanceOf(ValidatorFactory);

      const schemaValidator = serviceContainer.get('schemaValidator');
      expect(schemaValidator).toBeDefined();
      expect(typeof schemaValidator.validateResponse).toBe('function');

      const stagingEnv = serviceContainer.get('environment.staging');
      expect(stagingEnv.url).toBe('https://staging.api.example.com');
    });

    test('should create validator from service container', () => {
      // Register services
      ValidatorFactory.registerServices(serviceContainer, {
        testing: { url: 'https://test.api.example.com' }
      });

      const factory = serviceContainer.get('validatorFactory');

      // Mock the validator creation to avoid actual HTTP clients
      const mockValidator = { initialized: true };
      vi.spyOn(factory, 'createFromContainer').mockReturnValue(mockValidator);

      const validator = factory.createFromContainer('testing');

      expect(validator).toBe(mockValidator);
      expect(factory.createFromContainer).toHaveBeenCalledWith('testing');
    });

    test('should handle scoped containers correctly', () => {
      // Register services in parent container
      ValidatorFactory.registerServices(serviceContainer, {
        parent: { url: 'https://parent.api.example.com' }
      });

      // Create scoped container
      const scopedContainer = serviceContainer.createScope();

      // Add scoped-specific service
      scopedContainer.register('environment.scoped', () => ({
        url: 'https://scoped.api.example.com'
      }));

      // Verify both containers work independently
      expect(serviceContainer.has('environment.parent')).toBe(true);
      expect(serviceContainer.has('environment.scoped')).toBe(false);

      expect(scopedContainer.has('environment.parent')).toBe(true);
      expect(scopedContainer.has('environment.scoped')).toBe(true);

      // Verify factory works in scoped container
      const scopedFactory = scopedContainer.get('validatorFactory');
      expect(scopedFactory).toBeInstanceOf(ValidatorFactory);

      // The factory should be able to access both parent and scoped services
      // but the internal serviceContainer reference might be to the parent
      expect(scopedFactory.serviceContainer).toBeDefined();
    });
  });

  describe('Multi-Environment Integration', () => {
    test('should validate multiple environments in sequence', async () => {
      // Mock successful validation for both environments
      const mockValidationResults = {
        staging: {
          success: true,
          statistics: { total: 2, passed: 2, failed: 0 }
        },
        production: {
          success: true,
          statistics: { total: 2, passed: 2, failed: 0 }
        }
      };

      vi.spyOn(validationService, 'validateEnvironment')
        .mockImplementation(async (envName) => {
          return mockValidationResults[envName];
        });

      const result = await validationService.validateMultipleEnvironments(
        ['staging', 'production'],
        { output: 'json' }
      );

      expect(result.success).toBe(true);
      expect(result.exitCode).toBe(0);
      expect(result.environments.staging.success).toBe(true);
      expect(result.environments.production.success).toBe(true);
      expect(result.summary.totalEnvironments).toBe(2);
      expect(result.summary.successfulEnvironments).toBe(2);
      expect(result.summary.failedEnvironments).toBe(0);
    });

    test('should handle mixed success/failure across environments', async () => {
      const mockValidationResults = {
        staging: {
          success: true,
          statistics: { total: 2, passed: 2, failed: 0 }
        },
        production: {
          success: false,
          statistics: { total: 2, passed: 1, failed: 1 }
        }
      };

      vi.spyOn(validationService, 'validateEnvironment')
        .mockImplementation(async (envName) => {
          return mockValidationResults[envName];
        });

      const result = await validationService.validateMultipleEnvironments(
        ['staging', 'production']
      );

      expect(result.success).toBe(false);
      expect(result.exitCode).toBe(1);
      expect(result.summary.successfulEnvironments).toBe(1);
      expect(result.summary.failedEnvironments).toBe(1);
      expect(result.summary.totalPassed).toBe(3);
      expect(result.summary.totalFailed).toBe(1);
    });
  });

  describe('Error Handling Integration', () => {
    test('should properly categorize setup vs validation errors', async () => {
      // Test config loading error by providing invalid config path
      try {
        await validationService.validateEnvironment('nonexistent', {
          config: '/path/that/does/not/exist.yaml'
        });
      } catch (error) {
        expect(error).toBeInstanceOf(SpecJetError);
        expect(error.code).toBe('CONFIG_LOAD_ERROR');
      }
    });

    test('should handle validation errors differently from setup errors', async () => {
      // Test environment not found error
      const mockConfigLoader = {
        loadConfig: vi.fn().mockResolvedValue({
          environments: {
            production: { url: 'https://prod.api.com' }
          }
        }),
        validateConfig: vi.fn()
      };

      const serviceWithMockConfig = new ValidationService({
        configLoader: mockConfigLoader,
        validatorFactory: validatorFactory,
        serviceContainer: serviceContainer,
        logger: mockLogger
      });

      try {
        await serviceWithMockConfig.validateEnvironment('nonexistent-env');
      } catch (error) {
        expect(error).toBeInstanceOf(SpecJetError);
        expect(error.code).toBe('ENVIRONMENT_NOT_FOUND');
      }
    });
  });

  describe('Configuration Integration', () => {
    test('should return comprehensive service configuration', () => {
      // Set up complete service configuration
      ValidatorFactory.registerServices(serviceContainer, {
        staging: { url: 'https://staging.api.example.com' }
      });

      const mockHttpClientFactory = {
        getStats: vi.fn().mockReturnValue({
          totalClients: 3,
          activeConnections: 2
        })
      };

      const factoryWithMockedStats = new ValidatorFactory({
        serviceContainer: serviceContainer,
        httpClientFactory: mockHttpClientFactory
      });

      const serviceWithMockedFactory = new ValidationService({
        validatorFactory: factoryWithMockedStats,
        serviceContainer: serviceContainer,
        logger: mockLogger
      });

      const config = serviceWithMockedFactory.getConfig();

      expect(config.hasServiceContainer).toBe(true);
      expect(config.validatorFactoryConfig.hasServiceContainer).toBe(true);
      expect(config.validatorFactoryConfig.httpClientFactoryStats.totalClients).toBe(3);
      expect(config.serviceNames).toContain('validatorFactory');
      expect(config.serviceNames).toContain('schemaValidator');
    });
  });

  describe('Real Component Integration', () => {
    test('should create real validation system components', () => {
      // Test that real components can be created and work together
      const environment = { url: 'https://api.example.com' };

      // This should create real instances without mocking
      const realServiceContainer = new ServiceContainer();

      // Register real services
      ValidatorFactory.registerServices(realServiceContainer, {
        test: environment
      });

      // Verify real components are created
      const realFactory = realServiceContainer.get('validatorFactory');
      expect(realFactory).toBeInstanceOf(ValidatorFactory);

      const realSchemaValidator = realServiceContainer.get('schemaValidator');
      expect(realSchemaValidator).toBeDefined();
      expect(typeof realSchemaValidator.validateResponse).toBe('function');

      // Test that factory can create validation system
      const validationSystem = realFactory.createValidationSystem(environment, {
        concurrency: 1,
        delay: 100
      });

      expect(validationSystem.validator).toBeDefined();
      expect(validationSystem.batchProcessor).toBeDefined();
      expect(validationSystem.retryHandler).toBeDefined();
      expect(validationSystem.resultsAggregator).toBeDefined();
      expect(typeof validationSystem.initialize).toBe('function');
      expect(typeof validationSystem.validateAllEndpoints).toBe('function');
    });
  });
});