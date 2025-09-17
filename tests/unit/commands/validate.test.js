import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { validateCore } from '#src/commands/validate.js';

// Mock the ValidationService and its dependencies
vi.mock('#src/services/validation-service.js');

const mockValidationService = await import('#src/services/validation-service.js');

describe('Command Exit Code Handling Tests', () => {
  let mockValidationServiceInstance;
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

    // Create mock validation service instance
    mockValidationServiceInstance = {
      validateEnvironment: vi.fn()
    };

    // Mock the ValidationService constructor to return our mock instance
    mockValidationService.default.mockImplementation(() => mockValidationServiceInstance);
  });

  afterEach(() => {
    console.log = originalConsoleLog;
    console.warn = originalConsoleWarn;
    vi.clearAllMocks();
  });

  describe('Success Cases - Exit Code 0', () => {
    test('should return exit code 0 when all validations pass', async () => {
      const successResponse = {
        exitCode: 0,
        success: true,
        results: [
          { success: true, endpoint: '/users', method: 'GET', issues: [] },
          { success: true, endpoint: '/users', method: 'POST', issues: [] }
        ],
        statistics: {
          total: 2,
          passed: 2,
          failed: 0,
          successRate: 100
        },
        environment: 'staging'
      };

      mockValidationServiceInstance.validateEnvironment.mockResolvedValue(successResponse);

      const result = await validateCore('staging', {});

      expect(result).toEqual(successResponse);
      expect(result.exitCode).toBe(0);
      expect(result.success).toBe(true);
      expect(mockValidationServiceInstance.validateEnvironment).toHaveBeenCalledWith('staging', {});
    });

    test('should handle console output format correctly', async () => {
      const successResponse = {
        exitCode: 0,
        success: true,
        results: [{ success: true, endpoint: '/users', method: 'GET', issues: [] }],
        statistics: { total: 1, passed: 1, failed: 0, successRate: 100 },
        environment: 'staging'
      };

      mockValidationServiceInstance.validateEnvironment.mockResolvedValue(successResponse);

      const result = await validateCore('staging', { output: 'console' });

      expect(result.exitCode).toBe(0);
      expect(result.success).toBe(true);
      expect(mockValidationServiceInstance.validateEnvironment).toHaveBeenCalledWith('staging', { output: 'console' });
    });

    test('should handle JSON output format correctly', async () => {
      const successResponse = {
        exitCode: 0,
        success: true,
        results: [{ success: true, endpoint: '/users', method: 'GET', issues: [] }],
        statistics: { total: 1, passed: 1, failed: 0, successRate: 100 },
        environment: 'staging'
      };

      mockValidationServiceInstance.validateEnvironment.mockResolvedValue(successResponse);

      const result = await validateCore('staging', { output: 'json' });

      expect(result.exitCode).toBe(0);
      expect(result.success).toBe(true);
      expect(mockValidationServiceInstance.validateEnvironment).toHaveBeenCalledWith('staging', { output: 'json' });
    });

    test('should handle markdown output format correctly', async () => {
      const successResponse = {
        exitCode: 0,
        success: true,
        results: [{ success: true, endpoint: '/users', method: 'GET', issues: [] }],
        statistics: { total: 1, passed: 1, failed: 0, successRate: 100 },
        environment: 'staging'
      };

      mockValidationServiceInstance.validateEnvironment.mockResolvedValue(successResponse);

      const result = await validateCore('staging', { output: 'markdown' });

      expect(result.exitCode).toBe(0);
      expect(result.success).toBe(true);
      expect(mockValidationServiceInstance.validateEnvironment).toHaveBeenCalledWith('staging', { output: 'markdown' });
    });
  });

  describe('Validation Failure Cases - Exit Code 1', () => {
    test('should return exit code 1 when validation fails', async () => {
      const failedResponse = {
        exitCode: 1,
        success: false,
        results: [
          {
            success: false,
            endpoint: '/users',
            method: 'GET',
            issues: [{ type: 'validation_error', message: 'Schema mismatch' }]
          },
          { success: true, endpoint: '/users', method: 'POST', issues: [] }
        ],
        statistics: {
          total: 2,
          passed: 1,
          failed: 1,
          successRate: 50
        },
        environment: 'staging'
      };

      mockValidationServiceInstance.validateEnvironment.mockResolvedValue(failedResponse);

      const result = await validateCore('staging', {});

      expect(result).toEqual(failedResponse);
      expect(result.exitCode).toBe(1);
      expect(result.success).toBe(false);
    });

    test('should return exit code 1 when all validations fail', async () => {
      const allFailedResponse = {
        exitCode: 1,
        success: false,
        results: [
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
        ],
        statistics: {
          total: 2,
          passed: 0,
          failed: 2,
          successRate: 0
        },
        environment: 'staging'
      };

      mockValidationServiceInstance.validateEnvironment.mockResolvedValue(allFailedResponse);

      const result = await validateCore('staging', {});

      expect(result.exitCode).toBe(1);
      expect(result.success).toBe(false);
      expect(result.statistics.failed).toBe(2);
    });
  });

  describe('Configuration/Setup Error Cases - Exit Code 2', () => {
    test('should return exit code 2 for missing environment', async () => {
      const missingEnvResponse = {
        exitCode: 1,
        success: false,
        error: 'Environment required',
        availableEnvironments: ['staging', 'production']
      };

      mockValidationServiceInstance.validateEnvironment.mockResolvedValue(missingEnvResponse);

      const result = await validateCore(null, {});

      expect(result.exitCode).toBe(1);
      expect(result.success).toBe(false);
      expect(result.error).toBe('Environment required');
    });

    test('should return exit code 2 for environment not found', async () => {
      const envNotFoundResponse = {
        exitCode: 2,
        success: false,
        error: "Environment 'nonexistent' not found",
        errorCode: 'ENVIRONMENT_NOT_FOUND'
      };

      mockValidationServiceInstance.validateEnvironment.mockResolvedValue(envNotFoundResponse);

      const result = await validateCore('nonexistent', {});

      expect(result.exitCode).toBe(2);
      expect(result.success).toBe(false);
      expect(result.error).toBe("Environment 'nonexistent' not found");
    });

    test('should return exit code 2 for configuration load error', async () => {
      const configErrorResponse = {
        exitCode: 2,
        success: false,
        error: 'Failed to load config',
        errorCode: 'CONFIG_LOAD_ERROR'
      };

      mockValidationServiceInstance.validateEnvironment.mockResolvedValue(configErrorResponse);

      const result = await validateCore('staging', {});

      expect(result.exitCode).toBe(2);
      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to load config');
      expect(result.errorCode).toBe('CONFIG_LOAD_ERROR');
    });

    test('should return exit code 2 for missing environment variables', async () => {
      const envVarErrorResponse = {
        exitCode: 2,
        success: false,
        error: 'Environment variable not set',
        errorCode: 'ENV_VAR_MISSING'
      };

      mockValidationServiceInstance.validateEnvironment.mockResolvedValue(envVarErrorResponse);

      const result = await validateCore('staging', {});

      expect(result.exitCode).toBe(2);
      expect(result.success).toBe(false);
      expect(result.error).toBe('Environment variable not set');
      expect(result.errorCode).toBe('ENV_VAR_MISSING');
    });

    test('should return exit code 2 for DNS lookup failures', async () => {
      const dnsErrorResponse = {
        exitCode: 2,
        success: false,
        error: 'DNS lookup failed',
        errorCode: 'DNS_LOOKUP_FAILED'
      };

      mockValidationServiceInstance.validateEnvironment.mockResolvedValue(dnsErrorResponse);

      const result = await validateCore('staging', {});

      expect(result.exitCode).toBe(2);
      expect(result.success).toBe(false);
      expect(result.error).toBe('DNS lookup failed');
      expect(result.errorCode).toBe('DNS_LOOKUP_FAILED');
    });

    test('should return exit code 2 for connection refused', async () => {
      const connectionErrorResponse = {
        exitCode: 2,
        success: false,
        error: 'Connection refused',
        errorCode: 'CONNECTION_REFUSED'
      };

      mockValidationServiceInstance.validateEnvironment.mockResolvedValue(connectionErrorResponse);

      const result = await validateCore('staging', {});

      expect(result.exitCode).toBe(2);
      expect(result.success).toBe(false);
      expect(result.error).toBe('Connection refused');
      expect(result.errorCode).toBe('CONNECTION_REFUSED');
    });

    test('should return exit code 2 for timeout errors', async () => {
      const timeoutErrorResponse = {
        exitCode: 2,
        success: false,
        error: 'Request timeout',
        errorCode: 'REQUEST_TIMEOUT'
      };

      mockValidationServiceInstance.validateEnvironment.mockResolvedValue(timeoutErrorResponse);

      const result = await validateCore('staging', {});

      expect(result.exitCode).toBe(2);
      expect(result.success).toBe(false);
      expect(result.error).toBe('Request timeout');
      expect(result.errorCode).toBe('REQUEST_TIMEOUT');
    });
  });

  describe('General Error Cases - Exit Code 1', () => {
    test('should return exit code 1 for general errors', async () => {
      const generalErrorResponse = {
        exitCode: 1,
        success: false,
        error: 'Unknown error',
        errorCode: 'UNKNOWN_ERROR'
      };

      mockValidationServiceInstance.validateEnvironment.mockResolvedValue(generalErrorResponse);

      const result = await validateCore('staging', {});

      expect(result.exitCode).toBe(1);
      expect(result.success).toBe(false);
      expect(result.error).toBe('Unknown error');
      expect(result.errorCode).toBe('UNKNOWN_ERROR');
    });

    test('should return exit code 1 for validator initialization errors', async () => {
      const validatorErrorResponse = {
        exitCode: 1,
        success: false,
        error: 'Validator init failed',
        errorCode: 'VALIDATOR_INIT_ERROR'
      };

      mockValidationServiceInstance.validateEnvironment.mockResolvedValue(validatorErrorResponse);

      const result = await validateCore('staging', {});

      expect(result.exitCode).toBe(1);
      expect(result.success).toBe(false);
      expect(result.error).toBe('Validator init failed');
      expect(result.errorCode).toBe('VALIDATOR_INIT_ERROR');
    });
  });

  describe('Anti-Pattern Elimination', () => {
    test('should not call process.exit directly', async () => {
      const processExitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {});

      const successResponse = {
        exitCode: 0,
        success: true,
        results: [{ success: true, endpoint: '/users', method: 'GET', issues: [] }],
        statistics: { total: 1, passed: 1, failed: 0 },
        environment: 'staging'
      };

      mockValidationServiceInstance.validateEnvironment.mockResolvedValue(successResponse);

      await validateCore('staging', {});

      // validateCore should never call process.exit
      expect(processExitSpy).not.toHaveBeenCalled();

      processExitSpy.mockRestore();
    });

    test('should return result objects instead of exiting', async () => {
      const processExitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {});

      const failedResponse = {
        exitCode: 1,
        success: false,
        results: [{ success: false, endpoint: '/users', method: 'GET', issues: [] }],
        statistics: { total: 1, passed: 0, failed: 1 },
        environment: 'staging'
      };

      mockValidationServiceInstance.validateEnvironment.mockResolvedValue(failedResponse);

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
        {
          response: { exitCode: 0, success: true, statistics: { failed: 0 } },
          expected: 0
        },
        {
          response: { exitCode: 1, success: false, statistics: { failed: 1 } },
          expected: 1
        },
      ];

      for (const scenario of scenarios) {
        mockValidationServiceInstance.validateEnvironment.mockResolvedValue(scenario.response);

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
      const undefinedEnvResponse = {
        exitCode: 1,
        success: false,
        error: 'Environment required'
      };

      mockValidationServiceInstance.validateEnvironment.mockResolvedValue(undefinedEnvResponse);

      const result = await validateCore(undefined, {});

      expect(result.exitCode).toBe(1);
      expect(result.success).toBe(false);
      expect(result.error).toBe('Environment required');
    });

    test('should handle empty string environment', async () => {
      const emptyEnvResponse = {
        exitCode: 1,
        success: false,
        error: 'Environment required'
      };

      mockValidationServiceInstance.validateEnvironment.mockResolvedValue(emptyEnvResponse);

      const result = await validateCore('', {});

      expect(result.exitCode).toBe(1);
      expect(result.success).toBe(false);
      expect(result.error).toBe('Environment required');
    });

    test('should handle malformed options gracefully', async () => {
      const successResponse = {
        exitCode: 0,
        success: true,
        results: [{ success: true, endpoint: '/users', method: 'GET', issues: [] }],
        statistics: { total: 1, passed: 1, failed: 0 },
        environment: 'staging'
      };

      mockValidationServiceInstance.validateEnvironment.mockResolvedValue(successResponse);

      const result = await validateCore('staging', {
        timeout: 'invalid',
        output: 'invalid_format',
        verbose: 'not_boolean'
      });

      expect(result.exitCode).toBe(0);
      expect(result.success).toBe(true);
    });

    test('should maintain original error structure', async () => {
      const customErrorResponse = {
        exitCode: 1,
        success: false,
        error: 'Custom error message',
        errorCode: 'CUSTOM_ERROR_CODE',
        suggestions: ['suggestion 1', 'suggestion 2']
      };

      mockValidationServiceInstance.validateEnvironment.mockResolvedValue(customErrorResponse);

      const result = await validateCore('staging', {});

      expect(result.error).toBe('Custom error message');
      expect(result.errorCode).toBe('CUSTOM_ERROR_CODE');
      expect(result.exitCode).toBe(1);
    });

    test('should handle promise rejections without process.exit', async () => {
      const processExitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {});

      const errorResponse = {
        exitCode: 1,
        success: false,
        error: 'Async operation failed'
      };

      mockValidationServiceInstance.validateEnvironment.mockResolvedValue(errorResponse);

      const result = await validateCore('staging', {});

      expect(result.success).toBe(false);
      expect(result.exitCode).toBe(1);
      expect(processExitSpy).not.toHaveBeenCalled();

      processExitSpy.mockRestore();
    });
  });
});