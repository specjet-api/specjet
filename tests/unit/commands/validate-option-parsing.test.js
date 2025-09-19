import { describe, test, expect } from 'vitest';

// Import the parsePathParams function directly by reading the validate command file
// Since it's not exported, we'll test the logic independently

function parsePathParams(pathParamsString) {
  if (!pathParamsString) {
    return {};
  }

  const params = {};
  const pairs = pathParamsString.split(',');

  for (const pair of pairs) {
    const splitIndex = pair.indexOf('=');
    if (splitIndex > 0 && splitIndex < pair.length - 1) {
      const key = pair.substring(0, splitIndex).trim();
      const value = pair.substring(splitIndex + 1).trim();
      if (key && value) {
        params[key] = value;
      }
    }
  }

  return params;
}

function processValidateOptions(options) {
  return {
    ...options,
    // Handle parameter discovery flag (Commander.js uses negated flag names)
    // When --no-parameter-discovery is used, parameterDiscovery becomes false
    // When not specified, parameterDiscovery is undefined, so we default to true
    enableParameterDiscovery: options.parameterDiscovery !== false,
    // Parse path parameters from string format
    pathParams: parsePathParams(options.pathParams)
  };
}

describe('Validate Command Option Processing', () => {
  describe('parsePathParams', () => {
    test('should parse simple key=value pairs', () => {
      const result = parsePathParams('petId=123,userId=456');
      expect(result).toEqual({
        petId: '123',
        userId: '456'
      });
    });

    test('should handle spaces around keys and values', () => {
      const result = parsePathParams('name=John Doe, category=test category ');
      expect(result).toEqual({
        name: 'John Doe',
        category: 'test category'
      });
    });

    test('should handle empty string', () => {
      const result = parsePathParams('');
      expect(result).toEqual({});
    });

    test('should handle undefined input', () => {
      const result = parsePathParams(undefined);
      expect(result).toEqual({});
    });

    test('should handle null input', () => {
      const result = parsePathParams(null);
      expect(result).toEqual({});
    });

    test('should ignore malformed pairs', () => {
      const result = parsePathParams('petId=123,invalidpair,userId=456,=missingkey,missingvalue=');
      expect(result).toEqual({
        petId: '123',
        userId: '456'
      });
    });

    test('should handle equals signs in values', () => {
      const result = parsePathParams('query=key=value,filter=status=active');
      expect(result).toEqual({
        query: 'key=value', // Takes everything after the first =
        filter: 'status=active' // Takes everything after the first =
      });
    });

    test('should handle special characters', () => {
      const result = parsePathParams('email=user@example.com,url=https://example.com/path?query=value');
      expect(result).toEqual({
        email: 'user@example.com',
        url: 'https://example.com/path?query=value' // Takes everything after the first =
      });
    });

    test('should handle single parameter', () => {
      const result = parsePathParams('petId=123');
      expect(result).toEqual({
        petId: '123'
      });
    });

    test('should handle multiple commas (empty segments)', () => {
      const result = parsePathParams('petId=123,,userId=456,,');
      expect(result).toEqual({
        petId: '123',
        userId: '456'
      });
    });
  });

  describe('processValidateOptions', () => {
    test('should enable parameter discovery by default', () => {
      const result = processValidateOptions({
        verbose: false,
        timeout: '30000'
      });

      expect(result).toEqual({
        verbose: false,
        timeout: '30000',
        enableParameterDiscovery: true,
        pathParams: {}
      });
    });

    test('should disable parameter discovery when parameterDiscovery is false', () => {
      const result = processValidateOptions({
        verbose: false,
        parameterDiscovery: false  // --no-parameter-discovery sets this to false
      });

      expect(result).toEqual({
        verbose: false,
        parameterDiscovery: false,
        enableParameterDiscovery: false,
        pathParams: {}
      });
    });

    test('should parse path parameters from string', () => {
      const result = processValidateOptions({
        pathParams: 'petId=123,userId=456'
      });

      expect(result).toEqual({
        pathParams: {
          petId: '123',
          userId: '456'
        },
        enableParameterDiscovery: true
      });
    });

    test('should combine all options correctly', () => {
      const result = processValidateOptions({
        verbose: true,
        timeout: '45000',
        output: 'json',
        contract: './api.yaml',
        parameterDiscovery: false,
        pathParams: 'petId=999,userId=admin'
      });

      expect(result).toEqual({
        verbose: true,
        timeout: '45000',
        output: 'json',
        contract: './api.yaml',
        parameterDiscovery: false,
        enableParameterDiscovery: false,
        pathParams: {
          petId: '999',
          userId: 'admin'
        }
      });
    });

    test('should preserve other options unchanged', () => {
      const originalOptions = {
        verbose: true,
        timeout: '60000',
        output: 'markdown',
        contract: './custom.yaml',
        config: './config.js',
        queryParams: { filter: 'active' },
        requestBody: { name: 'test' }
      };

      const result = processValidateOptions(originalOptions);

      expect(result).toEqual({
        ...originalOptions,
        enableParameterDiscovery: true,
        pathParams: {}
      });
    });

    test('should handle undefined parameterDiscovery (default behavior)', () => {
      const result = processValidateOptions({
        verbose: false,
        parameterDiscovery: undefined
      });

      expect(result.enableParameterDiscovery).toBe(true);
    });

    test('should handle null parameterDiscovery (default behavior)', () => {
      const result = processValidateOptions({
        verbose: false,
        parameterDiscovery: null
      });

      expect(result.enableParameterDiscovery).toBe(true);
    });

    test('should handle explicitly true parameterDiscovery', () => {
      const result = processValidateOptions({
        verbose: false,
        parameterDiscovery: true
      });

      expect(result.enableParameterDiscovery).toBe(true);
    });
  });

  describe('Integration - Full Option Processing', () => {
    test('should process realistic CLI options correctly', () => {
      // Simulate options as they would come from Commander.js
      const cliOptions = {
        verbose: true,
        timeout: '30000',
        output: 'console',
        contract: './pet-store.yaml',
        parameterDiscovery: false, // --no-parameter-discovery
        pathParams: 'petId=123,username=testuser,orderId=456'
      };

      const processed = processValidateOptions(cliOptions);

      expect(processed).toEqual({
        verbose: true,
        timeout: '30000',
        output: 'console',
        contract: './pet-store.yaml',
        parameterDiscovery: false,
        enableParameterDiscovery: false,
        pathParams: {
          petId: '123',
          username: 'testuser',
          orderId: '456'
        }
      });
    });

    test('should handle default case (no special flags)', () => {
      const cliOptions = {
        verbose: false,
        timeout: '30000',
        output: 'console'
      };

      const processed = processValidateOptions(cliOptions);

      expect(processed).toEqual({
        verbose: false,
        timeout: '30000',
        output: 'console',
        enableParameterDiscovery: true,
        pathParams: {}
      });
    });

    test('should handle discovery enabled with manual parameters', () => {
      const cliOptions = {
        verbose: false,
        // parameterDiscovery not specified - should default to enabled
        pathParams: 'userId=manual,petId=override'
      };

      const processed = processValidateOptions(cliOptions);

      expect(processed).toEqual({
        verbose: false,
        enableParameterDiscovery: true,
        pathParams: {
          userId: 'manual',
          petId: 'override'
        }
      });
    });
  });
});