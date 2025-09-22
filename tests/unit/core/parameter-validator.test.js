import { describe, test, expect, vi } from 'vitest';
import { validateTimeout, validateConcurrency, validateDelay, validateMaxRetries, validateOptions } from '#src/core/parameter-validator.js';
import { SpecJetError } from '#src/core/errors.js';

describe('Parameter Validator', () => {
  describe('Timeout Validation', () => {
    test('should validate numeric timeout strings', () => {
      expect(validateTimeout('30000')).toBe(30000);
      expect(validateTimeout('5000')).toBe(5000);
      expect(validateTimeout('1000')).toBe(1000);
    });

    test('should validate numeric timeout numbers', () => {
      expect(validateTimeout(30000)).toBe(30000);
      expect(validateTimeout(5000)).toBe(5000);
    });

    test('should use default when timeout is undefined/null', () => {
      expect(validateTimeout(undefined)).toBe(30000);
      expect(validateTimeout(null)).toBe(30000);
      expect(validateTimeout(undefined, 15000)).toBe(15000);
    });

    test('should throw error for invalid timeout values', () => {
      expect(() => validateTimeout('invalid')).toThrow(SpecJetError);
      expect(() => validateTimeout('abc123')).toThrow(SpecJetError);
      expect(() => validateTimeout('')).toThrow(SpecJetError);
    });

    test('should throw error for negative timeout', () => {
      expect(() => validateTimeout(-1000)).toThrow(SpecJetError);
      expect(() => validateTimeout('-5000')).toThrow(SpecJetError);
    });

    test('should warn for very high timeouts', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const result = validateTimeout(400000); // 400 seconds
      expect(result).toBe(400000);
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Very high timeout'));

      consoleSpy.mockRestore();
    });

    test('should include helpful error messages', () => {
      try {
        validateTimeout('invalid');
      } catch (error) {
        expect(error.message).toContain('Invalid timeout value');
        expect(error.code).toBe('INVALID_TIMEOUT_PARAMETER');
        expect(error.suggestions).toContain('Use a numeric value like --timeout 30000');
      }
    });
  });

  describe('Concurrency Validation', () => {
    test('should validate numeric concurrency strings', () => {
      expect(validateConcurrency('3')).toBe(3);
      expect(validateConcurrency('10')).toBe(10);
      expect(validateConcurrency('1')).toBe(1);
    });

    test('should validate numeric concurrency numbers', () => {
      expect(validateConcurrency(3)).toBe(3);
      expect(validateConcurrency(10)).toBe(10);
    });

    test('should use default when concurrency is undefined/null', () => {
      expect(validateConcurrency(undefined)).toBe(3);
      expect(validateConcurrency(null)).toBe(3);
      expect(validateConcurrency(undefined, 5)).toBe(5);
    });

    test('should throw error for invalid concurrency values', () => {
      expect(() => validateConcurrency('invalid')).toThrow(SpecJetError);
      expect(() => validateConcurrency('0')).toThrow(SpecJetError);
      expect(() => validateConcurrency('-1')).toThrow(SpecJetError);
    });

    test('should warn for very high concurrency', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const result = validateConcurrency(25);
      expect(result).toBe(25);
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('High concurrency'));

      consoleSpy.mockRestore();
    });
  });

  describe('Delay Validation', () => {
    test('should validate numeric delay strings', () => {
      expect(validateDelay('100')).toBe(100);
      expect(validateDelay('500')).toBe(500);
      expect(validateDelay('0')).toBe(0);
    });

    test('should validate numeric delay numbers', () => {
      expect(validateDelay(100)).toBe(100);
      expect(validateDelay(0)).toBe(0);
    });

    test('should use default when delay is undefined/null', () => {
      expect(validateDelay(undefined)).toBe(100);
      expect(validateDelay(null)).toBe(100);
      expect(validateDelay(undefined, 200)).toBe(200);
    });

    test('should throw error for invalid delay values', () => {
      expect(() => validateDelay('invalid')).toThrow(SpecJetError);
      expect(() => validateDelay('-100')).toThrow(SpecJetError);
    });
  });

  describe('Max Retries Validation', () => {
    test('should validate numeric maxRetries strings', () => {
      expect(validateMaxRetries('2')).toBe(2);
      expect(validateMaxRetries('5')).toBe(5);
      expect(validateMaxRetries('0')).toBe(0);
    });

    test('should validate numeric maxRetries numbers', () => {
      expect(validateMaxRetries(2)).toBe(2);
      expect(validateMaxRetries(0)).toBe(0);
    });

    test('should use default when maxRetries is undefined/null', () => {
      expect(validateMaxRetries(undefined)).toBe(2);
      expect(validateMaxRetries(null)).toBe(2);
      expect(validateMaxRetries(undefined, 3)).toBe(3);
    });

    test('should throw error for invalid maxRetries values', () => {
      expect(() => validateMaxRetries('invalid')).toThrow(SpecJetError);
      expect(() => validateMaxRetries('-1')).toThrow(SpecJetError);
    });

    test('should warn for very high retry counts', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const result = validateMaxRetries(15);
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

      const result = validateOptions(options);

      expect(result).toEqual({
        timeout: 5000,
        concurrency: 2,
        delay: 200,
        maxRetries: 3
      });
    });

    test('should use defaults for missing options', () => {
      const result = validateOptions({});

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

      const result = validateOptions(options);

      expect(result).toEqual({
        timeout: 10000,
        concurrency: 3, // default
        delay: 300,
        maxRetries: 2 // default
      });
    });
  });

  describe('Custom Defaults', () => {
    test('should allow custom defaults as function parameters', () => {
      const result = {
        timeout: validateTimeout(undefined, 60000),
        concurrency: validateConcurrency(undefined, 5),
        delay: validateDelay(undefined, 250),
        maxRetries: validateMaxRetries(undefined, 4)
      };

      expect(result).toEqual({
        timeout: 60000,
        concurrency: 5,
        delay: 250,
        maxRetries: 4
      });
    });

    test('should use standard defaults when no custom defaults provided', () => {
      const result = validateOptions({});

      expect(result.timeout).toBe(30000);
      expect(result.concurrency).toBe(3);
      expect(result.delay).toBe(100);
      expect(result.maxRetries).toBe(2);
    });
  });

  describe('CLI Parameter Compatibility', () => {
    test('should handle timeout parameter from CLI (string)', () => {
      // Simulates CLI passing --timeout 10000
      expect(validateTimeout('10000')).toBe(10000);
    });

    test('should handle timeout parameter from config (number)', () => {
      // Simulates config file with numeric value
      expect(validateTimeout(10000)).toBe(10000);
    });

    test('should prevent the original parseInt bug', () => {
      // The original bug: CLI timeout passed as string caused issues
      // This should NOT throw or return NaN
      const cliTimeout = '30000'; // CLI always passes strings
      expect(validateTimeout(cliTimeout)).toBe(30000);
      expect(typeof validateTimeout(cliTimeout)).toBe('number');
    });
  });

  describe('Error Context and Suggestions', () => {
    test('should provide context-aware error messages', () => {
      try {
        validateTimeout('not-a-number');
      } catch (error) {
        expect(error.message).toContain('Invalid timeout value: "not-a-number"');
        expect(error.suggestions).toHaveLength(3);
        expect(error.suggestions[0]).toContain('--timeout 30000');
      }
    });

    test('should provide appropriate error codes', () => {
      expect(() => validateTimeout('invalid')).toThrow(
        expect.objectContaining({ code: 'INVALID_TIMEOUT_PARAMETER' })
      );
      expect(() => validateConcurrency('invalid')).toThrow(
        expect.objectContaining({ code: 'INVALID_CONCURRENCY_PARAMETER' })
      );
      expect(() => validateDelay('invalid')).toThrow(
        expect.objectContaining({ code: 'INVALID_DELAY_PARAMETER' })
      );
      expect(() => validateMaxRetries('invalid')).toThrow(
        expect.objectContaining({ code: 'INVALID_MAX_RETRIES_PARAMETER' })
      );
    });
  });
});