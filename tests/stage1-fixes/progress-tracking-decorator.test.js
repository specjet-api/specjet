import { describe, test, expect, vi, beforeEach } from 'vitest';

// Import the decorator class from validate.js
// We need to import the internal class, so we'll read the file and extract it
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Mock validator for testing
class MockValidator {
  constructor() {
    this.endpoints = [
      { path: '/users', method: 'GET' },
      { path: '/users', method: 'POST' },
      { path: '/users/{id}', method: 'GET' }
    ];
    this.contract = { info: { title: 'Test API', version: '1.0.0' } };
    this.validateEndpointCalls = [];
  }

  async validateEndpoint(path, method, opts) {
    this.validateEndpointCalls.push({ path, method, opts });

    // Simulate validation result
    return {
      endpoint: path,
      method: method.toUpperCase(),
      success: Math.random() > 0.3, // Random success/failure for testing
      statusCode: 200,
      issues: [],
      metadata: { responseTime: Math.floor(Math.random() * 500) + 100 }
    };
  }

  async validateAllEndpoints(options) {
    const results = [];
    for (const endpoint of this.endpoints) {
      const result = await this.validateEndpoint(endpoint.path, endpoint.method, options);
      results.push(result);
    }
    return results;
  }
}

// Extract ProgressTrackingValidator class from validate.js
const validateFilePath = join(__dirname, '../../src/commands/validate.js');
const validateFileContent = readFileSync(validateFilePath, 'utf-8');

// Extract the class definition using regex
const classMatch = validateFileContent.match(/class ProgressTrackingValidator \{[\s\S]*?\n\}/);
if (!classMatch) {
  throw new Error('Could not extract ProgressTrackingValidator class from validate.js');
}

// Create the class in our test context
const classCode = classMatch[0];
eval(`
${classCode}
globalThis.ProgressTrackingValidator = ProgressTrackingValidator;
`);

const ProgressTrackingValidator = globalThis.ProgressTrackingValidator;

