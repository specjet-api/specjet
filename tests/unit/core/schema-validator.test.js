import { describe, test, expect, vi, beforeEach } from 'vitest';
import SchemaValidator from '#src/core/schema-validator.js';

describe('SchemaValidator', () => {
  let schemaValidator;

  beforeEach(() => {
    schemaValidator = new SchemaValidator();
  });

  describe('Constructor and Setup', () => {
    test('should initialize AJV with correct configuration', () => {
      expect(schemaValidator.ajv).toBeDefined();
      expect(schemaValidator.ajv.opts.allErrors).toBe(true);
      expect(schemaValidator.ajv.opts.verbose).toBe(true);
      expect(schemaValidator.ajv.opts.strict).toBe(false);
      expect(schemaValidator.ajv.opts.removeAdditional).toBe(false);
    });

    test('should add custom OpenAPI keywords', () => {
      // Test that custom keywords are added without throwing errors
      const schema = {
        type: 'object',
        properties: {
          id: { type: 'string', readOnly: true },
          password: { type: 'string', writeOnly: true }
        },
        discriminator: { propertyName: 'type' },
        deprecated: true
      };

      expect(() => {
        schemaValidator.ajv.compile(schema);
      }).not.toThrow();
    });
  });

  describe('Response Validation', () => {
    test('should return empty array for valid data', async () => {
      const schema = {
        type: 'object',
        properties: {
          name: { type: 'string' },
          age: { type: 'number' }
        },
        required: ['name']
      };

      const data = { name: 'John', age: 30 };

      const issues = await schemaValidator.validateResponse(data, schema);

      expect(issues).toEqual([]);
    });

    test('should return issues for invalid data', async () => {
      const schema = {
        type: 'object',
        properties: {
          name: { type: 'string' },
          age: { type: 'number' }
        },
        required: ['name']
      };

      const data = { age: 30 }; // Missing required 'name'

      const issues = await schemaValidator.validateResponse(data, schema);

      expect(issues).toHaveLength(1);
      expect(issues[0].type).toBe('missing_field');
      expect(issues[0].field).toBe('name');
      expect(issues[0].message).toContain("Required field 'name' is missing");
    });

    test('should handle schema compilation errors', async () => {
      const invalidSchema = {
        type: 'invalid_type' // This should cause compilation error
      };

      const data = { test: 'value' };

      const issues = await schemaValidator.validateResponse(data, invalidSchema);

      expect(issues).toHaveLength(1);
      expect(issues[0].type).toBe('schema_compilation_error');
      expect(issues[0].field).toBe(null);
      expect(issues[0].message).toContain('Failed to compile schema:');
    });
  });

  describe('Schema Validation Integration', () => {
    test('should detect required field violations', async () => {
      const schema = {
        type: 'object',
        properties: {
          name: { type: 'string' },
          email: { type: 'string' }
        },
        required: ['name', 'email']
      };

      const data = { name: 'John' }; // Missing email

      const issues = await schemaValidator.validateResponse(data, schema);

      expect(issues).toHaveLength(1);
      expect(issues[0].type).toBe('missing_field');
      expect(issues[0].field).toBe('email');
      expect(issues[0].message).toContain("Required field 'email' is missing");
    });

    test('should detect type mismatch violations', async () => {
      const schema = {
        type: 'object',
        properties: {
          age: { type: 'number' }
        },
        required: ['age']
      };

      const data = { age: 'thirty' }; // Should be number

      const issues = await schemaValidator.validateResponse(data, schema);

      expect(issues).toHaveLength(1);
      expect(issues[0].type).toBe('type_mismatch');
      expect(issues[0].field).toBe('age');
      expect(issues[0].message).toContain("should be number but got string");
    });

    test('should detect format violations', async () => {
      const schema = {
        type: 'object',
        properties: {
          email: { type: 'string', format: 'email' }
        },
        required: ['email']
      };

      const data = { email: 'invalid-email' };

      const issues = await schemaValidator.validateResponse(data, schema);

      expect(issues).toHaveLength(1);
      expect(issues[0].type).toBe('format_mismatch');
      expect(issues[0].field).toBe('email');
      expect(issues[0].message).toContain("does not match format 'email'");
    });

    test('should detect enum violations', async () => {
      const schema = {
        type: 'object',
        properties: {
          status: {
            type: 'string',
            enum: ['active', 'inactive', 'pending']
          }
        },
        required: ['status']
      };

      const data = { status: 'unknown' };

      const issues = await schemaValidator.validateResponse(data, schema);

      expect(issues).toHaveLength(1);
      expect(issues[0].type).toBe('enum_violation');
      expect(issues[0].field).toBe('status');
      expect(issues[0].message).toContain("must be one of: active, inactive, pending");
    });

    test('should detect range violations', async () => {
      const schema = {
        type: 'object',
        properties: {
          age: {
            type: 'number',
            minimum: 0
          }
        },
        required: ['age']
      };

      const data = { age: -5 };

      const issues = await schemaValidator.validateResponse(data, schema);

      expect(issues).toHaveLength(1);
      expect(issues[0].type).toBe('range_violation');
      expect(issues[0].field).toBe('age');
      expect(issues[0].message).toContain("must be >= 0");
    });

    test('should detect length violations', async () => {
      const schema = {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            minLength: 3
          }
        },
        required: ['name']
      };

      const data = { name: 'Jo' };

      const issues = await schemaValidator.validateResponse(data, schema);

      expect(issues).toHaveLength(1);
      expect(issues[0].type).toBe('length_violation');
      expect(issues[0].field).toBe('name');
      expect(issues[0].message).toContain("must NOT have fewer than 3 characters");
    });

    test('should detect additional properties violations', async () => {
      const schema = {
        type: 'object',
        properties: {
          name: { type: 'string' }
        },
        additionalProperties: false,
        required: ['name']
      };

      const data = { name: 'John', unexpectedField: 'value' };

      const issues = await schemaValidator.validateResponse(data, schema);

      expect(issues).toHaveLength(1);
      expect(issues[0].type).toBe('unexpected_field');
      expect(issues[0].field).toBe('unexpectedField');
      expect(issues[0].message).toContain("Unexpected field 'unexpectedField' found");
    });

    test('should detect array length violations', async () => {
      const schema = {
        type: 'object',
        properties: {
          tags: {
            type: 'array',
            items: { type: 'string' },
            minItems: 2
          }
        },
        required: ['tags']
      };

      const data = { tags: ['tag1'] };

      const issues = await schemaValidator.validateResponse(data, schema);

      expect(issues).toHaveLength(1);
      expect(issues[0].type).toBe('array_length_violation');
      expect(issues[0].field).toBe('tags');
      expect(issues[0].message).toContain("must NOT have fewer than 2 items");
    });
  });

  describe('Field Path Utilities', () => {
    test('should extract field name from path', () => {
      expect(schemaValidator.extractFieldName('/user/name')).toBe('name');
      expect(schemaValidator.extractFieldName('/items/0/title')).toBe('title');
      expect(schemaValidator.extractFieldName('name')).toBe('name');
      expect(schemaValidator.extractFieldName('')).toBe('root');
      expect(schemaValidator.extractFieldName(null)).toBe('root');
    });

    test('should get field value from data using path', () => {
      const data = {
        user: {
          name: 'John',
          addresses: [
            { street: '123 Main St' },
            { street: '456 Oak Ave' }
          ]
        },
        tags: ['tag1', 'tag2']
      };

      expect(schemaValidator.getFieldValue(data, '/user/name')).toBe('John');
      expect(schemaValidator.getFieldValue(data, '/user/addresses/0/street')).toBe('123 Main St');
      expect(schemaValidator.getFieldValue(data, '/user/addresses/1/street')).toBe('456 Oak Ave');
      expect(schemaValidator.getFieldValue(data, '/tags/0')).toBe('tag1');
      expect(schemaValidator.getFieldValue(data, '/nonexistent')).toBe(undefined);
      expect(schemaValidator.getFieldValue(data, '')).toBe(data);
    });

    test('should handle null/undefined data in field value extraction', () => {
      expect(schemaValidator.getFieldValue(null, '/field')).toBe(undefined);
      expect(schemaValidator.getFieldValue(undefined, '/field')).toBe(undefined);
      expect(schemaValidator.getFieldValue({ field: null }, '/field/subfield')).toBe(undefined);
    });
  });

  describe('Sample Data Generation', () => {
    test('should generate sample data for object schema', () => {
      const schema = {
        type: 'object',
        properties: {
          name: { type: 'string' },
          age: { type: 'number' },
          email: { type: 'string', format: 'email' }
        },
        required: ['name']
      };

      const sample = schemaValidator.generateSampleData(schema);

      expect(sample).toHaveProperty('name');
      expect(typeof sample.name).toBe('string');
      expect(sample.email).toBe('test@example.com');
    });

    test('should generate sample data for array schema', () => {
      const schema = {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' }
          }
        },
        minItems: 1,
        maxItems: 3
      };

      const sample = schemaValidator.generateSampleData(schema);

      expect(Array.isArray(sample)).toBe(true);
      expect(sample.length).toBeGreaterThanOrEqual(1);
      expect(sample.length).toBeLessThanOrEqual(3);
      expect(sample[0]).toHaveProperty('id');
      expect(sample[0]).toHaveProperty('name');
    });

    test('should generate sample data for string with specific formats', () => {
      const testCases = [
        { format: 'email', expected: 'test@example.com' },
        { format: 'date', expected: '2023-01-01' },
        { format: 'date-time', expected: '2023-01-01T00:00:00Z' },
        { format: 'uri', expected: 'https://example.com' },
        { format: 'uuid', expected: '123e4567-e89b-12d3-a456-426614174000' }
      ];

      testCases.forEach(({ format, expected }) => {
        const schema = { type: 'string', format };
        const sample = schemaValidator.generateSampleData(schema);
        expect(sample).toBe(expected);
      });
    });

    test('should use enum values when available', () => {
      const schema = {
        type: 'string',
        enum: ['active', 'inactive', 'pending']
      };

      const sample = schemaValidator.generateSampleData(schema);
      expect(sample).toBe('active');
    });

    test('should use example values when provided', () => {
      const schema = {
        type: 'object',
        properties: {
          name: { type: 'string', example: 'Example Name' },
          count: { type: 'number', example: 42 }
        },
        example: { name: 'Full Example', count: 100 }
      };

      const sample = schemaValidator.generateSampleData(schema);
      expect(sample).toEqual({ name: 'Full Example', count: 100 });
    });

    test('should use default values when provided', () => {
      const schema = {
        type: 'object',
        properties: {
          name: { type: 'string', default: 'Default Name' },
          active: { type: 'boolean', default: true }
        }
      };

      const sample = schemaValidator.generateSampleData(schema);
      expect(sample.name).toBe('Default Name');
      expect(sample.active).toBe(true);
    });

    test('should handle oneOf/anyOf schemas', () => {
      const schema = {
        oneOf: [
          { type: 'string' },
          { type: 'number' }
        ]
      };

      const sample = schemaValidator.generateSampleData(schema);
      expect(typeof sample).toBe('string');
    });

    test('should generate numbers within constraints', () => {
      const schema = {
        type: 'integer',
        minimum: 10,
        maximum: 20
      };

      const sample = schemaValidator.generateSampleData(schema);
      expect(sample).toBeGreaterThanOrEqual(10);
      expect(sample).toBeLessThanOrEqual(20);
      expect(Number.isInteger(sample)).toBe(true);
    });

    test('should generate strings with length constraints', () => {
      const schema = {
        type: 'string',
        minLength: 5,
        maxLength: 10
      };

      const sample = schemaValidator.generateSampleData(schema);
      expect(sample.length).toBeGreaterThanOrEqual(5);
      expect(sample.length).toBeLessThanOrEqual(10);
    });

    test('should handle deep nesting with recursion limit', () => {
      const schema = {
        type: 'object',
        properties: {
          nested: {
            type: 'object',
            properties: {
              deeplyNested: {
                type: 'object',
                properties: {
                  veryDeep: { type: 'string' }
                }
              }
            }
          }
        }
      };

      const sample = schemaValidator.generateSampleData(schema);
      expect(sample).toHaveProperty('nested');
      expect(sample.nested).toHaveProperty('deeplyNested');
    });

    test('should handle generation errors gracefully', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      // Force an error by providing invalid schema that causes generation to fail
      const invalidSchema = { type: 'object' };
      Object.defineProperty(invalidSchema, 'properties', {
        get() { throw new Error('Forced error'); }
      });

      const sample = schemaValidator.generateSampleData(invalidSchema);

      expect(sample).toBe(null);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to generate sample data:')
      );

      consoleSpy.mockRestore();
    });
  });

  describe('Schema Validation Utilities', () => {
    test('should validate valid schemas', () => {
      const validSchema = {
        type: 'object',
        properties: {
          name: { type: 'string' },
          age: { type: 'number' }
        }
      };

      expect(schemaValidator.isValidSchema(validSchema)).toBe(true);
    });

    test('should reject invalid schemas', () => {
      const invalidSchema = {
        type: 'invalid_type'
      };

      expect(schemaValidator.isValidSchema(invalidSchema)).toBe(false);
    });

    test('should return schema errors for invalid schemas', () => {
      const invalidSchema = {
        type: 'invalid_type'
      };

      const errors = schemaValidator.getSchemaErrors(invalidSchema);
      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain('must be equal to one of the allowed values');
    });

    test('should return empty errors for valid schemas', () => {
      const validSchema = {
        type: 'object',
        properties: {
          name: { type: 'string' }
        }
      };

      const errors = schemaValidator.getSchemaErrors(validSchema);
      expect(errors).toEqual([]);
    });
  });
});