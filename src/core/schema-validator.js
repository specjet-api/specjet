import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import ValidationResults from './validation-results.js';

/**
 * Schema Validator using AJV for OpenAPI schema validation
 * Handles JSON Schema validation and generates sample data
 */
class SchemaValidator {
  constructor() {
    this.ajv = new Ajv({
      allErrors: true,
      verbose: true,
      strict: false,
      removeAdditional: false
    });

    // Add format validation (email, date-time, etc.)
    addFormats(this.ajv);

    // Add custom keywords for OpenAPI extensions
    this.addCustomKeywords();
  }

  /**
   * Validate response data against OpenAPI schema
   * @param {*} data - Response data to validate
   * @param {Object} schema - OpenAPI schema definition
   * @returns {Array} Array of validation issues
   */
  async validateResponse(data, schema) {
    try {
      const validate = this.ajv.compile(schema);
      const isValid = validate(data);

      if (isValid) {
        return [];
      }

      return this.convertAjvErrorsToIssues(validate.errors, data);
    } catch (error) {
      return [ValidationResults.createIssue(
        'schema_compilation_error',
        null,
        `Failed to compile schema: ${error.message}`,
        { schemaError: error.message }
      )];
    }
  }

  /**
   * Convert AJV validation errors to validation issues
   * @private
   */
  convertAjvErrorsToIssues(ajvErrors, data) {
    const issues = [];

    for (const error of ajvErrors) {
      const issue = this.createIssueFromAjvError(error, data);
      if (issue) {
        issues.push(issue);
      }
    }

    return issues;
  }

  /**
   * Create a validation issue from an AJV error
   * @private
   */
  createIssueFromAjvError(error, data) {
    const fieldPath = error.instancePath || error.schemaPath;
    const fieldName = this.extractFieldName(fieldPath);

    switch (error.keyword) {
      case 'required':
        return ValidationResults.createIssue(
          'missing_field',
          error.params.missingProperty,
          `Required field '${error.params.missingProperty}' is missing`,
          {
            fieldPath: fieldPath,
            schemaPath: error.schemaPath
          }
        );

      case 'type':
        return ValidationResults.createIssue(
          'type_mismatch',
          fieldName,
          `Field '${fieldName}' should be ${error.params.type} but got ${typeof this.getFieldValue(data, fieldPath)}`,
          {
            expected: error.params.type,
            actual: typeof this.getFieldValue(data, fieldPath),
            fieldPath: fieldPath,
            value: this.getFieldValue(data, fieldPath)
          }
        );

      case 'format':
        return ValidationResults.createIssue(
          'format_mismatch',
          fieldName,
          `Field '${fieldName}' does not match format '${error.params.format}'`,
          {
            expectedFormat: error.params.format,
            actualValue: this.getFieldValue(data, fieldPath),
            fieldPath: fieldPath
          }
        );

      case 'enum':
        return ValidationResults.createIssue(
          'enum_violation',
          fieldName,
          `Field '${fieldName}' must be one of: ${error.params.allowedValues.join(', ')}`,
          {
            allowedValues: error.params.allowedValues,
            actualValue: this.getFieldValue(data, fieldPath),
            fieldPath: fieldPath
          }
        );

      case 'minimum':
      case 'maximum':
      case 'exclusiveMinimum':
      case 'exclusiveMaximum':
        return ValidationResults.createIssue(
          'range_violation',
          fieldName,
          `Field '${fieldName}' ${error.message}`,
          {
            constraint: error.keyword,
            limit: error.params.limit,
            actualValue: this.getFieldValue(data, fieldPath),
            fieldPath: fieldPath
          }
        );

      case 'minLength':
      case 'maxLength':
        return ValidationResults.createIssue(
          'length_violation',
          fieldName,
          `Field '${fieldName}' ${error.message}`,
          {
            constraint: error.keyword,
            limit: error.params.limit,
            actualLength: this.getFieldValue(data, fieldPath)?.length,
            fieldPath: fieldPath
          }
        );

      case 'pattern':
        return ValidationResults.createIssue(
          'pattern_violation',
          fieldName,
          `Field '${fieldName}' does not match required pattern`,
          {
            pattern: error.params.pattern,
            actualValue: this.getFieldValue(data, fieldPath),
            fieldPath: fieldPath
          }
        );

      case 'additionalProperties':
        return ValidationResults.createIssue(
          'unexpected_field',
          error.params.additionalProperty,
          `Unexpected field '${error.params.additionalProperty}' found`,
          {
            fieldPath: fieldPath,
            unexpectedField: error.params.additionalProperty
          }
        );

      case 'minItems':
      case 'maxItems':
        return ValidationResults.createIssue(
          'array_length_violation',
          fieldName,
          `Array '${fieldName}' ${error.message}`,
          {
            constraint: error.keyword,
            limit: error.params.limit,
            actualLength: this.getFieldValue(data, fieldPath)?.length,
            fieldPath: fieldPath
          }
        );

      default:
        return ValidationResults.createIssue(
          'schema_violation',
          fieldName,
          error.message || `Schema validation failed for '${fieldName}'`,
          {
            keyword: error.keyword,
            params: error.params,
            fieldPath: fieldPath,
            schemaPath: error.schemaPath
          }
        );
    }
  }

