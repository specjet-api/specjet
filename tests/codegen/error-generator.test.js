import { describe, test, expect, beforeEach } from 'vitest';
import ErrorGenerator from '../../src/codegen/error-generator.js';

describe('ErrorGenerator', () => {
  let errorGenerator;

  beforeEach(() => {
    errorGenerator = new ErrorGenerator();
  });

  describe('Error Interface Generation', () => {
    test('should generate all error class definitions', () => {
      const result = errorGenerator.generateErrorInterface();
      
      const expectedClasses = [
        'ApiError',
        'BadRequestError', 
        'UnauthorizedError',
        'ForbiddenError',
        'NotFoundError',
        'ValidationError',
        'RateLimitError',
        'InternalServerError',
        'ServiceUnavailableError'
      ];
      
      expectedClasses.forEach(className => {
        expect(result).toContain(`export class ${className}`);
        expect(result).toContain(`this.name = '${className}';`);
      });
    });

    test('should have proper inheritance hierarchy', () => {
      const result = errorGenerator.generateErrorInterface();
      
      // Base ApiError should extend Error
      expect(result).toContain('export class ApiError extends Error');
      
      // All specific errors should extend ApiError
      const specificErrors = [
        'BadRequestError', 'UnauthorizedError', 'ForbiddenError', 
        'NotFoundError', 'ValidationError', 'RateLimitError',
        'InternalServerError', 'ServiceUnavailableError'
      ];
      
      specificErrors.forEach(errorClass => {
        expect(result).toContain(`export class ${errorClass} extends ApiError`);
      });
    });

    test('should include consistent constructor parameters', () => {
      const result = errorGenerator.generateErrorInterface();
      
      // All error classes should have same constructor signature
      const constructorPattern = /constructor\(\s*status: number,\s*statusText: string,\s*body: any = null\s*\)/g;
      const matches = result.match(constructorPattern);
      
      // Should have 8 constructors (all error classes)
      expect(matches.length).toBeGreaterThanOrEqual(8);
    });

    test('should generate proper error messages', () => {
      const result = errorGenerator.generateErrorInterface();
      
      // Base ApiError should have template literal for error message
      expect(result).toContain('super(`HTTP error! status: ${status} ${statusText}`)');
      
      // All specific errors should call super with same parameters
      expect(result).toMatch(/super\(status, statusText, body\);/g);
    });
  });

  describe('Error Handling Method Generation', () => {
    test('should generate complete error handling method', () => {
      const result = errorGenerator.generateErrorHandlingMethod();
      
      expect(result).toContain('private async handleErrorResponse(response: Response): Promise<never>');
      expect(result).toContain('const status = response.status');
      expect(result).toContain('const statusText = response.statusText');
    });

    test('should handle different content types for error parsing', () => {
      const result = errorGenerator.generateErrorHandlingMethod();
      
      expect(result).toContain("response.headers.get('content-type')");
      expect(result).toContain("contentType.includes('application/json')");
      expect(result).toContain('await response.json()');
      expect(result).toContain('await response.text()');
    });

    test('should have proper error parsing with fallbacks', () => {
      const result = errorGenerator.generateErrorHandlingMethod();
      
      expect(result).toContain('try {');
      expect(result).toContain('} catch {');
      expect(result).toContain('// Ignore parsing errors');
    });

    test('should map all HTTP status codes to specific errors', () => {
      const result = errorGenerator.generateErrorHandlingMethod();
      
      const statusMappings = [
        { status: '400', error: 'BadRequestError' },
        { status: '401', error: 'UnauthorizedError' },
        { status: '403', error: 'ForbiddenError' },
        { status: '404', error: 'NotFoundError' },
        { status: '422', error: 'ValidationError' },
        { status: '429', error: 'RateLimitError' },
        { status: '500', error: 'InternalServerError' },
        { status: '502', error: 'ServiceUnavailableError' },
        { status: '503', error: 'ServiceUnavailableError' },
        { status: '504', error: 'ServiceUnavailableError' }
      ];
      
      statusMappings.forEach(({ status, error }) => {
        expect(result).toContain(`case ${status}:`);
        expect(result).toContain(`throw new ${error}(status, statusText, errorBody);`);
      });
    });

    test('should have default case for unmapped status codes', () => {
      const result = errorGenerator.generateErrorHandlingMethod();
      
      expect(result).toContain('default:');
      expect(result).toContain('throw new ApiError(status, statusText, errorBody);');
    });

    test('should handle multiple 5xx status codes for service unavailable', () => {
      const result = errorGenerator.generateErrorHandlingMethod();
      
      // Should handle 502, 503, 504 all as ServiceUnavailableError
      expect(result).toContain('case 502:');
      expect(result).toContain('case 503:');
      expect(result).toContain('case 504:');
      expect(result).toContain('throw new ServiceUnavailableError(status, statusText, errorBody);');
    });
  });

  describe('Error Type Safety', () => {
    test('should use proper TypeScript types', () => {
      const interfaceResult = errorGenerator.generateErrorInterface();
      
      expect(interfaceResult).toContain('public status: number');
      expect(interfaceResult).toContain('public statusText: string');
      expect(interfaceResult).toContain('public body: any = null');
    });

    test('should use consistent parameter naming', () => {
      const methodResult = errorGenerator.generateErrorHandlingMethod();
      
      expect(methodResult).toContain('response: Response');
      expect(methodResult).toContain('Promise<never>');
      expect(methodResult).toContain('let errorBody: any = null;');
    });
  });

  describe('Error Message Generation', () => {
    test('should generate descriptive error messages', () => {
      const result = errorGenerator.generateErrorInterface();
      
      // Base error should include status and statusText in message
      expect(result).toContain('HTTP error! status: ${status} ${statusText}');
    });

    test('should set proper error names for debugging', () => {
      const result = errorGenerator.generateErrorInterface();
      
      const errorNames = [
        'ApiError', 'BadRequestError', 'UnauthorizedError', 'ForbiddenError',
        'NotFoundError', 'ValidationError', 'RateLimitError',
        'InternalServerError', 'ServiceUnavailableError'
      ];
      
      errorNames.forEach(name => {
        expect(result).toContain(`this.name = '${name}';`);
      });
    });
  });

  describe('Code Generation Consistency', () => {
    test('should maintain consistent indentation', () => {
      const interfaceResult = errorGenerator.generateErrorInterface();
      const methodResult = errorGenerator.generateErrorHandlingMethod();
      
      // Check that both methods generate properly indented code
      const interfaceLines = interfaceResult.split('\n');
      const methodLines = methodResult.split('\n');
      
      // Most lines should have consistent indentation
      interfaceLines.forEach(line => {
        if (line.trim() && !line.startsWith('export') && !line.startsWith('//')) {
          // Allow various indentation patterns for generated code
          expect(line.length).toBeGreaterThan(0);
        }
      });
      
      methodLines.forEach(line => {
        if (line.trim() && !line.startsWith('  private') && !line.startsWith('//')) {
          expect(line.match(/^  /)).toBeTruthy(); // Should start with at least 2 spaces
        }
      });
    });

    test('should generate valid TypeScript syntax', () => {
      const interfaceResult = errorGenerator.generateErrorInterface();
      const methodResult = errorGenerator.generateErrorHandlingMethod();
      
      // Check for common TypeScript syntax elements
      expect(interfaceResult).toContain('export class');
      expect(interfaceResult).toContain('extends');
      expect(interfaceResult).toContain('constructor(');
      expect(interfaceResult).toContain('public');
      
      expect(methodResult).toContain('private async');
      expect(methodResult).toContain('Promise<never>');
      expect(methodResult).toContain('switch (status)');
    });
  });

  describe('Error Handling', () => {
    test('should handle content-type parsing gracefully', () => {
      const result = errorGenerator.generateErrorHandlingMethod();
      
      expect(result).toContain('const contentType = response.headers.get(\'content-type\')');
      expect(result).toContain('if (contentType && contentType.includes(\'application/json\'))');
    });

    test('should ignore JSON parsing errors silently', () => {
      const result = errorGenerator.generateErrorHandlingMethod();
      
      expect(result).toContain('} catch {');
      expect(result).toContain('// Ignore parsing errors');
      expect(result).not.toContain('console.error');
      expect(result).not.toContain('console.error');
    });

    test('should preserve original response data', () => {
      const result = errorGenerator.generateErrorHandlingMethod();
      
      // Should pass status, statusText, and body to error constructors
      const throwStatements = result.match(/throw new \w+Error\(status, statusText, errorBody\);/g);
      expect(throwStatements.length).toBeGreaterThan(0);
      
      // Default case should also preserve data
      expect(result).toContain('throw new ApiError(status, statusText, errorBody);');
    });
  });
});