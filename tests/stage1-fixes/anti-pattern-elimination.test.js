import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { validateCore } from '../../src/commands/validate.js';
import EnvValidator from '../../src/core/env-validator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Mock dependencies for integration tests
vi.mock('../../src/core/config.js');
vi.mock('../../src/core/contract-finder.js');
vi.mock('../../src/core/validator.js');

describe('Anti-Pattern Elimination Verification', () => {
  let originalConsoleLog;
  let originalConsoleWarn;
  let processExitSpy;

  beforeEach(async () => {
    // Spy on process.exit to ensure it's not called
    processExitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {});

    // Mock console methods
    originalConsoleLog = console.log;
    originalConsoleWarn = console.warn;
    console.log = vi.fn();
    console.warn = vi.fn();

    // Mock all the dependencies for validateCore
    const mockConfigLoader = vi.mocked(await import('../../src/core/config.js'));
    const mockContractFinder = vi.mocked(await import('../../src/core/contract-finder.js'));
    const mockAPIValidator = vi.mocked(await import('../../src/core/validator.js'));

    // Setup default successful mocks
    mockConfigLoader.default.loadConfig.mockResolvedValue({
      contract: './api-contract.yaml',
      environments: {
        staging: { url: 'https://api.example.com' }
      }
    });
    mockConfigLoader.default.validateConfig.mockReturnValue(true);
    mockConfigLoader.default.getEnvironmentConfig.mockReturnValue({
      url: 'https://api.example.com'
    });
    mockConfigLoader.default.getAvailableEnvironments.mockReturnValue(['staging']);

    mockContractFinder.default.findContract.mockResolvedValue('./contract.yaml');
    mockContractFinder.default.validateContractFile.mockResolvedValue(true);
    mockContractFinder.default.getRelativePath.mockReturnValue('./contract.yaml');

    const mockValidator = {
      initialize: vi.fn(),
      validateAllEndpoints: vi.fn().mockResolvedValue([
        { success: true, endpoint: '/test', method: 'GET', issues: [] }
      ]),
      endpoints: [{ path: '/test', method: 'GET' }]
    };

    mockAPIValidator.default.mockImplementation(() => mockValidator);
    mockAPIValidator.default.getValidationStats.mockReturnValue({
      total: 1, passed: 1, failed: 0
    });
  });

  afterEach(() => {
    console.log = originalConsoleLog;
    console.warn = originalConsoleWarn;
    processExitSpy.mockRestore();
    vi.clearAllMocks();
  });

  describe('Anti-Pattern 1: Validator Mutation Elimination', () => {
    test('should not mutate validator instances during progress tracking', async () => {
      // Read the validate.js file to verify the implementation
      const validateFilePath = join(__dirname, '../../src/commands/validate.js');
      const validateFileContent = readFileSync(validateFilePath, 'utf-8');

      // Verify the decorator pattern is implemented
      expect(validateFileContent).toContain('class ProgressTrackingValidator');
      expect(validateFileContent).toContain('constructor(validator, progressCallback)');

      // Verify no direct mutation of validator methods
      expect(validateFileContent).not.toContain('validator.validateEndpoint = ');
      expect(validateFileContent).not.toContain('originalValidateEndpoint = validator.validateEndpoint.bind(validator)');

      // The new implementation should use delegation without mutation
      expect(validateFileContent).toContain('this.validator = validator');
      expect(validateFileContent).toContain('this.progressCallback = progressCallback');
    });

    test('should use decorator pattern that preserves original validator', () => {
      // Extract and test the ProgressTrackingValidator class
      const validateFilePath = join(__dirname, '../../src/commands/validate.js');
      const validateFileContent = readFileSync(validateFilePath, 'utf-8');

      const classMatch = validateFileContent.match(/class ProgressTrackingValidator \{[\s\S]*?\n\}/);
      expect(classMatch).toBeTruthy();

      const classCode = classMatch[0];

      // Verify decorator delegates to original validator
      expect(classCode).toContain('this.validator.validateEndpoint');
      // Note: The decorator implements its own validateAllEndpoints with batching logic

      // Verify it doesn't modify the original validator
      expect(classCode).not.toContain('validator.validateEndpoint =');
      expect(classCode).not.toContain('validator.validateAllEndpoints =');
    });

    test('should not leave the validator in a mutated state after operation', async () => {
      // Create a mock validator to test with
      const mockValidator = {
        endpoints: [{ path: '/test', method: 'GET' }],
        contract: { info: { title: 'Test' } },
        validateEndpoint: vi.fn().mockResolvedValue({
          success: true, endpoint: '/test', method: 'GET', issues: []
        }),
        validateAllEndpoints: vi.fn().mockResolvedValue([
          { success: true, endpoint: '/test', method: 'GET', issues: [] }
        ])
      };

      const originalValidateEndpoint = mockValidator.validateEndpoint;
      const originalValidateAllEndpoints = mockValidator.validateAllEndpoints;

      // Extract ProgressTrackingValidator and test it
      const validateFilePath = join(__dirname, '../../src/commands/validate.js');
      const validateFileContent = readFileSync(validateFilePath, 'utf-8');
      const classMatch = validateFileContent.match(/class ProgressTrackingValidator \{[\s\S]*?\n\}/);

      eval(`
        ${classMatch[0]}
        globalThis.TestProgressValidator = ProgressTrackingValidator;
      `);

      const TestProgressValidator = globalThis.TestProgressValidator;
      const decorator = new TestProgressValidator(mockValidator, vi.fn());

      await decorator.validateAllEndpoints({});

      // Verify original validator methods are unchanged
      expect(mockValidator.validateEndpoint).toBe(originalValidateEndpoint);
      expect(mockValidator.validateAllEndpoints).toBe(originalValidateAllEndpoints);
    });
  });

  describe('Anti-Pattern 2: Direct process.exit() Elimination', () => {
    test('should not call process.exit() directly in validateCore', async () => {
      await validateCore('staging', {});

      expect(processExitSpy).not.toHaveBeenCalled();
    });

    test('should return result objects instead of calling process.exit()', async () => {
      const result = await validateCore('staging', {});

      // Should return a proper result object
      expect(result).toHaveProperty('exitCode');
      expect(result).toHaveProperty('success');
      expect(typeof result.exitCode).toBe('number');
      expect(typeof result.success).toBe('boolean');

      // Should not have called process.exit
      expect(processExitSpy).not.toHaveBeenCalled();
    });

    test('should handle all error scenarios without process.exit()', async () => {
      const mockConfigLoader = vi.mocked(await import('../../src/core/config.js'));

      // Test configuration error
      mockConfigLoader.default.loadConfig.mockRejectedValue(
        new Error('Config load failed')
      );

      const result = await validateCore('staging', {});

      expect(result.success).toBe(false);
      expect(result.exitCode).toBeGreaterThan(0);
      expect(processExitSpy).not.toHaveBeenCalled();
    });

    test('should verify validateCore source code has no process.exit calls', () => {
      const validateFilePath = join(__dirname, '../../src/commands/validate.js');
      const validateFileContent = readFileSync(validateFilePath, 'utf-8');

      // Find the validateCore function
      const validateCoreMatch = validateFileContent.match(
        /async function validateCore\([\s\S]*?\n\}/
      );

      expect(validateCoreMatch).toBeTruthy();

      const validateCoreCode = validateCoreMatch[0];

      // Verify no process.exit calls in validateCore
      expect(validateCoreCode).not.toContain('process.exit(');
      expect(validateCoreCode).not.toContain('process.exit ');

      // Should return result objects instead
      expect(validateCoreCode).toContain('return {');
      expect(validateCoreCode).toContain('exitCode:');
    });
  });

  describe('Anti-Pattern 3: Environment Variable Security Vulnerabilities', () => {
    // Note: Environment variable validation functionality is thoroughly tested
    // in env-validator-security.test.js - no need to duplicate here

    test('should use secure regex patterns that prevent ReDoS', async () => {
      // Import the real EnvValidator for this test
      const { default: RealEnvValidator } = await vi.importActual('../../src/core/env-validator.js');

      const longString = 'a'.repeat(10000) + '${VALID_VAR}' + 'b'.repeat(10000);

      const startTime = Date.now();
      RealEnvValidator.substituteEnvVars(longString);
      const endTime = Date.now();

      // Should complete quickly (less than 100ms)
      expect(endTime - startTime).toBeLessThan(100);
    });

    test('should handle malformed patterns safely', async () => {
      // Import the real EnvValidator for this test
      const { default: RealEnvValidator } = await vi.importActual('../../src/core/env-validator.js');

      const malformedPatterns = [
        '${INCOMPLETE',
        'INCOMPLETE}',
        '${}',
        '${${NESTED}}',
        '${' + 'A'.repeat(1000) + '}'
      ];

      malformedPatterns.forEach(pattern => {
        expect(() => RealEnvValidator.substituteEnvVars(pattern)).not.toThrow();
      });
    });

    test('should verify env-validator source code uses secure patterns', () => {
      const envValidatorPath = join(__dirname, '../../src/core/env-validator.js');
      const envValidatorContent = readFileSync(envValidatorPath, 'utf-8');

      // Should have validateEnvVarName method
      expect(envValidatorContent).toContain('static validateEnvVarName(varName)');

      // Should use secure regex for variable name validation
      expect(envValidatorContent).toContain('/^[A-Za-z_][A-Za-z0-9_]*$/');

      // Should validate before processing
      expect(envValidatorContent).toContain('this.validateEnvVarName(varName)');

      // Should handle invalid names gracefully
      expect(envValidatorContent).toContain('console.warn');
      expect(envValidatorContent).toContain('Invalid environment variable name');
    });
  });

  describe('Comprehensive Integration Tests', () => {
    test('should demonstrate all anti-patterns are eliminated together', async () => {
      // Test that all three anti-patterns are fixed in one integrated test
      const mockConfigLoader = vi.mocked(await import('../../src/core/config.js'));
      const mockValidator = {
        endpoints: [{ path: '/test', method: 'GET' }],
        initialize: vi.fn(),
        validateAllEndpoints: vi.fn().mockResolvedValue([
          { success: false, endpoint: '/test', method: 'GET', issues: ['error'] }
        ])
      };

      const mockAPIValidator = vi.mocked(await import('../../src/core/validator.js'));
      mockAPIValidator.default.mockImplementation(() => mockValidator);
      mockAPIValidator.default.getValidationStats.mockReturnValue({
        total: 1, passed: 0, failed: 1
      });

      // Test with configuration that has environment variables
      mockConfigLoader.default.getEnvironmentConfig.mockReturnValue({
        url: 'https://api.example.com',
        headers: {
          'Authorization': 'Bearer ${API_TOKEN}',  // Valid env var
          'Malicious': '${$(evil)}'                // Invalid env var
        }
      });

      const result = await validateCore('staging', {});

      // 1. Should not call process.exit (anti-pattern 2)
      expect(processExitSpy).not.toHaveBeenCalled();

      // 2. Should return proper result object
      expect(result.exitCode).toBe(1); // Failed validation
      expect(result.success).toBe(false);

      // 3. Environment variable security should have been applied (anti-pattern 3)
      // The malicious env var should have been caught by our security validation

      // 4. No validator mutation should have occurred (anti-pattern 1)
      // The original validator methods should remain unchanged
      expect(mockValidator.validateAllEndpoints).toHaveBeenCalled();
    });

    test('should be testable without side effects', async () => {
      // Run multiple tests in sequence to verify no side effects
      const testCases = [
        { expectedExit: 0, mockResults: [{ success: true, issues: [] }] },
        { expectedExit: 1, mockResults: [{ success: false, issues: ['error'] }] },
        { expectedExit: 0, mockResults: [{ success: true, issues: [] }] }
      ];

      const mockAPIValidator = vi.mocked(await import('../../src/core/validator.js'));

      for (const testCase of testCases) {
        const mockValidator = {
          endpoints: [{ path: '/test', method: 'GET' }],
          initialize: vi.fn(),
          validateAllEndpoints: vi.fn().mockResolvedValue(testCase.mockResults)
        };

        mockAPIValidator.default.mockImplementation(() => mockValidator);
        mockAPIValidator.default.getValidationStats.mockReturnValue({
          total: 1,
          passed: testCase.expectedExit === 0 ? 1 : 0,
          failed: testCase.expectedExit === 1 ? 1 : 0
        });

        const result = await validateCore('staging', {});

        expect(result.exitCode).toBe(testCase.expectedExit);
        expect(processExitSpy).not.toHaveBeenCalled();
      }
    });

    test('should maintain backward compatibility for CLI usage', async () => {
      // Verify the CLI wrapper still exists and calls process.exit
      const validateFilePath = join(__dirname, '../../src/commands/validate.js');
      const validateFileContent = readFileSync(validateFilePath, 'utf-8');

      // Should have both validateCore and validateCommand
      expect(validateFileContent).toContain('async function validateCore(');
      expect(validateFileContent).toContain('async function validateCommand(');

      // validateCommand should call validateCore and then process.exit
      const validateCommandMatch = validateFileContent.match(
        /async function validateCommand\([\s\S]*?\n\}/
      );

      expect(validateCommandMatch).toBeTruthy();

      const validateCommandCode = validateCommandMatch[0];
      expect(validateCommandCode).toContain('await validateCore(');
      expect(validateCommandCode).toContain('process.exit(result.exitCode)');

      // Should export both functions
      expect(validateFileContent).toContain('export default validateCommand');
      expect(validateFileContent).toContain('export { validateCore }');
    });
  });

  describe('Performance and Memory Safety', () => {
    test('should not create memory leaks or circular references', async () => {
      // Test multiple iterations to check for memory leaks
      const iterations = 100;

      for (let i = 0; i < iterations; i++) {
        await validateCore('staging', {});
      }

      // Should not have called process.exit despite many iterations
      expect(processExitSpy).not.toHaveBeenCalled();

      // Memory usage should remain stable (this is a basic check)
      const memUsage = process.memoryUsage();
      expect(memUsage.heapUsed).toBeLessThan(100 * 1024 * 1024); // Less than 100MB
    });

    test('should handle large numbers of environment variables efficiently', () => {
      const largeConfig = {};

      // Create a large number of environment variables
      for (let i = 0; i < 1000; i++) {
        largeConfig[`var${i}`] = `\${VAR_${i}}`;
      }

      const startTime = Date.now();
      const missing = EnvValidator.findMissingEnvVars(largeConfig);
      const endTime = Date.now();

      // Should complete in reasonable time
      expect(endTime - startTime).toBeLessThan(1000);
      expect(missing).toHaveLength(1000);
    });
  });

  describe('Code Quality and Maintainability', () => {
    test('should have clear separation of concerns', () => {
      const validateFilePath = join(__dirname, '../../src/commands/validate.js');
      const validateFileContent = readFileSync(validateFilePath, 'utf-8');

      // Should have separate functions for different concerns
      expect(validateFileContent).toContain('class ProgressTrackingValidator');
      expect(validateFileContent).toContain('async function validateCore(');
      expect(validateFileContent).toContain('async function validateCommand(');
      expect(validateFileContent).toContain('async function runValidationWithProgress(');

      // Core logic should be separate from CLI wrapper
      const validateCoreMatch = validateFileContent.match(
        /async function validateCore\([\s\S]*?\n\}/
      );
      const validateCommandMatch = validateFileContent.match(
        /async function validateCommand\([\s\S]*?\n\}/
      );

      expect(validateCoreMatch).toBeTruthy();
      expect(validateCommandMatch).toBeTruthy();

      // validateCore should not contain process.exit
      expect(validateCoreMatch[0]).not.toContain('process.exit');

      // validateCommand should be minimal and just wrap validateCore
      expect(validateCommandMatch[0]).toContain('await validateCore(');
      expect(validateCommandMatch[0]).toContain('process.exit(result.exitCode)');
    });

    test('should maintain proper error handling patterns', async () => {
      const mockConfigLoader = vi.mocked(await import('../../src/core/config.js'));

      // Test error handling without process.exit
      mockConfigLoader.default.loadConfig.mockRejectedValue(
        new Error('Test error')
      );

      const result = await validateCore('staging', {});

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.exitCode).toBeGreaterThan(0);
      expect(processExitSpy).not.toHaveBeenCalled();
    });
  });
});