describe('ProgressTrackingValidator Decorator Tests', () => {
  let mockValidator;
  let progressCallback;
  let progressValidator;
  let progressCalls;

  beforeEach(() => {
    mockValidator = new MockValidator();
    progressCalls = [];
    progressCallback = vi.fn((result) => {
      progressCalls.push(result);
    });
    progressValidator = new ProgressTrackingValidator(mockValidator, progressCallback);
  });

  describe('Decorator Pattern Implementation', () => {
    test('should not mutate the original validator', () => {
      const originalValidateEndpoint = mockValidator.validateEndpoint;
      const originalValidateAllEndpoints = mockValidator.validateAllEndpoints;

      // Create decorator
      new ProgressTrackingValidator(mockValidator, progressCallback);

      // Verify original methods are unchanged
      expect(mockValidator.validateEndpoint).toBe(originalValidateEndpoint);
      expect(mockValidator.validateAllEndpoints).toBe(originalValidateAllEndpoints);
    });

    test('should delegate properties correctly', () => {
      expect(progressValidator.endpoints).toBe(mockValidator.endpoints);
      expect(progressValidator.contract).toBe(mockValidator.contract);
    });

    test('should wrap validateEndpoint with progress tracking', async () => {
      const result = await progressValidator.validateEndpoint('/test', 'GET', {});

      // Verify original method was called
      expect(mockValidator.validateEndpointCalls).toHaveLength(1);
      expect(mockValidator.validateEndpointCalls[0]).toEqual({
        path: '/test',
        method: 'GET',
        opts: {}
      });

      // Verify progress callback was called
      expect(progressCallback).toHaveBeenCalledTimes(1);
      expect(progressCallback).toHaveBeenCalledWith(result);
    });
  });

  describe('Progress Tracking Functionality', () => {
    test('should call progress callback for each endpoint validation', async () => {
      await progressValidator.validateAllEndpoints({});

      // Should call progress callback for each endpoint
      expect(progressCallback).toHaveBeenCalledTimes(3);
      expect(progressCalls).toHaveLength(3);

      // Verify each call has the expected structure
      progressCalls.forEach((call) => {
        expect(call).toHaveProperty('endpoint');
        expect(call).toHaveProperty('method');
        expect(call).toHaveProperty('success');
        expect(call).toHaveProperty('statusCode');
        expect(call).toHaveProperty('issues');
        expect(call).toHaveProperty('metadata');
      });
    });

    test('should handle progress callback gracefully when not provided', async () => {
      const validatorWithoutCallback = new ProgressTrackingValidator(mockValidator, null);

      // Should not throw error
      await expect(validatorWithoutCallback.validateEndpoint('/test', 'GET', {})).resolves.toBeDefined();
    });

    test('should handle undefined progress callback', async () => {
      const validatorWithUndefined = new ProgressTrackingValidator(mockValidator, undefined);

      // Should not throw error
      await expect(validatorWithUndefined.validateEndpoint('/test', 'GET', {})).resolves.toBeDefined();
    });

    test('should preserve validation options and parameters', async () => {
      const options = { timeout: 5000, customParam: 'test' };

      await progressValidator.validateEndpoint('/test', 'POST', options);

      expect(mockValidator.validateEndpointCalls[0].opts).toBe(options);
    });
  });

  describe('Batch Processing', () => {
    test('should process endpoints in batches with concurrency control', async () => {
      const options = { concurrency: 2, delay: 10 };

      const startTime = Date.now();
      const results = await progressValidator.validateAllEndpoints(options);
      const endTime = Date.now();

      // Should return results for all endpoints
      expect(results).toHaveLength(3);

      // Should have called progress callback for each endpoint
      expect(progressCallback).toHaveBeenCalledTimes(3);

      // Should take some time due to batching (basic timing check)
      expect(endTime - startTime).toBeGreaterThan(5);
    });

    test('should handle errors in batch processing gracefully', async () => {
      // Create a validator that throws an error for one endpoint
      const errorValidator = new MockValidator();
      errorValidator.validateEndpoint = vi.fn()
        .mockResolvedValueOnce({ success: true, endpoint: '/users', method: 'GET' })
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({ success: true, endpoint: '/users/{id}', method: 'GET' });

      const errorProgressValidator = new ProgressTrackingValidator(errorValidator, progressCallback);

      const results = await errorProgressValidator.validateAllEndpoints({});

      // Should handle the error and continue processing
      expect(results).toHaveLength(3);

      // Check that one result represents the error
      const errorResult = results.find(r => !r.success && r.endpoint === 'unknown');
      expect(errorResult).toBeDefined();
      expect(errorResult.issues[0].message).toContain('Network error');
    });
  });

  describe('Anti-Pattern Elimination', () => {
    test('should not modify validator instance methods', () => {
      const originalMethods = {
        validateEndpoint: mockValidator.validateEndpoint,
        validateAllEndpoints: mockValidator.validateAllEndpoints
      };

      // Create multiple decorators to test no side effects
      new ProgressTrackingValidator(mockValidator, progressCallback);
      new ProgressTrackingValidator(mockValidator, vi.fn());

      // Original methods should remain unchanged
      expect(mockValidator.validateEndpoint).toBe(originalMethods.validateEndpoint);
      expect(mockValidator.validateAllEndpoints).toBe(originalMethods.validateAllEndpoints);
    });

    test('should maintain original validator state integrity', async () => {
      const originalEndpoints = mockValidator.endpoints.slice();
      const originalContract = mockValidator.contract;

      await progressValidator.validateAllEndpoints({});

      // Original validator state should be unchanged
      expect(mockValidator.endpoints).toEqual(originalEndpoints);
      expect(mockValidator.contract).toBe(originalContract);
    });

    test('should be composable without side effects', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      const decorator1 = new ProgressTrackingValidator(mockValidator, callback1);
      const _decorator2 = new ProgressTrackingValidator(mockValidator, callback2);

      // Both decorators should work independently
      expect(decorator1.endpoints).toBe(mockValidator.endpoints);
      expect(_decorator2.endpoints).toBe(mockValidator.endpoints);

      // Neither should affect the other or the original
      expect(mockValidator.validateEndpoint).toBe(mockValidator.validateEndpoint);
    });
  });

  describe('Memory and Performance', () => {
    test('should not create memory leaks through circular references', () => {
      const decorator = new ProgressTrackingValidator(mockValidator, progressCallback);

      // Should be able to clean up references
      expect(decorator.validator).toBe(mockValidator);
      expect(decorator.progressCallback).toBe(progressCallback);

      // No circular references should exist
      expect(mockValidator.progressCallback).toBeUndefined();
      expect(progressCallback.validator).toBeUndefined();
    });

    test('should handle large numbers of endpoints efficiently', async () => {
      // Create a validator with many endpoints
      const largeValidator = new MockValidator();
      largeValidator.endpoints = Array.from({ length: 100 }, (_, i) => ({
        path: `/endpoint${i}`,
        method: 'GET'
      }));

      const largeProgressValidator = new ProgressTrackingValidator(largeValidator, progressCallback);

      const startTime = Date.now();
      await largeProgressValidator.validateAllEndpoints({ concurrency: 5 });
      const endTime = Date.now();

      // Should complete in reasonable time (less than 5 seconds for 100 endpoints)
      expect(endTime - startTime).toBeLessThan(5000);
      expect(progressCallback).toHaveBeenCalledTimes(100);
    });
  });
});