  /**
   * Extract field name from JSON path
   * @private
   */
  extractFieldName(path) {
    if (!path) return 'root';

    // Remove leading slash and get the last segment
    const segments = path.replace(/^\//, '').split('/');
    return segments[segments.length - 1] || 'root';
  }

  /**
   * Get field value from data using JSON path
   * @private
   */
  getFieldValue(data, path) {
    if (!path || path === '') return data;

    const segments = path.replace(/^\//, '').split('/');
    let current = data;

    for (const segment of segments) {
      if (current == null) return undefined;

      // Handle array indices
      if (/^\d+$/.test(segment)) {
        current = current[parseInt(segment)];
      } else {
        current = current[segment];
      }
    }

    return current;
  }

  /**
   * Generate sample data that conforms to a schema
   * @param {Object} schema - OpenAPI schema definition
   * @returns {*} Generated sample data
   */
  generateSampleData(schema) {
    try {
      return this.generateValueFromSchema(schema);
    } catch (error) {
      console.warn(`⚠️  Failed to generate sample data: ${error.message}`);
      return null;
    }
  }

  /**
   * Generate a value from a schema definition
   * @private
   */
  generateValueFromSchema(schema, depth = 0) {
    // Prevent infinite recursion
    if (depth > 10) {
      return null;
    }

    // Handle schema references (shouldn't happen after dereferencing, but just in case)
    if (schema.$ref) {
      console.warn('Encountered $ref in schema - this should have been resolved');
      return null;
    }

    // Handle oneOf/anyOf by using the first option
    if (schema.oneOf && schema.oneOf.length > 0) {
      return this.generateValueFromSchema(schema.oneOf[0], depth + 1);
    }

    if (schema.anyOf && schema.anyOf.length > 0) {
      return this.generateValueFromSchema(schema.anyOf[0], depth + 1);
    }

    // Use example if provided
    if (schema.example !== undefined) {
      return schema.example;
    }

    // Use default if provided
    if (schema.default !== undefined) {
      return schema.default;
    }

    // Generate based on type
    switch (schema.type) {
      case 'object':
        return this.generateObjectValue(schema, depth);

      case 'array':
        return this.generateArrayValue(schema, depth);

      case 'string':
        return this.generateStringValue(schema);

      case 'number':
      case 'integer':
        return this.generateNumberValue(schema);

      case 'boolean':
        return true;

      case 'null':
        return null;

      default:
        // If type is not specified, try to infer from other properties
        if (schema.properties) {
          return this.generateObjectValue(schema, depth);
        }
        if (schema.items) {
          return this.generateArrayValue(schema, depth);
        }
        return null;
    }
  }

  /**
   * Generate object value from schema
   * @private
   */
  generateObjectValue(schema, depth) {
    const obj = {};
    const properties = schema.properties || {};
    const required = schema.required || [];

    // Generate required properties
    for (const propName of required) {
      const propSchema = properties[propName];
      if (propSchema) {
        obj[propName] = this.generateValueFromSchema(propSchema, depth + 1);
      }
    }

    // Generate some optional properties (max 3 to keep objects manageable)
    const optionalProps = Object.keys(properties).filter(prop => !required.includes(prop));
    const optionalToGenerate = optionalProps.slice(0, 3);

    for (const propName of optionalToGenerate) {
      const propSchema = properties[propName];
      if (propSchema) {
        obj[propName] = this.generateValueFromSchema(propSchema, depth + 1);
      }
    }

    return obj;
  }

  /**
   * Generate array value from schema
   * @private
   */
  generateArrayValue(schema, depth) {
    if (!schema.items) {
      return [];
    }

    // Generate 1-3 items for arrays
    const minItems = schema.minItems || 1;
    const maxItems = Math.min(schema.maxItems || 3, 3);
    const itemCount = Math.max(minItems, Math.min(maxItems, 2));

    const array = [];
    for (let i = 0; i < itemCount; i++) {
      array.push(this.generateValueFromSchema(schema.items, depth + 1));
    }

    return array;
  }

  /**
   * Generate string value from schema
   * @private
   */
  generateStringValue(schema) {
    // Handle specific formats
    if (schema.format) {
      switch (schema.format) {
        case 'email':
          return 'test@example.com';
        case 'date':
          return '2023-01-01';
        case 'date-time':
          return '2023-01-01T00:00:00Z';
        case 'uri':
        case 'url':
          return 'https://example.com';
        case 'uuid':
          return '123e4567-e89b-12d3-a456-426614174000';
        case 'password':
          return 'password123';
        case 'byte':
          return 'aGVsbG8gd29ybGQ=';
        case 'binary':
          return 'binary_data';
      }
    }

    // Handle enum
    if (schema.enum && schema.enum.length > 0) {
      return schema.enum[0];
    }

    // Handle pattern (generate a simple string that might match)
    if (schema.pattern) {
      // For common patterns, return reasonable defaults
      if (schema.pattern.includes('\\d')) {
        return '123';
      }
      if (schema.pattern.includes('[a-zA-Z]')) {
        return 'abc';
      }
    }

    // Generate string based on length constraints
    const minLength = schema.minLength || 1;
    const maxLength = Math.min(schema.maxLength || 20, 20);
    const targetLength = Math.max(minLength, Math.min(maxLength, 10));

    return 'sample_' + 'x'.repeat(Math.max(0, targetLength - 7));
  }

  /**
   * Generate number value from schema
   * @private
   */
  generateNumberValue(schema) {
    // Handle enum
    if (schema.enum && schema.enum.length > 0) {
      return schema.enum[0];
    }

    let min = schema.minimum !== undefined ? schema.minimum : 0;
    let max = schema.maximum !== undefined ? schema.maximum : 100;

    // Handle exclusive bounds
    if (schema.exclusiveMinimum !== undefined) {
      min = schema.exclusiveMinimum + (schema.type === 'integer' ? 1 : 0.1);
    }
    if (schema.exclusiveMaximum !== undefined) {
      max = schema.exclusiveMaximum - (schema.type === 'integer' ? 1 : 0.1);
    }

    // Generate a reasonable value within bounds
    const value = min + (max - min) * 0.5;

    return schema.type === 'integer' ? Math.round(value) : value;
  }

  /**
   * Add custom keywords for OpenAPI extensions
   * @private
   */
  addCustomKeywords() {
    // Add support for common OpenAPI keywords that AJV doesn't handle by default
    // Check if keyword already exists before adding
    const keywordsToAdd = [
      { keyword: 'discriminator', schemaType: 'object' },
      { keyword: 'readOnly', schemaType: 'boolean' },
      { keyword: 'writeOnly', schemaType: 'boolean' },
      { keyword: 'xml', schemaType: 'object' },
      { keyword: 'externalDocs', schemaType: 'object' },
      { keyword: 'deprecated', schemaType: 'boolean' }
    ];

    for (const keywordDef of keywordsToAdd) {
      try {
        this.ajv.addKeyword(keywordDef);
      } catch (error) {
        // Keyword already exists, skip it
        if (!error.message.includes('already defined')) {
          throw error;
        }
      }
    }

    // Note: x- extension keywords are typically ignored by AJV by default
    // We don't need to explicitly add them as they should be handled gracefully
  }

  /**
   * Check if a schema is valid and can be compiled
   * @param {Object} schema - Schema to validate
   * @returns {boolean} True if schema is valid
   */
  isValidSchema(schema) {
    try {
      this.ajv.compile(schema);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get schema compilation errors
   * @param {Object} schema - Schema to check
   * @returns {Array} Array of error messages
   */
  getSchemaErrors(schema) {
    try {
      this.ajv.compile(schema);
      return [];
    } catch (error) {
      return [error.message];
    }
  }
}

export default SchemaValidator;