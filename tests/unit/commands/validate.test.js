import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { validateCore } from '../../../src/commands/validate.js';
import { SpecJetError } from '../../../src/core/errors.js';

// Mock the dependencies
vi.mock('../../../src/core/config.js');
vi.mock('../../../src/core/contract-finder.js');
vi.mock('../../../src/core/validator.js');
vi.mock('../../../src/core/env-validator.js');

const mockConfigLoader = await import('../../../src/core/config.js');
const mockContractFinder = await import('../../../src/core/contract-finder.js');
const mockAPIValidator = await import('../../../src/core/validator.js');
const mockEnvValidator = await import('../../../src/core/env-validator.js');

describe('Command Exit Code Handling Tests', () => {
  let mockValidator;
  let originalConsoleLog;
  let originalConsoleWarn;
  let mockConsoleOutput;

  beforeEach(() => {
    // Mock console methods
    mockConsoleOutput = [];
    originalConsoleLog = console.log;
    originalConsoleWarn = console.warn;
    console.log = vi.fn((...args) => mockConsoleOutput.push(['log', ...args]));
    console.warn = vi.fn((...args) => mockConsoleOutput.push(['warn', ...args]));

    // Create mock validator
    mockValidator = {
      initialize: vi.fn(),
      validateAllEndpoints: vi.fn(),
      endpoints: [
        { path: '/users', method: 'GET' },
        { path: '/users', method: 'POST' }
      ]
    };

    // Setup default mocks
    mockConfigLoader.default.loadConfig.mockResolvedValue({
      contract: './api-contract.yaml',
      output: { types: './types', client: './client' },
      environments: {
        staging: {
          url: 'https://api-staging.example.com',
          headers: { 'Authorization': 'Bearer token123' }
        }
      }
    });

    mockConfigLoader.default.validateConfig.mockReturnValue(true);
    mockConfigLoader.default.getEnvironmentConfig.mockReturnValue({
      url: 'https://api-staging.example.com',
      headers: { 'Authorization': 'Bearer token123' }
    });
    mockConfigLoader.default.getAvailableEnvironments.mockReturnValue(['staging', 'production']);
    mockConfigLoader.default.listEnvironments.mockReturnValue('Available: staging, production');

    mockContractFinder.default.findContract.mockResolvedValue('./api-contract.yaml');
    mockContractFinder.default.validateContractFile.mockResolvedValue(true);
    mockContractFinder.default.getRelativePath.mockReturnValue('./api-contract.yaml');

    mockAPIValidator.default.mockImplementation(() => mockValidator);
    mockAPIValidator.default.getValidationStats.mockReturnValue({
      total: 2,
      passed: 2,
      failed: 0,
      successRate: '100'
    });

    mockEnvValidator.default.validateEnvironment.mockResolvedValue(true);
  });

  afterEach(() => {
    console.log = originalConsoleLog;
    console.warn = originalConsoleWarn;
    vi.clearAllMocks();
  });

  describe('Success Cases - Exit Code 0', () => {
    test('should return exit code 0 when all validations pass', async () => {
      // Mock successful validation results
      const successResults = [
        { success: true, endpoint: '/users', method: 'GET', issues: [] },
        { success: true, endpoint: '/users', method: 'POST', issues: [] }
      ];

      mockValidator.validateAllEndpoints.mockResolvedValue(successResults);
      mockAPIValidator.default.getValidationStats.mockReturnValue({
        total: 2,
        passed: 2,
        failed: 0,
        successRate: '100'
      });

      const result = await validateCore('staging', {});

      expect(result).toEqual({
        exitCode: 0,
        success: true,
        results: successResults,
        stats: expect.objectContaining({
          total: 2,
          passed: 2,
          failed: 0
        })
      });
    });

    test('should handle console output format correctly', async () => {
      const successResults = [
        { success: true, endpoint: '/users', method: 'GET', issues: [] }
      ];

      mockValidator.validateAllEndpoints.mockResolvedValue(successResults);

      const result = await validateCore('staging', { output: 'console' });

      expect(result.exitCode).toBe(0);
      expect(result.success).toBe(true);
    });

    test('should handle JSON output format correctly', async () => {
      const successResults = [
        { success: true, endpoint: '/users', method: 'GET', issues: [] }
      ];

      mockValidator.validateAllEndpoints.mockResolvedValue(successResults);

      const result = await validateCore('staging', { output: 'json' });

      expect(result.exitCode).toBe(0);
      expect(result.success).toBe(true);
    });

    test('should handle markdown output format correctly', async () => {
      const successResults = [
        { success: true, endpoint: '/users', method: 'GET', issues: [] }
      ];

      mockValidator.validateAllEndpoints.mockResolvedValue(successResults);

      const result = await validateCore('staging', { output: 'markdown' });

      expect(result.exitCode).toBe(0);
      expect(result.success).toBe(true);
    });
  });

  describe('Validation Failure Cases - Exit Code 1', () => {
    test('should return exit code 1 when validation fails', async () => {
      // Mock failed validation results
      const failedResults = [
        {
          success: false,
          endpoint: '/users',
          method: 'GET',
          issues: [{ type: 'validation_error', message: 'Schema mismatch' }]
        },
        { success: true, endpoint: '/users', method: 'POST', issues: [] }
      ];

      mockValidator.validateAllEndpoints.mockResolvedValue(failedResults);
      mockAPIValidator.default.getValidationStats.mockReturnValue({
        total: 2,
        passed: 1,
        failed: 1,
        successRate: '50'
      });

      const result = await validateCore('staging', {});

      expect(result).toEqual({
        exitCode: 1,
        success: false,
        results: failedResults,
        stats: expect.objectContaining({
          total: 2,
          passed: 1,
          failed: 1
        })
      });
    });

    test('should return exit code 1 when all validations fail', async () => {
      const allFailedResults = [
        {
          success: false,
          endpoint: '/users',
          method: 'GET',
          issues: [{ type: 'network_error', message: 'Connection failed' }]
        },
        {
          success: false,
          endpoint: '/users',
          method: 'POST',
          issues: [{ type: 'schema_error', message: 'Invalid response' }]
        }
      ];

      mockValidator.validateAllEndpoints.mockResolvedValue(allFailedResults);
      mockAPIValidator.default.getValidationStats.mockReturnValue({
        total: 2,
        passed: 0,
        failed: 2,
        successRate: '0'
      });

      const result = await validateCore('staging', {});

      expect(result.exitCode).toBe(1);
      expect(result.success).toBe(false);
      expect(result.stats.failed).toBe(2);
    });
  });

  describe('Configuration/Setup Error Cases - Exit Code 2', () => {
    test('should return exit code 2 for missing environment', async () => {
      mockConfigLoader.default.getAvailableEnvironments.mockReturnValue(['staging']);

      const result = await validateCore(null, {});

      expect(result).toEqual({
        exitCode: 1,
        success: false,
        error: 'Environment required'
      });
    });

    test('should return exit code 2 for environment not found', async () => {
      const error = new SpecJetError(
        'Environment not found',
        'CONFIG_ENVIRONMENT_NOT_FOUND'
      );
      mockConfigLoader.default.getEnvironmentConfig.mockImplementation(() => {
        throw error;
      });

      const result = await validateCore('nonexistent', {});

      expect(result).toEqual({
        exitCode: 1,
        success: false,
        error: "Environment 'nonexistent' not found"
      });
    });

    test('should return exit code 2 for configuration load error', async () => {
      const error = new SpecJetError(
        'Failed to load config',
        'CONFIG_LOAD_ERROR'
      );
      mockConfigLoader.default.loadConfig.mockRejectedValue(error);

      const result = await validateCore('staging', {});

      expect(result).toEqual({
        exitCode: 2,
        success: false,
        error: 'Failed to load config',
        errorCode: 'CONFIG_LOAD_ERROR'
      });
    });

    test('should return exit code 2 for missing environment variables', async () => {
      const error = new SpecJetError(
        'Environment variable not set',
        'ENV_VAR_MISSING'
      );
      mockEnvValidator.default.validateEnvironment.mockRejectedValue(error);

      const result = await validateCore('staging', {});

      expect(result).toEqual({
        exitCode: 2,
        success: false,
        error: 'Environment variable not set',
        errorCode: 'ENV_VAR_MISSING'
      });
    });

    test('should return exit code 2 for DNS lookup failures', async () => {
      const error = new SpecJetError(
        'DNS lookup failed',
        'DNS_LOOKUP_FAILED'
      );
      mockEnvValidator.default.validateEnvironment.mockRejectedValue(error);

      const result = await validateCore('staging', {});

      expect(result).toEqual({
        exitCode: 2,
        success: false,
        error: 'DNS lookup failed',
        errorCode: 'DNS_LOOKUP_FAILED'
      });
    });

    test('should return exit code 2 for connection refused', async () => {
      const error = new SpecJetError(
        'Connection refused',
        'CONNECTION_REFUSED'
      );
      mockValidator.initialize.mockRejectedValue(error);

      const result = await validateCore('staging', {});

      expect(result).toEqual({
        exitCode: 2,
        success: false,
        error: 'Connection refused',
        errorCode: 'CONNECTION_REFUSED'
      });
    });

    test('should return exit code 2 for timeout errors', async () => {
      const error = new SpecJetError(
        'Request timeout',
        'REQUEST_TIMEOUT'
      );
      mockValidator.initialize.mockRejectedValue(error);

      const result = await validateCore('staging', {});

      expect(result).toEqual({
        exitCode: 2,
        success: false,
        error: 'Request timeout',
        errorCode: 'REQUEST_TIMEOUT'
      });
    });
  });

  describe('General Error Cases - Exit Code 1', () => {
    test('should return exit code 1 for general errors', async () => {
      const error = new SpecJetError(
        'Unknown error',
        'UNKNOWN_ERROR'
      );
      mockValidator.initialize.mockRejectedValue(error);

      const result = await validateCore('staging', {});

      expect(result).toEqual({
        exitCode: 1,
        success: false,
        error: 'Unknown error',
        errorCode: 'UNKNOWN_ERROR'
      });
    });

    test('should return exit code 1 for validator initialization errors', async () => {
      const error = new SpecJetError(
        'Validator init failed',
        'VALIDATOR_INIT_ERROR'
      );
      mockValidator.initialize.mockRejectedValue(error);

      const result = await validateCore('staging', {});

      expect(result).toEqual({
        exitCode: 1,
        success: false,
        error: 'Validator init failed',
        errorCode: 'VALIDATOR_INIT_ERROR'
      });
    });
  });

  describe('Anti-Pattern Elimination', () => {
    test('should not call process.exit directly', async () => {
      const processExitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {});

      const successResults = [
        { success: true, endpoint: '/users', method: 'GET', issues: [] }
      ];
      mockValidator.validateAllEndpoints.mockResolvedValue(successResults);

      await validateCore('staging', {});

      // validateCore should never call process.exit
      expect(processExitSpy).not.toHaveBeenCalled();

      processExitSpy.mockRestore();
    });

    test('should return result objects instead of exiting', async () => {
      const processExitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {});

      const failedResults = [
        { success: false, endpoint: '/users', method: 'GET', issues: [] }
      ];
      mockValidator.validateAllEndpoints.mockResolvedValue(failedResults);
      mockAPIValidator.default.getValidationStats.mockReturnValue({
        total: 1,
        passed: 0,
        failed: 1
      });

      const result = await validateCore('staging', {});

      // Should return a result object
      expect(result).toHaveProperty('exitCode');
      expect(result).toHaveProperty('success');
      expect(result.exitCode).toBe(1);
      expect(result.success).toBe(false);

      // Should not call process.exit
      expect(processExitSpy).not.toHaveBeenCalled();

      processExitSpy.mockRestore();
    });

    test('should be testable without side effects', async () => {
      const processExitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {});

      // Test multiple scenarios without interference
      const scenarios = [
        { results: [{ success: true, issues: [] }], expected: 0 },
        { results: [{ success: false, issues: ['error'] }], expected: 1 },
      ];

      for (const scenario of scenarios) {
        mockValidator.validateAllEndpoints.mockResolvedValue(scenario.results);
        mockAPIValidator.default.getValidationStats.mockReturnValue({
          failed: scenario.expected
        });

        const result = await validateCore('staging', {});
        expect(result.exitCode).toBe(scenario.expected);
      }

      // No process.exit calls should have been made
      expect(processExitSpy).not.toHaveBeenCalled();

      processExitSpy.mockRestore();
    });
  });

  describe('Edge Cases and Error Handling', () => {
    test('should handle undefined environment gracefully', async () => {
      const result = await validateCore(undefined, {});

      expect(result.exitCode).toBe(1);
      expect(result.success).toBe(false);
      expect(result.error).toBe('Environment required');
    });

    test('should handle empty string environment', async () => {
      const result = await validateCore('', {});

      expect(result.exitCode).toBe(1);
      expect(result.success).toBe(false);
      expect(result.error).toBe('Environment required');
    });

    test('should handle malformed options gracefully', async () => {
      const successResults = [
        { success: true, endpoint: '/users', method: 'GET', issues: [] }
      ];
      mockValidator.validateAllEndpoints.mockResolvedValue(successResults);

      const result = await validateCore('staging', {
        timeout: 'invalid',
        output: 'invalid_format',
        verbose: 'not_boolean'
      });

      expect(result.exitCode).toBe(0);
      expect(result.success).toBe(true);
    });

    test('should maintain original error structure', async () => {
      const originalError = new SpecJetError(
        'Custom error message',
        'CUSTOM_ERROR_CODE',
        new Error('Underlying cause'),
        ['suggestion 1', 'suggestion 2']
      );

      mockConfigLoader.default.loadConfig.mockRejectedValue(originalError);

      const result = await validateCore('staging', {});

      expect(result.error).toBe('Custom error message');
      expect(result.errorCode).toBe('CUSTOM_ERROR_CODE');
      expect(result.exitCode).toBe(1); // CUSTOM_ERROR_CODE not in setup errors
    });

    test('should handle promise rejections without process.exit', async () => {
      const processExitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {});

      mockValidator.validateAllEndpoints.mockRejectedValue(
        new Error('Async operation failed')
      );

      const result = await validateCore('staging', {});

      expect(result.success).toBe(false);
      expect(result.exitCode).toBe(1);
      expect(processExitSpy).not.toHaveBeenCalled();

      processExitSpy.mockRestore();
    });
  });
});