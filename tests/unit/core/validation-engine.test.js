import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { writeFileSync, existsSync, mkdirSync, rmSync } from 'fs';
import APIValidator from '../../../src/core/validator.js';
import SchemaValidator from '../../../src/core/schema-validator.js';
import HttpClient from '../../../src/core/http-client.js';
import ValidationResults from '../../../src/core/validation-results.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('Validation Engine Tests', () => {
  let tempDir;
  let contractPath;
  let mockServer;

  beforeEach(() => {
    tempDir = join(__dirname, '../temp', `validation-${Date.now()}`);
    mkdirSync(tempDir, { recursive: true });
    contractPath = join(tempDir, 'test-contract.yaml');

    // Create a test OpenAPI contract
    writeFileSync(contractPath, `
openapi: 3.0.0
info:
  title: Test API
  version: 1.0.0
paths:
  /users:
    get:
      responses:
        '200':
          description: List users
          content:
            application/json:
              schema:
                type: array
                items:
                  type: object
                  properties:
                    id:
                      type: integer
                    name:
                      type: string
                      minLength: 1
                    email:
                      type: string
                      format: email
                    active:
                      type: boolean
                  required: [id, name, email]
        '500':
          description: Server error
    post:
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                name:
                  type: string
                  minLength: 1
                email:
                  type: string
                  format: email
              required: [name, email]
      responses:
        '201':
          description: User created
          content:
            application/json:
              schema:
                type: object
                properties:
                  id:
                    type: integer
                  name:
                    type: string
                  email:
                    type: string
                  active:
                    type: boolean
                required: [id, name, email]
  /users/{id}:
    get:
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: integer
      responses:
        '200':
          description: Get user
          content:
            application/json:
              schema:
                type: object
                properties:
                  id:
                    type: integer
                  name:
                    type: string
                  email:
                    type: string
                    format: email
                  active:
                    type: boolean
                required: [id, name, email]
        '404':
          description: User not found
components:
  schemas:
    User:
      type: object
      properties:
        id:
          type: integer
        name:
          type: string
        email:
          type: string
          format: email
        active:
          type: boolean
      required: [id, name, email]
    `.trim());
  });

  afterEach(() => {
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
    if (mockServer) {
      mockServer.close();
    }
  });

  describe('APIValidator', () => {
    test('should initialize with contract and discover endpoints', async () => {
      const validator = new APIValidator(contractPath, 'https://api.example.com');
      await validator.initialize();

      expect(validator.contract).toBeDefined();
      expect(validator.endpoints).toBeDefined();
      expect(validator.endpoints).toHaveLength(3); // GET /users, POST /users, GET /users/{id}
    });

    test('should throw error when contract file does not exist', async () => {
      const validator = new APIValidator('/nonexistent/contract.yaml', 'https://api.example.com');

      await expect(validator.initialize()).rejects.toThrow('Failed to initialize validator');
    });

    test('should find endpoint definition', async () => {
      const validator = new APIValidator(contractPath, 'https://api.example.com');
      await validator.initialize();

      const endpoint = validator.findEndpoint('/users', 'GET');
      expect(endpoint).toBeDefined();
      expect(endpoint.path).toBe('/users');
      expect(endpoint.method).toBe('GET');

      const missingEndpoint = validator.findEndpoint('/nonexistent', 'GET');
      expect(missingEndpoint).toBeUndefined();
    });

    test('should resolve path parameters', async () => {
      const validator = new APIValidator(contractPath, 'https://api.example.com');
      await validator.initialize();

      const resolved = validator.resolvePath('/users/{id}', { id: 123 });
      expect(resolved).toBe('/users/123');

      expect(() => {
        validator.resolvePath('/users/{id}', {});
      }).toThrow('Unresolved path parameters');
    });

    test('should generate request body from schema', async () => {
      const validator = new APIValidator(contractPath, 'https://api.example.com');
      await validator.initialize();

      const endpoint = validator.findEndpoint('/users', 'POST');
      const requestBody = await validator.generateRequestBody(endpoint);

      expect(requestBody).toBeDefined();
      expect(requestBody).toHaveProperty('name');
      expect(requestBody).toHaveProperty('email');
      expect(typeof requestBody.name).toBe('string');
      expect(typeof requestBody.email).toBe('string');
    });

    test('should validate endpoint not found', async () => {
      const validator = new APIValidator(contractPath, 'https://api.example.com');
      await validator.initialize();

      const result = await validator.validateEndpoint('/nonexistent', 'GET');

      expect(result.success).toBe(false);
      expect(result.issues).toHaveLength(1);
      expect(result.issues[0].type).toBe('endpoint_not_found');
    });

    test('should throw error when not initialized', async () => {
      const validator = new APIValidator(contractPath, 'https://api.example.com');

      await expect(validator.validateEndpoint('/users', 'GET')).rejects.toThrow('Validator not initialized');
    });

    test('should get validation statistics', () => {
      const results = [
        ValidationResults.createResult('/users', 'GET', true, 200, []),
        ValidationResults.createResult('/users', 'POST', false, 400, [
          ValidationResults.createIssue('missing_field', 'name', 'Required field missing')
        ]),
        ValidationResults.createResult('/users/123', 'GET', false, 500, [
          ValidationResults.createIssue('network_error', null, 'Connection failed')
        ])
      ];

      const stats = APIValidator.getValidationStats(results);

      expect(stats.total).toBe(3);
      expect(stats.passed).toBe(1);
      expect(stats.failed).toBe(2);
      expect(stats.totalIssues).toBe(2);
      expect(stats.successRate).toBe(33); // 1 passed out of 3 total = 33%
      expect(stats.issuesByType).toEqual({
        missing_field: 1,
        network_error: 1
      });
    });
  });

  describe('SchemaValidator', () => {
    let schemaValidator;

    beforeEach(() => {
      schemaValidator = new SchemaValidator();
    });

    test('should validate correct response data', async () => {
      const schema = {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          name: { type: 'string' },
          email: { type: 'string', format: 'email' }
        },
        required: ['id', 'name', 'email']
      };

      const validData = {
        id: 1,
        name: 'John Doe',
        email: 'john@example.com'
      };

      const issues = await schemaValidator.validateResponse(validData, schema);
      expect(issues).toHaveLength(0);
    });

    test('should detect missing required fields', async () => {
      const schema = {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          name: { type: 'string' },
          email: { type: 'string' }
        },
        required: ['id', 'name', 'email']
      };

      const invalidData = {
        id: 1,
        name: 'John Doe'
        // missing email
      };

      const issues = await schemaValidator.validateResponse(invalidData, schema);
      expect(issues).toHaveLength(1);
      expect(issues[0].type).toBe('missing_field');
      expect(issues[0].field).toBe('email');
    });

    test('should detect type mismatches', async () => {
      const schema = {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          name: { type: 'string' },
          active: { type: 'boolean' }
        },
        required: ['id', 'name', 'active']
      };

      const invalidData = {
        id: '1', // should be integer
        name: 123, // should be string
        active: 'true' // should be boolean
      };

      const issues = await schemaValidator.validateResponse(invalidData, schema);
      expect(issues).toHaveLength(3);

      const issueTypes = issues.map(issue => issue.type);
      expect(issueTypes).toContain('type_mismatch');
    });

    test('should detect format violations', async () => {
      const schema = {
        type: 'object',
        properties: {
          email: { type: 'string', format: 'email' },
          date: { type: 'string', format: 'date' }
        },
        required: ['email', 'date']
      };

      const invalidData = {
        email: 'not-an-email',
        date: 'not-a-date'
      };

      const issues = await schemaValidator.validateResponse(invalidData, schema);
      expect(issues).toHaveLength(2);

      const issueTypes = issues.map(issue => issue.type);
      expect(issueTypes).toContain('format_mismatch');
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

      const invalidData = {
        status: 'unknown'
      };

      const issues = await schemaValidator.validateResponse(invalidData, schema);
      expect(issues).toHaveLength(1);
      expect(issues[0].type).toBe('enum_violation');
    });

    test('should detect range violations', async () => {
      const schema = {
        type: 'object',
        properties: {
          age: {
            type: 'integer',
            minimum: 0,
            maximum: 120
          },
          score: {
            type: 'number',
            exclusiveMinimum: 0,
            exclusiveMaximum: 100
          }
        },
        required: ['age', 'score']
      };

      const invalidData = {
        age: -5,
        score: 100
      };

      const issues = await schemaValidator.validateResponse(invalidData, schema);
      expect(issues).toHaveLength(2);

      const issueTypes = issues.map(issue => issue.type);
      expect(issueTypes).toContain('range_violation');
    });

    test('should detect length violations', async () => {
      const schema = {
        type: 'object',
        properties: {
          username: {
            type: 'string',
            minLength: 3,
            maxLength: 20
          }
        },
        required: ['username']
      };

      const invalidData = {
        username: 'ab' // too short
      };

      const issues = await schemaValidator.validateResponse(invalidData, schema);
      expect(issues).toHaveLength(1);
      expect(issues[0].type).toBe('length_violation');
    });

    test('should generate sample data from schema', () => {
      const schema = {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          name: { type: 'string' },
          email: { type: 'string', format: 'email' },
          active: { type: 'boolean' },
          tags: {
            type: 'array',
            items: { type: 'string' }
          }
        },
        required: ['id', 'name', 'email']
      };

      const sampleData = schemaValidator.generateSampleData(schema);

      expect(sampleData).toBeDefined();
      expect(sampleData).toHaveProperty('id');
      expect(sampleData).toHaveProperty('name');
      expect(sampleData).toHaveProperty('email');
      expect(typeof sampleData.id).toBe('number');
      expect(typeof sampleData.name).toBe('string');
      expect(typeof sampleData.email).toBe('string');
      expect(sampleData.email).toContain('@');
    });

    test('should generate sample data with nested objects', () => {
      const schema = {
        type: 'object',
        properties: {
          user: {
            type: 'object',
            properties: {
              id: { type: 'integer' },
              profile: {
                type: 'object',
                properties: {
                  firstName: { type: 'string' },
                  lastName: { type: 'string' }
                },
                required: ['firstName']
              }
            },
            required: ['id', 'profile']
          }
        },
        required: ['user']
      };

      const sampleData = schemaValidator.generateSampleData(schema);

      expect(sampleData).toBeDefined();
      expect(sampleData.user).toBeDefined();
      expect(sampleData.user.id).toBeDefined();
      expect(sampleData.user.profile).toBeDefined();
      expect(sampleData.user.profile.firstName).toBeDefined();
    });

    test('should handle schema compilation errors', async () => {
      const invalidSchema = {
        type: 'object',
        properties: {
          id: { type: 'invalid-type' } // Invalid type
        }
      };

      const issues = await schemaValidator.validateResponse({ id: 1 }, invalidSchema);
      expect(issues).toHaveLength(1);
      expect(issues[0].type).toBe('schema_compilation_error');
    });

    test('should check if schema is valid', () => {
      const validSchema = {
        type: 'object',
        properties: {
          name: { type: 'string' }
        }
      };

      const invalidSchema = {
        type: 'object',
        properties: {
          name: { type: 'invalid-type' }
        }
      };

      expect(schemaValidator.isValidSchema(validSchema)).toBe(true);
      expect(schemaValidator.isValidSchema(invalidSchema)).toBe(false);
    });
  });

  describe('HttpClient', () => {
    test('should create client with base URL and headers', () => {
      const client = new HttpClient('https://api.example.com', {
        'Authorization': 'Bearer token',
        'X-Custom': 'value'
      });

      const config = client.getConfig();
      expect(config.baseURL).toBe('https://api.example.com');
      expect(config.defaultHeaders['Authorization']).toBe('Bearer token');
      expect(config.defaultHeaders['X-Custom']).toBe('value');
    });

    test('should build URL correctly', () => {
      const client = new HttpClient('https://api.example.com');

      const url1 = client.buildURL('/users');
      expect(url1).toBe('https://api.example.com/users');

      const url2 = client.buildURL('/users', { page: 1, limit: 10 });
      expect(url2).toBe('https://api.example.com/users?page=1&limit=10');

      const url3 = client.buildURL('https://other.example.com/data');
      expect(url3).toBe('https://other.example.com/data');
    });

    test('should handle query parameters correctly', () => {
      const client = new HttpClient('https://api.example.com');

      const url = client.buildURL('/search', {
        q: 'test query',
        tags: ['tag1', 'tag2'],
        active: true,
        page: 1,
        empty: null,
        undefined: undefined
      });

      expect(url).toMatch(/q=test(\+|%20)query/);
      expect(url).toContain('tags=tag1');
      expect(url).toContain('tags=tag2');
      expect(url).toContain('active=true');
      expect(url).toContain('page=1');
      expect(url).not.toContain('empty');
      expect(url).not.toContain('undefined');
    });

    test('should set and remove default headers', () => {
      const client = new HttpClient('https://api.example.com');

      client.setDefaultHeaders({
        'Authorization': 'Bearer token',
        'X-Version': '1.0'
      });

      let config = client.getConfig();
      expect(config.defaultHeaders['Authorization']).toBe('Bearer token');
      expect(config.defaultHeaders['X-Version']).toBe('1.0');

      client.removeDefaultHeader('Authorization');
      config = client.getConfig();
      expect(config.defaultHeaders['Authorization']).toBeUndefined();
      expect(config.defaultHeaders['X-Version']).toBe('1.0');
    });

    test('should update base URL', () => {
      const client = new HttpClient('https://api.example.com');

      client.setBaseURL('https://api2.example.com/');
      const config = client.getConfig();
      expect(config.baseURL).toBe('https://api2.example.com');
    });

    test('should throw error for relative path without base URL', () => {
      const client = new HttpClient();

      expect(() => {
        client.buildURL('/users');
      }).toThrow('Base URL is required for relative paths');
    });

    // Note: Testing actual HTTP requests would require a mock server
    // These tests focus on the client configuration and URL building logic
  });

  describe('ValidationResults', () => {
    test('should create standardized result object', () => {
      const result = ValidationResults.createResult(
        '/users',
        'GET',
        true,
        200,
        [],
        { responseTime: 150 }
      );

      expect(result.endpoint).toBe('/users');
      expect(result.method).toBe('GET');
      expect(result.success).toBe(true);
      expect(result.statusCode).toBe(200);
      expect(result.issues).toEqual([]);
      expect(result.metadata.responseTime).toBe(150);
      expect(result.timestamp).toBeDefined();
    });

    test('should create standardized issue object', () => {
      const issue = ValidationResults.createIssue(
        'missing_field',
        'email',
        'Required field missing',
        { schemaPath: '/properties/email' }
      );

      expect(issue.type).toBe('missing_field');
      expect(issue.field).toBe('email');
      expect(issue.message).toBe('Required field missing');
      expect(issue.severity).toBe('error');
      expect(issue.details.schemaPath).toBe('/properties/email');
    });

    test('should assign correct severity levels', () => {
      expect(ValidationResults.getSeverityForType('missing_field')).toBe('error');
      expect(ValidationResults.getSeverityForType('type_mismatch')).toBe('error');
      expect(ValidationResults.getSeverityForType('unexpected_status_code')).toBe('warning');
      expect(ValidationResults.getSeverityForType('format_mismatch')).toBe('warning');
      expect(ValidationResults.getSeverityForType('enum_violation')).toBe('info');
      expect(ValidationResults.getSeverityForType('unknown_type')).toBe('info');
    });

    test('should generate console output', () => {
      const results = [
        ValidationResults.createResult('/users', 'GET', true, 200, []),
        ValidationResults.createResult('/users', 'POST', false, 400, [
          ValidationResults.createIssue('missing_field', 'email', 'Required field missing'),
          ValidationResults.createIssue('type_mismatch', 'age', 'Expected number but got string')
        ])
      ];

      const output = ValidationResults.formatConsoleOutput(results);

      expect(output).toContain('API Validation Results');
      expect(output).toContain('Total: 2');
      expect(output).toContain('Passed: 1');
      expect(output).toContain('Failed: 1');
      expect(output).toContain('GET');
      expect(output).toContain('POST');
      expect(output).toContain('/users');
      expect(output).toContain('Required field missing');
      expect(output).toContain('Expected number but got string');
    });

    test('should generate JSON output', () => {
      const results = [
        ValidationResults.createResult('/users', 'GET', true, 200, [])
      ];

      const output = ValidationResults.formatJsonOutput(results);
      const parsed = JSON.parse(output);

      expect(parsed.success).toBe(true);
      expect(parsed.summary).toBeDefined();
      expect(parsed.summary.total).toBe(1);
      expect(parsed.summary.passed).toBe(1);
      expect(parsed.summary.failed).toBe(0);
      expect(parsed.failures).toHaveLength(0);
    });

    test('should generate markdown report', () => {
      const results = [
        ValidationResults.createResult('/users', 'GET', true, 200, []),
        ValidationResults.createResult('/users', 'POST', false, 400, [
          ValidationResults.createIssue('missing_field', 'email', 'Required field missing')
        ])
      ];

      const output = ValidationResults.formatMarkdownReport(results, {
        title: 'Test Report'
      });

      expect(output).toContain('# Test Report');
      expect(output).toContain('## Summary');
      expect(output).toContain('**Total Endpoints:** 2');
      expect(output).toContain('**Passed:** 1');
      expect(output).toContain('**Failed:** 1');
      expect(output).toContain('## Issues by Type');
      expect(output).toContain('## Detailed Results');
    });

    test('should calculate statistics correctly', () => {
      const results = [
        ValidationResults.createResult('/users', 'GET', true, 200, [], { responseTime: 100 }),
        ValidationResults.createResult('/users', 'POST', false, 400, [
          ValidationResults.createIssue('missing_field', 'email', 'Required field missing'),
          ValidationResults.createIssue('type_mismatch', 'age', 'Type mismatch')
        ], { responseTime: 200 }),
        ValidationResults.createResult('/users/123', 'GET', true, 200, [], { responseTime: 150 })
      ];

      const stats = ValidationResults.getResultsStats(results);

      expect(stats.total).toBe(3);
      expect(stats.passed).toBe(2);
      expect(stats.failed).toBe(1);
      expect(stats.totalIssues).toBe(2);
      expect(stats.successRate).toBe(67);
      expect(stats.avgResponseTime).toBe(150);
      expect(stats.issuesByType).toEqual({
        missing_field: 1,
        type_mismatch: 1
      });
    });

    test('should filter results by criteria', () => {
      const results = [
        ValidationResults.createResult('/users', 'GET', true, 200, []),
        ValidationResults.createResult('/users', 'POST', false, 400, [
          ValidationResults.createIssue('missing_field', 'email', 'Required field missing')
        ]),
        ValidationResults.createResult('/posts', 'GET', true, 200, []),
        ValidationResults.createResult('/posts', 'DELETE', false, 500, [
          ValidationResults.createIssue('network_error', null, 'Connection failed')
        ])
      ];

      // Filter by success
      const failed = ValidationResults.filter(results, { success: false });
      expect(failed).toHaveLength(2);

      // Filter by method
      const getResults = ValidationResults.filter(results, { method: 'GET' });
      expect(getResults).toHaveLength(2);

      // Filter by endpoint
      const userResults = ValidationResults.filter(results, { endpoint: 'users' });
      expect(userResults).toHaveLength(2);

      // Filter by issue types
      const networkErrors = ValidationResults.filter(results, {
        issueTypes: ['network_error']
      });
      expect(networkErrors).toHaveLength(1);

      // Filter by having issues
      const withIssues = ValidationResults.filter(results, { hasIssues: true });
      expect(withIssues).toHaveLength(2);
    });

    test('should export in different formats', () => {
      const results = [
        ValidationResults.createResult('/users', 'GET', true, 200, [])
      ];

      const consoleOutput = ValidationResults.export(results, 'console');
      expect(consoleOutput).toContain('API Validation Results');

      const jsonOutput = ValidationResults.export(results, 'json');
      expect(() => JSON.parse(jsonOutput)).not.toThrow();

      const markdownOutput = ValidationResults.export(results, 'markdown');
      expect(markdownOutput).toContain('# API Validation Report');
    });
  });
});