import { describe, test, expect, beforeEach, vi } from 'vitest';
import ParameterValidator from '#src/core/parameter-validator.js';
import { SpecJetError } from '#src/core/errors.js';

describe('Parameter Validator', () => {
  let validator;

  beforeEach(() => {
    validator = new ParameterValidator();
  });

  describe('Timeout Validation', () => {
    test('should validate numeric timeout strings', () => {
      expect(validator.validateTimeout('30000')).toBe(30000);
      expect(validator.validateTimeout('5000')).toBe(5000);
      expect(validator.validateTimeout('1000')).toBe(1000);
    });

    test('should validate numeric timeout numbers', () => {
      expect(validator.validateTimeout(30000)).toBe(30000);
      expect(validator.validateTimeout(5000)).toBe(5000);
    });

    test('should use default when timeout is undefined/null', () => {
      expect(validator.validateTimeout(undefined)).toBe(30000);
      expect(validator.validateTimeout(null)).toBe(30000);
      expect(validator.validateTimeout(undefined, 15000)).toBe(15000);
    });

    test('should throw error for invalid timeout values', () => {
      expect(() => validator.validateTimeout('invalid')).toThrow(SpecJetError);
      expect(() => validator.validateTimeout('abc123')).toThrow(SpecJetError);
      expect(() => validator.validateTimeout('')).toThrow(SpecJetError);
    });

    test('should throw error for negative timeout', () => {
      expect(() => validator.validateTimeout(-1000)).toThrow(SpecJetError);
      expect(() => validator.validateTimeout('-5000')).toThrow(SpecJetError);
    });

    test('should warn for very high timeouts', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const result = validator.validateTimeout(400000); // 400 seconds
      expect(result).toBe(400000);
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Very high timeout'));

      consoleSpy.mockRestore();
    });

    test('should include helpful error messages', () => {
      try {
        validator.validateTimeout('invalid');
      } catch (error) {
        expect(error.message).toContain('Invalid timeout value');
        expect(error.code).toBe('INVALID_TIMEOUT_PARAMETER');
        expect(error.suggestions).toContain('Use a numeric value like --timeout 30000');
      }
    });
  });

  describe('Concurrency Validation', () => {
    test('should validate numeric concurrency strings', () => {
      expect(validator.validateConcurrency('3')).toBe(3);
      expect(validator.validateConcurrency('10')).toBe(10);
      expect(validator.validateConcurrency('1')).toBe(1);
    });

    test('should validate numeric concurrency numbers', () => {
      expect(validator.validateConcurrency(3)).toBe(3);
      expect(validator.validateConcurrency(10)).toBe(10);
    });

    test('should use default when concurrency is undefined/null', () => {
      expect(validator.validateConcurrency(undefined)).toBe(3);
      expect(validator.validateConcurrency(null)).toBe(3);
      expect(validator.validateConcurrency(undefined, 5)).toBe(5);
    });

    test('should throw error for invalid concurrency values', () => {
      expect(() => validator.validateConcurrency('invalid')).toThrow(SpecJetError);
      expect(() => validator.validateConcurrency('0')).toThrow(SpecJetError);
      expect(() => validator.validateConcurrency('-1')).toThrow(SpecJetError);
    });

    test('should warn for very high concurrency', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const result = validator.validateConcurrency(25);
      expect(result).toBe(25);
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('High concurrency'));

      consoleSpy.mockRestore();
    });
  });

  describe('Delay Validation', () => {
    test('should validate numeric delay strings', () => {
      expect(validator.validateDelay('100')).toBe(100);
      expect(validator.validateDelay('500')).toBe(500);
      expect(validator.validateDelay('0')).toBe(0);
    });

    test('should validate numeric delay numbers', () => {
      expect(validator.validateDelay(100)).toBe(100);
      expect(validator.validateDelay(0)).toBe(0);
    });

    test('should use default when delay is undefined/null', () => {
      expect(validator.validateDelay(undefined)).toBe(100);
      expect(validator.validateDelay(null)).toBe(100);
      expect(validator.validateDelay(undefined, 200)).toBe(200);
    });

    test('should throw error for invalid delay values', () => {
      expect(() => validator.validateDelay('invalid')).toThrow(SpecJetError);
      expect(() => validator.validateDelay('-100')).toThrow(SpecJetError);
    });
  });

  describe('Max Retries Validation', () => {
    test('should validate numeric maxRetries strings', () => {
      expect(validator.validateMaxRetries('2')).toBe(2);
      expect(validator.validateMaxRetries('5')).toBe(5);
      expect(validator.validateMaxRetries('0')).toBe(0);
    });

    test('should validate numeric maxRetries numbers', () => {
      expect(validator.validateMaxRetries(2)).toBe(2);
      expect(validator.validateMaxRetries(0)).toBe(0);
    });

    test('should use default when maxRetries is undefined/null', () => {
      expect(validator.validateMaxRetries(undefined)).toBe(2);
      expect(validator.validateMaxRetries(null)).toBe(2);
      expect(validator.validateMaxRetries(undefined, 3)).toBe(3);
    });

    test('should throw error for invalid maxRetries values', () => {
      expect(() => validator.validateMaxRetries('invalid')).toThrow(SpecJetError);
      expect(() => validator.validateMaxRetries('-1')).toThrow(SpecJetError);
    });

    test('should warn for very high retry counts', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const result = validator.validateMaxRetries(15);
      expect(result).toBe(15);
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('High retry count'));

      consoleSpy.mockRestore();
    });
  });

  describe('Validate Options', () => {
    test('should validate all options together', () => {
      const options = {
        timeout: '5000',
        concurrency: '2',
        delay: '200',
        maxRetries: '3'
      };

      const result = validator.validateOptions(options);

      expect(result).toEqual({
        timeout: 5000,
        concurrency: 2,
        delay: 200,
        maxRetries: 3
      });
    });

    test('should use defaults for missing options', () => {
      const result = validator.validateOptions({});

      expect(result).toEqual({
        timeout: 30000,
        concurrency: 3,
        delay: 100,
        maxRetries: 2
      });
    });

    test('should handle partial options', () => {
      const options = {
        timeout: '10000',
        delay: '300'
      };

      const result = validator.validateOptions(options);

      expect(result).toEqual({
        timeout: 10000,
        concurrency: 3, // default
        delay: 300,
        maxRetries: 2 // default
      });
    });
  });

  describe('Custom Defaults', () => {
    test('should allow custom defaults in constructor', () => {
      const customValidator = new ParameterValidator({
        defaultTimeout: 60000,
        defaultConcurrency: 5,
        defaultDelay: 250,
        defaultMaxRetries: 4
      });

      const result = customValidator.validateOptions({});

      expect(result).toEqual({
        timeout: 60000,
        concurrency: 5,
        delay: 250,
        maxRetries: 4
      });
    });

    test('should return custom defaults via getDefaults', () => {
      const customValidator = new ParameterValidator({
        defaultTimeout: 60000,
        defaultConcurrency: 5
      });

      const defaults = customValidator.getDefaults();

      expect(defaults.timeout).toBe(60000);
      expect(defaults.concurrency).toBe(5);
    });
  });

  describe('CLI Parameter Compatibility', () => {
    test('should handle timeout parameter from CLI (string)', () => {
      // Simulates CLI passing --timeout 10000
      expect(validator.validateTimeout('10000')).toBe(10000);
    });

    test('should handle timeout parameter from config (number)', () => {
      // Simulates config file with numeric value
      expect(validator.validateTimeout(10000)).toBe(10000);
    });

    test('should prevent the original parseInt bug', () => {
      // The original bug: CLI timeout passed as string caused issues
      // This should NOT throw or return NaN
      const cliTimeout = '30000'; // CLI always passes strings
      expect(validator.validateTimeout(cliTimeout)).toBe(30000);
      expect(typeof validator.validateTimeout(cliTimeout)).toBe('number');
    });
  });

  describe('Error Context and Suggestions', () => {
    test('should provide context-aware error messages', () => {
      try {
        validator.validateTimeout('not-a-number');
      } catch (error) {
        expect(error.message).toContain('Invalid timeout value: "not-a-number"');
        expect(error.suggestions).toHaveLength(3);
        expect(error.suggestions[0]).toContain('--timeout 30000');
      }
    });

    test('should provide appropriate error codes', () => {
      expect(() => validator.validateTimeout('invalid')).toThrow(
        expect.objectContaining({ code: 'INVALID_TIMEOUT_PARAMETER' })
      );
      expect(() => validator.validateConcurrency('invalid')).toThrow(
        expect.objectContaining({ code: 'INVALID_CONCURRENCY_PARAMETER' })
      );
      expect(() => validator.validateDelay('invalid')).toThrow(
        expect.objectContaining({ code: 'INVALID_DELAY_PARAMETER' })
      );
      expect(() => validator.validateMaxRetries('invalid')).toThrow(
        expect.objectContaining({ code: 'INVALID_MAX_RETRIES_PARAMETER' })
      );
    });
  });
});